const inspect      = Symbol.for('nodejs.util.inspect.custom');
const bindContext  = Symbol('bind.context');
const buildUpTree  = Symbol('build.up.tree');
const throwErrOnCD = Symbol('circular.dependency.check');

const EXISTS       = 0;
const INVALID_TYPE = 1;
const INVALID_NAME = 2;
const UNSUPPORTED  = 3;
const INCOMPLETE   = 4;
const NOT_CALLABLE = 5;
const CIRCULAR     = 6;
const PARSER_ERR   = 7;
const UNKNOWN      = 8;

const errMessages = [
  (msg) => `a module with "${msg}" name is already exists.`,
  (msg) => `invalid dependency type - "${msg}", expected a "function".`,
  ()    => "invalid dependency name. Expected a string.",
  (msg) => `got "${msg}" as a dependency evaluation result. Expected an object or a function.`,
  (msg) => `Proxy::${msg}::an attempt to use an incomplete dependency instance.`,
  (msg) => `Proxy::apply::"${msg}" is not a function".`,
  (msg) => `circular dependency detected: [${msg}].`,
  (msg) => `an invalid way of defining dependencies names => "(${msg})". ` +
           "Must be a plain comma separated list.",
  (msg) => `can't find a dependency with a given name: "${msg}".`,
];

function throwErr(errCode, message) {
  if (errCode !== null && errCode !== undefined) {
    message = errMessages[errCode](message)
  }
  throw new Error(`[DI Engine]::${message}`)
}

function errorWhenNotReady(obj, message, callback) {
  return (!obj.isReady()) ? throwErr(INCOMPLETE, message) : callback();
}

function isObject(obj) {
  return ["function", "object"].indexOf(typeof obj) != -1;
}

function isFunction(obj) {
  return (typeof obj) == "function";
}

/**
 * The purpose of inheritance from Function class is to support of object's
 * [[Call]] internal method interception.
 */
class Dependency extends Function {

  #depsNames          = [];
  #ready              = false;

  constructor(source, isMock) {
    super();
    this.data         = isFunction(source) ? source : () => source;
    this.mock         = isMock;
    this.#depsNames   = Dependency.getOwnDepsNames(this.data.toString());

    this[inspect]      = this[inspect].bind(this);
    this[bindContext]  = this[bindContext].bind(this);
    this[buildUpTree]  = this[buildUpTree].bind(this);
    this[throwErrOnCD] = this[throwErrOnCD].bind(this);
  }

  // Ensures that a dependency won't be used until its build up proceess finishes.
  isReady () { return this.#ready; }

  [bindContext] (ctx, name) {
    this[throwErrOnCD](name, ctx);
    if (this.#depsNames.length > 0) {
      this.data = this.data.bind(null, ...this.#depsNames.map(depName => ctx[depName]));
    }
  }

  [throwErrOnCD] (depName, diCtx, hierarchy) {
    if (this.#depsNames.indexOf(depName) != -1) {
      throwErr(CIRCULAR, Dependency.#depsTree(hierarchy, depName, depName))
    }
    this.#depsNames.forEach(name => {
      if (!diCtx[name]) {
        throwErr(UNKNOWN, name);
      }
      diCtx[name][throwErrOnCD](
        depName, diCtx, Dependency.#depsTree(hierarchy, name, depName)
      );
    });
  }

  [buildUpTree] (modules) {
    return Promise.all(
      this.#depsNames.map(name => modules[name][buildUpTree](modules))
    ).then(() => this.#instantiate());
  }

  // make it look prettier while logging an object instance
  [inspect]() { return this.data; }

  async #instantiate () {
    return (this.data.constructor == Promise || this.isReady()) ?
      this.data :
      this.data = new Promise(async (resolve, reject) => {
        try {
          const instance = await Dependency.#setUp(this.data);
          if (!isObject(instance)) {
            return reject(throwErr(UNSUPPORTED, typeof instance));
          }
          this.data = this.mock ? instance : Object.freeze(instance);
          this.#ready = true;
          resolve();
        } catch(e) { reject(e); }
      })
  }

  static #setUp(depSource) {
    switch (typeof depSource) {
      case "function": return depSource();
      case "object": return depSource;
    }
  }

  static #depsTree(msg, dep, root) {
    if (!msg) { msg = root; }
    return `${msg} => ${dep}`;
  }

  static getOwnDepsNames(funcAsStr) {
    const match = /\(([^\)]*)\)/.exec(funcAsStr);
    if (!match || !(match[1].length > 0)) { return []; }
    return !/\{/.test(match[1]) ?
      match[1].replace(/\s+/g, '').split(',') : throwErr(PARSER_ERR, match[1]);
  }
}

const proxyHandler = {
  get: (obj, prop) =>
    ([bindContext, throwErrOnCD, buildUpTree].indexOf(prop) != -1) ?
      obj[prop] :
      errorWhenNotReady(obj, "get", () =>
        Reflect.get(obj.data, prop, obj.data), prop // handling non object values
      ),

  set: (obj, prop, value) =>
    errorWhenNotReady(obj, "set", () => Reflect.set(obj.data, prop, value)),

  apply: (obj, thisArg, argumentsList) =>
    errorWhenNotReady(obj, "apply", () => (
      !isFunction(obj.data) ?
        throwErr(NOT_CALLABLE, "obj") :
        Reflect.apply(obj.data, thisArg, argumentsList)
    ))
};

function setProxy(source, isMock) {
  return isObject(source) ?
    new Proxy(
      new Dependency(source, isMock === true), proxyHandler
    ) : throwErr(UNSUPPORTED, source)
}

function asyncIterable(proxies, modules) {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        async next() {
          v = await proxies[i][buildUpTree](modules);
          i++;
          const done = i === (proxies.length);
          return { value: v, done };
        },
        return() { return { done: true }; },
      };
    },
  }
};

function context() {
  const modules = {};

  function register(name, dep) {
    if (modules[name]) { throwErr(EXISTS, name); }
    modules[name] = dep;
  }

  function checkBeforeRegister(name, value, isMock = false) {
    if (typeof name !== "string" || !(name.length > 0) ) {
      throwErr(INVALID_NAME);
    } else if (!isObject(value)) {
      throwErr(UNSUPPORTED, typeof value);
    }
    register(name, setProxy(value, isMock));
  }

  const options = {
    registerAll: (dependencies = {}) => {
      for (const [ depName, value ] of Object.entries(dependencies)) {
        !isFunction(value) ?
          throwErr(INVALID_TYPE, typeof value)
        : register(depName, setProxy(value));
      }
    },

    registerOne: (value = {}, name) =>
      checkBeforeRegister(name, value),

    registerMock: (name, value) =>
      checkBeforeRegister(name, value, true),

    invoke: async () => {
      const proxies = [];
      for (const [ name, dep ] of Object.entries(modules)) {
        dep[bindContext](modules, name);
        proxies.push(dep);
      }
      for await (const p of asyncIterable(proxies, modules)) {}
      return modules;
    }
  }

  return Object.freeze(options);
}

module.exports = {
  init: (callback) => callback(context())
}

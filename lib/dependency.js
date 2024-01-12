const { ErrorCode, throwErr }  = require("./error");
const { isFunction, isObject } = require("./util");

const inspect      = Symbol.for("nodejs.util.inspect.custom");
const bindContext  = Symbol("di.bind.context");
const buildUpTree  = Symbol("di.build.up.tree");
const throwErrOnCD = Symbol("di.circular.dependency.check");

function parseDepsNames(funcAsStr) {
  const fnProps = /\(([^\)]*)\)/.exec(funcAsStr);
  if (!fnProps || !(fnProps[1].length > 0)) { return []; }
  const objDestruction = /\{/;
  return !objDestruction.test(fnProps[1]) ?
    fnProps[1].replace(/\s+/g, '').split(',') :
    throwErr(ErrorCode.PARSER_ERR, fnProps[1]);
}

function depsTree(msg, dep, root) {
  if (!msg) { msg = root; }
  return `${msg} => ${dep}`;
}

/**
 * The purpose of inheritance from Function class is to support of object's
 * [[Call]] internal method interception.
 */
class Dependency extends Function {

  #depsNames          = [];
  #ready              = false;
  #mock               = false;

  constructor(source, isMock) {
    super();
    this.data         = isFunction(source) ? source : () => source;
    this.#mock        = isMock;
    this.#depsNames   = parseDepsNames(this.data.toString());

    this[inspect]      = this[inspect].bind(this);
    this[bindContext]  = this[bindContext].bind(this);
    this[buildUpTree]  = this[buildUpTree].bind(this);
    this[throwErrOnCD] = this[throwErrOnCD].bind(this);
  }

  getDepsNames() {
    return Array.from(this.#depsNames);
  }

  // Ensures that a dependency won't be used until its build up proceess finishes.
  isReady () {
    return this.#ready;
  }

  pathThrough (propName) {
    return [bindContext, throwErrOnCD, buildUpTree].indexOf(propName) == -1;
  }

  [bindContext] (ctx, name) {
    this[throwErrOnCD](name, ctx);
    if (this.getDepsNames().length > 0) {
      this.data = this.data.bind(null, ...this.getDepsNames().map(depName => ctx[depName]));
    }
  }

  [throwErrOnCD] (ownName, diCtx, nodePath) {
    if (this.getDepsNames().indexOf(ownName) != -1) {
      throwErr(ErrorCode.CIRCULAR, depsTree(nodePath, ownName, ownName))
    }
    this.getDepsNames().forEach(name =>
      diCtx[name] ?
        diCtx[name][throwErrOnCD](ownName, diCtx, depsTree(nodePath, name, ownName)) :
        throwErr(ErrorCode.UNKNOWN, name)
    );
  }

  [buildUpTree] (modules) {
    return Promise.all(
      this.getDepsNames().map(name => modules[name][buildUpTree](modules))
    ).then(() => this.#instantiate());
  }

  // make it look prettier while logging an object instance
  [inspect]() {
    return this.data;
  }

  async #instantiate () {
    return (this.data.constructor == Promise || this.isReady()) ?
      this.data :
      this.data = new Promise(async (resolve, reject) => {
        try {
          const instance = await Dependency.#setUp(this.data);
          if (!isObject(instance)) {
            let objType = typeof instance;
            if (instance === null) {
              objType = "null";
            }
            return reject(throwErr(ErrorCode.UNSUPPORTED, objType));
          }
          this.data = this.#mock ? instance : Object.freeze(instance);
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
};

module.exports = {
  Dependency,
  bindContext,
  throwErrOnCD,
  buildUpTree,
  parseDepsNames
};

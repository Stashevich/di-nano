const { ErrorCode, throwErr }  = require("./error");
const { isFunction, isObject } = require("./util");

const inspect = Symbol.for("nodejs.util.inspect.custom");

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

  #depsNames        = [];
  #ready            = false;
  #dname            = "";
  #data             = null;

  constructor(name, source) {
    super();
    this.#data      = isFunction(source) ? source : () => source;
    this.#dname     = name;
    this.#depsNames = parseDepsNames(this.#data.toString());

    this.cdCheck    = this.cdCheck.bind(this);
    this.getData    = this.getData.bind(this);
    this.getName    = this.getName.bind(this);
    this.buildUp    = this.buildUp.bind(this);
    this[inspect]   = this[inspect].bind(this);
  }

  getDepsNames() {
    return Array.from(this.#depsNames);
  }

  // Ensures that a dependency won't be used until its build up proceess finishes.
  isReady () {
    return this.#ready;
  }

  getData () {
    return this.isReady() ? this.#data : throwErr(ErrorCode.INCOMPLETE);
  }

  getName () {
    return this.#dname;
  }

  cdCheck (ownName, modules, nodePath) {
    if (this.getDepsNames().indexOf(ownName) != -1) {
      throwErr(ErrorCode.CIRCULAR, depsTree(nodePath, ownName, ownName))
    }
    this.getDepsNames().forEach(name =>
      modules.has(name) ?
        modules.get(name).cdCheck(ownName, modules, depsTree(nodePath, name, ownName)) :
        throwErr(ErrorCode.UNKNOWN, name)
    );
  }

  buildUp (modules) {
    return Promise.all(
      this.getDepsNames().map(name => modules.get(name).buildUp(modules))
    ).then(() => this.#instantiate(modules));
  }

  // make it look prettier while logging an object instance
  [inspect]() {
    return this.#data;
  }

  #injectDependencies (modules) {
    if (this.getDepsNames().length > 0) {
      this.#data = this.#data.bind(null, ...this.getDepsNames().map(
        name => modules.get(name).getData()
      ));
    }
  }

  #instantiate (modules) {
    if (this.#data.constructor == Promise || this.isReady()) {
      return this.#data;
    }
    this.#injectDependencies(modules);
    return this.#data = new Promise(async (resolve, reject) => {
      try {
        const instance = await Dependency.#setUp(this.#data);
        if (!isObject(instance)) {
          let objType = typeof instance;
          if (instance === null) {
            objType = "null";
          }
          return reject(throwErr(ErrorCode.UNSUPPORTED, objType));
        }
        this.#data = instance;
        this.#ready = true;
        resolve(this);
      } catch(e) {
        reject(e);
      }
    });
  }

  static #setUp(depSource) {
    switch (typeof depSource) {
      case "function": return depSource();
      case "object": return depSource;
    }
  }
};

module.exports = {
  parseDepsNames,
  Dependency
};

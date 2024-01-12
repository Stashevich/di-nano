const { ErrorCode, throwErr }                  = require("./error");
const { isFunction, isObject }                 = require("./util");
const { proxify }                              = require("./proxy");
const { Dependency, bindContext, buildUpTree } = require("./dependency");

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

function contextFactory() {
  const modules = {};

  function register(name, dep) {
    if (modules[name]) {
      throwErr(ErrorCode.EXISTS, name);
    }
    modules[name] = dep;
  }

  function checkBeforeRegister(name, value, isMock = false) {
    if (typeof name !== "string" || !(name.length > 0) ) {
      throwErr(ErrorCode.INVALID_NAME);
    } else if (!isObject(value)) {
      throwErr(ErrorCode.UNSUPPORTED, typeof value);
    }
    register(name, proxify(new Dependency(value, isMock)));
  }

  const options = {
    registerAll: (dependencies = {}) => {
      for (const [ depName, value ] of Object.entries(dependencies)) {
        isFunction(value) ?
          register(depName, proxify(new Dependency(value))) :
          throwErr(ErrorCode.INVALID_TYPE, typeof value)
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
  contextFactory
}

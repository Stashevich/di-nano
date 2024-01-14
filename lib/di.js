const { ErrorCode, throwErr }  = require("./error");
const { isFunction, isObject } = require("./util");
const { Dependency }           = require("./dependency");

function contextFactory() {
  const depsMap = new Map();

  function register(name, dep) {
    !depsMap.has(name) ? depsMap.set(name, dep) : throwErr(ErrorCode.EXISTS, name);
  }

  function checkBeforeRegister(name, value, isMock = false) {
    if (typeof name !== "string" || !(name.length > 0) ) {
      throwErr(ErrorCode.INVALID_NAME);
    } else if (!isObject(value)) {
      throwErr(ErrorCode.UNSUPPORTED, typeof value);
    }
    register(name, new Dependency(name, value, isMock));
  }

  return {
    registerAll: (dependencies = {}) => {
      for (const [ depName, value ] of Object.entries(dependencies)) {
        isFunction(value) ?
          register(depName, new Dependency(depName, value)) :
          throwErr(ErrorCode.INVALID_TYPE, typeof value)
      }
    },

    registerOne: (value = {}, name) =>
      checkBeforeRegister(name, value),

    registerMock: (name, value) =>
      checkBeforeRegister(name, value, true),

    invoke: async () => {
      depsMap.forEach((dep, name) => dep.cdCheck(name, depsMap));

      for await (const item of depsMap) {
        await item[1].buildUp(depsMap);
      }

      return Array.from(depsMap)
        .sort((a, b) => a[0] == b[0] ? 0 : (a[0] > b[0] ? 1 : -1))
        .reduce((accum, item) => {
          accum[item[1].getName()] = item[1].getData();
          return accum;
        }, {});
    }
  }
}

module.exports = {
  contextFactory
}

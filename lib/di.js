const { isFunction, validateObject } = require("./util");
const { ErrorCode, throwErr }        = require("./error");
const { Dependency }                 = require("./dependency");

function contextFactory() {
  const depsMap = new Map();

  function register(name, dep) {
    !depsMap.has(name) ? depsMap.set(name, dep) : throwErr(ErrorCode.EXISTS, name);
  }

  function checkBeforeRegister(name, value) {
    if (typeof name !== "string" || !(name.length > 0) )
      throwErr(ErrorCode.INVALID_NAME);
    validateObject(value, name)
    register(name, new Dependency(name, value));
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

    registerMock: (name, value) => {
      console.log('registerMock is deprecated. Use "registerOne" instead.');
      checkBeforeRegister(name, value);
    },

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

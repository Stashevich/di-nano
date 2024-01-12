const { ErrorCode, throwErr }  = require("./error");
const { isFunction }           = require("./util");

const errorWhenNotReady = (obj, message, callback) =>
  !obj.isReady() ? throwErr(ErrorCode.INCOMPLETE, message) : callback();

const proxyHandler = {
  get: (obj, prop) =>
    !obj.pathThrough(prop) ?
      obj[prop] :
      errorWhenNotReady(obj, "get", () =>
        Reflect.get(obj.data, prop, obj.data), prop // handling non object values
      ),

  set: (obj, prop, value) =>
    errorWhenNotReady(obj, "set", () => Reflect.set(obj.data, prop, value)),

  apply: (obj, thisArg, argumentsList) =>
    errorWhenNotReady(obj, "apply", () => (
      !isFunction(obj.data) ?
        throwErr(ErrorCode.NOT_CALLABLE, "obj") :
        Reflect.apply(obj.data, thisArg, argumentsList)
    ))
};

const proxify = (depClassInstance) => {
  const name = depClassInstance?.constructor?.name;
  return name == "Dependency" ?
    new Proxy(depClassInstance, proxyHandler) : throwErr(ErrorCode.UNEXPECTED, name);
}

module.exports = {
  proxyHandler,
  proxify
};

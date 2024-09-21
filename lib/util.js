const { ErrorCode, throwErr } = require("./error");

const isFunction = (obj) => (typeof obj) == "function";

const validateObject = (depObj, depName) => {
  let type = typeof depObj
  if (["function", "object"].indexOf(depObj && type) != -1)
    return depObj
  if (depObj === null)
    type = "null"
  throwErr(ErrorCode.UNSUPPORTED,
    `dependency, named >>> "${depName}" <<< has type - "${type}"`);
}

module.exports = {
  validateObject,
  isFunction
};

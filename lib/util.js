const isObject = (obj) => ["function", "object"].indexOf(obj && typeof obj) != -1;

const isFunction = (obj) => (typeof obj) == "function";

module.exports = {
  isFunction,
  isObject
};

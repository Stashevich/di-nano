const { describe, test, expect }     = require("@jest/globals");
const { isFunction, validateObject } = require("../lib/util");

describe("[ Utils ]", () => {
  test("should check entinity for to be an object", () => {
    const msg = (type) =>
      `[DI Engine]::dependency, named >>> "abc" <<< has type - "${type}"` +
      ". Expected an object or a function."
    expect(() => validateObject(() => {}, "abc")).not.toThrow()
    expect(() => validateObject({}, "abc")).not.toThrow()
    expect(() => validateObject(null, "abc")).toThrow(msg("null"))
    expect(() => validateObject(undefined, "abc")).toThrow(msg("undefined"))
    expect(() => validateObject("mock", "abc")).toThrow(msg("string"))
    expect(() => validateObject(true, "abc")).toThrow(msg("boolean")) });

  test("should check entinity for to a an function", () =>
    expect(isFunction(() => {})).toEqual(true) );
});

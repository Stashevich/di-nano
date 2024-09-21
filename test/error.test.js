const { describe, test, expect }        = require("@jest/globals");
const { ErrorCode, throwErr, DI_Error } = require("../lib/error");

describe("[ Error Module ]", () => {
  test("should use a custom error class", () =>
    expect(() => throwErr(null, "err-mock")).toThrow(new DI_Error(null, "err-mock")) );

  test("should print a user message, when an error code is unknown", () =>
    expect(() => throwErr(-1, "message mock")).toThrowError("message mock") );

  test("should throw EXISTS error", () =>
    expect(() => throwErr(ErrorCode.EXISTS, "test"))
      .toThrowError('a module with "test" name is already exists.') );

  test("should throw INVALID_TYPE error", () =>
    expect(() => throwErr(ErrorCode.INVALID_TYPE, null))
      .toThrowError('invalid dependency type - "null", expected a "function".') );

  test("should throw INVALID_NAME error", () =>
    expect(() => throwErr(ErrorCode.INVALID_NAME, null))
      .toThrowError("invalid dependency name. Expected a string.") );

  test("should throw UNSUPPORTED error", () =>
    expect(() => throwErr(ErrorCode.UNSUPPORTED, "msg-mock"))
      .toThrowError("msg-mock. Expected an object or a function.") );

  test("should throw INCOMPLETE error", () =>
    expect(() => throwErr(ErrorCode.INCOMPLETE, "get"))
      .toThrowError('an attempt to use an incomplete dependency instance.') );

  test("should throw CIRCULAR error", () =>
    expect(() => throwErr(ErrorCode.CIRCULAR, "mock"))
      .toThrowError('circular dependency detected: [mock].') );

  test("should throw PARSER_ERR error", () =>
    expect(() => throwErr(ErrorCode.PARSER_ERR, "mock"))
      .toThrowError('an invalid way of defining dependencies names => "(mock)". ' +
        "Must be a plain comma separated list.") );

  test("should throw UNKNOWN error", () =>
    expect(() => throwErr(ErrorCode.UNKNOWN, "mock"))
      .toThrowError(`can't find a dependency with a given name: "mock".`) );
});

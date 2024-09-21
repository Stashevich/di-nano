const { describe } = require("mocha");
const should       = require("chai").should();

const { ErrorCode, throwErr } = require("../lib/error");

const msgCheck = (err, ...args) =>
  err.message.should.equal(`[DI Engine]::` + Array.from(args).join(""));

describe("[ Error Module ]", () => {
  it("should use a custom error class", () => {
    try {
      throwErr();
      should.fail("Unexpected flow");
    } catch (e) {
      e.name.should.equal("DI_Error");
    }
  });

  it("should print a user message, when an error code is unknown", () => {
    try {
      throwErr(-1, "message mock");
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, "message mock");
    }
  });

  it("should throw EXISTS error", () => {
    try {
      throwErr(ErrorCode.EXISTS, "test");
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, 'a module with "test" name is already exists.');
    }
  });

  it("should throw INVALID_TYPE error", () => {
    try {
      throwErr(ErrorCode.INVALID_TYPE, null);
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, 'invalid dependency type - "null", expected a "function".');
    }
  });

  it("should throw INVALID_NAME error", () => {
    try {
      throwErr(ErrorCode.INVALID_NAME, null);
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, "invalid dependency name. Expected a string.");
    }
  });

  it("should throw UNSUPPORTED error", () => {
    try {
      throwErr(ErrorCode.UNSUPPORTED, "msg-mock");
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, "msg-mock. Expected an object or a function.");
    }
  });

  it("should throw INCOMPLETE error", () => {
    try {
      throwErr(ErrorCode.INCOMPLETE, "get");
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, 'an attempt to use an incomplete dependency instance.');
    }
  });

  it("should throw CIRCULAR error", () => {
    try {
      throwErr(ErrorCode.CIRCULAR, "mock");
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, 'circular dependency detected: [mock].');
    }
  });

  it("should throw PARSER_ERR error", () => {
    try {
      throwErr(ErrorCode.PARSER_ERR, "mock");
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, 'an invalid way of defining dependencies names => "(mock)". ',
        "Must be a plain comma separated list.");
    }
  });

  it("should throw UNKNOWN error", () => {
    try {
      throwErr(ErrorCode.UNKNOWN, "mock");
      should.fail("Unexpected flow");
    } catch (e) {
      msgCheck(e, `can't find a dependency with a given name: "mock".`);
    }
  });
});

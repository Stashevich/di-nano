const { describe }                   = require("mocha");
const { isFunction, validateObject } = require("../lib/util");

describe("[ Utils ]", () => {
  it("should check entinity for to be an object", () => {
    const msg = (type) =>
      `[DI Engine]::dependency, named >>> "abc" <<< has type - "${type}"` +
      ". Expected an object or a function."
    validateObject(() => {}, "abc")
    validateObject({}, "abc")
    try { validateObject(null, "abc") } catch (e) { e.message.should.eql(msg("null"))};
    try { validateObject(undefined, "abc") } catch (e) { e.message.should.eql(msg("undefined"))};
    try { validateObject("mock", "abc") } catch (e) { e.message.should.eql(msg("string"))};
    try { validateObject(true, "abc") } catch (e) { e.message.should.eql(msg("boolean"))};
    try { validateObject(Symbol("mock"), "abc") } catch (e) { e.message.should.eql(msg("symbol"))};
  });

  it("should check entinity for to a an function", () => {
    isFunction(() => {}).should.equal(true);
  });
});

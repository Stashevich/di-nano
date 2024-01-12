const { describe }             = require("mocha");
const { isFunction, isObject } = require("../lib/util");

describe("[ Utils ]", () => {
  it("should check entinity for to be an object", () => {
    isObject(() => {}).should.equal(true);
    isObject({}).should.equal(true);
    isObject(null).should.equal(false);
    isObject(undefined).should.equal(false);
    isObject("mock").should.equal(false);
    isObject(true).should.equal(false);
    isObject(Symbol("mock")).should.equal(false);
  });

  it("should check entinity for to a an function", () => {
    isFunction(() => {}).should.equal(true);
  });
});

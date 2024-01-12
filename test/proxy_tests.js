const should                     = require("chai").should();
const { describe }               = require("mocha");
const { proxify, proxyHandler } = require("../lib/proxy");

const depMock = (data = null) => ({
  pathThrough: () => false,
  isReady: () => true,
  data: data
})

describe("[ Proxy ]", () => {
  describe("— property handler, GET", () => {
    it("should not reflect specific props. names", () => {
      const dep = depMock({ value: "mock" });
      dep.a = "a-OK";
      dep.b = "b-OK";
      dep.pathThrough = (p) => [ "a", "b" ].indexOf(p) == -1;
      proxyHandler.get(dep, "a").should.eql("a-OK");
      proxyHandler.get(dep, "b").should.eql("b-OK");
      proxyHandler.get(dep, "value").should.eql("mock");
    });

    it("should throw an error on attempt to use an incomplete dependency", () => {
      const dep = depMock({});
      dep.isReady = () => false;
      dep.pathThrough = () => true;
      try {
        proxyHandler.get(dep, "value");
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql(
          "[DI Engine]::Proxy::get::an attempt to use an incomplete dependency instance."
        );
      }
    });
  });

  describe("— property handler, SET", () => {
    it("should set a property value", () => {
      const dep = depMock({});
      dep.pathThrough = () => true;
      proxyHandler.set(dep, "value", "mock");
      dep.data.value.should.eql("mock")
    });

    it("should throw an error on attempt to use an incomplete dependency", () => {
      const dep = depMock({});
      dep.isReady = () => false;
      dep.pathThrough = () => true;
      try {
        proxyHandler.set(dep, "value", "mock");
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql(
          "[DI Engine]::Proxy::set::an attempt to use an incomplete dependency instance."
        );
      }
    });
  });

  describe("— property handler, APPLY", () => {
    it("should call an object, when it supports this", () => {
      const dep = depMock(function (...args) {
        return `OK-${Array.from(args).join(",")} ${this.name}`
      });
      dep.pathThrough = () => true;
      proxyHandler.apply(dep, { name: "mock" }, ["a", "b", "c"])
        .should.eql("OK-a,b,c mock");
    });

    it("should throw an error on attempt to call uncollable object", () => {
      const dep = depMock({});
      dep.pathThrough = () => true;
      try {
        proxyHandler.apply(dep, {}, ["a", "b", "c"]);
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql('[DI Engine]::Proxy::apply::"obj" is not a function".');
      }
    });

    it("should throw an error on attempt to use an incomplete dependency", () => {
      const dep = depMock({});
      dep.isReady = () => false;
      dep.pathThrough = () => true;
      try {
        proxyHandler.apply(dep, {}, ["a", "b", "c"]);
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql(
          "[DI Engine]::Proxy::apply::an attempt to use an incomplete dependency instance."
        );
      }
    });
  });

  describe("— proxify", () => {
    it("should set a proxy for an object", () => {
      proxify(new (function Dependency() {}));
    });

    it("should throw an error on unsupported dependency type", () => {
      try {
        proxify({});
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql(
          '[DI Engine]::Proxy::received an invalid object type - "Object". ' +
          'Must be an instance of Dependency class.'
        );
      }
    });
  });
});

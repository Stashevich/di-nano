const should            = require("chai").should();
const { describe }      = require("mocha");
const { Dependency,
        parseDepsNames } = require("../lib/dependency");

describe("[ Dependency ]", () => {
  it("should return a list of own dependencies names", () => {
    const dep = new Dependency("name-mock", (a, b) => ({}));
    dep.getDepsNames().should.eql(["a", "b"]);
  });

  it("should return a dependency name", async () => {
    const modules = new Map([
      ["a", new Dependency("a", () => ({}))]
    ]);
    await modules.get("a").buildUp(modules, "a");
    modules.get("a").getName().should.eql("a");
  });

  it("should return a dependency value", async () => {
    const modules = new Map([
      ["a", new Dependency("a", () => ({ value : "OK" }))]
    ]);
    await modules.get("a").buildUp(modules, "a");
    modules.get("a").getData().value.should.eql("OK");
  });

  it("should fail to return any instance's data until build is completed", async () => {
    const dep = new Dependency("a", () => ({}));
    try {
      dep.getData();
      should.fail("unexpected flow");
    } catch (e) {
      e.message.should
        .eql("[DI Engine]::an attempt to use an incomplete dependency instance.")
    }
  });

  describe("- dependecies parser", () => {
    it("should handle an arrow function", () => {
      const dep = (a, b) => ({});
      parseDepsNames(dep.toString()).should.eql(["a", "b"]);
    });

    it("should handle a function expression", () => {
      const dep = function (a, b, c) {};
      parseDepsNames(dep.toString()).should.eql(["a", "b", "c"]);
    });

    it("should handle multiline declaration 1", () => {
      const dep = function (
          b, c
        ) {};
      parseDepsNames(dep.toString()).should.eql(["b", "c"]);
    });

    it("should handle multiline declaration 2", () => {
      const dep = (
          a,
          c
        ) => {};
      parseDepsNames(dep.toString()).should.eql(["a", "c"]);
    });

    it("should handle an async function", () => {
      const dep = async function (a, c) {};
      parseDepsNames(dep.toString()).should.eql(["a", "c"]);
    });

    it("should handle spaces between props", () => {
      const dep = async function ( b,  c ) {};
      parseDepsNames(dep.toString()).should.eql(["b", "c"]);
    });

    it("should fail on attempt to use an object destruction for function props", () => {
      const dep = async function ({ b, c }) {};
      try {
        parseDepsNames(dep.toString()).should.eql(["b", "c"]);
        should.fail("Unexpected flow");
      } catch(e) {
        e.message.should.eql(
          `[DI Engine]::an invalid way of defining dependencies names => "({ b, c })". ` +
          "Must be a plain comma separated list."
        )
      }
    });
  });

  describe("- build up", () => {
    it("should build a subtree of own dependencies, empty list", async () => {
      const dep = new Dependency("a", () => ({ value: "OK" }));
      await dep.buildUp(null);
      dep.getData().value.should.eql("OK");
    });

    it("should build a subtree of own dependencies", async () => {
      const modules = new Map([
        ["a", new Dependency("a", (b, c) => ({ value: `OK-${b.value}-${c.value}` }))],
        ["b", new Dependency("b", () => ({ value: "b" }))],
        ["c", new Dependency("c", (b) => ({ value: `OK-${b.value}-c` }))],
      ]);
      await modules.get("a").buildUp(modules, "a");
      modules.get("a").getData().value.should.eql("OK-b-OK-b-c");
      modules.get("b").getData().value.should.eql("b");
      modules.get("c").getData().value.should.eql("OK-b-c");
    });

    it("should bind properties", async () => {
      const modules = new Map([
        ["a", new Dependency("a", () => { return { value: "a" }; })],
        ["b", new Dependency("b", (a) => { return a; })]
      ]);
      await modules.get("b").buildUp(modules, "b");
      modules.get("b").getData().value.should.eql("a");
    });

    it("should not bind anything when deps. list is empty", async () => {
      let count = 0;
      const dep = new Dependency("a", function fn () {
        count = Array.from(arguments).length;
        return { value: "a" };
      });
      await dep.buildUp(null, "a");
      dep.getData().value.should.eql("a");
      count.should.eql(0);
    });

    it("should fail when includes self", () => {
      try {
        new Dependency("a", (a) => {}).cdCheck("a");
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql("[DI Engine]::circular dependency detected: [a => a].");
      }
    });

    it("should fail when there is a circular dependency", () => {
      const modules = new Map([
        ["a", new Dependency("a", (b) => {})],
        ["b", new Dependency("b", (a) => {})],
      ]);
      try {
        modules.get("a").cdCheck("a", modules);
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql("[DI Engine]::circular dependency detected: [a => b => a].");
      }
    });

    it("should fail when can't find a module with a given name", () => {
      const dep = new Dependency("b", (d) => {});
      try {
        dep.cdCheck("b", new Map);
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql(`[DI Engine]::can't find a dependency with a given name: "d".`);
      }
    });

    it("should refuse to build up a module, which not resolves with an object or a function", async () => {
      const test = async (value, type) => {
        const dep = new Dependency("a", () => { return value; })
        try {
          await dep.buildUp(null);
          should.fail("Unexpected flow");
        } catch (e) {
          e.message.should.eql(`[DI Engine]::dependency, named >>> "a" <<< has type - "${type}". Expected an object or a function.`)
        }
      }
      await test(undefined,      "undefined");
      await test(null,           "null");
      await test("mock",         "string");
      await test(true,           "boolean");
      await test(1234,           "number");
      await test(Symbol('1234'), "symbol");
    });

    it("should not suppress a module's error", async () => {
      const dep = new Dependency("a", () => { throw new Error("mock"); });
      try {
        await dep.buildUp(null);
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql("mock");
      }
    });

    it("should update dependency's readiness status", async () => {
      const dep = new Dependency("a", () => { return {} });
      await dep.buildUp(null);
      dep.isReady().should.eql(true);
    });

    it("should not instantiate a dependency more than once", async () => {
      let counter = 0;
      const modules = new Map([
        ["a", new Dependency("a", () => { counter++; return {} })],
        ["b", new Dependency("b", (a) => { return {} })],
        ["c", new Dependency("c", (a) => { return {} })]
      ]);
      await modules.get("a").buildUp(modules);
      await modules.get("b").buildUp(modules);
      await modules.get("c").buildUp(modules);
      counter.should.eql(1);
    });
  });
});

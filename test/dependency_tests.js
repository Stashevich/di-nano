const should            = require("chai").should();
const { describe }      = require("mocha");
const { Dependency,
        bindContext,
        throwErrOnCD,
        buildUpTree,
        parseDepsNames } = require("../lib/dependency");

describe("[ Dependency ]", () => {
  it("should match own special properties", () => {
    const dep = new Dependency({});
    dep.pathThrough(bindContext).should.eql(false);
    dep.pathThrough(throwErrOnCD).should.eql(false);
    dep.pathThrough(buildUpTree).should.eql(false);
    dep.pathThrough("propName").should.eql(true);
  });

  it("should return a list of own dependencies names", () => {
    const dep = new Dependency((a, b) => ({}));
    dep.getDepsNames().should.eql(['a', 'b']);
  });

  describe("- dependecies parser", () => {
    it("should handle an arrow function", () => {
      const dep = (a, b) => ({});
      parseDepsNames(dep.toString()).should.eql(['a', 'b']);
    });

    it("should handle a function expression", () => {
      const dep = function (a, b, c) {};
      parseDepsNames(dep.toString()).should.eql(['a', 'b', 'c']);
    });

    it("should handle multiline declaration 1", () => {
      const dep = function (
          b, c
        ) {};
      parseDepsNames(dep.toString()).should.eql(['b', 'c']);
    });

    it("should handle multiline declaration 2", () => {
      const dep = (
          a,
          c
        ) => {};
      parseDepsNames(dep.toString()).should.eql(['a', 'c']);
    });

    it("should handle an async function", () => {
      const dep = async function (a, c) {};
      parseDepsNames(dep.toString()).should.eql(['a', 'c']);
    });

    it("should handle spaces between props", () => {
      const dep = async function ( b,  c ) {};
      parseDepsNames(dep.toString()).should.eql(['b', 'c']);
    });

    it("should fail on attempt to use an object destruction for function props", () => {
      const dep = async function ({ b, c }) {};
      try {
        parseDepsNames(dep.toString()).should.eql(['b', 'c']);
        should.fail("Unexpected flow");
      } catch(e) {
        e.message.should.eql(
          `[DI Engine]::an invalid way of defining dependencies names => "({ b, c })". ` +
          "Must be a plain comma separated list."
        )
      }
    });
  });

  describe("- context binding", () => {
    it("should bind properties", () => {
      const modules = {
        a: new Dependency(() => { return "a"; }),
        b: new Dependency((a) => { return a; })
      };
      modules.b[bindContext](modules, 'b');
      modules.b.data().data().should.eql("a");
    });

    it("should not bind anything when deps. list is empty", () => {
      const modules = {
        a: new Dependency(() => { return "a"; }),
      };
      modules.a[bindContext](modules, "a");
      modules.a.data().should.eql("a");
    });

    it("should fail when includes self", () => {
      const modules = {
        a: new Dependency((a) => {}),
      };
      try {
        modules.a[bindContext](modules, "a");
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql("[DI Engine]::circular dependency detected: [a => a].");
      }
    });

    it("should fail when there is a circular dependency", () => {
      const modules = {
        a: new Dependency((b) => {}),
        b: new Dependency((a) => {}),
      };
      try {
        modules.a[bindContext](modules, "a");
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql("[DI Engine]::circular dependency detected: [a => b => a].");
      }
    });

    it("should fail when can't find a module with a given name", () => {
      const modules = {
        b: new Dependency((d) => {}),
      };
      try {
        modules.b[bindContext](modules, "b");
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql(`[DI Engine]::can't find a dependency with a given name: "d".`);
      }
    });
  });

  describe("- build up", () => {
    it("should build a subtree of own dependencies, empty list", async () => {
      const modules = {
        a: new Dependency(() => ({ value: "OK" })),
      };
      modules.a[bindContext](modules, "a");
      await modules.a[buildUpTree](modules);
      modules.a.data.value.should.eql("OK");
    });

    it("should build a subtree of own dependencies", async () => {
      const modules = {
        a: new Dependency((b, c) => ({ value: `OK-${b.data.value}-${c.data.value}` })),
        b: new Dependency(() => ({ value: "b" })),
        c: new Dependency((b) => ({ value: `OK-${b.data.value}-c` })),
      };
      modules.a[bindContext](modules, "a");
      modules.b[bindContext](modules, "b");
      modules.c[bindContext](modules, "c");
      await modules.a[buildUpTree](modules);
      modules.a.data.value.should.eql("OK-b-OK-b-c");
      modules.b.data.value.should.eql("b");
      modules.c.data.value.should.eql("OK-b-c");
    });

    it("should refuse to build up a module, which not resolves with an object or a function", async () => {
      const test = async (value, type) => {
        let modules = { a: new Dependency(() => { return value; }) };
        modules.a[bindContext](modules, "a");
        try {
          await modules.a[buildUpTree](modules);
          should.fail("Unexpected flow");
        } catch (e) {
          e.message.should
            .eql(`[DI Engine]::got "${type}" as a dependency evaluation result. ` +
                 "Expected an object or a function.");
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
      let modules = { a: new Dependency(() => { throw new Error("mock"); }) };
      modules.a[bindContext](modules, "a");
      try {
        await modules.a[buildUpTree](modules);
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql("mock");
      }
    });

    it("should update dependency's readiness status", async () => {
      let modules = { a: new Dependency(() => { return {} }) };
      modules.a[bindContext](modules, "a");
      await modules.a[buildUpTree](modules);
      modules.a.isReady().should.eql(true);
    });

    it("should 'freeze' a instantiated dependency", async () => {
      let modules = { a: new Dependency(() => { return {} }) };
      modules.a[bindContext](modules, "a");
      await modules.a[buildUpTree](modules);
      Object.isFrozen(modules.a.data).should.eql(true);
    });

    it("should not 'freeze' a dependency, when it is a mock", async () => {
      let modules = { a: new Dependency(() => { return {} }, true) };
      modules.a[bindContext](modules, "a");
      await modules.a[buildUpTree](modules);
      Object.isFrozen(modules.a.data).should.eql(false);
    });

    it("should not instantiate a dependancy more then one time", async () => {
      let counter = 0;
      let modules = {
        a: new Dependency(() => { counter++; return {} }),
        b: new Dependency((a) => { return {} }),
        c: new Dependency((a) => { return {} })
      };
      modules.a[bindContext](modules, "a");
      modules.b[bindContext](modules, "b");
      modules.c[bindContext](modules, "c");
      await modules.a[buildUpTree](modules);
      counter.should.eql(1);
    });
  });
});

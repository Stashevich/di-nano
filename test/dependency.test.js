const { describe, test, expect }     = require("@jest/globals");
const { Dependency, parseDepsNames } = require("../lib/dependency");
const { ErrorCode, DI_Error }        = require("../lib/error")

describe("[ Dependency ]", () => {
  test("should return a list of own dependencies names", () =>
    expect(new Dependency("name-mock", (a, b) => ({}))
      .getDepsNames()).toEqual(["a", "b"]) );

  test("should return a dependency name", async () => {
    const modules = new Map([ [ "a", new Dependency("a", () => ({})) ] ]);
    await modules.get("a").buildUp(modules, "a");
    expect(modules.get("a").getName()).toEqual("a"); });

  test("should return a dependency value", async () => {
    const modules = new Map([ [ "a", new Dependency("a", () => ({ value : "OK" })) ] ]);
    await modules.get("a").buildUp(modules, "a");
    expect(modules.get("a").getData().value).toEqual("OK"); });

  test("should fail to return any instance's data until build is completed", async () => {
    const dep = new Dependency("a", () => ({}));
    expect(() => dep.getData()).toThrow(new DI_Error(ErrorCode.INCOMPLETE)) });

  describe("- dependecies parser", () => {
    test("should handle an arrow function", () => {
      const dep = (a, b) => ({});
      expect(parseDepsNames(dep.toString())).toEqual(["a", "b"]); });

    test("should handle a function expression", () => {
      const dep = function (a, b, c) {};
      expect(parseDepsNames(dep.toString())).toEqual(["a", "b", "c"]); });

    test("should handle multiline declaration 1", () => {
      const dep = function (
          b, c
        ) {};
      expect(parseDepsNames(dep.toString())).toEqual(["b", "c"]); });

    test("should handle multiline declaration 2", () => {
      const dep = (
          a,
          c
        ) => {};
      expect(parseDepsNames(dep.toString())).toEqual(["a", "c"]); });

    test("should handle an async function", () => {
      const dep = async function (a, c) {};
      expect(parseDepsNames(dep.toString())).toEqual(["a", "c"]); });

    test("should handle spaces between props", () => {
      const dep = async function ( b,  c ) {};
      expect(parseDepsNames(dep.toString())).toEqual(["b", "c"]); });

    test("should fail on attempt to use an object destruction for function props", () => {
      const dep = async function ({ b, c }) {};
      expect(() => parseDepsNames(
        dep.toString().replaceAll("\n", "").replace(/\s+/g, " ")
      )).toThrow(new DI_Error(ErrorCode.PARSER_ERR, "{ b, c }")); });
  })

  describe("- build up", () => {
    test("should build a subtree of own dependencies, empty list", async () => {
      const dep = new Dependency("a", () => ({ value: "OK" }));
      await dep.buildUp(null);
      expect(dep.getData().value).toEqual("OK"); });

    test("should build a subtree of own dependencies", async () => {
      const modules = new Map([
        ["a", new Dependency("a", (b, c) => ({ value: `OK-${b.value}-${c.value}` }))],
        ["b", new Dependency("b", () => ({ value: "b" }))],
        ["c", new Dependency("c", (b) => ({ value: `OK-${b.value}-c` }))],
      ]);
      await modules.get("a").buildUp(modules, "a");
      expect(modules.get("a").getData().value).toEqual("OK-b-OK-b-c");
      expect(modules.get("b").getData().value).toEqual("b");
      expect(modules.get("c").getData().value).toEqual("OK-b-c"); });

    test("should bind properties", async () => {
      const modules = new Map([
        ["a", new Dependency("a", () => { return { value: "a" }; })],
        ["b", new Dependency("b", (a) => { return a; })]
      ]);
      await modules.get("b").buildUp(modules, "b");
      expect(modules.get("b").getData().value).toEqual("a"); });

    test("should not bind anything when deps. list is empty", async () => {
      let count = 0;
      const dep = new Dependency("a", function fn () {
        count = Array.from(arguments).length;
        return { value: "a" };
      });
      await dep.buildUp(null, "a");
      expect(dep.getData().value).toEqual("a");
      expect(count).toEqual(0); });

    test("should fail when includes self", () =>
      expect(() => new Dependency("a", (a) => {}).cdCheck("a"))
        .toThrow("[DI Engine]::circular dependency detected: [a => a].") );

    test("should fail when there is a circular dependency", () => {
      const modules = new Map([
        ["a", new Dependency("a", (b) => {})],
        ["b", new Dependency("b", (a) => {})],
      ]);
      expect(() => modules.get("a").cdCheck("a", modules))
        .toThrow("[DI Engine]::circular dependency detected: [a => b => a].") });

    test("should fail when can't find a module with a given name", () =>
      expect(() => new Dependency("b", (d) => {}).cdCheck("b", new Map))
        .toThrow(`[DI Engine]::can't find a dependency with a given name: "d".`) );

    test("should refuse to build up a module, which not resolves with an object or a function", async () => {
      const test = async (value, type) => {
        const dep = new Dependency("a", () => { return value; })
        await expect(dep.buildUp(null)).rejects.toThrow(
          `[DI Engine]::dependency, named >>> "a" <<< has type - "${type}". ` +
          "Expected an object or a function." ) }
      await test(undefined,      "undefined");
      await test(null,           "null");
      await test("mock",         "string");
      await test(true,           "boolean");
      await test(1234,           "number");
      await test(Symbol('1234'), "symbol"); });

    test("should not suppress a module's error", async () => {
      const dep = new Dependency("a", () => { throw new Error("mock"); });
      await expect(dep.buildUp(null)).rejects.toThrow("mock") });

    test("should update dependency's readiness status", async () => {
      const dep = new Dependency("a", () => { return {} });
      await dep.buildUp(null);
      expect(dep.isReady()).toEqual(true); });

    test("should not instantiate a dependency more than once", async () => {
      let counter = 0;
      const modules = new Map([
        ["a", new Dependency("a", () => { counter++; return {} })],
        ["b", new Dependency("b", (a) => { return {} })],
        ["c", new Dependency("c", (a) => { return {} })]
      ]);
      await modules.get("a").buildUp(modules);
      await modules.get("b").buildUp(modules);
      await modules.get("c").buildUp(modules);
      expect(counter).toEqual(1); });
  });
})

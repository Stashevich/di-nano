const { describe, test, expect } = require("@jest/globals");
const di                         = require("../index");

describe("[ Dependency Injection Engine ]", () => {
  test("should create a di instance", () => {
    di.init((ctx) => {
      expect(typeof ctx.registerOne).toEqual("function");
      expect(typeof ctx.registerAll).toEqual("function");
      expect(typeof ctx.registerMock).toEqual("function");
      expect(typeof ctx.invoke).toEqual("function");
    }) });

  test("should add a dependency into a shared context obj", async () =>
    await expect(di.init((ctx) => {
      ctx.registerOne({ val: "OK" }, "name_mock");
      return ctx.invoke();
    })).resolves.toHaveProperty("name_mock.val", "OK") );

  test("should add a list of unique dependencies into a shared context obj", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({
        module_a: () => ({}),
        module_b: () => ({}),
        module_c: () => ({})
      })
      return ctx.invoke();
    })
    expect(ctx).toHaveProperty("module_a");
    expect(ctx).toHaveProperty("module_b");
    expect(ctx).toHaveProperty("module_c"); });

  test("should await for a resolving of an async module", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({
        asyncModule: () => new Promise(
          (res) => setTimeout(() => res({ prop: "value-mock" }), 100)
        )
      })
      return ctx.invoke();
    });
    expect(ctx).toHaveProperty("asyncModule");
    expect(ctx.asyncModule.prop).toEqual("value-mock"); });

  test("should handle a construction of a function-like dependency", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({ a: () => () => ({ getValue: () => "OK" })});
      return ctx.invoke(); });
    expect(ctx.a().getValue()).toEqual("OK"); });

  test("should handle a construction of a object-like dependency", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({ a: () => ({ getValue: () => "OK" })});
      return ctx.invoke(); })
    expect(ctx.a.getValue()).toEqual("OK"); });

  test("should build up a module with a dependencies list", async () =>
    await expect(di.init((ctx) => {
      ctx.registerAll({
        a: (b) => ({}),
        b: (c) => ({}),
        c: () => ({})
      });
      return ctx.invoke();
    })).toBeDefined() );

  test("should sort modules alphabetically in ASC order", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({
        f: () => ({}),
        i: () => ({}),
      });
      ctx.registerAll({ a: () => ({}) });
      ctx.registerOne(() => ({}), "0c");
      return ctx.invoke();
    });
    expect(Object.keys(ctx).join(',')).toEqual("0c,a,f,i"); });

  describe("— build up verification", () => {
    test("should receive a ready-to-use async dependency as a prop", async () => {
      const dep1 = { a: (b) => ({ getValue: () => b.innerValue() }) };
      const dep2 = {
        b: () => new Promise(
          (res) => setTimeout(() => res({ innerValue: () => "OK" }), 100)
        )
      };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      });
      expect(ctx.a.getValue()).toEqual("OK"); });

    test("should receive a ready-to-use sync dependency as prop", async () => {
      const dep1 = { a: (b) => ({ getValue: () => b.innerValue() }) };
      const dep2 = { b: () => ({ innerValue: () => "OK" }) };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      });
      expect(ctx.a.getValue()).toEqual("OK"); });

    test("should allow a usage of sync dependencies right away", async () => {
      const dep1 = { a: () => ({ valueFromA: () => "a" }) };
      const dep2 = {
        b: ( a, c ) => {
          const mockA = a.valueFromA();
          const mockC = c.valueFromC();
          return { value: () => `xyz-${mockA}${mockC}` }
        },
        c: () => ({ valueFromC: () => "c" }),
      };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      });
      expect(ctx.b.value()).toEqual("xyz-ac"); });

    test("should allow a usage of sync dependencies right away from async dep.", async () => {
      const dep1 = { a: () => ({ value: () => "a_result" }) };
      const dep2 = {
        b: (a) => {
          const mock = a.value();
          return new Promise((res) =>
            setTimeout(() => res({ value: () => `b_result ${mock}` }), 100)
          )
        }
      };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      });
      expect(ctx.b.value()).toEqual("b_result a_result"); });

    test("should allow a usage of async dependencies right away from sync dep.", async () => {
      const dep1 = {
        a: () => new Promise((res) =>
          setTimeout(() => res({ value: () => "a_result" }), 100)
        )
      };
      const dep2 = { b: (a) => ({ value: () => `b_result ${a.value()}` }) };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke(); });
      expect(ctx.b.value()).toEqual("b_result a_result"); });
  });

  describe("— cirular dependency", () => {
    test("should fail to build up in case of synchronous CD", async () => {
      const dep1 = { a: (b) => ({ value: () => b.name(), name: () => "abc" }) };
      const dep2 = { b: (a) => ({ value: () => a.name(), name: () => "xyz" }) };
      await expect(di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      })).rejects.toHaveProperty("message",
        "[DI Engine]::circular dependency detected: [a => b => a]."); });

    test("should detect CD by inspecting module's dependencies list", async () => {
      const deps = {
        a: (b) => ({}),
        b: (c) => ({}),
        c: (a) => ({})
      };
      await expect(di.init((ctx) => {
        ctx.registerAll(deps);
        return ctx.invoke();
      })).rejects.toHaveProperty("message",
        "[DI Engine]::circular dependency detected: [a => b => c => a]."); });

    test("should fail to build up in case of asynchronous CD", async () => {
      const dep1 = { b: (c) => new Promise((res) => res("b")) };
      const dep2 = { c: (b) => new Promise((res) => res("c")) };
      await expect(di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      })).rejects.toHaveProperty("message",
        "[DI Engine]::circular dependency detected: [b => c => b]."); });
  })

  describe("— exceptions handling", () => {
    test("should fail on attemp to use an invalid dependency name", async () =>
      await expect(async () => {
        await di.init((ctx) => {
        ctx.registerOne({ a: () => () => {} });
        return ctx.invoke();
      })}).rejects.toThrow("[DI Engine]::invalid dependency name. Expected a string.") );
  });

  describe("[ mocks ]", () => {
    test("should register dependency as a mock", async () => {
      const dep = { a: (b, c) => ({}) };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep);
        ctx.registerMock("b", {});
        ctx.registerMock("c", {});
        return ctx.invoke();
      });
      expect(ctx).toHaveProperty("a");
      expect(ctx).toHaveProperty("b");
      expect(ctx).toHaveProperty("c"); });

    test("should support module's method mock", async () => {
      const dep = { a: (b) => ({ doJob: () => b.status() }) };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep);
        ctx.registerMock("b", {});
        ctx.registerMock("c", {});
        return ctx.invoke();
      });
      ctx.b.status = jest.fn(() => {})
      ctx.a.doJob();
      expect(ctx.b.status).toHaveBeenCalledTimes(1); });
  });
});

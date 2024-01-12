const { describe } = require("mocha");
const chai         = require("chai").use(require("chai-as-promised"));
const should       = chai.should();
const sn           = require("sinon");

const di = require("../index");

describe("[ Dependency Injection Engine ]", () => {
  it("should create a di instance", () => {
    di.init((ctx) => {
      ctx.should.have.property("registerOne");
      ctx.should.have.property("registerAll");
      ctx.should.have.property("registerMock");
      ctx.should.have.property("invoke");
    })
  });

  it("should add a dependency into a shared context obj", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerOne({ val: "OK" }, "name_mock");
      return ctx.invoke();
    });
    ctx.name_mock.val.should.eql("OK");
  });

  it("should add a list of unique dependencies into a shared context obj", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({
        module_a: () => ({}),
        module_b: () => ({}),
        module_c: () => ({})
      })
      return ctx.invoke();
    });
    ctx.should.have.property("module_a");
    ctx.should.have.property("module_b");
    ctx.should.have.property("module_c");
  });

  it("should await for a resolving of an async module", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({
        asyncModule: () => new Promise(
          (res) => setTimeout(() => res({ prop: "value-mock" }), 100)
        )
      })
      return ctx.invoke();
    });
    ctx.should.have.property("asyncModule");
    ctx.asyncModule.prop.should.eql("value-mock");
  });

  it("should handle a construction of a function-like dependency", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({ a: () => () => ({ getValue: () => "OK" })});
      return ctx.invoke();
    });
    ctx.a().getValue().should.eql("OK");
  });

  it("should handle a construction of a object-like dependency", async () => {
    const ctx = await di.init((ctx) => {
      ctx.registerAll({ a: () => ({ getValue: () => "OK" })});
      return ctx.invoke();
    })
    ctx.a.getValue().should.eql("OK");
  });

  it("should successfully perform building a deps. tree", async () => {
    try {
      const ctx = await di.init((ctx) => {
        ctx.registerAll({
          a: (b) => ({}),
          b: (c) => ({}),
          c: () => ({})
        });
        return ctx.invoke();
      })
    } catch(e) {
      should.fail(e.message);
    }
  });

  describe("— build up verification", () => {
    it("should receive a ready-to-use async dependency as prop", async () => {
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
      ctx.a.getValue().should.eql("OK");
    });

    it("should receive a ready-to-use sync dependency as prop", async () => {
      const dep1 = { a: (b) => ({ getValue: () => b.innerValue() }) };
      const dep2 = { b: () => ({ innerValue: () => "OK" }) };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      });
      ctx.a.getValue().should.eql("OK");
    });

    it("should allow a usage of sync dependencies right away", async () => {
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
      ctx.b.value().should.eql("xyz-ac");
    });

    it("should allow a usage of sync dependencies right away from async dep.", async () => {
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
      ctx.b.value().should.eql("b_result a_result");
    });

    it("should allow a usage of async dependencies right away from sync dep.", async () => {
      const dep1 = {
        a: () => new Promise((res) =>
          setTimeout(() => res({ value: () => "a_result" }), 100)
        )
      };
      const dep2 = { b: (a) => ({ value: () => `b_result ${a.value()}` }) };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      });
      ctx.b.value().should.eql("b_result a_result");
    });
  });

  describe("— cirular dependency", () => {
    it("should fail to build up in case of synchronous CD", async () => {
      const dep1 = { a: (b) => ({ value: () => b.name(), name: () => "abc" }) };
      const dep2 = { b: (a) => ({ value: () => a.name(), name: () => "xyz" }) };
      await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      }).should.be.rejectedWith(
        "[DI Engine]::circular dependency detected: [a => b => a]"
      );
    });

    it("should detect CD by inspecting module's dependencies list", async () => {
      const deps = {
        a: (b) => ({}),
        b: (c) => ({}),
        c: (a) => ({})
      };
      await di.init((ctx) => {
        ctx.registerAll(deps);
        return ctx.invoke();
      }).should.be.rejectedWith(
        "[DI Engine]::circular dependency detected: [a => b => c => a]"
      );
    });

    it("should fail to build up in case of asynchronous CD", async () => {
      const dep1 = {
        b: (c) => new Promise((res) =>
        setTimeout(() => res({ value: () => c.name(), name: () => "abc" }), 100)
      )};
      const dep2 = {
        c: (b) => new Promise((res) =>
        setTimeout(() => res({ value: () => b.name(), name: () => "xyz" }), 150)
      )};
      await di.init((ctx) => {
        ctx.registerAll(dep1);
        ctx.registerAll(dep2);
        return ctx.invoke();
      }).should.be.rejectedWith(
        "[DI Engine]::circular dependency detected: [b => c => b]"
      );
    });
  })

  describe("— exceptions handling", () => {
    it("should fail on attemp to use an invalid dependency name", async () => {
      try {
        await di.init((ctx) => {
          ctx.registerOne({ a: () => () => {} });
          return ctx.invoke();
        })
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql("[DI Engine]::invalid dependency name. Expected a string.");
      }
    });

    it("should fail when a final result of dep. instance is not an object or function", async () => {
      try {
        await di.init((ctx) => {
          ctx.registerAll({ a: () => "result-mock" });
          return ctx.invoke();
        });
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql(`[DI Engine]::got "string" as a dependency evaluation result. Expected an object or a function.`);
      }
    });

    it("should fail on attemt to call out an object", async () => {
      try {
        const ctx = await di.init((ctx) => {
          ctx.registerAll({ a: () => ({ value: () => "mock" }) });
          return ctx.invoke();
        });
        ctx.a();
        should.fail("Unexpected flow");
      } catch (e) {
        e.message.should.eql(`[DI Engine]::Proxy::apply::"obj" is not a function".`);
      }
    });
  });

  describe("[ mocks ]", () => {
    it("should register dependency as a mock", async () => {
      const dep = { a: (b, c) => ({}) };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep);
        ctx.registerMock("b", {});
        ctx.registerMock("c", {});
        return ctx.invoke();
      });
      ctx.should.have.property("a");
      ctx.should.have.property("b");
      ctx.should.have.property("c");
    });

    it("should support module's method mock", async () => {
      const dep = { a: (b) => ({ doJob: () => b.status() }) };
      const ctx = await di.init((ctx) => {
        ctx.registerAll(dep);
        ctx.registerMock("b", {});
        ctx.registerMock("c", {});
        return ctx.invoke();
      });
      ctx.b.status = sn.fake();
      ctx.a.doJob();
      ctx.b.status.callCount.should.eql(1);
    });
  });
});

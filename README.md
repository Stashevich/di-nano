# GENERAL
  An implementation of Dependency Injection pattern in a way, which enables its usages in a simplest way possible.

  ```javascript
  const di = require("di-nano");

  di.init((ctx) => {
    ctx.registerAll(require("./some_module"));
    return ctx.invoke();
  }).then((ctx) => {
    // ...
  });
  ```

  > [!NOTE]
  > DI decreases interdependence between modules, what leads to simplifying of tests writing and application logic.

  There are only 5 functions exposed to a user, to make everything work:
  - [init](#initcallback-promise)
  - [registerAll](#registeralldependencies-undefined)
  - [registerOne](#registeronedependency-name-undefined)
  - [registerMock](#registermockname-undefined)
  - [invoke](#invoke-promise)

# USAGE

  To define a dependency, create a function and export it under any name.
  Names **MUST** be unique among each other.

  ### 1) Synchronous dependency:
  ```javascript
  exports.Dependency_A = () => {
    // ...
  }
  ```

  ### 2) Asynchronous dependency:
  ```javascript
  exports.Dependency_A = async () => {
    // ...
  }

  // or

  exports.Dependency_B = () => {
    // ...
    return new Promise((resolve, reject) => {
    // ...
    });
  }
  ```
  > [!NOTE]
  > If a function returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), it will be automatically converted into async dependency.

  ### 3) Setting a module's dependencies list:
  To define module's dependencies, list them as typical function parameters, assuming they are defined in the same way, described already above. They can have a list of it's own dependencies too:
  ```javascript
  exports.Dependency_A = (dep_B, dep_C, ... dep_N) => {
    // ...
  }
  ```

  ### 4) Multiple dependencies in a single file:
  There is nothing special about this, since it is a plain Node.js export:
  ```javascript
  exports.Dependency_A = (Dependency_C, Dependency_B) => {
    // ...
  }

  exports.Dependency_B = (Dependency_C) => {
    // ...
  }

  exports.Dependency_C = () => {
    // ...
  }
  ```

  ### 5) Context build up:
  ```javascript
  const di = require("di-nano");

  di.init((ctx) => {
    ctx.registerAll(require("./some_module_1"));
    ctx.registerAll(require("./some_module_2"));
    return ctx.invoke();
  }).then((ctx) => {
    // ...
  });
  ```

  [**di.init**](#initcallback-promise) resolves with an object which provides an access to all registered modules. An object destruction could be applied for receiving a list of specific modules:
  ```javascript
  di.init((ctx) => {
    // ...
    return ctx.invoke();
  }).then(({ module_1, modul_2, module_n }) => {});
  ```
  > [!NOTE]
  > Before returning a result, [**ctx.invoke()**](#invoke-promise) will wait for all asynchronous dependencies to resolve.

  ### 6) Anonymous module export:
  It is also possible to register an anonymous function or an object, but a name of a module **MUST** be set additionally. For this purpose serves [**registerOne**](#registeronedependency-name-undefined):
  ```javascript
  // module_a.js
  module.exports = () => {
    // ...
  }

  // index.js
  di.init((ctx) => {
    ctx.registerOne(require("./module_a"), "MyModule");
    return ctx.invoke();
  }).then((ctx) => {
    // ...
  });
  ```

# EXAMPLE
  A runnable working example could be found [here](examples).

  A possible use case is described below, emphasizing the key points of DI:
  ```javascript
  // data_provider.js
  exports.DataProvider = async ($conf) => { // requesting a $conf module as a dependency
    // YOUR PREFERRED DB CONNECTOR
    return connector;
  }

  // user_controller.js
  exports.UserController = ($conf, DataProvider) => { // requesting a $conf and DataProvider
    // ...
    router.get("/get-some-data", async (req, res, next) => {
      try {
        const result = await DataProvider.getSomeData();
        res.send(result);
      } catch (err) {
        next(err);
      }
    });
    return router;
  }

  // server.js
  const express = require("express");
  const di      = require("di-nano");

  di.init((ctx) => {
    ctx.registerObj(require(process.env.APP_CONFIG_PATH), "$conf");
    ctx.registerAll(require("./data_provider"));
    ctx.registerAll(require("./user_controller"));
    return ctx.invoke();
  }).then(({ $conf, UserController }) => { // plain JS technique, can receive modules here also
    const server = express();
    ...
    server.use("/user", UserController);
    ...
    server.listen($conf.server.port, () => {
      console.log(`Server is listening at ${$conf.server.port} port.`);
    });
  });

  ```

# MODULE API

  #### init(callback): Promise
  ```javascript
  /**
   * @param { Function } callback - A function to provide a context with.
   *
   * @returns Must return a result(Promise) of *** invoke *** call.
  */
  ```

  #### registerAll(dependencies): undefined
  ```javascript
  /**
   * @param { Object } dependencies - An map of dependencies.
   *
   * @returns undefined.
  */
  ```

  #### registerOne(dependency, name): undefined
  ```javascript
  /**
   * @param { Object } dependency - A single dependency map.
   * @param { String } name - A module name to set.
   *
   * @returns undefined.
  */
  ```

  #### registerMock(name, value): undefined
  ```javascript
  /**
   * @param { String } name - A module name to set.
   * @param { Object | Function } value - A module source.
   *
   * @returns undefined.
  */
  ```

  #### invoke(): Promise
  ```javascript
  /**
   * @returns A Promise, which resolves with DI context object.
  */
  ```
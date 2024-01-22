[![tests](https://github.com/Stashevich/di-nano/actions/workflows/node.js.yml/badge.svg?event=push)](https://github.com/Stashevich/di-nano/actions/workflows/node.js.yml)
# GENERAL
  An implementation of Dependency Injection pattern in a way, which enables its usages in a simplest way possible.

  > [!NOTE]
  > DI decreases interdependence between modules, what leads to simplifying of tests writing and application logic.

  Looks as follows:
  ```javascript
  // Module's dependencies listed as function parameters.

  // user_controller.js - a SYNCHRONOUS module:
  exports.UserController = ($conf, DataProvider) => { // <--- dependencies are in braces
    // ...
    router.get("/get-some-data", async (req, res, next) => {
      // ...
      const result = await DataProvider.getSomeData();
      // ...
    });
    return router;
  }

  // data_provider.js - an ASYNCHRONOUS module:
  exports.DataProvider = async ($conf) => { // <--- dependencies are in braces
    // YOUR PREFERRED DB CONNECTOR
    return connector;
  }

  // server.js
  const express = require("express");
  const di      = require("di-nano");

  di.init((ctx) => {
    ctx.registerOne(require(process.env.APP_CONFIG_PATH), "$conf");
    ctx.registerAll(require("./data_provider"));
    ctx.registerAll(require("./user_controller"));
    return ctx.invoke();
    // use an object destruction to get a list of specific modules here, when needed
  }).then(({ $conf, UserController }) => { // <----
    const server = express();
    // ...
    server.use("/user", UserController);
    // ...
    server.listen($conf.server.port, () => {
      console.log(`Server is listening at ${$conf.server.port} port.`);
    });
  });
  ```

### EXAMPLE
  A runnable working example could be found [here](examples).

# USAGE

  **di-nano** exposes next 4 functions to the end user:
  - [init](#initcallback-promise)
  - [registerAll](#registeralldependencies-undefined)
  - [registerOne](#registeronedependency-name-undefined)
  - [invoke](#invoke-promise)

  To define a dependency, create a function and export it under any name.
  Names **MUST** be unique among each other.

  #### 1) SYNCHRONOUS DEPENDENCY:
  ```javascript
  exports.SomeModule = () => { /**/ }
  ```

  #### 2) ASYNCHRONOUS DEPENDENCY:
  ```javascript
  exports.SomeModule = async () => { /**/ }

  // or

  exports.SomeModule = () => {
    // ...
    return new Promise((resolve, reject) => { /**/ });
  }
  ```
  > [!NOTE]
  > If a function returns a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise), it will be automatically converted into async dependency.

  #### 3) SETTING DEPENDENCIES LIST:
  To define module's dependencies, list them as typical function parameters, assuming they are defined in the same way, described already above. They can have a list of it's own dependencies too:
  ```javascript
  exports.Module_A = (Module_B, Module_C, ... Module_N) => { /**/ }
  ```

  #### 4) MULTIPLE DEPENDENCIES IN A SINGLE FILE:
  There is nothing special about this, since it is a plain Node.js export:
  ```javascript
  exports.Module_A = (Module_C, Module_B) => { /**/ }
  exports.Module_B = (Module_C) => { /**/ }
  exports.Module_C = () => { /**/ }
  ```

  #### 5) CONTEXT BUILD UP:
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

  #### 6) ANONYMOUS MODULE EXPORT:
  It is also possible to register an anonymous function or an object, but a name of a module **MUST** be set additionally. For this purpose serves [**registerOne**](#registeronedependency-name-undefined):
  ```javascript
  // module_a.js
  module.exports = () => { /**/ }

  // index.js
  di.init((ctx) => {
    ctx.registerOne(require("./module_a"), "MyModule");
    return ctx.invoke();
  }).then((ctx) => {
    // ...
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

  #### invoke(): Promise
  ```javascript
  /**
   * @returns A Promise, which resolves with DI context object.
  */
  ```
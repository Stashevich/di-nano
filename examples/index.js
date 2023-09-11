const express = require("express");
const di      = require("di-nano");

di.init((ctx) => {
  ctx.registerOne(require("./config"), "$conf");
  ctx.registerAll(require("./controller"));
  ctx.registerAll(require("./logger"));
  return ctx.invoke();
}).then(({ $conf, Controller, Logger }) => {
  const server = express();

  server.use(Logger);
  server.use(Controller);

  server.listen($conf.server.port, () => {
    console.log(`Server is listening at ${$conf.server.port}`)
  });
});

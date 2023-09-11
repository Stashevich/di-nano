const express = require("express");

exports.Helpers = ($conf) => {
  return {
    flip: () =>
      Math.random() + $conf.headsOffset > 0.5 ? "heads" : "tails"
  }
}

exports.Controller = ($conf, Helpers) => {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.send(`Hello from ${ $conf.controller.from }.`);
  });

  router.get("/flip-a-coin", (req, res) => {
    res.send(`It is ${ Helpers.flip() }.`);
  });

  return router;
}

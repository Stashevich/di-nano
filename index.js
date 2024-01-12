const { contextFactory } = require("./lib/di");

module.exports = {
  init: (callback) => callback(contextFactory())
}

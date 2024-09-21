const ErrorCode = {
  EXISTS       : 0,
  INVALID_TYPE : 1,
  INVALID_NAME : 2,
  UNSUPPORTED  : 3,
  INCOMPLETE   : 4,
  CIRCULAR     : 5,
  PARSER_ERR   : 6,
  UNKNOWN      : 7,
};

const errMessages = {
  [ErrorCode.EXISTS       ] : (msg) => `a module with "${msg}" name is already exists.`,
  [ErrorCode.INVALID_TYPE ] : (msg) => `invalid dependency type - "${msg}", expected a "function".`,
  [ErrorCode.INVALID_NAME ] : ()    => "invalid dependency name. Expected a string.",
  [ErrorCode.UNSUPPORTED  ] : (msg) => `${msg}. Expected an object or a function.`,
  [ErrorCode.INCOMPLETE   ] : () => `an attempt to use an incomplete dependency instance.`,
  [ErrorCode.CIRCULAR     ] : (msg) => `circular dependency detected: [${msg}].`,
  [ErrorCode.PARSER_ERR   ] : (msg) => `an invalid way of defining dependencies names => "(${msg})". Must be a plain comma separated list.`,
  [ErrorCode.UNKNOWN      ] : (msg) => `can't find a dependency with a given name: "${msg}".`,
};

class DI_Error extends Error {
  constructor(errCode, message) {
    if (errMessages[errCode]) {
      message = errMessages[errCode](message);
    }
    message = "[DI Engine]::" + message;
    super(message);
    this.name = this.constructor.name;
  }
}

const throwErr = (errCode, message) => {
  throw new DI_Error(errCode, message);
}

module.exports = {
  ErrorCode,
  throwErr
};

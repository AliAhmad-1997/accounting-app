'use strict';

// Domain errors surface a human-readable Arabic message to the renderer.
// We never swallow these silently — the IPC layer forwards message + code.
class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION';
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
  }
}

module.exports = { ValidationError, NotFoundError };


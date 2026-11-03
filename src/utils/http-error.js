class HttpError extends Error {
  constructor(status, message, datos) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.datos = datos;
  }
}

module.exports = HttpError;

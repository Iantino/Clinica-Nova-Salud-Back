function notFound(req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' });
}

// Centraliza errores HTTP y no filtra detalles inesperados del servidor.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status === 500) console.error(err);
  const respuesta = { message: status === 500 ? 'Error interno del servidor' : err.message };
  if (err.errores) respuesta.errores = err.errores;
  if (err.datos) respuesta.datos = err.datos;
  res.status(status).json(respuesta);
}

module.exports = { notFound, errorHandler };

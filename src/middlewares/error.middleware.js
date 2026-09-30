// Responde cuando se pide una ruta que no existe
function notFound(req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' });
}

// Captura cualquier error y evita mostrar detalles internos al usuario
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Error interno del servidor' : err.message,
  });
}

module.exports = { notFound, errorHandler };

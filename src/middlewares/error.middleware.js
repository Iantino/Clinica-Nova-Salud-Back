// Responde cuando se pide una ruta que no existe
function notFound(req, res) {
  res.status(404).json({ message: 'Ruta no encontrada' });
}

// Captura cualquier error y evita mostrar detalles internos al usuario
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  // Solo se registran en consola los errores inesperados del servidor
  if (status === 500) console.error(err);

  res.status(status).json({
    message: status === 500 ? 'Error interno del servidor' : err.message,
  });
}

module.exports = { notFound, errorHandler };

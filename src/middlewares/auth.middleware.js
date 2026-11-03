// RNF-05: cada endpoint valida la sesión y el rol en el servidor,
// no basta con ocultar botones en el frontend.

// Exige que haya una sesión iniciada
function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ message: 'No has iniciado sesión' });
  }
  req.usuario = req.session.usuario;
  next();
}

// Exige uno de los roles indicados; incluye la validación de sesión
function requireRol(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!roles.includes(req.usuario.rol)) {
        return res.status(403).json({ message: 'No tienes permiso para realizar esta acción' });
      }
      next();
    });
  };
}

module.exports = { requireAuth, requireRol };

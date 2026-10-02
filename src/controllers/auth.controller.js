const authService = require('../services/auth.service');

async function login(req, res, next) {
  try {
    const usuario = await authService.login(req.body.correo, req.body.password);

    // Se crea una sesión nueva al iniciar sesión para evitar la fijación de sesión
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.usuario = usuario;
      res.json({ usuario });
    });
  } catch (error) {
    next(error);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('nova.sid');
    res.status(204).end();
  });
}

function me(req, res) {
  if (!req.session.usuario) {
    return res.status(401).json({ message: 'No has iniciado sesión' });
  }
  res.json({ usuario: req.session.usuario });
}

module.exports = { login, logout, me };

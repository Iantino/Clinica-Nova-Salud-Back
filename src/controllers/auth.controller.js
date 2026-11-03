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
  res.json({ usuario: req.usuario });
}

module.exports = { login, logout, me };

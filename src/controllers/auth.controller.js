const authService = require('../services/auth.service');
const recuperacionService = require('../services/recuperacion.service');

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

async function solicitarRestablecimiento(req, res, next) {
  try {
    await recuperacionService.solicitarRestablecimiento(req.body.correo);
    res.json({ mensaje: 'Si el correo corresponde a una cuenta activa, enviaremos un enlace para cambiar la contraseña.' });
  } catch (error) {
    next(error);
  }
}

async function restablecerContrasena(req, res, next) {
  try {
    const resultado = await recuperacionService.restablecerContrasena(req.body.token, req.body.password);
    res.json(resultado);
  } catch (error) {
    next(error);
  }
}

module.exports = { login, logout, me, solicitarRestablecimiento, restablecerContrasena };

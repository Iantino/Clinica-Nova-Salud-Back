const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { requireAuth } = require('../middlewares/auth.middleware');
const {
  loginSchema,
  solicitarRestablecimientoSchema,
  restablecerContrasenaSchema,
} = require('../validators/auth.validator');

const router = Router();

// Máximo 20 intentos de inicio de sesión cada 15 minutos por IP (RNF-04)
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

const limitadorRestablecimiento = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.' },
});

const limitadorCambioPassword = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

router.post('/login', limitadorLogin, validate(loginSchema), authController.login);
router.post(
  '/solicitar-restablecimiento',
  limitadorRestablecimiento,
  validate(solicitarRestablecimientoSchema),
  authController.solicitarRestablecimiento
);
router.post(
  '/restablecer-contrasena',
  limitadorCambioPassword,
  validate(restablecerContrasenaSchema),
  authController.restablecerContrasena
);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;

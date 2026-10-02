const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { loginSchema } = require('../validators/auth.validator');

const router = Router();

// Máximo 20 intentos de inicio de sesión cada 15 minutos por IP (RNF-04)
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' },
});

router.post('/login', limitadorLogin, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.me);

module.exports = router;

const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/portal.controller');
const validate = require('../middlewares/validate.middleware');
const { requireRol } = require('../middlewares/auth.middleware');
const v = require('../validators/portal.validator');

const router = Router();
const paciente = requireRol('paciente');
const limiteRegistro = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Se alcanzó el límite de registros. Intenta más tarde.' },
});

router.post('/registro', limiteRegistro, validate(v.registroSchema), controller.registrar);
router.get('/medicos', paciente, controller.medicos);
router.get('/disponibilidad', paciente, validate(v.disponibilidadSchema, 'query'), controller.disponibilidad);
router.get('/citas', paciente, validate(v.listarCitasSchema, 'query'), controller.citas);
router.post('/citas', paciente, validate(v.crearCitaSchema), controller.crearCita);
router.put('/citas/:id/reprogramar', paciente, validate(v.idParams, 'params'), validate(v.reprogramarCitaSchema), controller.reprogramarCita);
router.patch('/citas/:id/cancelar', paciente, validate(v.idParams, 'params'), validate(v.cancelarCitaSchema), controller.cancelarCita);

module.exports = router;

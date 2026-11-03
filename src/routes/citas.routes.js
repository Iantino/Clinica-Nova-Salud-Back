const { Router } = require('express');
const controller = require('../controllers/citas.controller');
const validate = require('../middlewares/validate.middleware');
const { requireRol } = require('../middlewares/auth.middleware');
const v = require('../validators/cita.validator');

const router = Router();
const staff = requireRol('administrador', 'recepcionista', 'medico');
const agenda = requireRol('administrador', 'recepcionista');

router.get('/', staff, validate(v.listarCitasSchema, 'query'), controller.listar);
router.get('/:id', staff, validate(v.idParams, 'params'), controller.obtener);
router.post('/', agenda, validate(v.crearCitaSchema), controller.crear);
router.put('/:id/reprogramar', agenda, validate(v.idParams, 'params'), validate(v.reprogramarSchema), controller.reprogramar);
router.patch('/:id/cancelar', agenda, validate(v.idParams, 'params'), validate(v.cancelarSchema), controller.cancelar);
router.patch('/:id/estado', staff, validate(v.idParams, 'params'), validate(v.cambiarEstadoSchema), controller.cambiarEstado);

module.exports = router;

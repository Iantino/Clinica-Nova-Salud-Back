const { Router } = require('express');
const controller = require('../controllers/pacientes.controller');
const validate = require('../middlewares/validate.middleware');
const { requireRol } = require('../middlewares/auth.middleware');
const v = require('../validators/paciente.validator');

const router = Router();

const pueden = {
  consultar: requireRol('administrador', 'recepcionista', 'medico'),
  registrar: requireRol('administrador', 'recepcionista'),
};

router.get('/', pueden.consultar, validate(v.listarPacientesSchema, 'query'), controller.listar);
router.get('/:id', pueden.consultar, validate(v.idParams, 'params'), controller.obtener);
router.post('/', pueden.registrar, validate(v.pacienteSchema), controller.crear);
router.put('/:id', pueden.registrar, validate(v.idParams, 'params'), validate(v.pacienteSchema), controller.actualizar);

module.exports = router;

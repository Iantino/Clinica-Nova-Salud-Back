const { Router } = require('express');
const controller = require('../controllers/medicos.controller');
const validate = require('../middlewares/validate.middleware');
const { requireRol } = require('../middlewares/auth.middleware');
const v = require('../validators/medico.validator');

const router = Router();
const admin = requireRol('administrador');
const staff = requireRol('administrador', 'recepcionista', 'medico');

router.get('/especialidades', staff, controller.especialidades);
router.post('/especialidades', admin, validate(v.especialidadSchema), controller.crearEspecialidad);
router.put('/especialidades/:id', admin, validate(v.idParams, 'params'), validate(v.especialidadSchema), controller.actualizarEspecialidad);
router.get('/', staff, controller.listar);
router.get('/:id', staff, validate(v.idParams, 'params'), controller.obtener);
router.post('/', admin, validate(v.medicoSchema), controller.crear);
router.put('/:id', admin, validate(v.idParams, 'params'), validate(v.actualizarMedicoSchema), controller.actualizar);
router.patch('/:id/estado', admin, validate(v.idParams, 'params'), validate(v.estadoSchema), controller.cambiarEstado);

module.exports = router;

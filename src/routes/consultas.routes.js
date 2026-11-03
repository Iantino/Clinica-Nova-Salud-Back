const { Router } = require('express');
const controller = require('../controllers/consultas.controller');
const validate = require('../middlewares/validate.middleware');
const { requireRol } = require('../middlewares/auth.middleware');
const v = require('../validators/consulta.validator');

const router = Router();
const medico = requireRol('medico');

router.get('/pacientes/:id', medico, validate(v.historialParams, 'params'), controller.historial);
router.get('/:id', medico, validate(v.idParams, 'params'), controller.obtener);
router.post('/', medico, validate(v.crearConsultaSchema), controller.crear);
router.post('/:id/receta', medico, validate(v.idParams, 'params'), validate(v.recetaSchema), controller.crearReceta);

module.exports = router;

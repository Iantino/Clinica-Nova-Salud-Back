const { Router } = require('express');
const controller = require('../controllers/reportes.controller');
const validate = require('../middlewares/validate.middleware');
const { requireRol } = require('../middlewares/auth.middleware');
const v = require('../validators/reporte.validator');

const router = Router();
router.use(requireRol('administrador'));
router.get('/resumen', validate(v.resumenSchema, 'query'), controller.resumen);
router.get('/citas', validate(v.listaSchema, 'query'), controller.citas);
router.get('/exportar', validate(v.exportarSchema, 'query'), controller.exportar);
router.get('/bitacora', validate(v.listaSchema, 'query'), controller.bitacora);

module.exports = router;

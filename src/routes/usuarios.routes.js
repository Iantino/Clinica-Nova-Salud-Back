const { Router } = require('express');
const controller = require('../controllers/usuarios.controller');
const validate = require('../middlewares/validate.middleware');
const { requireRol } = require('../middlewares/auth.middleware');
const v = require('../validators/usuario.validator');

const router = Router();

// RF-02: solo el administrador gestiona usuarios
router.use(requireRol('administrador'));

router.get('/roles', controller.roles);
router.get('/', validate(v.listarUsuariosSchema, 'query'), controller.listar);
router.get('/:id', validate(v.idParams, 'params'), controller.obtener);
router.post('/', validate(v.crearUsuarioSchema), controller.crear);
router.put('/:id', validate(v.idParams, 'params'), validate(v.actualizarUsuarioSchema), controller.actualizar);
router.patch('/:id/estado', validate(v.idParams, 'params'), validate(v.estadoSchema), controller.cambiarEstado);

module.exports = router;

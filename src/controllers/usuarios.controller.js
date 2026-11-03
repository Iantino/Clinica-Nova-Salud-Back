const usuariosService = require('../services/usuarios.service');
const { ROLES_GESTIONABLES } = require('../validators/usuario.validator');

// Envuelve un controlador async para enviar los errores al manejador central
const manejar = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = {
  roles: (req, res) => res.json({ roles: ROLES_GESTIONABLES }),

  listar: manejar(async (req, res) => {
    res.json(await usuariosService.listar(req.validado.query));
  }),

  obtener: manejar(async (req, res) => {
    res.json({ usuario: await usuariosService.obtener(req.validado.params.id) });
  }),

  crear: manejar(async (req, res) => {
    res.status(201).json({ usuario: await usuariosService.crear(req.body) });
  }),

  actualizar: manejar(async (req, res) => {
    const usuario = await usuariosService.actualizar(
      req.validado.params.id,
      req.body,
      req.usuario.id
    );
    res.json({ usuario });
  }),

  cambiarEstado: manejar(async (req, res) => {
    const usuario = await usuariosService.cambiarEstado(
      req.validado.params.id,
      req.body.activo,
      req.usuario.id
    );
    res.json({ usuario });
  }),
};

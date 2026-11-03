const service = require('../services/medicos.service');

const manejar = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = {
  listar: manejar(async (req, res) => res.json({ medicos: await service.listar(req.usuario) })),
  obtener: manejar(async (req, res) => res.json({ medico: await service.obtener(req.validado.params.id) })),
  crear: manejar(async (req, res) => res.status(201).json({ medico: await service.crear(req.body) })),
  actualizar: manejar(async (req, res) => res.json({ medico: await service.actualizar(req.validado.params.id, req.body) })),
  cambiarEstado: manejar(async (req, res) => res.json({ medico: await service.cambiarEstado(req.validado.params.id, req.body.activo) })),
  especialidades: manejar(async (req, res) => res.json({ especialidades: await service.listarEspecialidades() })),
  crearEspecialidad: manejar(async (req, res) => res.status(201).json({ especialidad: await service.crearEspecialidad(req.body) })),
  actualizarEspecialidad: manejar(async (req, res) => res.json({ especialidad: await service.actualizarEspecialidad(req.validado.params.id, req.body) })),
};

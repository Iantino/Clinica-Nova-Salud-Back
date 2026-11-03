const service = require('../services/citas.service');

const manejar = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = {
  listar: manejar(async (req, res) => res.json(await service.listar(req.validado.query, req.usuario))),
  obtener: manejar(async (req, res) => res.json({ cita: await service.obtener(req.validado.params.id, req.usuario) })),
  crear: manejar(async (req, res) => res.status(201).json({ cita: await service.crear(req.body, req.usuario) })),
  reprogramar: manejar(async (req, res) => res.json({ cita: await service.reprogramar(req.validado.params.id, req.body, req.usuario) })),
  cancelar: manejar(async (req, res) => res.json({ cita: await service.cancelar(req.validado.params.id, req.body.motivo_cancelacion, req.usuario) })),
  cambiarEstado: manejar(async (req, res) => res.json({ cita: await service.cambiarEstado(req.validado.params.id, req.body.estado, req.usuario) })),
};

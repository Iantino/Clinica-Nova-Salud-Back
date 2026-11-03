const service = require('../services/consultas.service');

const manejar = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = {
  historial: manejar(async (req, res) => res.json({ consultas: await service.historial(req.validado.params.id, req.usuario) })),
  obtener: manejar(async (req, res) => res.json({ consulta: await service.obtener(req.validado.params.id, req.usuario) })),
  crear: manejar(async (req, res) => res.status(201).json({ consulta: await service.crear(req.body, req.usuario) })),
  crearReceta: manejar(async (req, res) => res.status(201).json({ consulta: await service.crearReceta(req.validado.params.id, req.body, req.usuario) })),
};

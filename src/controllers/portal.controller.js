const service = require('../services/portal.service');
const citasService = require('../services/citas.service');

const manejar = (fn) => (req, res, next) => fn(req, res, next).catch(next);

module.exports = {
  registrar: manejar(async (req, res) => res.status(201).json(await service.registrar(req.body))),
  medicos: manejar(async (_req, res) => res.json({ medicos: await service.listarMedicos() })),
  disponibilidad: manejar(async (req, res) => {
    const { medico_id: medicoId, fecha } = req.validado.query;
    res.json({ horarios: await citasService.disponibilidad(medicoId, fecha) });
  }),
  citas: manejar(async (req, res) => res.json(await service.listarCitas(req.usuario.id, req.validado.query.pagina))),
  crearCita: manejar(async (req, res) => res.status(201).json({ cita: await service.crearCita(req.body, req.usuario) })),
  reprogramarCita: manejar(async (req, res) => res.json({ cita: await service.reprogramarCita(req.validado.params.id, req.body, req.usuario) })),
  cancelarCita: manejar(async (req, res) => res.json(await service.cancelarCita(req.validado.params.id, req.body.motivo_cancelacion, req.usuario))),
};

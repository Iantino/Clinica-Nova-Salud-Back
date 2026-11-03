const pacientesService = require('../services/pacientes.service');

const manejar = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function protegerDatosClinicos(usuario, paciente) {
  if (usuario.rol === 'recepcionista') {
    delete paciente.alergias;
    delete paciente.antecedentes;
  }
  return paciente;
}

module.exports = {
  listar: manejar(async (req, res) => {
    res.json(await pacientesService.listar(req.validado.query));
  }),

  obtener: manejar(async (req, res) => {
    const paciente = await pacientesService.obtener(req.validado.params.id);
    res.json({ paciente: protegerDatosClinicos(req.usuario, paciente) });
  }),

  crear: manejar(async (req, res) => {
    const paciente = await pacientesService.crear(req.body, req.usuario.rol);
    res.status(201).json({ paciente: protegerDatosClinicos(req.usuario, paciente) });
  }),

  actualizar: manejar(async (req, res) => {
    const paciente = await pacientesService.actualizar(
      req.validado.params.id,
      req.body,
      req.usuario.rol
    );
    res.json({ paciente: protegerDatosClinicos(req.usuario, paciente) });
  }),
};



const service = require('../services/reportes.service');
const { csv, xlsx } = require('../utils/exportar-reporte');

const manejar = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function fechaGuatemala() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
}

module.exports = {
  resumen: manejar(async (req, res) => res.json({ resumen: await service.resumen(req.validado.query.fecha || fechaGuatemala()) })),
  citas: manejar(async (req, res) => res.json(await service.listarCitas(req.validado.query))),
  exportar: manejar(async (req, res) => {
    const { formato, ...filtros } = req.validado.query;
    const filas = await service.todasLasCitas(filtros);
    const nombre = `reporte-citas-${filtros.desde || 'inicio'}-${filtros.hasta || 'hoy'}`;
    if (formato === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${nombre}.csv"`);
      return res.send(csv(filas));
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}.xlsx"`);
    return res.send(xlsx(filas));
  }),
  bitacora: manejar(async (req, res) => res.json(await service.bitacora(req.validado.query))),
};

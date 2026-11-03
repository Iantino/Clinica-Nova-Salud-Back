const { z } = require('zod');

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD')
  .refine((valor) => {
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fechaReal = new Date(Date.UTC(anio, mes - 1, dia));
    return fechaReal.getUTCFullYear() === anio && fechaReal.getUTCMonth() === mes - 1 && fechaReal.getUTCDate() === dia;
  }, 'La fecha no es válida');
const pagina = z.coerce.number().int().min(1).default(1);

const rango = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  medico_id: z.coerce.number().int().positive().optional(),
}).superRefine((datos, ctx) => {
  if (datos.desde && datos.hasta && datos.desde > datos.hasta) {
    ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final debe ser igual o posterior a la inicial' });
  }
  if (datos.desde && datos.hasta) {
    const inicio = Date.parse(`${datos.desde}T00:00:00Z`);
    const fin = Date.parse(`${datos.hasta}T00:00:00Z`);
    if (Number.isFinite(inicio) && Number.isFinite(fin) && (fin - inicio) / 86400000 > 366) {
      ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'El rango máximo para reportes es de 366 días' });
    }
  }
});

const resumenSchema = z.object({ fecha: fecha.optional() });
const listaSchema = rango.extend({ pagina });
const exportarSchema = rango.extend({ formato: z.enum(['csv', 'xlsx']).default('xlsx') });

module.exports = { resumenSchema, listaSchema, exportarSchema };

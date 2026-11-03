const { z } = require('zod');
const { correo, pagina, idParams } = require('./comunes');
const { registroPacienteSchema } = require('./paciente.validator');

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((valor) => {
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}, 'La fecha no existe');

const registroSchema = registroPacienteSchema;
const disponibilidadSchema = z.object({
  medico_id: z.coerce.number().int().positive(),
  fecha: FECHA,
});
const crearCitaSchema = z.object({
  medico_id: z.coerce.number().int().positive(),
  fecha: FECHA,
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  motivo: z.string().trim().max(255).optional().nullable(),
});
const listarCitasSchema = z.object({ pagina });
const cancelarCitaSchema = z.object({
  motivo_cancelacion: z.string().trim().min(3, 'Escribe el motivo de cancelación').max(255),
});
const reprogramarCitaSchema = crearCitaSchema.omit({ motivo: true });

module.exports = {
  correo,
  idParams,
  registroSchema,
  disponibilidadSchema,
  crearCitaSchema,
  listarCitasSchema,
  cancelarCitaSchema,
  reprogramarCitaSchema,
};

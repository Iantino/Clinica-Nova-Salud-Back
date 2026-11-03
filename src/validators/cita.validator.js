const { z } = require('zod');
const { idParams, pagina } = require('./comunes');

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fecha = z.string().regex(FECHA, 'Usa una fecha válida con formato AAAA-MM-DD').refine((valor) => {
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  return fechaUtc.getUTCFullYear() === anio && fechaUtc.getUTCMonth() === mes - 1 && fechaUtc.getUTCDate() === dia;
}, 'La fecha no existe');
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa una hora válida con formato HH:MM');
const estados = ['programada', 'confirmada', 'en_atencion', 'atendida', 'cancelada', 'no_asistio'];

const crearCitaSchema = z.object({
  paciente_id: z.coerce.number().int().positive(),
  medico_id: z.coerce.number().int().positive(),
  fecha,
  hora_inicio: hora,
  motivo: z.string().trim().max(255).optional().nullable(),
});

const reprogramarSchema = z.object({
  medico_id: z.coerce.number().int().positive().optional(),
  fecha,
  hora_inicio: hora,
});

const cancelarSchema = z.object({
  motivo_cancelacion: z.string().trim().min(3, 'Escribe el motivo de cancelación').max(255),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(['confirmada', 'en_atencion', 'no_asistio']),
});

const listarCitasSchema = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  medico_id: z.coerce.number().int().positive().optional(),
  estado: z.enum(estados).optional(),
  pagina,
}).superRefine((filtros, ctx) => {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    ctx.addIssue({ code: 'custom', path: ['hasta'], message: 'La fecha final debe ser posterior a la inicial' });
  }
});

module.exports = { idParams, crearCitaSchema, reprogramarSchema, cancelarSchema, cambiarEstadoSchema, listarCitasSchema };

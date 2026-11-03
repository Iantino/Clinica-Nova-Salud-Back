const { z } = require('zod');
const { opcional, idParams, correo } = require('./comunes');

const password = z
  .string({ message: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña admite máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
  .regex(/\d/, 'La contraseña debe incluir al menos un número');

const horarioSchema = z.object({
  dia_semana: z.coerce.number().int().min(1).max(7),
  hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa una hora válida'),
  hora_fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa una hora válida'),
});

const horarios = z.array(horarioSchema).min(1, 'Agrega al menos un horario').max(14)
  .superRefine((items, ctx) => {
    const porDia = new Map();
    items.forEach((item, index) => {
      if (item.dia_semana > 5) {
        ctx.addIssue({ code: 'custom', path: [index, 'dia_semana'], message: 'La clínica atiende de lunes a viernes' });
      }
      if (item.hora_inicio >= item.hora_fin) {
        ctx.addIssue({ code: 'custom', path: [index, 'hora_fin'], message: 'La hora final debe ser posterior a la inicial' });
      }
      if (item.hora_inicio < '08:00' || item.hora_fin > '13:00') {
        ctx.addIssue({ code: 'custom', path: [index, 'hora_inicio'], message: 'El horario debe estar dentro de la atención de 08:00 a 13:00' });
      }
      const delDia = porDia.get(item.dia_semana) ?? [];
      if (delDia.some((otro) => item.hora_inicio < otro.fin && item.hora_fin > otro.inicio)) {
        ctx.addIssue({ code: 'custom', path: [index, 'hora_inicio'], message: 'Los horarios del mismo día no pueden traslaparse' });
      }
      delDia.push({ inicio: item.hora_inicio, fin: item.hora_fin });
      porDia.set(item.dia_semana, delDia);
    });
  });

const nombre = (campo, max) => z.string({ message: `${campo} es obligatorio` }).trim().min(2).max(max);
const baseMedico = z.object({
  nombre: nombre('El nombre', 80),
  apellido: nombre('El apellido', 80),
  correo,
  especialidad_id: z.coerce.number().int().positive('Elige una especialidad'),
  colegiado: z.string().trim().min(3).max(20),
  telefono: opcional(z.string().trim().regex(/^\d{8}$/, 'El teléfono debe tener 8 dígitos')),
  horarios,
});

const medicoSchema = baseMedico.extend({ password });
const actualizarMedicoSchema = baseMedico.extend({ password: password.optional() });

const especialidadSchema = z.object({
  nombre: nombre('El nombre', 80),
  descripcion: opcional(z.string().trim().max(255)),
});

module.exports = {
  idParams,
  medicoSchema,
  actualizarMedicoSchema,
  especialidadSchema,
  estadoSchema: z.object({ activo: z.boolean() }),
};

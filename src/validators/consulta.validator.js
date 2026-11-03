const { z } = require('zod');
const { idParams } = require('./comunes');

const texto = (campo, max) => z.string({ message: `${campo} es obligatorio` }).trim().min(2, `${campo} es obligatorio`).max(max);
const opcionalTexto = (max) => z.string().trim().max(max).nullable().optional();
const medida = (maximo) => z.preprocess(
  (valor) => valor === '' || valor === undefined ? null : valor,
  z.coerce.number().positive().max(maximo).nullable().optional()
);

const crearConsultaSchema = z.object({
  cita_id: z.coerce.number().int().positive(),
  motivo_consulta: texto('El motivo de consulta', 255),
  presion_arterial: opcionalTexto(10),
  frecuencia_cardiaca: medida(300),
  temperatura: medida(50),
  peso_kg: medida(500),
  talla_cm: medida(250),
  diagnostico: texto('El diagnóstico', 10000),
  tratamiento: opcionalTexto(10000),
  notas: opcionalTexto(10000),
});

const recetaSchema = z.object({
  indicaciones_generales: opcionalTexto(5000),
  medicamentos: z.array(z.object({
    medicamento: texto('El medicamento', 120),
    // Una dosis como "2" o "1" es válida y no debe rechazarse por longitud.
    dosis: z.string({ message: 'La dosis es obligatoria' }).trim().min(1, 'La dosis es obligatoria').max(60),
    frecuencia: texto('La frecuencia', 60),
    duracion: texto('La duración', 60),
  })).min(1, 'Agrega al menos un medicamento').max(20),
});

const historialParams = z.object({
  id: z.coerce.number().int().positive('El paciente no es válido'),
});

module.exports = { idParams, historialParams, crearConsultaSchema, recetaSchema };

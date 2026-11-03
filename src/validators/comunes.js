const { z } = require('zod');

// Convierte textos vacíos en null para los campos opcionales de formularios
const vacioANull = (valor) => (typeof valor === 'string' && valor.trim() === '' ? null : valor);

function opcional(esquema) {
  return z.preprocess(vacioANull, esquema.nullable().optional());
}

const idParams = z.object({
  id: z.coerce.number({ message: 'El id no es válido' }).int().positive('El id no es válido'),
});

const pagina = z.coerce.number().int().min(1).default(1);

const correo = z
  .string({ message: 'El correo es obligatorio' })
  .trim()
  .toLowerCase()
  .max(120, 'Máximo 120 caracteres')
  .email('El correo no es válido');

module.exports = { opcional, idParams, pagina, correo };

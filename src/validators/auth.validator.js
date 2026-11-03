const { z } = require('zod');

const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email('El correo no es válido'),
  password: z.string().min(1, 'La contraseña es obligatoria').max(100),
});

const solicitarRestablecimientoSchema = z.object({
  correo: z.string().trim().toLowerCase().max(120).email('El correo no es válido'),
});

const restablecerContrasenaSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/, 'El enlace no es válido o ya venció'),
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(72, 'La contraseña admite máximo 72 caracteres')
    .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra')
    .regex(/\d/, 'La contraseña debe incluir al menos un número'),
});

module.exports = { loginSchema, solicitarRestablecimientoSchema, restablecerContrasenaSchema };

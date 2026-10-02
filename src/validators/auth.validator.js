const { z } = require('zod');

const loginSchema = z.object({
  correo: z.string().trim().toLowerCase().email('El correo no es válido'),
  password: z.string().min(1, 'La contraseña es obligatoria').max(100),
});

module.exports = { loginSchema };

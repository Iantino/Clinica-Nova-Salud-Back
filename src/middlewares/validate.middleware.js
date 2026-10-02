// Valida req.body con un esquema de Zod antes de llegar al controlador (RNF-06)
function validate(schema) {
  return (req, res, next) => {
    const resultado = schema.safeParse(req.body);

    if (!resultado.success) {
      return res.status(400).json({
        message: 'Datos inválidos',
        errores: resultado.error.issues.map((issue) => ({
          campo: issue.path.join('.'),
          mensaje: issue.message,
        })),
      });
    }

    req.body = resultado.data;
    next();
  };
}

module.exports = validate;

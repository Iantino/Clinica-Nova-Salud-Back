const { Router } = require('express');

const router = Router();

// Ruta de prueba para verificar que la API está funcionando
router.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

module.exports = router;

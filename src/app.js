const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Seguridad: cabeceras HTTP seguras (RNF-04)
app.use(helmet());

// Solo el frontend puede llamar a la API, enviando la cookie de sesión
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));

app.use(express.json());

// En producción la API está detrás del proxy de Railway
if (isProduction) app.set('trust proxy', 1);

// Sesiones en cookie httpOnly que expiran tras 30 min sin actividad (RNF-02)
app.use(
  session({
    name: 'nova.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 30 * 60 * 1000,
    },
  })
);

// Rutas de la API
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);

// Manejo de rutas inexistentes y errores
app.use(notFound);
app.use(errorHandler);

module.exports = app;

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://tiendasaz.vercel.app',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/', (_req, res) => {
  res.json({ message: 'Backend funcionando 🚀', status: 'ok' });
});

const authMiddleware = require('./middleware/auth');

app.use('/api/auth',           require('./routes/auth'));
app.use('/api/productos',      require('./routes/productos'));
app.use('/api/inventario',     require('./routes/inventario'));
app.use('/api/ventas',         authMiddleware, require('./routes/ventas'));
app.use('/api/facturas',       authMiddleware, require('./routes/facturas'));
app.use('/api/empleados',      require('./routes/empleados'));
app.use('/api/buscar-producto',require('./routes/buscarProducto'));
app.use('/api/tiendas',        require('./routes/tiendas'));
app.use('/api/reportes',       require('./routes/reportes'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── TEST EMAIL ────────────────────────────────────────────────────────────────
app.post('/api/test-email', async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo) return res.status(400).json({ error: 'correo requerido' });

    const nodemailer = require('nodemailer');
    const pass = (process.env.EMAIL_PASS || '').replace(/\s/g, '');

    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS length:', pass.length);

    const t = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.EMAIL_USER, pass },
      tls: { rejectUnauthorized: false },
    });

    await t.verify();
    await t.sendMail({
      from: `"Abarrotes Test" <${process.env.EMAIL_USER}>`,
      to: correo,
      subject: '✅ Email de prueba — Abarrotes',
      html: '<h2>✅ El email funciona</h2><p>La configuración SMTP está correcta.</p>',
    });

    res.json({ ok: true, mensaje: `Email enviado a ${correo}` });
  } catch (err) {
    console.error('Test email error:', err.message);
    res.status(500).json({ ok: false, error: err.message, code: err.code });
  }
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── ERROR GLOBAL ──────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🛒 Backend corriendo en puerto: ${PORT}`);
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? 'OK' : 'FALTA'}`);
  console.log(`JWT_SECRET:   ${process.env.JWT_SECRET ? 'OK' : 'FALTA'}`);
  console.log(`EMAIL_USER:   ${process.env.EMAIL_USER || 'FALTA'}`);
  console.log(`EMAIL_PASS:   ${process.env.EMAIL_PASS ? 'OK (' + process.env.EMAIL_PASS.replace(/\s/g,'').length + ' chars)' : 'FALTA'}`);
  console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || 'FALTA'}`);
});

module.exports = app;
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ══════════════════════════════════════════
// MIDDLEWARES
// ══════════════════════════════════════════
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://tiendasaz.vercel.app',
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger básico
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ══════════════════════════════════════════
// RUTA RAÍZ ( IMPORTANTE PARA RENDER)
// ══════════════════════════════════════════
app.get("/", (_req, res) => {
  res.json({
    message: "Backend funcionando 🚀",
    status: "ok"
  });
});

// ══════════════════════════════════════════
// RUTAS
// ══════════════════════════════════════════

const authMiddleware = require('./middleware/auth');

// 🔐 Auth
app.use('/api/auth', require('./routes/auth'));

// 📦 Productos
app.use('/api/productos', require('./routes/productos'));

// 📊 Inventario
app.use('/api/inventario', require('./routes/inventario'));

// 🧾 Ventas
app.use('/api/ventas', authMiddleware, require('./routes/ventas'));

// 🧾 Facturas
app.use('/api/facturas', authMiddleware, require('./routes/facturas'));

// 👥 Empleados
app.use('/api/empleados', require('./routes/empleados'));

// 🔍 Buscar producto
app.use('/api/buscar-producto', require('./routes/buscarProducto'));

// 🏪 Tiendas
app.use('/api/tiendas', require('./routes/tiendas'));

// 📈 Reportes
app.use('/api/reportes', require('./routes/reportes'));

// ══════════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════════
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// ══════════════════════════════════════════
// 404
// ══════════════════════════════════════════
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ══════════════════════════════════════════
// ERROR GLOBAL
// ══════════════════════════════════════════
app.use((err, _req, res, _next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ══════════════════════════════════════════
// INICIO SERVIDOR
// ══════════════════════════════════════════
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🛒 Backend corriendo en puerto: ${PORT}`);
  console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? 'OK' : 'FALTA'}`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'OK' : 'FALTA'}`);
});

module.exports = app;
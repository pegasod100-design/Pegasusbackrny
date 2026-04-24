require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();


// ══════════════════════════════════════════
// CORS CONFIG
// ══════════════════════════════════════════

app.use(cors({
  origin: [
    "https://tiendasaz1.vercel.app",
    "http://localhost:5173"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
}));

// Preflight requests
app.options("*", cors());


// ══════════════════════════════════════════
// MIDDLEWARES
// ══════════════════════════════════════════

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Logger básico
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});


// ══════════════════════════════════════════
// IMPORTS
// ══════════════════════════════════════════

const authMiddleware = require('./middleware/auth');


// ══════════════════════════════════════════
// RUTAS API
// ══════════════════════════════════════════

// 🔐 AUTH
app.use('/api/auth', require('./routes/auth'));

// 📦 PRODUCTOS
app.use('/api/productos', require('./routes/productos'));

// 📊 INVENTARIO
app.use('/api/inventario', require('./routes/inventario'));

// 🧾 VENTAS (PROTEGIDAS)
app.use('/api/ventas', authMiddleware, require('./routes/ventas'));

// 🧾 FACTURAS (PROTEGIDAS)
app.use('/api/facturas', authMiddleware, require('./routes/facturas'));

// 👥 EMPLEADOS
app.use('/api/empleados', require('./routes/empleados'));

// 🔍 BUSCAR PRODUCTO
app.use('/api/buscar-producto', require('./routes/buscarProducto'));

// 🏪 TIENDAS
app.use('/api/tiendas', require('./routes/tiendas'));

// 📈 REPORTES
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
// 404 HANDLER
// ══════════════════════════════════════════

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});


// ══════════════════════════════════════════
// ERROR HANDLER
// ══════════════════════════════════════════

app.use((err, _req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});


// ══════════════════════════════════════════
// SERVER
// ══════════════════════════════════════════

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🛒 Backend corriendo en http://localhost:${PORT}`);
});

module.exports = app;
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { enviarRecuperacionContrasena } = require('../services/email');

const JWT_SECRET = process.env.JWT_SECRET || 'clave123';
// Secret diferente para tokens de reset/set (más seguro)
const RESET_SECRET = JWT_SECRET + '_reset_2024';

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { rfc_empleado, clave } = req.body;
    if (!rfc_empleado || !clave)
      return res.status(400).json({ error: 'RFC y clave son requeridos' });

    const { data: sesion, error } = await supabase
      .from('inicio_sesion')
      .select('rfc_empleado, clave')
      .eq('rfc_empleado', rfc_empleado.toUpperCase())
      .single();

    if (error || !sesion)
      return res.status(401).json({ error: 'Credenciales incorrectas' });

    // Sin contraseña establecida aún → el empleado debe usar el link del email
    if (!sesion.clave)
      return res.status(401).json({ error: 'Debes establecer tu contraseña primero. Revisa tu correo.' });

    let match = false;
    if (sesion.clave.startsWith('$2')) {
      match = await bcrypt.compare(clave, sesion.clave);
    } else {
      match = (clave === sesion.clave);
      if (match) {
        const hash = await bcrypt.hash(clave, 10);
        await supabase.from('inicio_sesion').update({ clave: hash }).eq('rfc_empleado', rfc_empleado.toUpperCase());
      }
    }
    if (!match) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const { data: empleado } = await supabase
      .from('catalogo_empleados')
      .select('rfc_empleado, nombre, apellido_paterno, puesto, id_tienda, correo_electronico, activo')
      .eq('rfc_empleado', rfc_empleado.toUpperCase())
      .single();

    if (!empleado || !empleado.activo)
      return res.status(403).json({ error: 'Empleado inactivo o no encontrado' });

    const token = jwt.sign(
      { rfc: empleado.rfc_empleado, nombre: `${empleado.nombre} ${empleado.apellido_paterno}`, puesto: empleado.puesto, id_tienda: empleado.id_tienda },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      empleado: {
        rfc: empleado.rfc_empleado,
        rfc_empleado: empleado.rfc_empleado,
        nombre: empleado.nombre,
        apellido_paterno: empleado.apellido_paterno,
        puesto: empleado.puesto,
        id_tienda: empleado.id_tienda,
        correo_electronico: empleado.correo_electronico,
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', authMiddleware, (req, res) => {
  res.json({ empleado: req.empleado });
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Body: { rfc_empleado }
router.post('/forgot-password', async (req, res) => {
  try {
    const { rfc_empleado } = req.body;
    if (!rfc_empleado)
      return res.status(400).json({ error: 'RFC requerido' });

    const { data: empleado } = await supabase
      .from('catalogo_empleados')
      .select('rfc_empleado, nombre, apellido_paterno, correo_electronico, activo')
      .eq('rfc_empleado', rfc_empleado.toUpperCase())
      .single();

    // Siempre responder OK para no revelar si el RFC existe
    if (!empleado || !empleado.activo || !empleado.correo_electronico) {
      return res.json({ mensaje: 'Si el RFC está registrado y tiene correo, recibirás un email en breve.' });
    }

    const resetToken = jwt.sign(
      { rfc: empleado.rfc_empleado, tipo: 'reset' },
      RESET_SECRET,
      { expiresIn: '1h' }
    );

    await enviarRecuperacionContrasena({
      nombre: `${empleado.nombre} ${empleado.apellido_paterno}`,
      correo: empleado.correo_electronico,
      token: resetToken,
    });

    res.json({ mensaje: 'Si el RFC está registrado y tiene correo, recibirás un email en breve.' });
  } catch (err) {
    console.error('Error forgot-password:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── POST /api/auth/set-password ───────────────────────────────────────────────
// Usado por el link de bienvenida (token tipo "set", 24h)
// Body: { token, nueva_clave }
router.post('/set-password', async (req, res) => {
  try {
    const { token, nueva_clave } = req.body;
    if (!token || !nueva_clave || nueva_clave.length < 6)
      return res.status(400).json({ error: 'Token y contraseña (mínimo 6 caracteres) requeridos' });

    let payload;
    try {
      payload = jwt.verify(token, RESET_SECRET);
    } catch {
      return res.status(400).json({ error: 'El enlace expiró o es inválido. Pide al administrador que te reenvíe el correo.' });
    }

    if (payload.tipo !== 'set')
      return res.status(400).json({ error: 'Enlace no válido para esta acción' });

    const hash = await bcrypt.hash(nueva_clave, 10);
    const { error } = await supabase.from('inicio_sesion').upsert({ rfc_empleado: payload.rfc, clave: hash });
    if (error) throw error;

    res.json({ mensaje: 'Contraseña establecida correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error set-password:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Usado por el link de recuperación (token tipo "reset", 1h)
// Body: { token, nueva_clave }
router.post('/reset-password', async (req, res) => {
  try {
    const { token, nueva_clave } = req.body;
    if (!token || !nueva_clave || nueva_clave.length < 6)
      return res.status(400).json({ error: 'Token y contraseña (mínimo 6 caracteres) requeridos' });

    let payload;
    try {
      payload = jwt.verify(token, RESET_SECRET);
    } catch {
      return res.status(400).json({ error: 'El enlace expiró o es inválido. Solicita uno nuevo desde el login.' });
    }

    if (payload.tipo !== 'reset')
      return res.status(400).json({ error: 'Enlace no válido para esta acción' });

    const hash = await bcrypt.hash(nueva_clave, 10);
    const { error } = await supabase.from('inicio_sesion').upsert({ rfc_empleado: payload.rfc, clave: hash });
    if (error) throw error;

    res.json({ mensaje: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
  } catch (err) {
    console.error('Error reset-password:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/auth/register-password (legado) ────────────────────────────────
router.post('/register-password', authMiddleware, async (req, res) => {
  try {
    const { rfc_empleado, clave } = req.body;
    if (!rfc_empleado || !clave || clave.length < 6)
      return res.status(400).json({ error: 'RFC y clave (mín. 6 caracteres) requeridos' });
    const hash = await bcrypt.hash(clave, 10);
    const { error } = await supabase.from('inicio_sesion').upsert({ rfc_empleado: rfc_empleado.toUpperCase(), clave: hash });
    if (error) throw error;
    res.json({ mensaje: 'Contraseña registrada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

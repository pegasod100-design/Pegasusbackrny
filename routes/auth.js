const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { rfc_empleado, clave } = req.body;
    if (!rfc_empleado || !clave) {
      return res.status(400).json({ error: 'RFC y clave son requeridos' });
    }

    // Obtener credenciales
    const { data: sesion, error } = await supabase
      .from('inicio_sesion')
      .select('rfc_empleado, clave')
      .eq('rfc_empleado', rfc_empleado.toUpperCase())
      .single();

    if (error || !sesion) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Verificar contraseña — soporta bcrypt (nuevo) y texto plano (legado)
    let match = false;
    const esBcrypt = sesion.clave.startsWith('$2');
    if (esBcrypt) {
      match = await bcrypt.compare(clave, sesion.clave);
    } else {
      // Contraseña en texto plano (legado): comparar directo y migrar a bcrypt
      match = (clave === sesion.clave);
      if (match) {
        // Migrar automáticamente a bcrypt
        const hash = await bcrypt.hash(clave, 10);
        await supabase.from('inicio_sesion')
          .update({ clave: hash })
          .eq('rfc_empleado', rfc_empleado.toUpperCase());
      }
    }
    if (!match) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Obtener datos del empleado
    const { data: empleado } = await supabase
      .from('catalogo_empleados')
      .select('rfc_empleado, nombre, apellido_paterno, apellido_materno, puesto, id_tienda, activo')
      .eq('rfc_empleado', rfc_empleado.toUpperCase())
      .single();

    if (!empleado || !empleado.activo) {
      return res.status(403).json({ error: 'Empleado inactivo o no encontrado' });
    }

    const token = jwt.sign(
      {
        rfc: empleado.rfc_empleado,
        nombre: `${empleado.nombre} ${empleado.apellido_paterno}`,
        puesto: empleado.puesto,
        id_tienda: empleado.id_tienda
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      empleado: {
        rfc: empleado.rfc_empleado,
        nombre: empleado.nombre,
        apellido_paterno: empleado.apellido_paterno,
        puesto: empleado.puesto,
        id_tienda: empleado.id_tienda
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({ empleado: req.empleado });
});

// POST /api/auth/register-password  (solo para crear la primera clave)
router.post('/register-password', authMiddleware, async (req, res) => {
  try {
    const { rfc_empleado, clave } = req.body;
    if (!rfc_empleado || !clave || clave.length < 6) {
      return res.status(400).json({ error: 'RFC y clave (mín. 6 caracteres) requeridos' });
    }
    const hash = await bcrypt.hash(clave, 10);
    const { error } = await supabase
      .from('inicio_sesion')
      .upsert({ rfc_empleado: rfc_empleado.toUpperCase(), clave: hash });

    if (error) throw error;
    res.json({ mensaje: 'Contraseña registrada correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { enviarBienvenidaEmpleado } = require('../services/email');

const RESET_SECRET = (process.env.JWT_SECRET || 'clave123') + '_reset_2024';

// GET /api/empleados
router.get('/', async (req, res) => {
  try {
    const { id_tienda, activo, search } = req.query;
    let query = supabase.from('catalogo_empleados').select('*, tiendas(nombre_tienda)').order('apellido_paterno');
    if (id_tienda) query = query.eq('id_tienda', id_tienda);
    if (activo !== undefined) query = query.eq('activo', activo === 'true');
    if (search) query = query.or(`nombre.ilike.%${search}%,apellido_paterno.ilike.%${search}%,rfc_empleado.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/empleados/:rfc
router.get('/:rfc', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('catalogo_empleados')
      .select('*, tiendas(nombre_tienda, id_tienda), telefonos(*)')
      .eq('rfc_empleado', req.params.rfc.toUpperCase())
      .single();
    if (error || !data) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/empleados — Crear + enviar email de bienvenida con link
router.post('/', async (req, res) => {
  try {
    const {
      rfc_empleado, apellido_paterno, apellido_materno, nombre, puesto,
      correo_electronico, calle, numero_exterior, numero_interior, colonia,
      codigo_postal, municipio, localidad, estado, id_tienda, telefonos
    } = req.body;

    if (!rfc_empleado || !nombre || !apellido_paterno || !puesto)
      return res.status(400).json({ error: 'RFC, nombre, apellido paterno y puesto son requeridos' });

    const rfcUpper = rfc_empleado.toUpperCase();

    const { data, error } = await supabase
      .from('catalogo_empleados')
      .insert({ rfc_empleado: rfcUpper, apellido_paterno, apellido_materno, nombre, puesto, correo_electronico, calle, numero_exterior, numero_interior, colonia, codigo_postal, municipio, localidad, estado, id_tienda })
      .select().single();
    if (error) throw error;

    // Crear registro en inicio_sesion SIN contraseña (clave vacía)
    // El empleado la establecerá desde el link del email
    const { error: errorSesion } = await supabase.from('inicio_sesion').upsert({ rfc_empleado: rfcUpper, clave: '' });
    if (errorSesion) console.error('Error inicio_sesion:', errorSesion.message);

    if (telefonos?.length) {
      await supabase.from('telefonos').insert(telefonos.map(t => ({ telefono: t.telefono, rfc_empleado: rfcUpper, tipo_telefono: t.tipo_telefono })));
    }

    // Generar token de set-password con 24h de expiración y enviar email
    let emailEnviado = false;
    if (correo_electronico) {
      const setToken = jwt.sign({ rfc: rfcUpper, tipo: 'set' }, RESET_SECRET, { expiresIn: '24h' });
      try {
        await enviarBienvenidaEmpleado({
          nombre: `${nombre} ${apellido_paterno}`,
          correo: correo_electronico,
          rfc: rfcUpper,
          token: setToken,
        });
        emailEnviado = true;
      } catch (e) {
        console.error('Email bienvenida error:', e.message);
      }
    }

    res.status(201).json({ ...data, email_enviado: emailEnviado });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/empleados/:rfc — Editar + opción de reenviar link
router.put('/:rfc', async (req, res) => {
  try {
    const rfcUpper = req.params.rfc.toUpperCase();
    const fields = ['apellido_paterno','apellido_materno','nombre','puesto','correo_electronico','calle','numero_exterior','numero_interior','colonia','codigo_postal','municipio','localidad','estado','id_tienda','activo'];
    const update = {};
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const { data, error } = await supabase.from('catalogo_empleados').update(update).eq('rfc_empleado', rfcUpper).select().single();
    if (error) throw error;

    let emailEnviado = false;
    // Si el admin activa "reenviar_link", enviamos nuevo email con link de set-password
    if (req.body.reenviar_link) {
      const correo = data.correo_electronico;
      if (correo) {
        const setToken = jwt.sign({ rfc: rfcUpper, tipo: 'set' }, RESET_SECRET, { expiresIn: '24h' });
        try {
          await enviarBienvenidaEmpleado({
            nombre: `${data.nombre} ${data.apellido_paterno}`,
            correo,
            rfc: rfcUpper,
            token: setToken,
          });
          emailEnviado = true;
        } catch (e) {
          console.error('Email reenvio error:', e.message);
        }
      }
    }

    res.json({ ...data, email_enviado: emailEnviado });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

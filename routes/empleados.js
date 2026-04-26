const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const { enviarCredencialesEmpleado } = require('../services/email');

// GET /api/empleados
router.get('/', async (req, res) => {
  try {
    const { id_tienda, activo, search } = req.query;
    let query = supabase
      .from('catalogo_empleados')
      .select('*, tiendas(nombre_tienda)')
      .order('apellido_paterno');
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

// POST /api/empleados — Crear + enviar credenciales por email
router.post('/', async (req, res) => {
  try {
    const {
      rfc_empleado, apellido_paterno, apellido_materno, nombre, puesto,
      correo_electronico, calle, numero_exterior, numero_interior, colonia,
      codigo_postal, municipio, localidad, estado, id_tienda, telefonos,
      contrasena_inicial
    } = req.body;

    if (!rfc_empleado || !nombre || !apellido_paterno || !puesto)
      return res.status(400).json({ error: 'RFC, nombre, apellido paterno y puesto son requeridos' });

    const rfcUpper = rfc_empleado.toUpperCase();

    const { data, error } = await supabase
      .from('catalogo_empleados')
      .insert({
        rfc_empleado: rfcUpper, apellido_paterno, apellido_materno,
        nombre, puesto, correo_electronico, calle, numero_exterior, numero_interior,
        colonia, codigo_postal, municipio, localidad, estado, id_tienda
      })
      .select()
      .single();
    if (error) throw error;

    const clavePlana = contrasena_inicial?.trim() || rfcUpper;
    const claveHash = await bcrypt.hash(clavePlana, 10);
    const { error: errorSesion } = await supabase
      .from('inicio_sesion')
      .upsert({ rfc_empleado: rfcUpper, clave: claveHash });
    if (errorSesion) console.error('Error inicio_sesion:', errorSesion.message);

    if (telefonos?.length) {
      await supabase.from('telefonos').insert(
        telefonos.map(t => ({ telefono: t.telefono, rfc_empleado: rfcUpper, tipo_telefono: t.tipo_telefono }))
      );
    }

    // Enviar credenciales por email (no bloqueante)
    if (correo_electronico) {
      enviarCredencialesEmpleado({
        nombre: `${nombre} ${apellido_paterno}`,
        correo: correo_electronico,
        rfc: rfcUpper,
        contrasena: clavePlana,
      }).catch(e => console.error('Email error:', e.message));
    }

    res.status(201).json({
      ...data,
      inicio_sesion_creado: !errorSesion,
      contrasena_inicial: clavePlana,
      email_enviado: !!correo_electronico,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/empleados/:rfc — Editar + opcional cambiar contraseña + re-enviar email
router.put('/:rfc', async (req, res) => {
  try {
    const rfcUpper = req.params.rfc.toUpperCase();
    const fields = ['apellido_paterno','apellido_materno','nombre','puesto',
      'correo_electronico','calle','numero_exterior','numero_interior',
      'colonia','codigo_postal','municipio','localidad','estado','id_tienda','activo'];
    const update = {};
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const { data, error } = await supabase
      .from('catalogo_empleados')
      .update(update)
      .eq('rfc_empleado', rfcUpper)
      .select()
      .single();
    if (error) throw error;

    let emailEnviado = false;
    const { nueva_contrasena } = req.body;

    if (nueva_contrasena?.trim()) {
      const claveHash = await bcrypt.hash(nueva_contrasena.trim(), 10);
      await supabase.from('inicio_sesion').upsert({ rfc_empleado: rfcUpper, clave: claveHash });

      const correo = data.correo_electronico;
      if (correo) {
        enviarCredencialesEmpleado({
          nombre: `${data.nombre} ${data.apellido_paterno}`,
          correo,
          rfc: rfcUpper,
          contrasena: nueva_contrasena.trim(),
        }).catch(e => console.error('Email error:', e.message));
        emailEnviado = true;
      }
    }

    res.json({ ...data, email_enviado: emailEnviado });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

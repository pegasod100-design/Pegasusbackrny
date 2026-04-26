const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { enviarBienvenidaEmpleado } = require('../services/email');

const RESET_SECRET = (process.env.JWT_SECRET || 'clave123') + '_reset_2024';

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

router.get('/:rfc', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('catalogo_empleados')
      .select('*, tiendas(nombre_tienda, id_tienda), telefonos(*)')
      .eq('rfc_empleado', req.params.rfc.toUpperCase()).single();
    if (error || !data) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { rfc_empleado, apellido_paterno, apellido_materno, nombre, puesto,
      correo_electronico, calle, numero_exterior, numero_interior, colonia,
      codigo_postal, municipio, localidad, estado, id_tienda, telefonos } = req.body;

    if (!rfc_empleado || !nombre || !apellido_paterno || !puesto)
      return res.status(400).json({ error: 'RFC, nombre, apellido paterno y puesto son requeridos' });

    const rfcUpper = rfc_empleado.toUpperCase();
    const { data, error } = await supabase
      .from('catalogo_empleados')
      .insert({ rfc_empleado: rfcUpper, apellido_paterno, apellido_materno, nombre, puesto,
        correo_electronico, calle, numero_exterior, numero_interior, colonia,
        codigo_postal, municipio, localidad, estado, id_tienda })
      .select().single();
    if (error) throw error;

    const claveTemp = 'PENDIENTE_' + rfcUpper + '_' + Date.now();
    await supabase.from('inicio_sesion').upsert({ rfc_empleado: rfcUpper, clave: claveTemp });

    if (telefonos?.length) {
      await supabase.from('telefonos').insert(telefonos.map(t => ({ telefono: t.telefono, rfc_empleado: rfcUpper, tipo_telefono: t.tipo_telefono })));
    }

    let emailEnviado = false;
    if (correo_electronico) {
      const setToken = jwt.sign({ rfc: rfcUpper, tipo: 'set' }, RESET_SECRET, { expiresIn: '24h' });
      try {
        await enviarBienvenidaEmpleado({ nombre: `${nombre} ${apellido_paterno}`, correo: correo_electronico, rfc: rfcUpper, token: setToken });
        emailEnviado = true;
      } catch (e) { console.error('Email error:', e.message); }
    }

    res.status(201).json({ ...data, email_enviado: emailEnviado });
  } catch (err) {
    console.error('Error crear empleado:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:rfc', async (req, res) => {
  try {
    const rfcUpper = req.params.rfc.toUpperCase();
    const fields = ['apellido_paterno','apellido_materno','nombre','puesto','correo_electronico',
      'calle','numero_exterior','numero_interior','colonia','codigo_postal','municipio','localidad','estado','id_tienda','activo'];
    const update = {};
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const { data, error } = await supabase.from('catalogo_empleados').update(update).eq('rfc_empleado', rfcUpper).select().single();
    if (error) throw error;

    let emailEnviado = false;
    if (req.body.reenviar_link && data.correo_electronico) {
      const setToken = jwt.sign({ rfc: rfcUpper, tipo: 'set' }, RESET_SECRET, { expiresIn: '24h' });
      try {
        await enviarBienvenidaEmpleado({ nombre: `${data.nombre} ${data.apellido_paterno}`, correo: data.correo_electronico, rfc: rfcUpper, token: setToken });
        emailEnviado = true;
      } catch (e) { console.error('Email reenvio error:', e.message); }
    }
    res.json({ ...data, email_enviado: emailEnviado });
  } catch (err) {
    console.error('Error editar empleado:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE — elimina por completo de inicio_sesion Y catalogo_empleados
router.delete('/:rfc', async (req, res) => {
  try {
    const rfcUpper = req.params.rfc.toUpperCase();

    // 1️⃣ Eliminar de inicio_sesion
    await supabase.from('inicio_sesion').delete().eq('rfc_empleado', rfcUpper);
    // 2️⃣ Eliminar de catalogo_empleados
    const { error } = await supabase.from('catalogo_empleados').delete().eq('rfc_empleado', rfcUpper);
    if (error) throw error;

    res.json({ mensaje: 'Empleado eliminado completamente' });
  } catch (err) {
    console.error('Error eliminar empleado:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

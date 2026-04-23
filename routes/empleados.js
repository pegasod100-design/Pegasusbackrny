const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/empleados/:rfc
router.get('/:rfc', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('catalogo_empleados')
      .select('*, tiendas(nombre_tienda), telefonos(*)')
      .eq('rfc_empleado', req.params.rfc.toUpperCase())
      .single();
    if (error || !data) return res.status(404).json({ error: 'Empleado no encontrado' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/empleados
router.post('/', async (req, res) => {
  try {
    const {
      rfc_empleado, apellido_paterno, apellido_materno, nombre, puesto,
      correo_electronico, calle, numero_exterior, numero_interior, colonia,
      codigo_postal, municipio, localidad, estado, id_tienda, telefonos,
      contrasena_inicial
    } = req.body;

    if (!rfc_empleado || !nombre || !apellido_paterno || !puesto) {
      return res.status(400).json({ error: 'RFC, nombre, apellido paterno y puesto son requeridos' });
    }

    const rfcUpper = rfc_empleado.toUpperCase();

    // 1️⃣ Insertar empleado en catalogo_empleados
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

    // 2️⃣ Registrar automáticamente en inicio_sesion (contraseña hasheada con bcrypt)
    // La contraseña inicial es la que el administrador definió, o el RFC por defecto
    const clavePlana = contrasena_inicial && contrasena_inicial.trim()
      ? contrasena_inicial.trim()
      : rfcUpper;

    const claveHash = await bcrypt.hash(clavePlana, 10);

    const { error: errorSesion } = await supabase
      .from('inicio_sesion')
      .upsert({ rfc_empleado: rfcUpper, clave: claveHash });

    if (errorSesion) {
      console.error('Error registrando inicio_sesion:', errorSesion.message);
    }

    // 3️⃣ Insertar teléfonos si vienen
    if (telefonos?.length) {
      const tels = telefonos.map(t => ({
        telefono: t.telefono,
        rfc_empleado: rfcUpper,
        tipo_telefono: t.tipo_telefono
      }));
      await supabase.from('telefonos').insert(tels);
    }

    res.status(201).json({
      ...data,
      inicio_sesion_creado: !errorSesion,
      contrasena_inicial: clavePlana
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/empleados/:rfc
router.put('/:rfc', async (req, res) => {
  try {
    const fields = ['apellido_paterno','apellido_materno','nombre','puesto',
      'correo_electronico','calle','numero_exterior','numero_interior',
      'colonia','codigo_postal','municipio','localidad','estado','id_tienda','activo'];
    const update = {};
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    const { data, error } = await supabase
      .from('catalogo_empleados')
      .update(update)
      .eq('rfc_empleado', req.params.rfc.toUpperCase())
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

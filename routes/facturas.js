const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/facturas
router.get('/', async (req, res) => {
  try {
    const { id_tienda } = req.query;
    let query = supabase
      .from('facturas')
      .select('*, tiendas(nombre_tienda), catalogo_empleados(nombre, apellido_paterno)')
      .order('fecha', { ascending: false });

    if (id_tienda) query = query.eq('id_tienda', id_tienda);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error listando facturas:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/facturas/:folio
router.get('/:folio', async (req, res) => {
  try {
    const { data: factura, error: e1 } = await supabase
      .from('facturas')
      .select('*, tiendas(nombre_tienda), catalogo_empleados(nombre, apellido_paterno)')
      .eq('folio_factura', req.params.folio)
      .single();

    if (e1 || !factura) return res.status(404).json({ error: 'Factura no encontrada' });

    const { data: detalle, error: e2 } = await supabase
      .from('detalle_facturas')
      .select('*, catalogo_productos(nombre_producto, categoria, unidad_medida)')
      .eq('folio_factura', req.params.folio);

    if (e2) throw e2;
    res.json({ factura, detalle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/facturas - RFC se toma del token de sesión automáticamente
router.post('/', async (req, res) => {
  try {
    const { folio_factura, empresa_proveedora, id_tienda, items } = req.body;
    const rfc_empleado = req.empleado?.rfc;

    if (!folio_factura || !empresa_proveedora || !id_tienda || !items?.length) {
      return res.status(400).json({ error: 'Folio, proveedor, tienda y productos son requeridos' });
    }
    if (!rfc_empleado) {
      return res.status(401).json({ error: 'No se pudo identificar al empleado. Vuelve a iniciar sesión.' });
    }

    // 1️ Insertar factura con el RFC del empleado logueado
    const { data: factura, error: e1 } = await supabase
      .from('facturas')
      .insert({ folio_factura, empresa_proveedora, id_tienda: parseInt(id_tienda), rfc_empleado })
      .select()
      .single();
    if (e1) throw e1;

    // 2️ Insertar detalle
    const detalles = items.map(item => ({
      folio_factura: factura.folio_factura,
      codigo_producto: item.codigo_producto,
      cantidad_entrada: parseInt(item.cantidad_entrada),
      precio_compra: parseFloat(item.precio_compra)
    }));

    const { error: e2 } = await supabase.from('detalle_facturas').insert(detalles);
    if (e2) {
      await supabase.from('facturas').delete().eq('folio_factura', factura.folio_factura);
      throw e2;
    }

    res.status(201).json({
      folio_factura: factura.folio_factura,
      fecha: factura.fecha,
      empresa_proveedora: factura.empresa_proveedora,
      rfc_empleado: factura.rfc_empleado,
      items: detalles.length
    });
  } catch (err) {
    console.error('Error registrando factura:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { enviarTicketVenta } = require('../services/email');

// GET /api/ventas
router.get('/', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, id_tienda } = req.query;
    let query = supabase.from('vista_ventas_resumen').select('*').order('fecha_venta', { ascending: false });
    if (fecha_inicio) query = query.gte('fecha_venta', fecha_inicio);
    if (fecha_fin) query = query.lte('fecha_venta', fecha_fin);
    if (id_tienda) query = query.eq('id_tienda', id_tienda);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ventas/:folio
router.get('/:folio', async (req, res) => {
  try {
    const { data: venta, error: e1 } = await supabase
      .from('ventas')
      .select('*, catalogo_empleados(nombre, apellido_paterno), tiendas(nombre_tienda)')
      .eq('folio_venta', req.params.folio)
      .single();
    if (e1 || !venta) return res.status(404).json({ error: 'Venta no encontrada' });
    const { data: detalle, error: e2 } = await supabase
      .from('detalle_ventas')
      .select('*, catalogo_productos(nombre_producto, categoria, unidad_medida)')
      .eq('folio_venta', req.params.folio);
    if (e2) throw e2;
    res.json({ venta, detalle });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ventas — Registrar venta + enviar ticket por email al admin
router.post('/', async (req, res) => {
  try {
    const { iva = 16, id_tienda, items } = req.body;
    const rfc_empleado = req.empleado.rfc;

    if (!id_tienda || !items?.length)
      return res.status(400).json({ error: 'id_tienda e items son requeridos' });

    // Insertar venta
    const { data: venta, error: e1 } = await supabase
      .from('ventas')
      .insert({ iva, rfc_empleado, id_tienda })
      .select()
      .single();
    if (e1) throw e1;

    const detalles = items.map(item => ({
      folio_venta: venta.folio_venta,
      codigo_producto: item.codigo_producto,
      cantidad_venta: item.cantidad_venta,
      precio_unitario: item.precio_unitario
    }));

    const { error: e2 } = await supabase.from('detalle_ventas').insert(detalles);
    if (e2) {
      await supabase.from('ventas').delete().eq('folio_venta', venta.folio_venta);
      throw e2;
    }

    const subtotal = items.reduce((acc, i) => acc + i.cantidad_venta * i.precio_unitario, 0);
    const ivaAmount = subtotal * (iva / 100);
    const total = subtotal + ivaAmount;

    // ── Obtener nombre de tienda y datos del cajero ──
    const [{ data: tiendaData }, { data: cajeroData }] = await Promise.all([
      supabase.from('tiendas').select('nombre_tienda').eq('id_tienda', id_tienda).single(),
      supabase.from('catalogo_empleados').select('nombre, apellido_paterno, correo_electronico').eq('rfc_empleado', rfc_empleado).single(),
    ]);

    // ── Obtener correo del administrador ──
    const { data: admins } = await supabase
      .from('catalogo_empleados')
      .select('correo_electronico')
      .eq('puesto', 'Administrador')
      .eq('activo', true)
      .limit(1);
    const correoAdmin = admins?.[0]?.correo_electronico || process.env.EMAIL_ADMIN;

    // Obtener nombres de productos para el ticket
    const itemsConNombre = await Promise.all(
      items.map(async i => {
        const { data: prod } = await supabase
          .from('catalogo_productos')
          .select('nombre_producto')
          .eq('codigo_producto', i.codigo_producto)
          .single();
        return { ...i, nombre_producto: prod?.nombre_producto || i.codigo_producto };
      })
    );

    // Enviar ticket por email (no bloqueante)
    if (correoAdmin) {
      enviarTicketVenta({
        folio: venta.folio_venta,
        fecha: new Date().toLocaleString('es-MX'),
        cajero: cajeroData ? `${cajeroData.nombre} ${cajeroData.apellido_paterno}` : rfc_empleado,
        tienda: tiendaData?.nombre_tienda || `Tienda #${id_tienda}`,
        items: itemsConNombre,
        subtotal,
        iva: ivaAmount,
        total,
        correoAdmin,
      }).catch(e => console.error('Email ticket error:', e.message));
    }

    res.status(201).json({
      folio_venta: venta.folio_venta,
      fecha_venta: venta.fecha_venta,
      hora: venta.hora,
      subtotal: parseFloat(subtotal.toFixed(2)),
      iva_porcentaje: iva,
      total: parseFloat(total.toFixed(2)),
      items: detalles.length,
      ticket_enviado: !!correoAdmin,
    });
  } catch (err) {
    console.error('Error al registrar venta:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ventas/estadisticas/resumen
router.get('/estadisticas/resumen', async (req, res) => {
  try {
    const { id_tienda, dias = 30 } = req.query;
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - parseInt(dias));
    const fechaStr = fechaInicio.toISOString().split('T')[0];
    let query = supabase.from('vista_ventas_resumen').select('*').gte('fecha_venta', fechaStr);
    if (id_tienda) query = query.eq('id_tienda', id_tienda);
    const { data, error } = await query;
    if (error) throw error;
    const porFecha = {};
    data.forEach(row => {
      if (!porFecha[row.fecha_venta])
        porFecha[row.fecha_venta] = { fecha: row.fecha_venta, total: 0, num_ventas: 0 };
      porFecha[row.fecha_venta].total += parseFloat(row.total_con_iva || 0);
      porFecha[row.fecha_venta].num_ventas += parseInt(row.num_ventas || 0);
    });
    const totalGeneral = data.reduce((acc, r) => acc + parseFloat(r.total_con_iva || 0), 0);
    const totalVentas = data.reduce((acc, r) => acc + parseInt(r.num_ventas || 0), 0);
    res.json({
      total_general: parseFloat(totalGeneral.toFixed(2)),
      total_ventas: totalVentas,
      promedio_diario: parseFloat((totalGeneral / parseInt(dias)).toFixed(2)),
      por_fecha: Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha))
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

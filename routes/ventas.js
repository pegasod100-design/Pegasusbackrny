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
    if (fecha_fin)    query = query.lte('fecha_venta', fecha_fin);
    if (id_tienda)    query = query.eq('id_tienda', id_tienda);
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
      .eq('folio_venta', req.params.folio).single();
    if (e1 || !venta) return res.status(404).json({ error: 'Venta no encontrada' });
    const { data: detalle, error: e2 } = await supabase
      .from('detalle_ventas')
      .select('*, catalogo_productos(nombre_producto, categoria, unidad_medida)')
      .eq('folio_venta', req.params.folio);
    if (e2) throw e2;
    res.json({ venta, detalle });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ventas — Registrar venta + enviar ticket al admin Y al cliente
router.post('/', async (req, res) => {
  try {
    const { iva = 0, id_tienda, items, correo_cliente, nombre_cliente } = req.body;
    const rfc_empleado = req.empleado.rfc;

    if (!id_tienda || !items?.length)
      return res.status(400).json({ error: 'id_tienda e items son requeridos' });

    // 1️⃣ Insertar venta
    const { data: venta, error: e1 } = await supabase
      .from('ventas').insert({ iva, rfc_empleado, id_tienda }).select().single();
    if (e1) throw e1;

    // 2️⃣ Insertar detalle
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

    const subtotal   = items.reduce((acc, i) => acc + i.cantidad_venta * i.precio_unitario, 0);
    const ivaAmount  = 0;
    const total      = subtotal;

    // 3️⃣ Datos de tienda y cajero
    const [{ data: tiendaData }, { data: cajeroData }] = await Promise.all([
      supabase.from('tiendas').select('nombre_tienda').eq('id_tienda', id_tienda).single(),
      supabase.from('catalogo_empleados').select('nombre, apellido_paterno').eq('rfc_empleado', rfc_empleado).single(),
    ]);

    // 4️⃣ Correo del administrador
    const { data: admins } = await supabase
      .from('catalogo_empleados').select('correo_electronico')
      .eq('puesto', 'Administrador').eq('activo', true).limit(1);
    const correoAdmin = admins?.[0]?.correo_electronico || process.env.EMAIL_ADMIN;

    // 5️⃣ Nombres de productos
    const itemsConNombre = await Promise.all(items.map(async i => {
      const { data: prod } = await supabase
        .from('catalogo_productos').select('nombre_producto')
        .eq('codigo_producto', i.codigo_producto).single();
      return { ...i, nombre_producto: prod?.nombre_producto || i.codigo_producto };
    }));

    const datosTicket = {
      folio:    venta.folio_venta,
      fecha:    new Date().toLocaleString('es-MX'),
      cajero:   cajeroData ? `${cajeroData.nombre} ${cajeroData.apellido_paterno}` : rfc_empleado,
      tienda:   tiendaData?.nombre_tienda || `Tienda #${id_tienda}`,
      items:    itemsConNombre,
      subtotal, iva: ivaAmount, total,
    };

    // 6️⃣ Enviar ticket al administrador (no bloqueante)
    if (correoAdmin) {
      enviarTicketVenta({ ...datosTicket, correoDestino: correoAdmin, esAdmin: true })
        .catch(e => console.error('Email admin error:', e.message));
    }

    // 7️⃣ Enviar ticket al cliente si proporcionó correo (no bloqueante)
    if (correo_cliente) {
      enviarTicketVenta({
        ...datosTicket,
        correoDestino: correo_cliente,
        nombreCliente: nombre_cliente || 'Cliente',
        esAdmin: false,
      }).catch(e => console.error('Email cliente error:', e.message));
    }

    res.status(201).json({
      folio_venta:    venta.folio_venta,
      fecha_venta:    venta.fecha_venta,
      subtotal:       parseFloat(subtotal.toFixed(2)),
      iva_porcentaje: iva,
      total:          parseFloat(total.toFixed(2)),
      cajero:         cajeroData ? `${cajeroData.nombre} ${cajeroData.apellido_paterno}` : rfc_empleado,
      tienda:         tiendaData?.nombre_tienda || `Tienda #${id_tienda}`,
      items:          itemsConNombre,
      ticket_admin:   !!correoAdmin,
      ticket_cliente: !!correo_cliente,
    });
  } catch (err) {
    console.error('Error al registrar venta:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
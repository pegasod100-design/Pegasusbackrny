const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/reportes/ventas-por-dia
router.get('/ventas-por-dia', async (req, res) => {
  try {
    const { id_tienda, fecha_inicio, fecha_fin } = req.query;
    let query = supabase
      .from('vista_ventas_resumen')
      .select('*')
      .order('fecha_venta', { ascending: true });
    if (id_tienda) query = query.eq('id_tienda', parseInt(id_tienda));
    if (fecha_inicio) query = query.gte('fecha_venta', fecha_inicio);
    if (fecha_fin) query = query.lte('fecha_venta', fecha_fin);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/productos-mas-vendidos
router.get('/productos-mas-vendidos', async (req, res) => {
  try {
    const { id_tienda, limit = 10 } = req.query;
    let query = supabase
      .from('detalle_ventas')
      .select(`
        codigo_producto,
        cantidad_venta,
        precio_unitario,
        catalogo_productos(nombre_producto, categoria),
        ventas(id_tienda, fecha_venta)
      `);
    const { data, error } = await query;
    if (error) throw error;

    // Agrupar por producto
    const agrupado = {};
    data.forEach(d => {
      if (id_tienda && d.ventas?.id_tienda !== parseInt(id_tienda)) return;
      const key = d.codigo_producto;
      if (!agrupado[key]) {
        agrupado[key] = {
          codigo_producto: key,
          nombre_producto: d.catalogo_productos?.nombre_producto,
          categoria: d.catalogo_productos?.categoria,
          total_cantidad: 0,
          total_ingresos: 0
        };
      }
      agrupado[key].total_cantidad += d.cantidad_venta;
      agrupado[key].total_ingresos += d.cantidad_venta * d.precio_unitario;
    });

    const resultado = Object.values(agrupado)
      .sort((a, b) => b.total_cantidad - a.total_cantidad)
      .slice(0, parseInt(limit))
      .map(p => ({ ...p, total_ingresos: parseFloat(p.total_ingresos.toFixed(2)) }));

    res.json(resultado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/ventas-por-tienda
router.get('/ventas-por-tienda', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let query = supabase.from('vista_ventas_resumen').select('*');
    if (fecha_inicio) query = query.gte('fecha_venta', fecha_inicio);
    if (fecha_fin) query = query.lte('fecha_venta', fecha_fin);
    const { data, error } = await query;
    if (error) throw error;

    // Agrupar por tienda
    const porTienda = {};
    data.forEach(r => {
      const k = r.id_tienda;
      if (!porTienda[k]) {
        porTienda[k] = {
          id_tienda: k,
          nombre_tienda: r.nombre_tienda,
          total_ventas: 0,
          total_ingresos: 0
        };
      }
      porTienda[k].total_ventas += parseInt(r.num_ventas || 0);
      porTienda[k].total_ingresos += parseFloat(r.total_con_iva || 0);
    });

    res.json(Object.values(porTienda).map(t => ({
      ...t,
      total_ingresos: parseFloat(t.total_ingresos.toFixed(2))
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/stock-global
router.get('/stock-global', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vista_stock_tiendas')
      .select('*')
      .order('nombre_tienda');
    if (error) throw error;

    const resumen = {
      total_productos: new Set(data.map(d => d.codigo_producto)).size,
      sin_stock: data.filter(d => d.estado_stock === 'Sin stock').length,
      stock_bajo: data.filter(d => d.estado_stock === 'Stock bajo').length,
      ok: data.filter(d => d.estado_stock === 'OK').length,
      detalle: data
    };
    res.json(resumen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/dashboard - Métricas generales del dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];
    const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [ventasHoy, ventas30, stockBajo, totalProductos, totalTiendas] = await Promise.all([
      supabase.from('vista_ventas_resumen').select('num_ventas,total_con_iva').eq('fecha_venta', hoy),
      supabase.from('vista_ventas_resumen').select('total_con_iva').gte('fecha_venta', hace30),
      supabase.from('vista_stock_tiendas').select('codigo_producto').in('estado_stock', ['Sin stock', 'Stock bajo']),
      supabase.from('catalogo_productos').select('codigo_producto', { count: 'exact' }).eq('activo', true),
      supabase.from('tiendas').select('id_tienda', { count: 'exact' }).eq('activa', true)
    ]);

    const ventasHoyTotal = (ventasHoy.data || []).reduce((a, r) => a + parseFloat(r.total_con_iva || 0), 0);
    const ventasHoyNum = (ventasHoy.data || []).reduce((a, r) => a + parseInt(r.num_ventas || 0), 0);
    const ventas30Total = (ventas30.data || []).reduce((a, r) => a + parseFloat(r.total_con_iva || 0), 0);

    res.json({
      ventas_hoy: { total: parseFloat(ventasHoyTotal.toFixed(2)), num_ventas: ventasHoyNum },
      ventas_30_dias: parseFloat(ventas30Total.toFixed(2)),
      alertas_stock: stockBajo.data?.length || 0,
      total_productos_activos: totalProductos.count || 0,
      total_tiendas_activas: totalTiendas.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

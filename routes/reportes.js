const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/reportes/ventas-por-dia
router.get('/ventas-por-dia', async (req, res) => {
  try {
    const { id_tienda, fecha_inicio, fecha_fin } = req.query;
    let query = supabase.from('vista_ventas_resumen').select('*').order('fecha_venta', { ascending: true });
    if (id_tienda)    query = query.eq('id_tienda', parseInt(id_tienda));
    if (fecha_inicio) query = query.gte('fecha_venta', fecha_inicio);
    if (fecha_fin)    query = query.lte('fecha_venta', fecha_fin);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reportes/productos-mas-vendidos
router.get('/productos-mas-vendidos', async (req, res) => {
  try {
    const { id_tienda, fecha_inicio, fecha_fin, limit = 10 } = req.query;
    let query = supabase.from('detalle_ventas').select(`
      codigo_producto, cantidad_venta, precio_unitario,
      catalogo_productos(nombre_producto, categoria),
      ventas(id_tienda, fecha_venta)
    `);
    if (fecha_inicio) query = query.gte('ventas.fecha_venta', fecha_inicio);
    if (fecha_fin)    query = query.lte('ventas.fecha_venta', fecha_fin);
    const { data, error } = await query;
    if (error) throw error;

    const agrupado = {};
    data.forEach(d => {
      if (!d.ventas) return;
      if (id_tienda && String(d.ventas.id_tienda) !== String(id_tienda)) return;
      if (fecha_inicio && d.ventas.fecha_venta < fecha_inicio) return;
      if (fecha_fin   && d.ventas.fecha_venta > fecha_fin)    return;
      const key = d.codigo_producto;
      if (!agrupado[key]) agrupado[key] = {
        codigo_producto: key,
        nombre_producto: d.catalogo_productos?.nombre_producto || key,
        categoria: d.catalogo_productos?.categoria || '-',
        total_cantidad: 0, total_ingresos: 0
      };
      agrupado[key].total_cantidad += d.cantidad_venta;
      agrupado[key].total_ingresos += d.cantidad_venta * d.precio_unitario;
    });

    res.json(Object.values(agrupado)
      .sort((a,b) => b.total_cantidad - a.total_cantidad)
      .slice(0, parseInt(limit))
      .map(p => ({ ...p, total_ingresos: parseFloat(p.total_ingresos.toFixed(2)) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reportes/ventas-por-tienda
router.get('/ventas-por-tienda', async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    let query = supabase.from('vista_ventas_resumen').select('*');
    if (fecha_inicio) query = query.gte('fecha_venta', fecha_inicio);
    if (fecha_fin)    query = query.lte('fecha_venta', fecha_fin);
    const { data, error } = await query;
    if (error) throw error;

    const porTienda = {};
    data.forEach(r => {
      const k = r.id_tienda;
      if (!porTienda[k]) porTienda[k] = { id_tienda: k, nombre_tienda: r.nombre_tienda, total_ventas: 0, total_ingresos: 0 };
      porTienda[k].total_ventas  += parseInt(r.num_ventas || 0);
      porTienda[k].total_ingresos += parseFloat(r.total_con_iva || 0);
    });

    res.json(Object.values(porTienda).map(t => ({ ...t, total_ingresos: parseFloat(t.total_ingresos.toFixed(2)) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reportes/detalle-productos  — detalle completo por producto para PDF
// Devuelve: por cada producto → por fecha → cantidad y monto
router.get('/detalle-productos', async (req, res) => {
  try {
    const { id_tienda, fecha_inicio, fecha_fin } = req.query;

    const { data, error } = await supabase
      .from('detalle_ventas')
      .select(`
        codigo_producto, cantidad_venta, precio_unitario,
        catalogo_productos(nombre_producto, categoria),
        ventas(id_tienda, fecha_venta, tiendas(nombre_tienda))
      `);
    if (error) throw error;

    // Filtrar
    const filtrado = data.filter(d => {
      if (!d.ventas) return false;
      if (id_tienda   && String(d.ventas.id_tienda) !== String(id_tienda)) return false;
      if (fecha_inicio && d.ventas.fecha_venta < fecha_inicio) return false;
      if (fecha_fin    && d.ventas.fecha_venta > fecha_fin)    return false;
      return true;
    });

    // Agrupar por tienda → fecha → producto
    const porTienda = {};
    filtrado.forEach(d => {
      const tid   = d.ventas.id_tienda;
      const tnombre = d.ventas.tiendas?.nombre_tienda || `Tienda ${tid}`;
      const fecha = d.ventas.fecha_venta;
      const cod   = d.codigo_producto;
      const nom   = d.catalogo_productos?.nombre_producto || cod;
      const cat   = d.catalogo_productos?.categoria || '-';

      if (!porTienda[tid]) porTienda[tid] = { id_tienda: tid, nombre_tienda: tnombre, por_fecha: {}, por_producto: {} };

      // Por fecha
      if (!porTienda[tid].por_fecha[fecha]) porTienda[tid].por_fecha[fecha] = {};
      if (!porTienda[tid].por_fecha[fecha][cod])
        porTienda[tid].por_fecha[fecha][cod] = { codigo_producto: cod, nombre_producto: nom, categoria: cat, cantidad: 0, importe: 0 };
      porTienda[tid].por_fecha[fecha][cod].cantidad += d.cantidad_venta;
      porTienda[tid].por_fecha[fecha][cod].importe  += d.cantidad_venta * d.precio_unitario;

      // Por producto (total del período)
      if (!porTienda[tid].por_producto[cod])
        porTienda[tid].por_producto[cod] = { codigo_producto: cod, nombre_producto: nom, categoria: cat, cantidad: 0, importe: 0 };
      porTienda[tid].por_producto[cod].cantidad += d.cantidad_venta;
      porTienda[tid].por_producto[cod].importe  += d.cantidad_venta * d.precio_unitario;
    });

    // Convertir a arrays y calcular totales
    const resultado = Object.values(porTienda).map(t => {
      const fechas = Object.entries(t.por_fecha)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([fecha, prods]) => {
          const productos = Object.values(prods).map(p => ({ ...p, importe: parseFloat(p.importe.toFixed(2)) }));
          const total_dia = productos.reduce((s,p) => s + p.importe, 0);
          return { fecha, productos, total_dia: parseFloat(total_dia.toFixed(2)) };
        });

      const productos_periodo = Object.values(t.por_producto)
        .sort((a,b) => b.importe - a.importe)
        .map(p => ({ ...p, importe: parseFloat(p.importe.toFixed(2)) }));

      const total_periodo = productos_periodo.reduce((s,p) => s + p.importe, 0);

      return {
        id_tienda: t.id_tienda,
        nombre_tienda: t.nombre_tienda,
        fechas,
        productos_periodo,
        total_periodo: parseFloat(total_periodo.toFixed(2)),
        mas_vendido: productos_periodo[0] || null,
      };
    }).sort((a,b) => b.total_periodo - a.total_periodo);

    res.json(resultado);
  } catch (err) {
    console.error('Error detalle-productos:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reportes/stock-global
router.get('/stock-global', async (req, res) => {
  try {
    const { data, error } = await supabase.from('vista_stock_tiendas').select('*').order('nombre_tienda');
    if (error) throw error;
    res.json({
      total_productos: new Set(data.map(d => d.codigo_producto)).size,
      sin_stock: data.filter(d => d.estado_stock === 'Sin stock').length,
      stock_bajo: data.filter(d => d.estado_stock === 'Stock bajo').length,
      ok: data.filter(d => d.estado_stock === 'OK').length,
      detalle: data
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/reportes/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const hoy   = new Date().toISOString().split('T')[0];
    const hace30 = new Date(Date.now() - 30*86400000).toISOString().split('T')[0];
    const [ventasHoy, ventas30, stockBajo, totalProductos, totalTiendas] = await Promise.all([
      supabase.from('vista_ventas_resumen').select('num_ventas,total_con_iva').eq('fecha_venta', hoy),
      supabase.from('vista_ventas_resumen').select('total_con_iva').gte('fecha_venta', hace30),
      supabase.from('vista_stock_tiendas').select('codigo_producto').in('estado_stock', ['Sin stock','Stock bajo']),
      supabase.from('catalogo_productos').select('codigo_producto', { count:'exact' }).eq('activo', true),
      supabase.from('tiendas').select('id_tienda', { count:'exact' }).eq('activa', true),
    ]);
    res.json({
      ventas_hoy: {
        total: parseFloat((ventasHoy.data||[]).reduce((a,r)=>a+parseFloat(r.total_con_iva||0),0).toFixed(2)),
        num_ventas: (ventasHoy.data||[]).reduce((a,r)=>a+parseInt(r.num_ventas||0),0)
      },
      ventas_30_dias: parseFloat((ventas30.data||[]).reduce((a,r)=>a+parseFloat(r.total_con_iva||0),0).toFixed(2)),
      alertas_stock: stockBajo.data?.length || 0,
      total_productos_activos: totalProductos.count || 0,
      total_tiendas_activas: totalTiendas.count || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

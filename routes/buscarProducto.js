const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// 🔍 BUSCAR PRODUCTO EN TODAS LAS TIENDAS QUE LO TIENEN EN STOCK
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    // Consulta correcta a la tabla 'stock' con joins a 'tiendas' y 'catalogo_productos'
    const { data, error } = await supabase
      .from('stock')
      .select(`
        stock_actual,
        limite_stock,
        tiendas (
          id_tienda,
          nombre_tienda,
          latitud,
          longitud,
          calle,
          numero_exterior,
          colonia,
          municipio,
          estado
        ),
        catalogo_productos (
          nombre_producto,
          categoria,
          precio,
          unidad_medida
        )
      `)
      .eq('codigo_producto', codigo)
      .gt('stock_actual', 0); // Solo tiendas con stock disponible

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Error en buscarProducto:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
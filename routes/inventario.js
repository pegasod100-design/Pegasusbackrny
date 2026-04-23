const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');


// 🔹 GET INVENTARIO GENERAL (filtrado)
router.get('/', async (req, res) => {
  try {
    const { id_tienda, estado } = req.query;

    let query = supabase
      .from('vista_stock_tiendas')
      .select('*');

    if (id_tienda) {
      query = query.eq('id_tienda', id_tienda);
    }

    if (estado) {
      query = query.eq('estado_stock', estado);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔹 ALERTAS (stock bajo o sin stock)
router.get('/alertas', async (req, res) => {
  try {
    const { id_tienda } = req.query;

    let query = supabase
      .from('vista_stock_tiendas')
      .select('*')
      .in('estado_stock', ['Sin stock', 'Stock bajo'])
      .order('stock_actual', { ascending: true });

    if (id_tienda) {
      query = query.eq('id_tienda', id_tienda);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔹 INVENTARIO POR TIENDA
router.get('/tienda/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vista_stock_tiendas')
      .select('*')
      .eq('id_tienda', req.params.id);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔹 STOCK BAJO (simple)
router.get('/stock-bajo', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('vista_stock_tiendas')
      .select('*')
      .in('estado_stock', ['Stock bajo', 'Sin stock']);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔹 ACTUALIZAR LIMITE DE STOCK
router.put('/limite-stock', async (req, res) => {
  try {
    const { codigo_producto, id_tienda, limite_stock } = req.body;

    if (!codigo_producto || !id_tienda || limite_stock === undefined) {
      return res.status(400).json({ error: 'Faltan parámetros' });
    }

    const { data, error } = await supabase
      .from('stock')
      .update({ limite_stock })
      .eq('codigo_producto', codigo_producto)
      .eq('id_tienda', id_tienda)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔥🔥 DISTRIBUIR PRODUCTO A TIENDA (LO QUE TÚ NECESITAS)
router.post('/asignar', async (req, res) => {
  try {
    const { codigo_producto, id_tienda, stock_inicial } = req.body;

    if (!codigo_producto || !id_tienda) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const { data, error } = await supabase
      .from('stock')
      .insert([
        {
          codigo_producto,
          id_tienda,
          stock_actual: stock_inicial || 0
        }
      ])
      .select();

    if (error) throw error;

    res.json({
      mensaje: 'Producto asignado a la tienda correctamente',
      data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔥 ELIMINAR PRODUCTO DE UNA TIENDA
router.delete('/remover', async (req, res) => {
  try {
    const { codigo_producto, id_tienda } = req.body;

    const { error } = await supabase
      .from('stock')
      .delete()
      .eq('codigo_producto', codigo_producto)
      .eq('id_tienda', id_tienda);

    if (error) throw error;

    res.json({ mensaje: 'Producto removido de la tienda' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
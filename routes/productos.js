const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/productos - Listar todos
router.get('/', async (req, res) => {
  try {
    const { categoria, activo, search } = req.query;
    let query = supabase.from('catalogo_productos').select('*').order('nombre_producto');

    if (categoria) query = query.eq('categoria', categoria);
    if (activo !== undefined) query = query.eq('activo', activo === 'true');
    if (search) query = query.ilike('nombre_producto', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/productos/categorias
router.get('/categorias', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('catalogo_productos')
      .select('categoria')
      .eq('activo', true);
    if (error) throw error;
    const cats = [...new Set(data.map(p => p.categoria))].sort();
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/productos/:codigo
router.get('/:codigo', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('catalogo_productos')
      .select('*')
      .eq('codigo_producto', req.params.codigo)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/productos
router.post('/', async (req, res) => {
  try {
    const { codigo_producto, nombre_producto, unidad_medida, precio, categoria, descripcion } = req.body;
    if (!codigo_producto || !nombre_producto || !unidad_medida || !precio || !categoria) {
      return res.status(400).json({ error: 'Campos obligatorios faltantes' });
    }
    const { data, error } = await supabase
      .from('catalogo_productos')
      .insert({ codigo_producto, nombre_producto, unidad_medida, precio, categoria, descripcion })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/productos/:codigo
router.put('/:codigo', async (req, res) => {
  try {
    const { nombre_producto, unidad_medida, precio, categoria, descripcion, activo } = req.body;
    const { data, error } = await supabase
      .from('catalogo_productos')
      .update({ nombre_producto, unidad_medida, precio, categoria, descripcion, activo })
      .eq('codigo_producto', req.params.codigo)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/productos/:codigo (soft delete)
router.delete('/:codigo', async (req, res) => {
  try {
    const { error } = await supabase
      .from('catalogo_productos')
      .update({ activo: false })
      .eq('codigo_producto', req.params.codigo);
    if (error) throw error;
    res.json({ mensaje: 'Producto desactivado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

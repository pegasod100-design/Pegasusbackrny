const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { obtenerCoordenadas } = require('../services/geocoding');


// 🔹 OBTENER TIENDAS
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tiendas')
      .select('*')
      .order('id_tienda');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔹 CREAR TIENDA (con coordenadas automáticas)
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    const direccion = `${data.calle || ''} ${data.numero_exterior || ''}, ${data.colonia || ''}, ${data.municipio || ''}, ${data.estado || ''}, ${data.codigo_postal}`;

    const coords = await obtenerCoordenadas(direccion);

    if (coords) {
      data.latitud = coords.latitud;
      data.longitud = coords.longitud;
    }

    const { data: tienda, error } = await supabase
      .from('tiendas')
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    res.json(tienda);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 🔹 EDITAR TIENDA
router.put('/:id', async (req, res) => {
  try {
    const data = req.body;

    const direccion = `${data.calle || ''} ${data.numero_exterior || ''}, ${data.colonia || ''}, ${data.municipio || ''}, ${data.estado || ''}, ${data.codigo_postal}`;

    const coords = await obtenerCoordenadas(direccion);

    if (coords) {
      data.latitud = coords.latitud;
      data.longitud = coords.longitud;
    }

    const { data: tienda, error } = await supabase
      .from('tiendas')
      .update(data)
      .eq('id_tienda', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(tienda);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


//  ELIMINAR TIENDA
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('tiendas')
      .delete()
      .eq('id_tienda', req.params.id);

    if (error) throw error;

    res.json({ message: 'Tienda eliminada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
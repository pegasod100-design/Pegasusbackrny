const axios = require('axios');

async function obtenerCoordenadas(direccion) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(direccion)}`;

    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'app-inventario'
      }
    });

    if (!res.data || res.data.length === 0) return null;

    return {
      latitud: parseFloat(res.data[0].lat),
      longitud: parseFloat(res.data[0].lon),
    };
  } catch (err) {
    console.error('Error geocoding:', err.message);
    return null;
  }
}

module.exports = { obtenerCoordenadas };
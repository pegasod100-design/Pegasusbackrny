const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token proporcionado' });

    const token = authHeader.split(' ')[1]; // Bearer <token>
    if (!token) return res.status(401).json({ error: 'Token inválido' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave123');
    req.empleado = decoded; // guardamos info del usuario en req.empleado
    next();
  } catch (err) {
    console.error('Auth error:', err);
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = authMiddleware;
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'oen-optik-jwt-secret-2024';

function authMiddleware(req, res, next) {
  const url = req.originalUrl || req.url;

  if (url.startsWith('/api/auth/')) {
    return next();
  }

  // 1. JWT - Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      req.user = decoded;
      return next();
    } catch(e) {}
  }

  // 2. JWT - Cookie
  const cookies = (req.headers.cookie || '').split(';').reduce((acc, c) => {
    const [k, v] = c.trim().split('=');
    acc[k] = v;
    return acc;
  }, {});
  if (cookies.oken_token) {
    try {
      const decoded = jwt.verify(cookies.oken_token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch(e) {}
  }

  // 3. Session (yerel sunucu icin)
  if (req.session && req.session.userId) {
    return next();
  }

  if (url.startsWith('/api/')) {
    return res.status(401).json({ error: 'Oturum acilmamis' });
  }

  return res.redirect('/login.html');
}

module.exports = authMiddleware;

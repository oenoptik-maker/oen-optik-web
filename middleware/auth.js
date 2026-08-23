const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'oen-optik-jwt-secret-2024';

function parseCookies(header) {
  const cookies = {};
  (header || '').split(';').forEach(c => {
    const idx = c.trim().indexOf('=');
    if (idx > 0) cookies[c.trim().substring(0, idx)] = c.trim().substring(idx + 1);
  });
  return cookies;
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch(e) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const url = req.originalUrl || req.url;

  if (url.startsWith('/api/auth/')) {
    return next();
  }

  // 1. JWT - URL query parameter (?token=xxx)
  const parsedUrl = new URL(req.originalUrl, `https://${req.headers.host || 'localhost'}`);
  const urlToken = parsedUrl.searchParams.get('token');
  if (urlToken) {
    const decoded = verifyToken(urlToken);
    if (decoded) {
      req.user = decoded;
      // Cookie'yi de ayarla (sonraki istekler için)
      res.cookie('oken_token', urlToken, { httpOnly: false, maxAge: 30 * 60 * 1000, sameSite: 'none', secure: true, path: '/' });
      // URL'den token'ı temizle (redirect ile)
      const cleanUrl = parsedUrl.pathname;
      return res.redirect(cleanUrl);
    }
  }

  // 2. JWT - Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const decoded = verifyToken(authHeader.slice(7));
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  // 3. JWT - Cookie
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.oken_token) {
    const decoded = verifyToken(cookies.oken_token);
    if (decoded) {
      req.user = decoded;
      return next();
    }
  }

  // 4. Session (yerel sunucu icin)
  if (req.session && req.session.userId) {
    return next();
  }

  if (url.startsWith('/api/')) {
    return res.status(401).json({ error: 'Oturum acilmamis' });
  }

  return res.redirect('/login.html');
}

module.exports = authMiddleware;

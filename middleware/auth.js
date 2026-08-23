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

function getTokenFromUrl(url) {
  try {
    const qIdx = url.indexOf('?');
    if (qIdx === -1) return null;
    const qs = url.substring(qIdx + 1);
    const params = qs.split('&');
    for (const p of params) {
      const [key, val] = p.split('=');
      if (key === 'token' && val) return decodeURIComponent(val);
    }
  } catch(e) {}
  return null;
}

function cleanUrlFromToken(url) {
  const qIdx = url.indexOf('?');
  if (qIdx === -1) return url;
  const path = url.substring(0, qIdx);
  const qs = url.substring(qIdx + 1);
  const params = qs.split('&').filter(p => !p.startsWith('token='));
  return params.length > 0 ? path + '?' + params.join('&') : path;
}

function authMiddleware(req, res, next) {
  const url = req.originalUrl || req.url;

  if (url.startsWith('/api/auth/')) {
    return next();
  }

  // 1. JWT - URL query parameter (?token=xxx)
  const urlToken = getTokenFromUrl(url);
  if (urlToken) {
    const decoded = verifyToken(urlToken);
    if (decoded) {
      req.user = decoded;
      res.cookie('oken_token', urlToken, { httpOnly: false, maxAge: 30 * 60 * 1000, sameSite: 'none', secure: true, path: '/' });
      return next();
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

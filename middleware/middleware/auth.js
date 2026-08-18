function authMiddleware(req, res, next) {
  // API routes that don't need auth
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  // Check session
  if (req.session && req.session.userId) {
    return next();
  }

  // API calls return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Oturum acilmamis' });
  }

  // Page requests redirect to login
  return res.redirect('/login.html');
}

module.exports = authMiddleware;

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { getDb, closeDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'oen-optik-default-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use('/api/', limiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
const authMiddleware = require('./middleware/auth');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/siparisler', authMiddleware, require('./routes/siparis'));
app.use('/api/kategoriler', authMiddleware, require('./routes/kategori'));
app.use('/api/urunler', authMiddleware, require('./routes/urun'));
app.use('/api/stok', authMiddleware, require('./routes/stok'));
app.use('/api/backup', authMiddleware, require('./routes/backup'));
app.use('/api/uts', authMiddleware, require('./routes/uts'));
app.use('/api/etiket', authMiddleware, require('./routes/etiket'));
app.use('/api/qr', authMiddleware, require('./routes/qr'));
app.use('/api/kasa', authMiddleware, require('./routes/kasa'));

// Protected pages
app.get('/index.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/list.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'list.html'));
});
app.get('/admin.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/kasa.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'kasa.html'));
});

// Root redirect
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    res.redirect('/index.html');
  } else {
    res.redirect('/login.html');
  }
});

// Init DB and start server
async function start() {
  await getDb();
  console.log('Veritabani baslatildi');

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OEN OPTIK Web Sunucusu baslatildi!`);
    console.log(`http://localhost:${PORT}`);
    console.log(`Tum ag erisimi: http://0.0.0.0:${PORT}`);
  });
}

start();

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});

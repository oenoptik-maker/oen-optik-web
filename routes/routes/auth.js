const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');
const bcrypt = require('bcryptjs');

router.post('/kayit', async (req, res) => {
  try {
    await getDb();
    const { username, password, fullname } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Kullanici adi ve sifre gerekli' });
    }

    const existing = dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bu kullanici adi zaten mevcut' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    dbRun('INSERT INTO users (username, password, fullname) VALUES (?, ?, ?)', [username, hashedPassword, fullname || username]);

    const user = dbGet('SELECT id FROM users WHERE username = ?', [username]);
    req.session.userId = user.id;
    req.session.username = username;
    req.session.fullname = fullname || username;

    res.json({ success: true, userId: user.id });
  } catch (err) {
    console.error('Kayit hatasi:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/giris', async (req, res) => {
  try {
    await getDb();
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Kullanici adi ve sifre gerekli' });
    }

    const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Gecersiz kullanici adi veya sifre' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Gecersiz kullanici adi veya sifre' });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.fullname = user.fullname;

    res.json({ success: true, user: { id: user.id, username: user.username, fullname: user.fullname } });
  } catch (err) {
    console.error('Giris hatasi:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/cikis', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

router.get('/durum', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({ loggedIn: true, user: { id: req.session.userId, username: req.session.username, fullname: req.session.fullname } });
  } else {
    res.json({ loggedIn: false });
  }
});

module.exports = router;

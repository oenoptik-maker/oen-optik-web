const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'oen-optik-jwt-secret-2024';

router.post('/kayit', async (req, res) => {
  try {
    await getDb();
    const { username, password, fullname } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Kullanici adi ve sifre gerekli' });
    }

    const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Bu kullanici adi zaten mevcut' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await dbRun('INSERT INTO users (username, password, fullname) VALUES (?, ?, ?)', [username, hashedPassword, fullname || username]);

    const user = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    const token = jwt.sign({ id: user.id, username }, JWT_SECRET, { expiresIn: '30m' });

    if (req.session) {
      req.session.userId = user.id;
      req.session.username = username;
    }

    res.json({ success: true, userId: user.id, token });
  } catch (err) {
    console.error('Kayit hatasi:', err.message, err.stack);
    res.status(500).json({ success: false, message: 'Kayit hatasi: ' + err.message });
  }
});

router.post('/giris', async (req, res) => {
  try {
    await getDb();
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Kullanici adi ve sifre gerekli' });
    }

    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Gecersiz kullanici adi veya sifre' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Gecersiz kullanici adi veya sifre' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30m' });

    res.cookie('oken_token', token, { httpOnly: false, maxAge: 30 * 60 * 1000, sameSite: 'lax' });
    res.json({ success: true, user: { id: user.id, username: user.username, fullname: user.fullname }, token });
  } catch (err) {
    console.error('Giris hatasi:', err.message);
    res.status(500).json({ success: false, message: 'Giris hatasi: ' + err.message });
  }
});

router.post('/cikis', (req, res) => {
  if (req.session) req.session.destroy();
  res.json({ success: true });
});

router.get('/durum', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        await getDb();
        const user = await dbGet('SELECT id, username, fullname FROM users WHERE id = ?', [decoded.id]);
        if (user) {
          return res.json({ loggedIn: true, user });
        }
      } catch(e) {}
    }

    if (req.session && req.session.userId) {
      await getDb();
      const user = await dbGet('SELECT id, username, fullname FROM users WHERE id = ?', [req.session.userId]);
      if (user) {
        return res.json({ loggedIn: true, user });
      }
    }

    res.json({ loggedIn: false });
  } catch (err) {
    res.json({ loggedIn: false });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateCode, sendSMS, IS_TEST_MODE } = require('./sms');

const JWT_SECRET = process.env.JWT_SECRET || 'oen-optik-jwt-secret-2024';
const SMS_ENABLED = process.env.SMS_ENABLED === 'true';

router.post('/kayit', async (req, res) => {
  return res.status(403).json({ success: false, message: 'Kayit islemi devre disi birakilmistir. Yeni hesaplar sadece admin tarafindan olusturulabilir.' });
});

// Eski giris endpoint - backward compatibility
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
    res.cookie('oken_token', token, { httpOnly: false, maxAge: 30 * 60 * 1000, sameSite: 'none', secure: true, path: '/' });
    res.json({ success: true, user: { id: user.id, username: user.username, fullname: user.fullname }, token });
  } catch (err) {
    console.error('Giris hatasi:', err.message);
    res.status(500).json({ success: false, message: 'Giris hatasi: ' + err.message });
  }
});

// SMS kodu gonder
router.post('/gonder-kod', async (req, res) => {
  try {
    await getDb();
    const { username, password, device_fingerprint } = req.body;
    
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

    // SMS devre disiysa direkt token ver
    if (!SMS_ENABLED) {
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30m' });
      res.cookie('oken_token', token, { httpOnly: false, maxAge: 30 * 60 * 1000, sameSite: 'none', secure: true, path: '/' });
      return res.json({ success: true, sms_required: false, user: { id: user.id, username: user.username, fullname: user.fullname }, token });
    }

    // Cihaz guvenli mi kontrol et
    if (device_fingerprint) {
      const trusted = await dbGet(
        'SELECT id FROM trusted_devices WHERE user_id = ? AND device_fingerprint = ?',
        [user.id, device_fingerprint]
      );
      
      if (trusted) {
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30m' });
        res.cookie('oken_token', token, { httpOnly: false, maxAge: 30 * 60 * 1000, sameSite: 'none', secure: true, path: '/' });
        return res.json({ success: true, sms_required: false, user: { id: user.id, username: user.username, fullname: user.fullname }, token });
      }
    }

    // Yeni cihaz - SMS kodu gonder
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    
    await dbRun('DELETE FROM sms_codes WHERE user_id = ? AND used = 0', [user.id]);
    await dbRun(
      'INSERT INTO sms_codes (user_id, code, phone, expires_at) VALUES (?, ?, ?, ?)',
      [user.id, code, user.username, expiresAt]
    );

    await sendSMS(user.username, code);

    res.json({ 
      success: true, 
      sms_required: true, 
      test_mode: IS_TEST_MODE,
      message: IS_TEST_MODE ? 'Test modu: Kod konsolda gorunuyor' : 'SMS kodu gonderildi'
    });
  } catch (err) {
    console.error('SMS gonderme hatasi:', err.message);
    res.status(500).json({ success: false, message: 'Hata: ' + err.message });
  }
});

// SMS kodunu dogrula
router.post('/dogrula-kod', async (req, res) => {
  try {
    await getDb();
    const { username, code, device_fingerprint, device_name } = req.body;
    
    if (!username || !code) {
      return res.status(400).json({ success: false, message: 'Kullanici adi ve kod gerekli' });
    }

    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Kullanici bulunamadi' });
    }

    // Kodu kontrol et
    const smsCode = await dbGet(
      'SELECT * FROM sms_codes WHERE user_id = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1',
      [user.id, code]
    );

    if (!smsCode) {
      return res.status(401).json({ success: false, message: 'Gecersiz kod' });
    }

    // Deneme sayisini kontrol et
    if (smsCode.attempts >= 3) {
      await dbRun('UPDATE sms_codes SET used = 1 WHERE id = ?', [smsCode.id]);
      return res.status(401).json({ success: false, message: 'Cok fazla deneme. Yeni kod isteyin.' });
    }

    // Sure dolmus mu kontrol et
    if (new Date(smsCode.expires_at) < new Date()) {
      await dbRun('UPDATE sms_codes SET used = 1 WHERE id = ?', [smsCode.id]);
      return res.status(401).json({ success: false, message: 'Kod suresi dolmus. Yeni kod isteyin.' });
    }

    // Kod yanlis
    if (smsCode.code !== code) {
      await dbRun('UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?', [smsCode.id]);
      return res.status(401).json({ success: false, message: 'Yanlis kod. Kalan deneme: ' + (3 - smsCode.attempts - 1) });
    }

    // Kod dogru - isaretle
    await dbRun('UPDATE sms_codes SET used = 1 WHERE id = ?', [smsCode.id]);

    // Cihazi guvenilir cihazlara ekle
    if (device_fingerprint) {
      const existing = await dbGet(
        'SELECT id FROM trusted_devices WHERE user_id = ? AND device_fingerprint = ?',
        [user.id, device_fingerprint]
      );
      
      if (!existing) {
        await dbRun(
          'INSERT INTO trusted_devices (user_id, device_fingerprint, device_name) VALUES (?, ?, ?)',
          [user.id, device_fingerprint, device_name || 'Bilinmeyen Cihaz']
        );
      }
    }

    // Token olustur
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30m' });
    res.cookie('oken_token', token, { httpOnly: false, maxAge: 30 * 60 * 1000, sameSite: 'none', secure: true, path: '/' });
    
    res.json({ 
      success: true, 
      user: { id: user.id, username: user.username, fullname: user.fullname }, 
      token 
    });
  } catch (err) {
    console.error('Kod dogrulama hatasi:', err.message);
    res.status(500).json({ success: false, message: 'Hata: ' + err.message });
  }
});

router.post('/cikis', (req, res) => {
  if (req.session) req.session.destroy();
  res.json({ success: true });
});

router.get('/durum', async (req, res) => {
  try {
    // 1. JWT - Authorization header
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

    // 2. JWT - Cookie
    const cookies = {};
    (req.headers.cookie || '').split(';').forEach(c => {
      const idx = c.trim().indexOf('=');
      if (idx > 0) cookies[c.trim().substring(0, idx)] = c.trim().substring(idx + 1);
    });
    if (cookies.oken_token) {
      try {
        const decoded = jwt.verify(cookies.oken_token, JWT_SECRET);
        await getDb();
        const user = await dbGet('SELECT id, username, fullname FROM users WHERE id = ?', [decoded.id]);
        if (user) {
          return res.json({ loggedIn: true, user });
        }
      } catch(e) {}
    }

    // 3. Session
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

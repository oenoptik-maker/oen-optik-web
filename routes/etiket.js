const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');

router.post('/tasarim', async (req, res) => {
  try {
    await getDb();
    const design = JSON.stringify(req.body);
    const existing = await dbGet('SELECT id FROM etiket_tasarim WHERE id = 1');
    if (existing) {
      await dbRun('UPDATE etiket_tasarim SET design = ? WHERE id = 1', [design]);
    } else {
      await dbRun('INSERT INTO etiket_tasarim (id, design) VALUES (1, ?)', [design]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/tasarim', async (req, res) => {
  try {
    await getDb();
    const row = await dbGet('SELECT design FROM etiket_tasarim WHERE id = 1');
    if (!row) return res.json({ success: false, design: null });
    res.json({ success: true, design: JSON.parse(row.design) });
  } catch (err) {
    res.status(500).json({ success: false, design: null });
  }
});

router.get('/yazicilar', (req, res) => {
  res.json([]);
});

module.exports = router;

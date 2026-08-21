const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    await getDb();
    const rows = await dbAll('SELECT * FROM kategoriler ORDER BY KATEGORI_ID');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sonraki-id', async (req, res) => {
  try {
    await getDb();
    const row = await dbGet('SELECT MAX(KATEGORI_ID) as maxId FROM kategoriler');
    res.json(row && row.maxId ? row.maxId + 1 : 1);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await getDb();
    const { KATEGORI_ID, KATEGORI_ADI } = req.body;
    const existing = await dbGet('SELECT KATEGORI_ID FROM kategoriler WHERE KATEGORI_ID = ?', [KATEGORI_ID]);
    if (existing) {
      await dbRun('UPDATE kategoriler SET KATEGORI_ADI = ? WHERE KATEGORI_ID = ?', [KATEGORI_ADI, KATEGORI_ID]);
    } else {
      await dbRun('INSERT INTO kategoriler (KATEGORI_ID, KATEGORI_ADI) VALUES (?, ?)', [KATEGORI_ID, KATEGORI_ADI]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await getDb();
    await dbRun('DELETE FROM kategoriler WHERE KATEGORI_ID = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

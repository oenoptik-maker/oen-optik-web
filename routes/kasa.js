const express = require('express');
const router = express.Router();
const { getDb, dbAll } = require('../db/database');

router.get('/ozet', async (req, res) => {
  try {
    await getDb();
    const rows = await dbAll('SELECT * FROM siparisler');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/filtrele', async (req, res) => {
  try {
    await getDb();
    const { baslangic, bitis } = req.query;
    let rows = await dbAll('SELECT * FROM siparisler');

    if (baslangic || bitis) {
      rows = rows.filter(s => {
        const parts = String(s.SIPARIS_TARIHI).split(/[./-]/);
        if (parts.length !== 3) return false;
        const [day, month, year] = parts.map(Number);
        const tarih = new Date(year, month - 1, day);
        if (baslangic) {
          const basDate = new Date(baslangic);
          basDate.setHours(0, 0, 0, 0);
          if (tarih < basDate) return false;
        }
        if (bitis) {
          const bitDate = new Date(bitis);
          bitDate.setHours(23, 59, 59, 999);
          if (tarih > bitDate) return false;
        }
        return true;
      });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

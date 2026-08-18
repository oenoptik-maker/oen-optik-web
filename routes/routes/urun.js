const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    await getDb();
    const rows = dbAll('SELECT * FROM urunler ORDER BY URUN_ID');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sonraki-id', async (req, res) => {
  try {
    await getDb();
    const row = dbGet('SELECT MAX(URUN_ID) as maxId FROM urunler');
    res.json(row && row.maxId ? row.maxId + 1 : 1);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await getDb();
    const u = req.body;
    const existing = dbGet('SELECT URUN_ID FROM urunler WHERE URUN_ID = ?', [u.URUN_ID]);
    if (existing) {
      dbRun('UPDATE urunler SET KATEGORI_ADI=?, URUN_ADI=?, ALIS_FIYATI=?, FIYAT=?, ADET=?, KAREKOD=?, MENSEI=? WHERE URUN_ID=?',
        [u.KATEGORI_ADI, u.URUN_ADI, u.ALIS_FIYATI || 0, u.FIYAT || 0, u.ADET || 0, u.KAREKOD || '', u.MENSEI || '', u.URUN_ID]);
    } else {
      dbRun('INSERT INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [u.URUN_ID, u.KATEGORI_ADI, u.URUN_ADI, u.ALIS_FIYATI || 0, u.FIYAT || 0, u.ADET || 0, u.KAREKOD || '', u.MENSEI || '']);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await getDb();
    dbRun('DELETE FROM urunler WHERE URUN_ID = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/toplu-sil', async (req, res) => {
  try {
    await getDb();
    const { idler } = req.body;
    const placeholders = idler.map(() => '?').join(',');
    dbRun(`DELETE FROM urunler WHERE URUN_ID IN (${placeholders})`, idler.map(Number));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/stok-guncelle', async (req, res) => {
  try {
    await getDb();
    const urunler = req.body;
    for (const item of urunler) {
      const urun = dbGet('SELECT ADET FROM urunler WHERE URUN_ID = ?', [item.URUN_ID]);
      if (urun) {
        let yeniAdet = (parseInt(urun.ADET) || 0) + (parseInt(item.ADET) || 0);
        if (yeniAdet < 0) yeniAdet = 0;
        dbRun('UPDATE urunler SET ADET = ? WHERE URUN_ID = ?', [yeniAdet, item.URUN_ID]);
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/stok-ayarla', async (req, res) => {
  try {
    await getDb();
    const urunler = req.body;
    let guncellenen = 0;
    for (const item of urunler) {
      dbRun('UPDATE urunler SET ADET = MAX(0, ?) WHERE URUN_ID = ?', [Number(item.ADET) || 0, item.URUN_ID]);
      guncellenen++;
    }
    res.json({ success: true, guncellenen });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

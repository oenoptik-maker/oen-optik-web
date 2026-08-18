const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');

router.post('/credential-kaydet', async (req, res) => {
  try {
    await getDb();
    const { tc, sifre } = req.body;
    const sifrele = (metin) => Buffer.from(metin).toString('base64');
    const existing = dbGet('SELECT id FROM credentials WHERE id = 1');
    if (existing) {
      dbRun('UPDATE credentials SET tc = ?, sifre = ? WHERE id = 1', [sifrele(tc), sifrele(sifre)]);
    } else {
      dbRun('INSERT INTO credentials (id, tc, sifre) VALUES (1, ?, ?)', [sifrele(tc), sifrele(sifre)]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/credential-oku', async (req, res) => {
  try {
    await getDb();
    const row = dbGet('SELECT * FROM credentials WHERE id = 1');
    if (!row) return res.json({ success: false, tc: '', sifre: '' });
    const coz = (sifreli) => Buffer.from(sifreli, 'base64').toString();
    res.json({ success: true, tc: coz(row.tc), sifre: coz(row.sifre) });
  } catch (err) {
    res.status(500).json({ success: false, tc: '', sifre: '' });
  }
});

router.get('/alimlar', async (req, res) => {
  try {
    await getDb();
    const rows = dbAll('SELECT * FROM uts_alimlar ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/alimlar', async (req, res) => {
  try {
    await getDb();
    const veriler = Array.isArray(req.body) ? req.body : [req.body];
    const bugun = new Date().toLocaleDateString('tr-TR');
    for (const v of veriler) {
      dbRun('INSERT INTO uts_alimlar (URUN_NUMARASI, LOT_BATCH_NO, SERI_SIRA_NO, URUN_TANIMI, GONDEREN_KURUM, ADET, ALIS_FIYATI, SATIS_FIYATI, KAYIT_TARIHI) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [v.urunNumarasi || '', v.lotBatchNo || '', v.seriSiraNo || '', v.urunTanimi || '', v.gonderenKurum || '', v.adet || '', v.alisFiyati || 0, v.satisFiyati || 0, bugun]);
    }
    res.json({ success: true, kaydedilen: veriler.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/alimlar/:index', async (req, res) => {
  try {
    await getDb();
    const rows = dbAll('SELECT id FROM uts_alimlar ORDER BY id');
    const row = rows[parseInt(req.params.index)];
    if (row) dbRun('DELETE FROM uts_alimlar WHERE id = ?', [row.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/alimlar/toplu-sil', async (req, res) => {
  try {
    await getDb();
    const { indexler } = req.body;
    const rows = dbAll('SELECT id FROM uts_alimlar ORDER BY id');
    const idsToDelete = indexler.map(i => rows[i]?.id).filter(Boolean);
    if (idsToDelete.length > 0) {
      const placeholders = idsToDelete.map(() => '?').join(',');
      dbRun(`DELETE FROM uts_alimlar WHERE id IN (${placeholders})`, idsToDelete);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/alimlar', async (req, res) => {
  try {
    await getDb();
    dbRun('DELETE FROM uts_alimlar');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/alimlar/:index/fiyat', async (req, res) => {
  try {
    await getDb();
    const { alan, deger } = req.body;
    const rows = dbAll('SELECT id FROM uts_alimlar ORDER BY id');
    const row = rows[parseInt(req.params.index)];
    if (row) dbRun(`UPDATE uts_alimlar SET ${alan} = ? WHERE id = ?`, [parseFloat(deger) || 0, row.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/alimlar/toplu-fiyat', async (req, res) => {
  try {
    await getDb();
    const { guncellemeler, alan, deger } = req.body;
    const rows = dbAll('SELECT id FROM uts_alimlar ORDER BY id');
    let basarili = 0;
    for (const idx of guncellemeler) {
      const row = rows[idx];
      if (row) {
        dbRun(`UPDATE uts_alimlar SET ${alan} = ? WHERE id = ?`, [parseFloat(deger) || 0, row.id]);
        basarili++;
      }
    }
    res.json({ success: true, basarili });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');

router.post('/credential-kaydet', async (req, res) => {
  try {
    await getDb();
    const { tc, sifre, gkk, workerUrl } = req.body;
    const sifrele = (metin) => Buffer.from(String(metin || '')).toString('base64');
    const existing = await dbGet('SELECT id FROM credentials WHERE id = 1');
    if (existing) {
      await dbRun('UPDATE credentials SET tc = ?, sifre = ?, gkk = ?, worker_url = ? WHERE id = 1', [sifrele(tc), sifrele(sifre), sifrele(gkk), sifrele(workerUrl || '')]);
    } else {
      await dbRun('INSERT INTO credentials (id, tc, sifre, gkk, worker_url) VALUES (1, ?, ?, ?, ?)', [sifrele(tc), sifrele(sifre), sifrele(gkk), sifrele(workerUrl || '')]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.get('/credential-oku', async (req, res) => {
  try {
    await getDb();
    const row = await dbGet('SELECT * FROM credentials WHERE id = 1');
    if (!row) return res.json({ success: false, tc: '', sifre: '', gkk: '', workerUrl: '' });
    const coz = (sifreli) => { try { return Buffer.from(sifreli || '', 'base64').toString(); } catch { return ''; } };
    res.json({ success: true, tc: coz(row.tc), sifre: coz(row.sifre), gkk: coz(row.gkk), workerUrl: coz(row.worker_url) });
  } catch (err) {
    res.status(500).json({ success: false, tc: '', sifre: '', gkk: '', workerUrl: '' });
  }
});

router.get('/alimlar', async (req, res) => {
  try {
    await getDb();
    const rows = await dbAll('SELECT * FROM uts_alimlar ORDER BY id DESC');
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
      await dbRun('INSERT INTO uts_alimlar (URUN_NUMARASI, LOT_BATCH_NO, SERI_SIRA_NO, URUN_TANIMI, GONDEREN_KURUM, ADET, ALIS_FIYATI, SATIS_FIYATI, KAYIT_TARIHI) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
    const rows = await dbAll('SELECT id FROM uts_alimlar ORDER BY id');
    const row = rows[parseInt(req.params.index)];
    if (row) await dbRun('DELETE FROM uts_alimlar WHERE id = ?', [row.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/alimlar/toplu-sil', async (req, res) => {
  try {
    await getDb();
    const { indexler } = req.body;
    const rows = await dbAll('SELECT id FROM uts_alimlar ORDER BY id');
    const idsToDelete = indexler.map(i => rows[i]?.id).filter(Boolean);
    if (idsToDelete.length > 0) {
      const placeholders = idsToDelete.map(() => '?').join(',');
      await dbRun(`DELETE FROM uts_alimlar WHERE id IN (${placeholders})`, idsToDelete);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/alimlar', async (req, res) => {
  try {
    await getDb();
    await dbRun('DELETE FROM uts_alimlar');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/alimlar/:index/fiyat', async (req, res) => {
  try {
    await getDb();
    const { alan, deger } = req.body;
    const rows = await dbAll('SELECT id FROM uts_alimlar ORDER BY id');
    const row = rows[parseInt(req.params.index)];
    if (row) {
      const textFields = ['MENSEI', 'URUN_TANIMI', 'GONDEREN_KURUM'];
      const degerFinal = textFields.includes(alan) ? deger : (parseFloat(deger) || 0);
      await dbRun(`UPDATE uts_alimlar SET ${alan} = ? WHERE id = ?`, [degerFinal, row.id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/alimlar/toplu-fiyat', async (req, res) => {
  try {
    await getDb();
    const { guncellemeler, alan, deger } = req.body;
    const rows = await dbAll('SELECT id FROM uts_alimlar ORDER BY id');
    let basarili = 0;
    const textFields = ['MENSEI', 'URUN_TANIMI', 'GONDEREN_KURUM'];
    const degerFinal = textFields.includes(alan) ? deger : (parseFloat(deger) || 0);
    for (const idx of guncellemeler) {
      const row = rows[idx];
      if (row) {
        await dbRun(`UPDATE uts_alimlar SET ${alan} = ? WHERE id = ?`, [degerFinal, row.id]);
        basarili++;
      }
    }
    res.json({ success: true, basarili });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

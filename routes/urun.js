const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');

router.get('/', async (req, res) => {
  try {
    await getDb();
    const { sayfa, boyut, arama, kategori, saharekkayit } = req.query;
    
    if (sayfa && boyut) {
      const limit = parseInt(boyut) || 100;
      const offset = ((parseInt(sayfa) || 1) - 1) * limit;
      
      let where = '1=1';
      let params = [];
      
      if (arama) {
        where += ' AND (URUN_ADI LIKE ? OR KAREKOD LIKE ?)';
        params.push('%' + arama + '%', '%' + arama + '%');
      }
      if (kategori) {
        where += ' AND KATEGORI_ADI = ?';
        params.push(kategori);
      }
      if (saharekkayit === '1') {
        where += ' AND (SILINDI = 0 OR SILINDI IS NULL)';
      }
      
      const countRow = await dbGet(`SELECT COUNT(*) as toplam FROM urunler WHERE ${where}`, params);
      const toplam = countRow ? countRow.toplam : 0;
      
      const rows = await dbAll(`SELECT * FROM urunler WHERE ${where} ORDER BY URUN_ID DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
      
      return res.json({ urunler: rows, toplam, sayfa: parseInt(sayfa) || 1, boyut: limit });
    }
    
    const rows = await dbAll('SELECT * FROM urunler ORDER BY URUN_ID');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sonraki-id', async (req, res) => {
  try {
    await getDb();
    const row = await dbGet('SELECT MAX(URUN_ID) as maxId FROM urunler');
    res.json(row && row.maxId ? row.maxId + 1 : 1);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await getDb();
    const u = req.body;
    if (u.URUN_ID) {
      const existing = await dbGet('SELECT URUN_ID FROM urunler WHERE URUN_ID = ?', [u.URUN_ID]);
      if (existing) {
        await dbRun('UPDATE urunler SET KATEGORI_ADI=?, URUN_ADI=?, ALIS_FIYATI=?, FIYAT=?, ADET=?, KAREKOD=?, MENSEI=? WHERE URUN_ID=?',
          [u.KATEGORI_ADI, u.URUN_ADI, u.ALIS_FIYATI || 0, u.FIYAT || 0, u.ADET || 0, u.KAREKOD || '', u.MENSEI || '', u.URUN_ID]);
      } else {
        await dbRun('INSERT INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [u.URUN_ID, u.KATEGORI_ADI, u.URUN_ADI, u.ALIS_FIYATI || 0, u.FIYAT || 0, u.ADET || 0, u.KAREKOD || '', u.MENSEI || '']);
      }
    } else {
      await dbRun('INSERT INTO urunler (KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [u.KATEGORI_ADI, u.URUN_ADI, u.ALIS_FIYATI || 0, u.FIYAT || 0, u.ADET || 0, u.KAREKOD || '', u.MENSEI || '']);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Urun POST hatasi:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await getDb();
    await dbRun('DELETE FROM urunler WHERE URUN_ID = ?', [parseInt(req.params.id)]);
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
    await dbRun(`DELETE FROM urunler WHERE URUN_ID IN (${placeholders})`, idler.map(Number));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/stok-guncelle', async (req, res) => {
  try {
    await getDb();
    const urunler = req.body;
    const { getDb: getDbFn } = require('../db/database');
    const db = await getDbFn();
    
    if (db.type === 'turso') {
      const statements = [];
      for (const item of urunler) {
        statements.push({
          sql: 'UPDATE urunler SET ADET = MAX(0, ADET + ?) WHERE URUN_ID = ?',
          args: [parseInt(item.ADET) || 0, item.URUN_ID]
        });
      }
      for (const stmt of statements) {
        await db.client.execute(stmt);
      }
    } else {
      for (const item of urunler) {
        const urun = await dbGet('SELECT ADET FROM urunler WHERE URUN_ID = ?', [item.URUN_ID]);
        if (urun) {
          let yeniAdet = (parseInt(urun.ADET) || 0) + (parseInt(item.ADET) || 0);
          if (yeniAdet < 0) yeniAdet = 0;
          await dbRun('UPDATE urunler SET ADET = ? WHERE URUN_ID = ?', [yeniAdet, item.URUN_ID]);
        }
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/fiyat-guncelle', async (req, res) => {
  try {
    await getDb();
    const urunler = req.body;
    let guncellenen = 0;
    for (const item of urunler) {
      await dbRun('UPDATE urunler SET ALIS_FIYATI = ?, FIYAT = ? WHERE URUN_ID = ?',
        [Number(item.ALIS_FIYATI) || 0, Number(item.FIYAT) || 0, item.URUN_ID]);
      guncellenen++;
    }
    res.json({ success: true, guncellenen });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/fiyat-tekli', async (req, res) => {
  try {
    await getDb();
    const { URUN_ID, ALIS_FIYATI, FIYAT } = req.body;
    await dbRun('UPDATE urunler SET ALIS_FIYATI = ?, FIYAT = ? WHERE URUN_ID = ?',
      [Number(ALIS_FIYATI) || 0, Number(FIYAT) || 0, URUN_ID]);
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
      await dbRun('UPDATE urunler SET ADET = MAX(0, ?) WHERE URUN_ID = ?', [Number(item.ADET) || 0, item.URUN_ID]);
      guncellenen++;
    }
    res.json({ success: true, guncellenen });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

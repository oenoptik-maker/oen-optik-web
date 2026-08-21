const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/toplu', async (req, res) => {
  try {
    await getDb();
    const rows = await dbAll("SELECT id AS ID, KATEGORI AS Kategori, KAREKOD, URUN_ADI AS [Urun Adi], ALIS_FIYATI AS [Alis Fiyati], SATIS_FIYATI AS [Satis Fiyati], MENSEI AS Mensei, ADET AS Adet FROM toplu_stok ORDER BY id");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/toplu-onayla', async (req, res) => {
  try {
    await getDb();
    const stokVerileri = req.body;
    let allProducts = await dbAll('SELECT * FROM urunler');
    let nextId = allProducts.length > 0 ? Math.max(...allProducts.map(r => parseInt(r.URUN_ID) || 0)) + 1 : 1;
    let guncellenen = 0;
    let eklenen = 0;

    for (const item of stokVerileri) {
      const adet = parseInt(item.Adet) || 0;
      if (adet <= 0) continue;

      const mevcut = allProducts.find(p => p.URUN_ADI === item['Urun Adi'] && p.KATEGORI_ADI === item.Kategori);
      if (mevcut) {
        await dbRun('UPDATE urunler SET ADET = ADET + ?, KAREKOD = ?, MENSEI = ? WHERE URUN_ADI = ? AND KATEGORI_ADI = ?',
          [adet, item.KAREKOD || '', item['Mensei'] || '', item['Urun Adi'], item.Kategori]);
        guncellenen++;
      } else {
        await dbRun('INSERT INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [nextId++, item.Kategori, item['Urun Adi'], parseFloat(item['Alis Fiyati']) || 0, parseFloat(item['Satis Fiyati']) || 0, adet, item.KAREKOD || '', item['Mensei'] || '']);
        eklenen++;
      }
    }
    res.json({ success: true, guncellenen, eklenen });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/toplu-yukle', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya yuklenemedi' });
    await getDb();

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

    await dbRun('DELETE FROM toplu_stok');

    for (const item of data) {
      await dbRun(
        'INSERT INTO toplu_stok (KATEGORI, KAREKOD, URUN_ADI, ALIS_FIYATI, SATIS_FIYATI, MENSEI, ADET) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.Kategori || '', item.KAREKOD || '', item['Urun Adi'] || '', parseFloat(item['Alis Fiyati']) || 0, parseFloat(item['Satis Fiyati']) || 0, item['Mensei'] || '', parseInt(item.Adet) || 0]
      );
    }

    res.json({ success: true, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

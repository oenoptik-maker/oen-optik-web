const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun, dbBatch } = require('../db/database');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

function getVal(item, ...keys) {
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== '') return item[k];
  }
  return '';
}

function normalizeItem(item) {
  return {
    Kategori: (getVal(item, 'Kategori', 'KATEGORI', 'kategori', 'Category') || '').toLocaleUpperCase('tr-TR'),
    KAREKOD: getVal(item, 'KAREKOD', 'karekod', 'Barkod', 'barkod', 'Kod'),
    UrunAdi: getVal(item, 'Urun Adi', 'Ürün Adı', 'URUN_ADI', 'urun_adi', 'UrunAdi', 'ÜrünAdı', 'Product'),
    AlisFiyati: parseFloat(getVal(item, 'Alis Fiyati', 'Alış Fiyatı', 'ALIS_FIYATI', 'alis_fiyati', 'AlisFiyati', 'AlışFiyatı', 'Cost')) || 0,
    SatisFiyati: parseFloat(getVal(item, 'Satis Fiyati', 'Satış Fiyatı', 'SATIS_FIYATI', 'satis_fiyati', 'SatisFiyati', 'SatışFiyatı', 'Price')) || 0,
    Mensei: getVal(item, 'Mensei', 'Menşei', 'MENSEI', 'mensei', 'Origin'),
    Adet: parseInt(getVal(item, 'Adet', 'ADET', 'adet', 'Quantity')) || 0,
  };
}

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

    const statements = [];
    for (const raw of stokVerileri) {
      const item = normalizeItem(raw);
      if (item.Adet <= 0) continue;

      const mevcut = allProducts.find(p => p.URUN_ADI === item.UrunAdi && p.KATEGORI_ADI === item.Kategori);
      if (mevcut) {
        statements.push({
          sql: 'UPDATE urunler SET ADET = ADET + ?, KAREKOD = ?, MENSEI = ? WHERE URUN_ADI = ? AND KATEGORI_ADI = ?',
          params: [item.Adet, item.KAREKOD, item.Mensei, item.UrunAdi, item.Kategori]
        });
        guncellenen++;
      } else {
        statements.push({
          sql: 'INSERT INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          params: [nextId++, item.Kategori, item.UrunAdi, item.AlisFiyati, item.SatisFiyati, item.Adet, item.KAREKOD, item.Mensei]
        });
        eklenen++;
      }
    }

    if (statements.length > 0) {
      await dbBatch(statements);
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

    const statements = [
      { sql: 'DELETE FROM toplu_stok', params: [] }
    ];
    for (const raw of data) {
      const item = normalizeItem(raw);
      statements.push({
        sql: 'INSERT INTO toplu_stok (KATEGORI, KAREKOD, URUN_ADI, ALIS_FIYATI, SATIS_FIYATI, MENSEI, ADET) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [item.Kategori, item.KAREKOD, item.UrunAdi, item.AlisFiyati, item.SatisFiyati, item.Mensei, item.Adet]
      });
    }

    await dbBatch(statements);
    res.json({ success: true, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

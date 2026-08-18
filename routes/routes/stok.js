const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');

const upload = multer({ dest: path.join(__dirname, '../data/uploads/') });
const TOPLU_STOK_FILE = path.join(__dirname, '../data/Toplu_Stok_Girisi.xlsx');

router.get('/toplu', async (req, res) => {
  try {
    const fs = require('fs');
    if (!fs.existsSync(TOPLU_STOK_FILE)) return res.json([]);
    const fileBuffer = fs.readFileSync(TOPLU_STOK_FILE);
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return res.json([]);
    res.json(XLSX.utils.sheet_to_json(ws, { defval: '' }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/toplu-onayla', async (req, res) => {
  try {
    await getDb();
    const stokVerileri = req.body;
    let allProducts = dbAll('SELECT * FROM urunler');
    let nextId = allProducts.length > 0 ? Math.max(...allProducts.map(r => parseInt(r.URUN_ID) || 0)) + 1 : 1;
    let guncellenen = 0;
    let eklenen = 0;

    for (const item of stokVerileri) {
      const adet = parseInt(item.Adet) || 0;
      if (adet <= 0) continue;

      const mevcut = allProducts.find(p => p.URUN_ADI === item['Ürün Adı'] && p.KATEGORI_ADI === item.Kategori);
      if (mevcut) {
        dbRun('UPDATE urunler SET ADET = ADET + ?, KAREKOD = ?, MENSEI = ? WHERE URUN_ADI = ? AND KATEGORI_ADI = ?',
          [adet, item.KAREKOD || '', item['Menşei'] || '', item['Ürün Adı'], item.Kategori]);
        guncellenen++;
      } else {
        dbRun('INSERT INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [nextId++, item.Kategori, item['Ürün Adı'], parseFloat(item['Alış Fiyatı']) || 0, parseFloat(item['Satış Fiyatı']) || 0, adet, item.KAREKOD || '', item['Menşei'] || '']);
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
    const fileBuffer = require('fs').readFileSync(req.file.path);
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const newWb = XLSX.utils.book_new();
    const newWs = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(newWb, newWs, 'Toplu Stok');
    XLSX.writeFile(newWb, TOPLU_STOK_FILE);
    require('fs').unlinkSync(req.file.path);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

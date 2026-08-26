const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbBatch } = require('../db/database');
const fs = require('fs');
const path = require('path');

const IS_VERCEL = !!process.env.VERCEL;
const BACKUP_DIR = path.join(__dirname, '../../data/yedekler');

// Yedek Oluştur (JSON export)
router.post('/olustur', async (req, res) => {
  try {
    await getDb();
    const [siparisler, urunler, kategoriler] = await Promise.all([
      dbAll('SELECT * FROM siparisler'),
      dbAll('SELECT * FROM urunler'),
      dbAll('SELECT * FROM kategoriler')
    ]);

    const yedek = {
      tarih: new Date().toISOString(),
      siparisler,
      urunler,
      kategoriler
    };

    const jsonStr = JSON.stringify(yedek, null, 2);

    // Vercel'de dosyaya yazma, direkt indir olarak gönder
    if (IS_VERCEL) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="yedek_${new Date().toISOString().slice(0,10)}.json"`);
      return res.send(jsonStr);
    }

    // Local: dosyaya yaz ve listele
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const filename = `yedek_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, filename), jsonStr);
    res.json({ success: true, filename });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Yedek Listesi
router.get('/liste', async (req, res) => {
  try {
    if (IS_VERCEL) return res.json([]);
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        filename: f,
        size: fs.statSync(path.join(BACKUP_DIR, f)).size,
        date: fs.statSync(path.join(BACKUP_DIR, f)).mtime
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(files);
  } catch (err) {
    res.status(500).json([]);
  }
});

// Yedek İndir
router.get('/indir/:dosya', (req, res) => {
  try {
    if (IS_VERCEL) return res.status(404).json({ error: 'Vercel desteklenmiyor' });
    const filePath = path.join(BACKUP_DIR, req.params.dosya);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Dosya bulunamadi' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Yedek Geri Yükle (JSON import)
router.post('/geri-yukle', async (req, res) => {
  try {
    await getDb();
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ success: false, message: 'Dosya adi gerekli' });

    if (IS_VERCEL) return res.status(400).json({ success: false, message: 'Vercel\'de dosyadan geri yükleme desteklenmiyor' });

    const backupPath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(backupPath)) return res.status(400).json({ success: false, message: 'Yedek dosyasi bulunamadi' });

    const jsonStr = fs.readFileSync(backupPath, 'utf8');
    const yedek = JSON.parse(jsonStr);
    await importYedek(yedek);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// JSON yükleme ile geri yükleme (Vercel uyumlu)
router.post('/yukle-geri-yukle', async (req, res) => {
  try {
    await getDb();
    const { yedek } = req.body;
    if (!yedek) return res.status(400).json({ success: false, message: 'Yedek verisi gerekli' });

    await importYedek(yedek);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

async function importYedek(yedek) {
  await getDb();
  const batches = [];

  if (yedek.siparisler && yedek.siparisler.length > 0) {
    batches.push({ sql: 'DELETE FROM siparisler' });
    const cols = [
      'SIRA_NO', 'AD_SOYAD', 'TC_KIMLIK', 'TELEFON', 'SIPARIS_TARIHI', 'TESLIM_TARIHI', 'EMAIL', 'ADRES',
      'SAG_SPH_UZAK', 'SAG_CYL_UZAK', 'SAG_AXE_UZAK', 'SOL_SPH_UZAK', 'SOL_CYL_UZAK', 'SOL_AXE_UZAK',
      'SAG_SPH_YAKIN', 'SAG_CYL_YAKIN', 'SAG_AXE_YAKIN', 'SOL_SPH_YAKIN', 'SOL_CYL_YAKIN', 'SOL_AXE_YAKIN',
      'ADD_DEGER', 'PD_SAG_UZAK', 'PD_SOL_UZAK', 'PD_SAG_YAKIN', 'PD_SOL_YAKIN',
      'YUKSEKLIK_SAG_UZAK', 'YUKSEKLIK_SOL_UZAK', 'YUKSEKLIK_SAG_YAKIN', 'YUKSEKLIK_SOL_YAKIN',
      'CAP_SAG_UZAK', 'CAP_SOL_UZAK', 'CAP_SAG_YAKIN', 'CAP_SOL_YAKIN',
      'ACIKLAMA_UZAK', 'ACIKLAMA_YAKIN', 'ODEME_DETAYLARI', 'SECILEN_URUNLER',
      'TOPLAM', 'ALINAN', 'KALAN', 'INDIRIM', 'INDIRIM_NOTU'
    ];
    const placeholders = cols.map(() => '?').join(',');
    const colStr = cols.join(', ');
    for (const s of yedek.siparisler) {
      batches.push({
        sql: `INSERT OR REPLACE INTO siparisler (${colStr}) VALUES (${placeholders})`,
        params: cols.map(c => s[c] !== undefined ? s[c] : null)
      });
    }
  }

  if (yedek.urunler && yedek.urunler.length > 0) {
    batches.push({ sql: 'DELETE FROM urunler' });
    for (const u of yedek.urunler) {
      batches.push({
        sql: 'INSERT OR REPLACE INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?,?,?,?,?,?,?,?)',
        params: [u.URUN_ID, u.KATEGORI_ADI, u.URUN_ADI, u.ALIS_FIYATI, u.FIYAT, u.ADET, u.KAREKOD, u.MENSEI]
      });
    }
  }

  if (yedek.kategoriler && yedek.kategoriler.length > 0) {
    batches.push({ sql: 'DELETE FROM kategoriler' });
    for (const k of yedek.kategoriler) {
      batches.push({
        sql: 'INSERT OR REPLACE INTO kategoriler (KATEGORI_ID, KATEGORI_ADI) VALUES (?,?)',
        params: [k.KATEGORI_ID, k.KATEGORI_ADI]
      });
    }
  }

  if (batches.length > 0) {
    await dbBatch(batches);
  }
}

module.exports = router;

const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbBatch } = require('../db/database');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

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

    if (yedek._batches && Array.isArray(yedek._batches)) {
      const CHUNK = 500;
      for (let i = 0; i < yedek._batches.length; i += CHUNK) {
        await dbBatch(yedek._batches.slice(i, i + CHUNK));
      }
    } else {
      await importYedek(yedek);
    }
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

// ===== EXCEL EXPORT =====
router.post('/excel-export', async (req, res) => {
  try {
    await getDb();
    const [siparisler, urunler, kategoriler] = await Promise.all([
      dbAll('SELECT * FROM siparisler'),
      dbAll('SELECT * FROM urunler'),
      dbAll('SELECT * FROM kategoriler')
    ]);

    const wb = XLSX.utils.book_new();

    if (kategoriler.length > 0) {
      const wsK = XLSX.utils.json_to_sheet(kategoriler);
      XLSX.utils.book_append_sheet(wb, wsK, 'Kategoriler');
    }
    if (urunler.length > 0) {
      const wsU = XLSX.utils.json_to_sheet(urunler);
      XLSX.utils.book_append_sheet(wb, wsU, 'Urunler');
    }
    if (siparisler.length > 0) {
      const wsS = XLSX.utils.json_to_sheet(siparisler);
      XLSX.utils.book_append_sheet(wb, wsS, 'Siparisler');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="yedek_${new Date().toISOString().slice(0,10)}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== EXCEL IMPORT =====
router.post('/excel-import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya yuklenemedi' });
    await getDb();

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const batches = [];

    const sheetNames = wb.SheetNames;

    for (const name of sheetNames) {
      const lower = name.toLocaleLowerCase('tr-TR').trim();
      const data = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
      if (data.length === 0) continue;

      if (lower.includes('kategori')) {
        batches.push({ sql: 'DELETE FROM kategoriler' });
        for (const k of data) {
          const adi = k.KATEGORI_ADI || k['Kategori Adı'] || k['kategori_adi'] || '';
          if (!adi) continue;
          batches.push({
            sql: 'INSERT OR REPLACE INTO kategoriler (KATEGORI_ADI) VALUES (?)',
            params: [adi]
          });
        }
      } else if (lower.includes('urun')) {
        batches.push({ sql: 'DELETE FROM urunler' });
        for (const u of data) {
          const cols = Object.keys(u);
          const get = (...keys) => {
            for (const k of keys) {
              const found = cols.find(c => c.toLocaleUpperCase('tr-TR') === k.toLocaleUpperCase('tr-TR'));
              if (found !== undefined && u[found] !== '' && u[found] !== null && u[found] !== undefined) return u[found];
            }
            return '';
          };
          batches.push({
            sql: 'INSERT OR REPLACE INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?,?,?,?,?,?,?,?)',
            params: [
              parseInt(get('URUN_ID', 'ID')) || null,
              get('KATEGORI_ADI', 'Kategori', 'kategori_adi'),
              get('URUN_ADI', 'Urun Adi', 'Ürün Adı', 'urun_adi'),
              parseFloat(get('ALIS_FIYATI', 'Alis Fiyati', 'Alış Fiyatı')) || 0,
              parseFloat(get('FIYAT', 'Satis Fiyati', 'Satış Fiyatı', 'Fiyat')) || 0,
              parseInt(get('ADET', 'Adet')) || 0,
              get('KAREKOD', 'Barkod'),
              get('MENSEI', 'Menşei', 'mensei')
            ]
          });
        }
      } else if (lower.includes('siparis')) {
        batches.push({ sql: 'DELETE FROM siparisler' });
        const cols = Object.keys(data[0] || {});
        const sipCols = [
          'SIRA_NO', 'AD_SOYAD', 'TC_KIMLIK', 'TELEFON', 'SIPARIS_TARIHI', 'TESLIM_TARIHI',
          'EMAIL', 'ADRES', 'SAG_SPH_UZAK', 'SAG_CYL_UZAK', 'SAG_AXE_UZAK',
          'SOL_SPH_UZAK', 'SOL_CYL_UZAK', 'SOL_AXE_UZAK', 'SAG_SPH_YAKIN', 'SAG_CYL_YAKIN',
          'SAG_AXE_YAKIN', 'SOL_SPH_YAKIN', 'SOL_CYL_YAKIN', 'SOL_AXE_YAKIN',
          'ADD_DEGER', 'PD_SAG_UZAK', 'PD_SOL_UZAK', 'PD_SAG_YAKIN', 'PD_SOL_YAKIN',
          'YUKSEKLIK_SAG_UZAK', 'YUKSEKLIK_SOL_UZAK', 'YUKSEKLIK_SAG_YAKIN', 'YUKSEKLIK_SOL_YAKIN',
          'CAP_SAG_UZAK', 'CAP_SOL_UZAK', 'CAP_SAG_YAKIN', 'CAP_SOL_YAKIN',
          'ACIKLAMA_UZAK', 'ACIKLAMA_YAKIN', 'ODEME_DETAYLARI', 'SECILEN_URUNLER',
          'TOPLAM', 'ALINAN', 'KALAN', 'INDIRIM', 'INDIRIM_NOTU'
        ];
        const placeholders = sipCols.map(() => '?').join(',');
        const colStr = sipCols.join(', ');
        for (const s of data) {
          batches.push({
            sql: `INSERT OR REPLACE INTO siparisler (${colStr}) VALUES (${placeholders})`,
            params: sipCols.map(c => {
              const found = cols.find(cl => cl.toLocaleUpperCase('tr-TR') === c.toLocaleUpperCase('tr-TR'));
              return found !== undefined ? s[found] : null;
            })
          });
        }
      }
    }

    if (batches.length === 0) {
      return res.status(400).json({ success: false, message: 'Gecerli sayfa bulunamadi (Kategoriler, Urunler, Siparisler)' });
    }

    const CHUNK = 500;
    for (let i = 0; i < batches.length; i += CHUNK) {
      await dbBatch(batches.slice(i, i + CHUNK));
    }

    res.json({ success: true, message: `${batches.length - (sheetNames.length)} kayit import edildi` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

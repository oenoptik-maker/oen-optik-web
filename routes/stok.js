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
  const rawKarekod = getVal(item, 'KAREKOD', 'karekod', 'Barkod', 'barkod', 'Kod');
  let karekod = String(rawKarekod).trim();
  if (/^\d+\.0+$/.test(karekod)) karekod = karekod.replace(/\.0+$/, '');

  return {
    Kategori: (getVal(item, 'Kategori', 'KATEGORI', 'kategori', 'Category') || '').toLocaleUpperCase('tr-TR').trim(),
    KAREKOD: karekod,
    UrunAdi: getVal(item, 'Urun Adi', 'Ürün Adı', 'URUN_ADI', 'urun_adi', 'UrunAdi', 'ÜrünAdı', 'Product'),
    AlisFiyati: parseFloat(getVal(item, 'Alis Fiyati', 'Alış Fiyatı', 'ALIS_FIYATI', 'alis_fiyati', 'AlisFiyati', 'AlışFiyatı', 'Cost')) || 0,
    SatisFiyati: parseFloat(getVal(item, 'Satis Fiyati', 'Satış Fiyatı', 'SATIS_FIYATI', 'satis_fiyati', 'SatisFiyati', 'SatışFiyatı', 'Price')) || 0,
    Mensei: getVal(item, 'Mensei', 'Menşei', 'MENSEI', 'mensei', 'Origin'),
    Adet: parseInt(getVal(item, 'Adet', 'ADET', 'adet', 'Quantity')) || 0,
  };
}

function normalizeText(text) {
  return (text || '').trim().toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I').replace(/I/g, 'I')
    .replace(/ü/g, 'U').replace(/Ü/g, 'U')
    .replace(/ö/g, 'O').replace(/Ö/g, 'O')
    .replace(/ş/g, 'S').replace(/Ş/g, 'S')
    .replace(/ç/g, 'C').replace(/Ç/g, 'C')
    .replace(/ğ/g, 'G').replace(/Ğ/g, 'G');
}

function buildMatchKey(urunAdi, kategori) {
  return normalizeText(urunAdi) + '|' + normalizeText(kategori);
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

async function stokOnaylaIsle(stokVerileri) {
  await getDb();

  const urunMap = new Map();
  const mevcutUrunler = await dbAll('SELECT URUN_ID, URUN_ADI, KATEGORI_ADI FROM urunler');
  for (const u of mevcutUrunler) {
    urunMap.set(buildMatchKey(u.URUN_ADI, u.KATEGORI_ADI), u);
  }

  const maxRow = await dbGet('SELECT MAX(URUN_ID) as maxId FROM urunler');
  let nextId = (maxRow && maxRow.maxId ? maxRow.maxId : 0) + 1;

  let guncellenen = 0;
  let eklenen = 0;
  const statements = [];

  for (const raw of stokVerileri) {
    const item = normalizeItem(raw);
    if (item.Adet <= 0) continue;

    const key = buildMatchKey(item.UrunAdi, item.Kategori);
    const mevcut = urunMap.get(key);

    if (mevcut) {
      statements.push({
        sql: 'UPDATE urunler SET ADET = ADET + ?, ALIS_FIYATI = ?, FIYAT = ?, KAREKOD = ?, MENSEI = ? WHERE URUN_ADI = ? AND KATEGORI_ADI = ?',
        params: [item.Adet, item.AlisFiyati, item.SatisFiyati, item.KAREKOD, item.Mensei, item.UrunAdi, item.Kategori]
      });
      guncellenen++;
    } else {
      statements.push({
        sql: 'INSERT INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [nextId, item.Kategori, item.UrunAdi, item.AlisFiyati, item.SatisFiyati, item.Adet, item.KAREKOD, item.Mensei]
      });
      urunMap.set(key, { URUN_ID: nextId, URUN_ADI: item.UrunAdi, KATEGORI_ADI: item.Kategori });
      nextId++;
      eklenen++;
    }
  }

  const CHUNK_SIZE = 1000;
  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    const chunk = statements.slice(i, i + CHUNK_SIZE);
    await dbBatch(chunk);
  }

  return { guncellenen, eklenen, toplam: statements.length };
}

router.post('/toplu-onayla', async (req, res) => {
  try {
    const result = await stokOnaylaIsle(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/toplu-onayla-parcali', async (req, res) => {
  try {
    const { stokVerileri, parcaNo, toplamParca } = req.body;
    const result = await stokOnaylaIsle(stokVerileri);
    res.json({ success: true, ...result, parcaNo, toplamParca });
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

    const CHUNK_SIZE = 500;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const statements = chunk.map(raw => {
        const item = normalizeItem(raw);
        return {
          sql: 'INSERT INTO toplu_stok (KATEGORI, KAREKOD, URUN_ADI, ALIS_FIYATI, SATIS_FIYATI, MENSEI, ADET) VALUES (?, ?, ?, ?, ?, ?, ?)',
          params: [item.Kategori, item.KAREKOD, item.UrunAdi, item.AlisFiyati, item.SatisFiyati, item.Mensei, item.Adet]
        };
      });
      await dbBatch(statements);
    }

    res.json({ success: true, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/mukerrer-temizle', async (req, res) => {
  try {
    await getDb();

    const gruplar = await dbAll(`
      SELECT KAREKOD, URUN_ADI, COUNT(*) as adet
      FROM urunler
      WHERE KAREKOD != '' AND KAREKOD IS NOT NULL AND KAREKOD != '0'
      GROUP BY KAREKOD, URUN_ADI
      HAVING adet > 1
    `);

    let silinen = 0;
    let birlestirilen = 0;
    const silinecekIdler = [];
    const guncellemeSatırlari = [];

    for (const g of gruplar) {
      const tumUrunler = await dbAll(
        'SELECT URUN_ID, ALIS_FIYATI, FIYAT, ADET FROM urunler WHERE KAREKOD = ? AND URUN_ADI = ? ORDER BY FIYAT DESC, ALIS_FIYATI DESC, URUN_ID DESC',
        [g.KAREKOD, g.URUN_ADI]
      );

      if (tumUrunler.length <= 1) continue;

      const enYuksek = tumUrunler[0];
      const silinecekler = tumUrunler.slice(1);
      const toplamAdet = silinecekler.reduce((s, u) => s + (u.ADET || 0), 0);

      if (toplamAdet > 0) {
        guncellemeSatırlari.push({
          sql: 'UPDATE urunler SET ADET = ADET + ? WHERE URUN_ID = ?',
          params: [toplamAdet, enYuksek.URUN_ID]
        });
      }

      for (const s of silinecekler) {
        silinecekIdler.push(s.URUN_ID);
        silinen++;
      }
      birlestirilen++;
    }

    for (const satir of guncellemeSatırlari) {
      await dbRun(satir.sql, satir.params);
    }

    if (silinecekIdler.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < silinecekIdler.length; i += CHUNK) {
        const chunk = silinecekIdler.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => '?').join(',');
        await dbRun(`DELETE FROM urunler WHERE URUN_ID IN (${placeholders})`, chunk);
      }
    }

    res.json({ success: true, silinen, birlestirilen, toplamGrup: gruplar.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

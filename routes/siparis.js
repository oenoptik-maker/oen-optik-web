const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');

const ORDER_COLUMNS = [
  'SIRA_NO', 'AD_SOYAD', 'TC_KIMLIK', 'TELEFON', 'SIPARIS_TARIHI', 'TESLIM_TARIHI',
  'EMAIL', 'ADRES',
  'SAG_SPH_UZAK', 'SAG_CYL_UZAK', 'SAG_AXE_UZAK', 'SOL_SPH_UZAK', 'SOL_CYL_UZAK', 'SOL_AXE_UZAK',
  'SAG_SPH_YAKIN', 'SAG_CYL_YAKIN', 'SAG_AXE_YAKIN', 'SOL_SPH_YAKIN', 'SOL_CYL_YAKIN', 'SOL_AXE_YAKIN',
  'ADD_DEGER',
  'PD_SAG_UZAK', 'PD_SOL_UZAK', 'PD_SAG_YAKIN', 'PD_SOL_YAKIN',
  'YUKSEKLIK_SAG_UZAK', 'YUKSEKLIK_SOL_UZAK', 'YUKSEKLIK_SAG_YAKIN', 'YUKSEKLIK_SOL_YAKIN',
  'CAP_SAG_UZAK', 'CAP_SOL_UZAK', 'CAP_SAG_YAKIN', 'CAP_SOL_YAKIN',
  'ACIKLAMA_UZAK', 'ACIKLAMA_YAKIN', 'ODEME_DETAYLARI', 'SECILEN_URUNLER', 'TOPLAM', 'ALINAN', 'KALAN', 'INDIRIM', 'INDIRIM_NOTU'
];

router.get('/', async (req, res) => {
  try {
    await getDb();
    const rows = await dbAll('SELECT * FROM siparisler ORDER BY SIRA_NO DESC');
    rows.forEach(row => {
      row.SIPARIS_DETAYLARI = row.ACIKLAMA_UZAK || '';
      delete row.ACIKLAMA_UZAK;
      delete row.ACIKLAMA_YAKIN;
    });
    res.json(rows);
  } catch (err) {
    console.error('Siparis okuma hatasi:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/sonraki-no', async (req, res) => {
  try {
    await getDb();
    const row = await dbGet('SELECT MAX(SIRA_NO) as maxNo FROM siparisler');
    res.json(row && row.maxNo ? row.maxNo + 1 : 1);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ara', async (req, res) => {
  try {
    await getDb();
    const { tc, telefon, adSoyad } = req.query;
    let query = 'SELECT * FROM siparisler WHERE 1=1';
    const params = [];

    if (tc) {
      query += ' AND TC_KIMLIK = ?';
      params.push(tc.trim());
    }
    if (telefon) {
      query += ' AND REPLACE(REPLACE(REPLACE(TELEFON, \'-\', \'\'), \'\', \'\'), \' \', \'\') = REPLACE(REPLACE(REPLACE(?, \'-\', \'\'), \'\', \'\'), \' \', \'\')';
      params.push(telefon.trim());
    }
    if (adSoyad) {
      query += ' AND LOWER(AD_SOYAD) = LOWER(?)';
      params.push(adSoyad.trim());
    }

    const rows = await dbAll(query, params);
    // ACIKLAMA_UZAK -> SIPARIS_DETAYLARI olarak döndür
    rows.forEach(row => {
      row.SIPARIS_DETAYLARI = row.ACIKLAMA_UZAK || '';
      delete row.ACIKLAMA_UZAK;
      delete row.ACIKLAMA_YAKIN;
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    await getDb();
    const orderData = req.body;

    // SIPARIS_DETAYLARI -> ACIKLAMA_UZAK olarak kaydet
    if (orderData.SIPARIS_DETAYLARI !== undefined) {
      orderData.ACIKLAMA_UZAK = orderData.SIPARIS_DETAYLARI;
      orderData.ACIKLAMA_YAKIN = '';
      delete orderData.SIPARIS_DETAYLARI;
    }

    const existing = await dbGet('SELECT SIRA_NO FROM siparisler WHERE SIRA_NO = ?', [orderData.SIRA_NO]);

    if (existing) {
      const setClauses = ORDER_COLUMNS.filter(c => c !== 'SIRA_NO').map(c => `${c} = ?`);
      const values = ORDER_COLUMNS.filter(c => c !== 'SIRA_NO').map(c => orderData[c] || '');
      values.push(orderData.SIRA_NO);
      await dbRun(`UPDATE siparisler SET ${setClauses.join(', ')} WHERE SIRA_NO = ?`, values);
    } else {
      const placeholders = ORDER_COLUMNS.map(() => '?').join(', ');
      const values = ORDER_COLUMNS.map(c => orderData[c] || '');
      await dbRun(`INSERT INTO siparisler (${ORDER_COLUMNS.join(', ')}) VALUES (${placeholders})`, values);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Siparis kaydetme hatasi:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:siraNo', async (req, res) => {
  try {
    await getDb();
    await dbRun('DELETE FROM siparisler WHERE SIRA_NO = ?', [parseInt(req.params.siraNo)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

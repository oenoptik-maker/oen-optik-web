// import-data.js - Mevcut Electron Excel verilerini SQLite'a aktarır
// Kullanım: node import-data.js

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { getDb, dbAll, dbGet, dbRun, saveDb } = require('./db/database');

const EXCEL_DIR = path.join(__dirname, '..', 'OEN-OPTİK', 'resources', 'app', 'data');
const EXCEL_FILE = path.join(EXCEL_DIR, 'siparisler.xlsx');

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

async function importData() {
  console.log('Veritabani baslatiliyor...');
  await getDb();

  if (!fs.existsSync(EXCEL_FILE)) {
    console.log('Excel dosyasi bulunamadi:', EXCEL_FILE);
    console.log('Lutfen Excel dosyasini su konuta koyun:', EXCEL_DIR);
    process.exit(1);
  }

  console.log('Excel dosyasi okunuyor:', EXCEL_FILE);
  const fileBuffer = fs.readFileSync(EXCEL_FILE);
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });

  // Siparişleri aktar
  if (wb.Sheets['Siparisler']) {
    const siparisler = XLSX.utils.sheet_to_json(wb.Sheets['Siparisler'], { defval: '' });
    console.log(`${siparisler.length} siparis bulundu`);

    let eklenen = 0;
    for (const s of siparisler) {
      const existing = dbGet('SELECT SIRA_NO FROM siparisler WHERE SIRA_NO = ?', [s.SIRA_NO]);
      if (!existing) {
        const placeholders = ORDER_COLUMNS.map(() => '?').join(', ');
        const values = ORDER_COLUMNS.map(c => s[c] !== undefined ? s[c] : '');
        dbRun(`INSERT INTO siparisler (${ORDER_COLUMNS.join(', ')}) VALUES (${placeholders})`, values);
        eklenen++;
      }
    }
    console.log(`${eklenen} siparis eklendi`);
  }

  // Kategorileri aktar
  if (wb.Sheets['Kategoriler']) {
    const kategoriler = XLSX.utils.sheet_to_json(wb.Sheets['Kategoriler'], { defval: '' });
    console.log(`${kategoriler.length} kategori bulundu`);

    let eklenen = 0;
    for (const k of kategoriler) {
      const existing = dbGet('SELECT KATEGORI_ID FROM kategoriler WHERE KATEGORI_ID = ?', [k.KATEGORI_ID]);
      if (!existing && k.KATEGORI_ADI) {
        dbRun('INSERT INTO kategoriler (KATEGORI_ID, KATEGORI_ADI) VALUES (?, ?)', [k.KATEGORI_ID, k.KATEGORI_ADI]);
        eklenen++;
      }
    }
    console.log(`${eklenen} kategori eklendi`);
  }

  // Ürünleri aktar
  if (wb.Sheets['Urunler']) {
    const urunler = XLSX.utils.sheet_to_json(wb.Sheets['Urunler'], { defval: '' });
    console.log(`${urunler.length} urun bulundu`);

    let eklenen = 0;
    for (const u of urunler) {
      const existing = dbGet('SELECT URUN_ID FROM urunler WHERE URUN_ID = ?', [u.URUN_ID]);
      if (!existing) {
        dbRun('INSERT INTO urunler (URUN_ID, KATEGORI_ADI, URUN_ADI, ALIS_FIYATI, FIYAT, ADET, KAREKOD, MENSEI) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [u.URUN_ID, u.KATEGORI_ADI || '', u.URUN_ADI || '', u.ALIS_FIYATI || 0, u.FIYAT || 0, u.ADET || 0, u.KAREKOD || '', u.MENSEI || '']);
        eklenen++;
      }
    }
    console.log(`${eklenen} urun eklendi`);
  }

  // UTS alımlarını aktar
  const UTS_FILE = path.join(EXCEL_DIR, 'uts_alim_verileri.xlsx');
  if (fs.existsSync(UTS_FILE)) {
    const utsBuffer = fs.readFileSync(UTS_FILE);
    const utsWb = XLSX.read(utsBuffer, { type: 'buffer' });
    if (utsWb.Sheets[utsWb.SheetNames[0]]) {
      const utsVerileri = XLSX.utils.sheet_to_json(utsWb.Sheets[utsWb.SheetNames[0]], { defval: '' });
      console.log(`${utsVerileri.length} UTS alimi bulundu`);

      let eklenen = 0;
      for (const v of utsVerileri) {
        dbRun('INSERT INTO uts_alimlar (URUN_NUMARASI, LOT_BATCH_NO, SERI_SIRA_NO, URUN_TANIMI, GONDEREN_KURUM, ADET, ALIS_FIYATI, SATIS_FIYATI, KAYIT_TARIHI) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [v.URUN_NUMARASI || '', v.LOT_BATCH_NO || '', v.SERI_SIRA_NO || '', v.URUN_TANIMI || '', v.GONDEREN_KURUM || '', v.ADET || '', v.ALIS_FIYATI || 0, v.SATIS_FIYATI || 0, v.KAYIT_TARIHI || '']);
        eklenen++;
      }
      console.log(`${eklenen} UTS alimi eklendi`);
    }
  }

  saveDb();
  console.log('İcerme tamamlandi! Veritabani kaydedildi.');

  // Özet
  const siparisSayisi = dbAll('SELECT COUNT(*) as cnt FROM siparisler')[0].cnt;
  const kategoriSayisi = dbAll('SELECT COUNT(*) as cnt FROM kategoriler')[0].cnt;
  const urunSayisi = dbAll('SELECT COUNT(*) as cnt FROM urunler')[0].cnt;
  console.log(`\nOzet:`);
  console.log(`  Siparisler: ${siparisSayisi}`);
  console.log(`  Kategoriler: ${kategoriSayisi}`);
  console.log(`  Urunler: ${urunSayisi}`);

  process.exit(0);
}

importData().catch(err => {
  console.error('Hata:', err);
  process.exit(1);
});

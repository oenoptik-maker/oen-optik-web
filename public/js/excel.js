const FIELD_IDS = {
  SIRA_NO: 'siraNo',
  AD_SOYAD: 'adSoyad',
  TC_KIMLIK: 'tcKimlik',
  TELEFON: 'telefon',
  SIPARIS_TARIHI: 'siparisTarihi',
  TESLIM_TARIHI: 'teslimTarihi',
  EMAIL: 'email',
  ADRES: 'adres',
  SAG_SPH_UZAK: 'sagSphUzak',
  SAG_CYL_UZAK: 'sagCylUzak',
  SAG_AXE_UZAK: 'sagAxeUzak',
  SOL_SPH_UZAK: 'solSphUzak',
  SOL_CYL_UZAK: 'solCylUzak',
  SOL_AXE_UZAK: 'solAxeUzak',
  SAG_SPH_YAKIN: 'sagSphYakin',
  SAG_CYL_YAKIN: 'sagCylYakin',
  SAG_AXE_YAKIN: 'sagAxeYakin',
  SOL_SPH_YAKIN: 'solSphYakin',
  SOL_CYL_YAKIN: 'solCylYakin',
  SOL_AXE_YAKIN: 'solAxeYakin',
  ADD_DEGER: 'addDeger',
  PD_SAG_UZAK: 'pdSagUzak',
  PD_SOL_UZAK: 'pdSolUzak',
  PD_SAG_YAKIN: 'pdSagYakin',
  PD_SOL_YAKIN: 'pdSolYakin',
  YUKSEKLIK_SAG_UZAK: 'yukseklikSagUzak',
  YUKSEKLIK_SOL_UZAK: 'yukseklikSolUzak',
  YUKSEKLIK_SAG_YAKIN: 'yukseklikSagYakin',
  YUKSEKLIK_SOL_YAKIN: 'yukseklikSolYakin',
  CAP_SAG_UZAK: 'capSagUzak',
  CAP_SOL_UZAK: 'capSolUzak',
  CAP_SAG_YAKIN: 'capSagYakin',
  CAP_SOL_YAKIN: 'capSolYakin',
  SIPARIS_DETAYLARI: 'siparisDetaylari',
  ODEME_DETAYLARI: 'odemeDetaylari',
  SECILEN_URUNLER: 'secilenUrunler',
  TOPLAM: 'toplam',
  ALINAN: 'alinan',
  KALAN: 'kalan',
  INDIRIM: 'indirim',
  INDIRIM_NOTU: 'indirimNotu'
};

function getFormData() {
  const data = {};
  for (const [key, id] of Object.entries(FIELD_IDS)) {
    if (key === 'SECILEN_URUNLER') {
      data[key] = JSON.stringify(seciliUrunlerListesi);
    } else if (key === 'ODEME_DETAYLARI') {
      data[key] = JSON.stringify(odemeListesi);
    } else {
      const el = document.getElementById(id);
      data[key] = el ? el.value : '';
    }
  }
  return data;
}

const UPPER_FIELDS = new Set([
  'AD_SOYAD', 'ADRES', 'SIPARIS_DETAYLARI',
  'SAG_SPH_UZAK', 'SAG_CYL_UZAK', 'SAG_AXE_UZAK', 'SOL_SPH_UZAK', 'SOL_CYL_UZAK', 'SOL_AXE_UZAK',
  'SAG_SPH_YAKIN', 'SAG_CYL_YAKIN', 'SAG_AXE_YAKIN', 'SOL_SPH_YAKIN', 'SOL_CYL_YAKIN', 'SOL_AXE_YAKIN'
]);

function setFormData(data) {
  for (const [key, id] of Object.entries(FIELD_IDS)) {
    if (key === 'SECILEN_URUNLER') {
      try {
        seciliUrunlerListesi = JSON.parse(data[key] || '[]');
      } catch {
        seciliUrunlerListesi = [];
      }
      renderSeciliUrunler();
    } else if (key === 'ODEME_DETAYLARI') {
      try {
        odemeListesi = JSON.parse(data[key] || '[]');
      } catch {
        odemeListesi = [];
      }
      renderOdemeListesi();
    } else {
      const el = document.getElementById(id);
      if (el) {
        const val = data[key];
        if (val !== undefined && val !== null && val !== '') {
          el.value = val;
        }
      }
    }
  }
}

function clearFormData() {
  for (const [key, id] of Object.entries(FIELD_IDS)) {
    if (key === 'SECILEN_URUNLER') {
      seciliUrunlerListesi = [];
      renderSeciliUrunler();
    } else if (key === 'ODEME_DETAYLARI') {
      odemeListesi = [];
      renderOdemeListesi();
    } else {
      const el = document.getElementById(id);
      if (el) el.value = '';
    }
  }
}

async function readExcel() {
  return await window.api.excelRead();
}

async function saveOrderToExcel(data) {
  return await window.api.excelSaveOrder(data);
}

async function deleteOrderFromExcel(siraNo) {
  return await window.api.excelDeleteOrder(siraNo);
}

async function getNextSiraNo() {
  return await window.api.excelGetNextSiraNo();
}

function exportToNewExcel(data, filePath) {
  try {
    const XLSX_LIB = window.XLSX;
    if (!XLSX_LIB) return false;
    const worksheet = XLSX_LIB.utils.json_to_sheet(data);
    const workbook = XLSX_LIB.utils.book_new();
    XLSX_LIB.utils.book_append_sheet(workbook, worksheet, 'Siparisler');
    XLSX_LIB.writeFile(workbook, filePath);
    return true;
  } catch (err) {
    console.error('Disa aktarma hatasi:', err);
    return false;
  }
}

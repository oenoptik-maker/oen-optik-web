// api.js - window.api objesi (Electron IPC → fetch wrapper)
// Mevcut tüm window.api.xxx() çağrılarını karşılar

async function apiFetch(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    if (response.status === 401) {
      window.location.href = '/login.html';
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error('API hatasi:', url, err);
    throw err;
  }
}

window.api = {
  // ===== SİPARİŞ İŞLEMLERİ =====
  getExcelPath: () => Promise.resolve('/data/oen-optik.db'),
  excelRead: () => apiFetch('/api/siparisler'),
  excelWrite: (data) => apiFetch('/api/siparisler', { method: 'POST', body: JSON.stringify({ writeAll: true, data }) }),
  excelSaveOrder: (order) => apiFetch('/api/siparisler', { method: 'POST', body: JSON.stringify(order) }),
  excelDeleteOrder: (siraNo) => apiFetch(`/api/siparisler/${siraNo}`, { method: 'DELETE' }),
  excelGetNextSiraNo: () => apiFetch('/api/siparisler/sonraki-no'),
  excelSearchOrder: (params) => apiFetch(`/api/siparisler/ara?${new URLSearchParams(params)}`),

  // ===== KATEGORİ İŞLEMLERİ =====
  kategoriRead: () => apiFetch('/api/kategoriler'),
  kategoriSave: (kategori) => apiFetch('/api/kategoriler', { method: 'POST', body: JSON.stringify(kategori) }),
  kategoriDelete: (id) => apiFetch(`/api/kategoriler/${id}`, { method: 'DELETE' }),
  kategoriGetNextId: () => apiFetch('/api/kategoriler/sonraki-id'),

  // ===== ÜRÜN İŞLEMLERİ =====
  urunRead: () => apiFetch('/api/urunler'),
  urunSave: (urun) => apiFetch('/api/urunler', { method: 'POST', body: JSON.stringify(urun) }),
  urunDelete: (id) => apiFetch(`/api/urunler/${id}`, { method: 'DELETE' }),
  urunDeleteBulk: (idler) => apiFetch('/api/urunler/toplu-sil', { method: 'POST', body: JSON.stringify({ idler }) }),
  urunGetNextId: () => apiFetch('/api/urunler/sonraki-id'),

  // ===== STOK İŞLEMLERİ =====
  topluStokRead: () => apiFetch('/api/stok/toplu'),
  topluStokOnayla: (veriler) => apiFetch('/api/stok/toplu-onayla', { method: 'POST', body: JSON.stringify(veriler) }),
  stokGuncelle: (urunler) => apiFetch('/api/urunler/stok-guncelle', { method: 'PUT', body: JSON.stringify(urunler) }),
  stokAyarla: (urunler) => apiFetch('/api/urunler/stok-ayarla', { method: 'PUT', body: JSON.stringify(urunler) }),

  // ===== DOSYA İŞLEMLERİ =====
  openFileDialog: () => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls';
      input.onchange = (e) => resolve(e.target.files[0] ? e.target.files[0].path : null);
      input.click();
    });
  },
  saveFileDialog: () => {
    return new Promise((resolve) => {
      const a = document.createElement('a');
      a.download = `siparisler_${new Date().toISOString().slice(0,10)}.xlsx`;
      resolve(a.download);
    });
  },

  // ===== YEDEKLEME =====
  createBackup: () => apiFetch('/api/backup/olustur', { method: 'POST' }),
  openBackupFolder: () => window.open('/data/yedekler', '_blank'),
  getBackupList: () => apiFetch('/api/backup/liste'),
  restoreBackup: (filename) => apiFetch('/api/backup/geri-yukle', { method: 'POST', body: JSON.stringify({ filename }) }),

  // ===== QR KOD =====
  qrGenerate: (text, size) => apiFetch(`/api/qr/${encodeURIComponent(text)}?size=${size || 150}`),

  // ===== UTS İŞLEMLERİ =====
  utsPencereAc: () => {
    window.open('https://utsuygulama.saglik.gov.tr/UTS', '_blank');
    return Promise.resolve({ success: true });
  },
  utsDurumDinle: (callback) => {
    // Web'de bu özellik sınırlı, callback çağrılmaz
    console.log('UTS durum dinleme: Web modunda sinirli destek');
  },
  utsVeriCek: () => Promise.resolve({ success: false, message: 'Web modunda UTS veri cekme desteklenmiyor. Verileri manuel olarak yapistirin.' }),
  utsAlimKaydet: (veriler) => apiFetch('/api/uts/alimlar', { method: 'POST', body: JSON.stringify(veriler) }),
  utsAlimOku: () => apiFetch('/api/uts/alimlar'),
  utsAlimSil: (index) => apiFetch(`/api/uts/alimlar/${index}`, { method: 'DELETE' }),
  utsAlimSilToplu: (indexler) => apiFetch('/api/uts/alimlar/toplu-sil', { method: 'POST', body: JSON.stringify({ indexler }) }),
  utsAlimTemizle: () => apiFetch('/api/uts/alimlar', { method: 'DELETE' }),
  utsAlimFiyatGuncelle: (veri) => apiFetch(`/api/uts/alimlar/${veri.index}/fiyat`, { method: 'PUT', body: JSON.stringify({ alan: veri.alan, deger: veri.deger }) }),
  utsAlimTopluFiyatGuncelle: (veri) => apiFetch('/api/uts/alimlar/toplu-fiyat', { method: 'PUT', body: JSON.stringify(veri) }),

  // ===== CREDENTIAL =====
  credentialKaydet: (veriler) => apiFetch('/api/uts/credential-kaydet', { method: 'POST', body: JSON.stringify(veriler) }),
  credentialOku: () => apiFetch('/api/uts/credential-oku'),

  // ===== ETİKET =====
  etiketDesignKaydet: (design) => apiFetch('/api/etiket/tasarim', { method: 'POST', body: JSON.stringify(design) }),
  etiketDesignOku: () => apiFetch('/api/etiket/tasarim'),
  etiketYazdir: (params) => {
    // Yazdırma: HTML'i yeni pencerede aç ve yazdır
    const win = window.open('', '_blank');
    win.document.write(params.html);
    win.document.close();
    setTimeout(() => { win.print(); }, 1000);
    return Promise.resolve({ success: true });
  },
  yaziciListesi: () => apiFetch('/api/etiket/yazicilar')
};

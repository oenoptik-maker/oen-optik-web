// api.js - window.api objesi (Electron IPC → fetch wrapper)
// Mevcut tüm window.api.xxx() çağrılarını karşılar

// iOS Safari third-party iframe'de localStorage calismayabilir.
// Token'i global degiskende tutalim, localStorage'i best-effort olarak kullanalim.
window._okenToken = null;

// Sayfa yuklenirken URL'den token al (ilk yuklemede)
(function() {
  try {
    var params = new URLSearchParams(window.location.search);
    var urlToken = params.get('token');
    if (urlToken) {
      window._okenToken = urlToken;
      try { localStorage.setItem('oken_token', urlToken); } catch(e) {}
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }
  } catch(e) {}
  // URL'de token yoksa localStorage'dan al
  try {
    var t = localStorage.getItem('oken_token');
    if (t) window._okenToken = t;
  } catch(e) {}
})();

function getAuthToken() {
  if (window._okenToken) return window._okenToken;
  try {
    var t = localStorage.getItem('oken_token');
    if (t) { window._okenToken = t; return t; }
  } catch(e) {}
  return null;
}

function setAuthToken(token) {
  window._okenToken = token;
  try { localStorage.setItem('oken_token', token); } catch(e) {}
}

function clearAuthToken() {
  window._okenToken = null;
  try { localStorage.removeItem('oken_token'); } catch(e) {}
}

async function apiFetch(url, options = {}) {
  try {
    const token = getAuthToken();
    // Token'i hem header'a hem URL query'ye ekle (iOS/cross-origin guvenlikli)
    let finalUrl = url;
    if (token && !url.includes('token=')) {
      const sep = url.includes('?') ? '&' : '?';
      finalUrl = url + sep + 'token=' + encodeURIComponent(token);
    }
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const response = await fetch(finalUrl, { ...options, headers });
    if (response.status === 401) {
      clearAuthToken();
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
  topluStokYukle: (dosya) => {
    const formData = new FormData();
    formData.append('file', dosya);
    const token = getAuthToken();
    const url = '/api/stok/toplu-yukle' + (token ? '?token=' + encodeURIComponent(token) : '');
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(url, { method: 'POST', headers, body: formData })
      .then(async r => {
        if (r.status === 401) { clearAuthToken(); window.location.href = '/login.html'; return null; }
        return await r.json();
      });
  },
  stokGuncelle: (urunler) => apiFetch('/api/urunler/stok-guncelle', { method: 'PUT', body: JSON.stringify(urunler) }),
  stokAyarla: (urunler) => apiFetch('/api/urunler/stok-ayarla', { method: 'PUT', body: JSON.stringify(urunler) }),
  mukerrerTemizle: () => apiFetch('/api/stok/mukerrer-temizle', { method: 'POST' }),
  fiyatGuncelle: (urunler) => apiFetch('/api/urunler/fiyat-guncelle', { method: 'PUT', body: JSON.stringify(urunler) }),
  fiyatTekli: (veri) => apiFetch('/api/urunler/fiyat-tekli', { method: 'PUT', body: JSON.stringify(veri) }),

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
  createBackup: () => fetch('/api/backup/olustur', { method: 'POST' }).then(async r => {
    if (r.status === 401) { window.location.href = '/login.html'; return null; }
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'Sunucu hatası'); }
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) return await r.json();
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yedek_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return { success: true };
  }),
  getBackupList: () => apiFetch('/api/backup/liste'),
  restoreBackup: (filename) => apiFetch('/api/backup/geri-yukle', { method: 'POST', body: JSON.stringify({ filename }) }),
  restoreBackupFromJson: (yedek) => apiFetch('/api/backup/yukle-geri-yukle', { method: 'POST', body: JSON.stringify({ yedek }) }),

  // ===== QR KOD =====
  qrGenerate: (text, size) => apiFetch(`/api/qr/${encodeURIComponent(text)}?size=${size || 150}`),

  // ===== UTS İŞLEMLERİ =====
  utsPencereAc: () => {
    window.open('https://utsuygulama.saglik.gov.tr/UTS/tibbiCihaz#/topluAlmaBildirimiEkle', '_blank');
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

  // ===== UTS API (DOĞRUDAN BAĞLANTI) =====
  utsApiSaglikKontrol: () => apiFetch('/api/uts-api/health'),
  utsApiGetToken: async () => {
    const r = await apiFetch('/api/uts-api/get-token');
    return r && r.token ? r.token : null;
  },
  utsApiBekleyenUrunleriSorgula: (p) => apiFetch('/api/uts-api/bekleyen-urunleri-sorgula', { method: 'POST', body: JSON.stringify(p) }),
  utsApiBekleyenUrunleri: (gkk) => apiFetch('/api/uts-api/bekleyen-urunleri-sorgula', { method: 'POST', body: JSON.stringify({ gkk: gkk, BNO: '', UNO: '', BID: '', SAN: 1 }) }),
  utsApiBekleyenSayisi: (p) => apiFetch('/api/uts-api/bekleyen-sayisi', { method: 'POST', body: JSON.stringify(p) }),
  utsApiAlmaBildirimi: (b) => apiFetch('/api/uts-api/alma-bildirimi', { method: 'POST', body: JSON.stringify(b) }),
  utsApiTopluAlmaBildirimi: (b) => apiFetch('/api/uts-api/toplu-alma-bildirimi', { method: 'POST', body: JSON.stringify({ bildirimler: b }) }),
  utsApiUrunSorgula: (p) => apiFetch('/api/uts-api/urun-sorgula', { method: 'POST', body: JSON.stringify(p) }),
  utsApiAyrintiliSorgula: (p) => apiFetch('/api/uts-api/ayrintili-sorgula', { method: 'POST', body: JSON.stringify(p) }),
  utsApiDebug: (gkk) => apiFetch('/api/uts-api/debug-sorgula', { method: 'POST', body: JSON.stringify({ gkk }) }),

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

let tumUrunler = [];
let tumKategorilerForm = [];
let seciliUrunlerListesi = [];
let odemeListesi = [];
let eskiSiparisUrunleri = [];

let confirmResolver = null;
function showConfirm(message, title) {
  return new Promise(resolve => {
    confirmResolver = resolve;
    document.getElementById('confirmModalTitle').textContent = title || 'Onay';
    document.getElementById('confirmModalBody').textContent = message;
    document.getElementById('confirmModal').classList.add('active');
  });
}
function resolveConfirm(result) {
  document.getElementById('confirmModal').classList.remove('active');
  if (confirmResolver) { confirmResolver(result); confirmResolver = null; }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (window.self !== window.top) {
      document.documentElement.classList.add('in-iframe');
      document.body.classList.add('in-iframe');
    }
    initTheme();

    // Tarayici otomatik doldurmayi engelle - tuzak inputlari temizle
    setTimeout(() => {
      document.querySelectorAll('input[name=fakeuser], input[name=fakepass]').forEach(el => { el.value = ''; });
      // Tum inputlari kontrol et, placeholder disinda deger varsa ve kullanici girmemisse temizle
      ['email','tcKimlik','adSoyad','telefon','adres'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.removeAttribute('autocomplete');
          el.setAttribute('autocomplete', 'one-time-code');
        }
      });
    }, 50);
    // Autofill yakalama - mutation observer
    setTimeout(() => {
      ['email','tcKimlik','adSoyad','telefon','adres'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          const check = () => {
            if (el.value && el.value.toLowerCase() === 'oguzhan') {
              el.value = '';
            }
          };
          el.addEventListener('change', check);
          el.addEventListener('input', check);
          check();
        }
      });
    }, 500);

    const isListPage = window.location.pathname.includes('list.html');
    const isAdminPage = window.location.pathname.includes('admin.html');

    // Sayfa türüne göre sadece gerekli minimum veriyi yükle
    if (!isListPage && !isAdminPage) {
      // Form sayfası: önce sayfayı göster, verileri arka planda yükle
      clearFormData();
      duzenleniyor = false;
      arananSiparisId = null;
      duzenlemeModuKapat();
      renderSeciliUrunler();
      renderOdemeListesi();
      updateOdemeOzeti();

      document.getElementById('siparisTarihi').value = formatDateForInput(new Date());
      document.getElementById('teslimTarihi').value = formatDateForInput(new Date());
      const odemeTarihInput = document.getElementById('yeniOdemeTarih');
      if (odemeTarihInput && !odemeTarihInput.value) odemeTarihInput.value = formatDateForInput(new Date());

      // Toplam/kalan hesaplama
      const toplamInput = document.getElementById('toplam');
      const alinanInput = document.getElementById('alinan');
      const kalanInput = document.getElementById('kalan');
      function updateKalan() {
        const toplam = parseFloat(toplamInput.value);
        const alinan = parseFloat(alinanInput.value);
        if (isNaN(toplam) && isNaN(alinan)) { kalanInput.value = ''; }
        else { kalanInput.value = ((isNaN(toplam) ? 0 : toplam) - (isNaN(alinan) ? 0 : alinan)).toFixed(0); }
      }
      toplamInput.addEventListener('input', () => { toplamInput.dataset.manuallyEdited = 'true'; updateKalan(); });
      alinanInput.addEventListener('input', updateKalan);

      // Draft/edit verisi varsa yükle
      const draftData = sessionStorage.getItem('orderDraft');
      const editData = sessionStorage.getItem('editOrder');
      sessionStorage.removeItem('orderDraft');
      sessionStorage.removeItem('editOrder');

      if (draftData) {
        try {
          const draft = JSON.parse(draftData);
          setFormData(draft);
          if (draft.odemeListesi) odemeListesi = draft.odemeListesi;
          if (draft.seciliUrunlerListesi) seciliUrunlerListesi = draft.seciliUrunlerListesi;
          renderOdemeListesi();
          renderSeciliUrunler();
          urunToplamiGuncelle();
          updateOdemeOzeti();
        } catch (err) { clearFormData(); }
      } else if (editData) {
        try {
          const order = JSON.parse(editData);
          eskiSiparisUrunleri = JSON.parse(order.SECILEN_URUNLER || '[]');
          setFormData(order);
          urunToplamiGuncelle();
          updateOdemeOzeti();
          duzenlemeModuAc(order.SIRA_NO);
          if (sessionStorage.getItem('editPaymentOnly') === 'true') {
            sessionStorage.removeItem('editPaymentOnly');
            setTimeout(() => {
              const odemeSection = document.querySelector('[id="yeniOdemeTipi"]')?.closest('.card');
              if (odemeSection) odemeSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 300);
          }
        } catch (err) { clearFormData(); }
      }

      // Loading overlay'i gizle - sayfa artık kullanıma hazır
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) loadingOverlay.classList.add('hidden');

      // Arka planda ürün ve kategori yükle (sayfa gösterildikten sonra)
      requestAnimationFrame(async () => {
        const [urunler, kategoriler] = await Promise.all([
          window.api.urunRead(),
          window.api.kategoriRead()
        ]);
        tumUrunler = urunler;
        tumKategorilerForm = kategoriler;
        
        const kategoriSelect = document.getElementById('urunKategoriFiltre');
        if (kategoriSelect) {
          kategoriSelect.innerHTML = '<option value="">Tüm Kategoriler</option>' +
            tumKategorilerForm.map(k => `<option value="${k.KATEGORI_ADI}">${k.KATEGORI_ADI}</option>`).join('');
        }
        filtreUrunleri();
        if (!duzenleniyor) {
          const nextNo = await getNextSiraNo();
          document.getElementById('siraNo').value = nextNo;
        }
        if (seciliUrunlerListesi.length > 0) urunToplamiGuncelle();
        if (odemeListesi.length > 0) updateOdemeOzeti();
      });

      window.addEventListener('pagehide', () => {
        sessionStorage.removeItem('editOrder');
        sessionStorage.removeItem('orderDraft');
      });
    } else if (isListPage) {
      // List sayfası
      await initListPage();
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) loadingOverlay.classList.add('hidden');

      // bfcache: sayfa geri geldiginde veriyi yenile
      window.addEventListener('pageshow', function(e) {
        if (e.persisted) { loadOrders(); }
      });
    } else {
      // Admin sayfası
      tumUrunler = await window.api.urunRead();
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  } catch (err) {
    console.error('DOMContentLoaded hatasi:', err);
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
  }
});

async function initFormPage() {
  duzenleniyor = false;
  arananSiparisId = null;
  duzenlemeModuKapat();

  const draftData = sessionStorage.getItem('orderDraft');
  const editData = sessionStorage.getItem('editOrder');
  sessionStorage.removeItem('orderDraft');
  sessionStorage.removeItem('editOrder');

  if (draftData) {
    try {
      const draft = JSON.parse(draftData);
      setFormData(draft);
      if (draft.odemeListesi) {
        odemeListesi = draft.odemeListesi;
      }
      if (draft.seciliUrunlerListesi) {
        seciliUrunlerListesi = draft.seciliUrunlerListesi;
      }
      renderOdemeListesi();
      renderSeciliUrunler();
      urunToplamiGuncelle();
      updateOdemeOzeti();
      showToast('Taslak bilgileri geri yuklendi.', 'info');
    } catch (err) {
      console.error('Draft yükleme hatası:', err);
      clearFormData();
    }
  } else if (editData) {
    try {
      const order = JSON.parse(editData);
      eskiSiparisUrunleri = JSON.parse(order.SECILEN_URUNLER || '[]');
      setFormData(order);
      duzenlemeModuAc(order.SIRA_NO);
      showToast(`${order.AD_SOYAD} - ${order.SIRA_NO} nolu sipariş düzenleniyor.`, 'info');
    } catch (err) {
      console.error('Sipariş yükleme hatası:', err);
      clearFormData();
    }
  } else {
    clearFormData();
    const nextNo = await getNextSiraNo();
    document.getElementById('siraNo').value = nextNo;
    odemeListesi = [];
    seciliUrunlerListesi = [];
    eskiSiparisUrunleri = [];
    renderSeciliUrunler();
    renderOdemeListesi();
  }

  document.getElementById('siparisTarihi').value = formatDateForInput(new Date());
  document.getElementById('teslimTarihi').value = formatDateForInput(new Date());
  const odemeTarihInput = document.getElementById('yeniOdemeTarih');
  if (odemeTarihInput && !odemeTarihInput.value) odemeTarihInput.value = formatDateForInput(new Date());
  renderOdemeListesi();
  updateOdemeOzeti();

  const toplamInput = document.getElementById('toplam');
  const alinanInput = document.getElementById('alinan');
  const kalanInput = document.getElementById('kalan');

  function updateKalan() {
    const toplam = parseFloat(toplamInput.value);
    const alinan = parseFloat(alinanInput.value);
    if (isNaN(toplam) && isNaN(alinan)) {
      kalanInput.value = '';
    } else {
      kalanInput.value = ((isNaN(toplam) ? 0 : toplam) - (isNaN(alinan) ? 0 : alinan)).toFixed(0);
    }
  }

  toplamInput.addEventListener('input', () => {
    toplamInput.dataset.manuallyEdited = 'true';
    updateKalan();
  });
  alinanInput.addEventListener('input', updateKalan);

  tumKategorilerForm = await window.api.kategoriRead();
  const kategoriSelect = document.getElementById('urunKategoriFiltre');
  if (kategoriSelect) {
    kategoriSelect.innerHTML = '<option value="">Tüm Kategoriler</option>' +
      tumKategorilerForm.map(k => `<option value="${k.KATEGORI_ADI}">${k.KATEGORI_ADI}</option>`).join('');
  }

  filtreUrunleri();
}

function goToAdminPage() {
  try {
    const data = getFormData();
    data.odemeListesi = odemeListesi;
    data.seciliUrunlerListesi = seciliUrunlerListesi;
    sessionStorage.setItem('orderDraft', JSON.stringify(data));
  } catch (err) {
    console.error('Admin sayfasina gecis hatasi:', err);
  }
  window.location.href = 'admin.html';
}

async function initListPage() {
  await loadOrders();
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// ===== ÜRÜN SEÇİM İŞLEMLERİ =====
let seciliUrunId = null;

function urunAramaYap(arama) {
  const dropdown = document.getElementById('urunDropdown');
  const kategoriFiltre = document.getElementById('urunKategoriFiltre');
  const seciliKategori = kategoriFiltre ? kategoriFiltre.value : '';
  let filtrelenmis = tumUrunler;

  if (seciliKategori) {
    filtrelenmis = filtrelenmis.filter(u => u.KATEGORI_ADI === seciliKategori);
  }

  const temizArama = arama.toLowerCase().trim();
  if (temizArama) {
    filtrelenmis = filtrelenmis.filter(u => 
      (u.URUN_ADI && u.URUN_ADI.toLowerCase().includes(temizArama)) ||
      (u.KAREKOD && String(u.KAREKOD).toLowerCase().includes(temizArama))
    );
  }

  if (filtrelenmis.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.innerHTML = filtrelenmis.slice(0, 20).map(u =>
    `<div style="padding:6px 10px; cursor:pointer; border-bottom:1px solid var(--border); font-size:0.85rem;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''" onmousedown="urunSec('${u.URUN_ID}', '${u.URUN_ADI.replace(/'/g, "\\'")} - ₺${parseFloat(u.FIYAT || 0).toFixed(0)}')">${u.URUN_ADI} - ₺${parseFloat(u.FIYAT || 0).toFixed(0)}</div>`
  ).join('');
  dropdown.style.display = 'block';
}

function urunSec(id, text) {
  document.getElementById('urunArama').value = text;
  document.getElementById('urunSecim').value = id;
  seciliUrunId = id;
  document.getElementById('urunDropdown').style.display = 'none';
}

document.addEventListener('click', function(e) {
  const dropdown = document.getElementById('urunDropdown');
  const arama = document.getElementById('urunArama');
  if (dropdown && arama && !dropdown.contains(e.target) && e.target !== arama) {
    dropdown.style.display = 'none';
  }
});

function filtreUrunleri() {
  const arama = document.getElementById('urunArama');
  if (arama && arama.value) {
    urunAramaYap(arama.value);
  }
}

async function openUrunModal() {
  document.getElementById('urunModalTitle').textContent = 'Yeni Ürün';
  document.getElementById('urunId').value = '';
  document.getElementById('urunAdi').value = '';
  document.getElementById('urunAlisFiyat').value = '';
  document.getElementById('urunFiyat').value = '';
  document.getElementById('urunAdet').value = '';
  document.getElementById('urunMensei').value = '';

  const kategoriler = await window.api.kategoriRead();
  const select = document.getElementById('urunKategori');
  select.innerHTML = kategoriler.map(k => `<option value="${k.KATEGORI_ADI}">${k.KATEGORI_ADI}</option>`).join('');

  document.getElementById('urunModal').classList.add('active');
  document.getElementById('urunAdi').focus();
}

function closeUrunModal() {
  document.getElementById('urunModal').classList.remove('active');
}

async function modalUrunKaydet() {
  const kategori = document.getElementById('urunKategori').value;
  const adi = document.getElementById('urunAdi').value.trim();
  const alisFiyat = document.getElementById('urunAlisFiyat').value;
  const fiyat = document.getElementById('urunFiyat').value;
  const adet = document.getElementById('urunAdet').value;
  const mensei = document.getElementById('urunMensei').value.trim();

  if (!adi) { showToast('Ürün adı boş olamaz.', 'error'); return; }
  if (!kategori) { showToast('Kategori seçiniz.', 'error'); return; }

  const urunId = await window.api.urunGetNextId();
  const result = await window.api.urunSave({
    URUN_ID: urunId,
    KATEGORI_ADI: kategori,
    URUN_ADI: adi,
    ALIS_FIYATI: parseFloat(alisFiyat) || 0,
    FIYAT: parseFloat(fiyat) || 0,
    ADET: parseInt(adet) || 0,
    KAREKOD: '',
    MENSEI: mensei
  });

  if (result) {
    showToast('Ürün kaydedildi ve siparişe eklendi.', 'success');
    closeUrunModal();
    tumUrunler = await window.api.urunRead();

    // Yeni kaydedilen urunu siparise otomatik ekle
    const yeniUrun = tumUrunler.find(u => String(u.URUN_ID) === String(urunId));
    if (yeniUrun) {
      const mevcut = seciliUrunlerListesi.find(item => String(item.URUN_ID) === String(yeniUrun.URUN_ID));
      if (mevcut) {
        mevcut.ADET += 1;
      } else {
        seciliUrunlerListesi.push({
          URUN_ID: yeniUrun.URUN_ID,
          URUN_ADI: yeniUrun.URUN_ADI,
          KATEGORI_ADI: yeniUrun.KATEGORI_ADI,
          ALIS_FIYATI: parseFloat(yeniUrun.ALIS_FIYATI) || 0,
          FIYAT: parseFloat(yeniUrun.FIYAT) || 0,
          ADET: 1,
          INDIRIM_TL: 0,
          INDIRIM_YUZDE: 0
        });
      }
      renderSeciliUrunler();
    }
  } else {
    showToast('Kaydetme hatası!', 'error');
  }
}

function urunEkle() {
  const urunSecim = document.getElementById('urunSecim');
  if (!urunSecim || !urunSecim.value) return;

  const seciliId = urunSecim.value;
  const urun = tumUrunler.find(u => String(u.URUN_ID) === String(seciliId));
  if (!urun) return;

  const mevcut = seciliUrunlerListesi.find(item => String(item.URUN_ID) === String(seciliId));
  if (mevcut) {
    mevcut.ADET += 1;
  } else {
    seciliUrunlerListesi.push({
      URUN_ID: urun.URUN_ID,
      URUN_ADI: urun.URUN_ADI,
      KATEGORI_ADI: urun.KATEGORI_ADI,
      ALIS_FIYATI: parseFloat(urun.ALIS_FIYATI) || 0,
      FIYAT: parseFloat(urun.FIYAT) || 0,
      ADET: 1,
      INDIRIM_TL: 0,
      INDIRIM_YUZDE: 0
    });
  }

  document.getElementById('urunArama').value = '';
  document.getElementById('urunSecim').value = '';
  seciliUrunId = null;

  renderSeciliUrunler();
  urunToplamiGuncelle();
}

// Ardışık karakter eşleşme uzunluğunu hesapla
function consecutiveMatch(a, b) {
  const sa = String(a).replace(/\D/g, '');
  const sb = String(b).replace(/\D/g, '');
  if (!sa || !sb) return 0;
  let maxLen = 0;
  // sa'nin her pozisyonundan sb'nin her pozisyonuna eslesme ara
  for (let i = 0; i < sa.length; i++) {
    for (let j = 0; j < sb.length; j++) {
      let len = 0;
      while (i + len < sa.length && j + len < sb.length && sa[i + len] === sb[j + len]) {
        len++;
      }
      if (len > maxLen) maxLen = len;
    }
  }
  return maxLen;
}

function barkodUrunSec(urunId) {
  const urun = tumUrunler.find(u => String(u.URUN_ID) === String(urunId));
  if (!urun) return;
  const mevcut = seciliUrunlerListesi.find(item => String(item.URUN_ID) === String(urun.URUN_ID));
  if (mevcut) {
    mevcut.ADET += 1;
  } else {
    seciliUrunlerListesi.push({
      URUN_ID: urun.URUN_ID,
      URUN_ADI: urun.URUN_ADI,
      KATEGORI_ADI: urun.KATEGORI_ADI,
      ALIS_FIYATI: parseFloat(urun.ALIS_FIYATI) || 0,
      FIYAT: parseFloat(urun.FIYAT) || 0,
      ADET: 1,
      INDIRIM_TL: 0,
      INDIRIM_YUZDE: 0
    });
  }
  const dropdown = document.getElementById('barkodDropdown');
  if (dropdown) dropdown.style.display = 'none';
  const barkodInput = document.getElementById('barkodGiris');
  if (barkodInput) { barkodInput.value = ''; barkodInput.focus(); }
  renderSeciliUrunler();
  urunToplamiGuncelle();
}

function barkodIleEkle() {
  const barkodInput = document.getElementById('barkodGiris');
  if (!barkodInput) return;

  const barkod = barkodInput.value.trim();
  if (!barkod) return;

  // 1. Tam eşleşme dene
  const tamEslesen = tumUrunler.find(u => u.KAREKOD && String(u.KAREKOD).trim() === barkod);
  if (tamEslesen) {
    barkodUrunSec(tamEslesen.URUN_ID);
    return;
  }

  // 2. Her ürün için eşleşme sayısını hesapla
  const MIN_MATCH = 10;
  const tumEslesmeler = [];
  for (const u of tumUrunler) {
    if (!u.KAREKOD) continue;
    const eslesme = consecutiveMatch(barkod, u.KAREKOD);
    if (eslesme >= MIN_MATCH) {
      tumEslesmeler.push({ urun: u, eslesme });
    }
  }

  if (tumEslesmeler.length === 0) {
    showToast(barkod + ' barkodunda ürün bulunamadı.', 'warning');
    barkodInput.value = '';
    barkodInput.focus();
    return;
  }

  // 3. En yüksek eşleşme seviyesini bul
  tumEslesmeler.sort((a, b) => b.eslesme - a.eslesme);
  const enYuksekEslesme = tumEslesmeler[0].eslesme;

  // 4. Sadece en yüksek seviyedekileri göster
  const eslesenler = tumEslesmeler.filter(e => e.eslesme === enYuksekEslesme);

  // Eşleşen ürünleri dropdown'da göster
  let dropdown = document.getElementById('barkodDropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'barkodDropdown';
    dropdown.style.cssText = 'position:absolute;z-index:9999;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;max-height:250px;overflow-y:auto;width:100%;box-shadow:0 8px 24px rgba(0,0,0,0.3);display:none;';
    barkodInput.parentElement.style.position = 'relative';
    barkodInput.parentElement.appendChild(dropdown);
  }

  dropdown.innerHTML = `<div style="padding:6px 12px;font-size:0.7rem;color:var(--text-secondary);border-bottom:1px solid var(--border);">${enYuksekEslesme} hanede eşleşen ${eslesenler.length} ürün bulundu</div>` +
    eslesenler.slice(0, 15).map(({ urun, eslesme }) => `
    <div style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:0.82rem;display:flex;justify-content:space-between;align-items:center;"
         onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''"
         onclick="barkodUrunSec('${urun.URUN_ID}')">
      <div>
        <div style="font-weight:600;color:var(--text-primary);">${urun.URUN_ADI}</div>
        <div style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">${urun.KATEGORI_ADI || ''} | ₺${parseFloat(urun.FIYAT || 0).toFixed(0)}</div>
      </div>
      <div style="font-size:0.65rem;color:var(--accent);white-space:nowrap;margin-left:8px;">${eslesme} hane</div>
    </div>
  `).join('');

  dropdown.style.display = 'block';

  // Dışarı tıklayınca kapat
  const kapat = (e) => {
    if (!dropdown.contains(e.target) && e.target !== barkodInput) {
      dropdown.style.display = 'none';
      document.removeEventListener('click', kapat);
    }
  };
  setTimeout(() => document.addEventListener('click', kapat), 100);
}

function urunCikar(urunId) {
  seciliUrunlerListesi = seciliUrunlerListesi.filter(item => String(item.URUN_ID) !== String(urunId));
  renderSeciliUrunler();
  urunToplamiGuncelle();
}

function urunAdetGuncelle(urunId, yeniAdet) {
  const item = seciliUrunlerListesi.find(i => String(i.URUN_ID) === String(urunId));
  if (item) {
    item.ADET = parseInt(yeniAdet) || 1;
    if (item.ADET < 1) item.ADET = 1;
    urunIndirimHesapla(item);
    renderSeciliUrunler();
    urunToplamiGuncelle();
  }
}

function urunIndirimTLGuncelle(urunId, tlDeger) {
  const item = seciliUrunlerListesi.find(i => String(i.URUN_ID) === String(urunId));
  if (!item) return;
  const birimToplam = item.FIYAT * item.ADET;
  item.INDIRIM_TL = parseFloat(tlDeger) || 0;
  if (item.INDIRIM_TL < 0) item.INDIRIM_TL = 0;
  if (item.INDIRIM_TL > birimToplam) item.INDIRIM_TL = birimToplam;
  item.INDIRIM_YUZDE = birimToplam > 0 ? (item.INDIRIM_TL / birimToplam * 100) : 0;
  renderSeciliUrunler();
  urunToplamiGuncelle();
}

function urunIndirimYuzdeGuncelle(urunId, yuzdeDeger) {
  const item = seciliUrunlerListesi.find(i => String(i.URUN_ID) === String(urunId));
  if (!item) return;
  const birimToplam = item.FIYAT * item.ADET;
  item.INDIRIM_YUZDE = parseFloat(yuzdeDeger) || 0;
  if (item.INDIRIM_YUZDE < 0) item.INDIRIM_YUZDE = 0;
  if (item.INDIRIM_YUZDE > 100) item.INDIRIM_YUZDE = 100;
  item.INDIRIM_TL = birimToplam * (item.INDIRIM_YUZDE / 100);
  renderSeciliUrunler();
  urunToplamiGuncelle();
}

function urunIndirimHesapla(item) {
  const birimToplam = item.FIYAT * item.ADET;
  if (item.INDIRIM_TL > birimToplam) {
    item.INDIRIM_TL = birimToplam;
    item.INDIRIM_YUZDE = birimToplam > 0 ? 100 : 0;
  } else {
    item.INDIRIM_YUZDE = birimToplam > 0 ? (item.INDIRIM_TL / birimToplam * 100) : 0;
  }
}

function urunIndirimTlAdim(urunId, adim) {
  const item = seciliUrunlerListesi.find(i => String(i.URUN_ID) === String(urunId));
  if (!item) return;
  const birimToplam = item.FIYAT * item.ADET;
  item.INDIRIM_TL = Math.max(0, Math.min(birimToplam, (item.INDIRIM_TL || 0) + adim));
  urunIndirimHesapla(item);
  renderSeciliUrunler();
  urunToplamiGuncelle();
}

function urunIndirimYuzdeAdim(urunId, adim) {
  const item = seciliUrunlerListesi.find(i => String(i.URUN_ID) === String(urunId));
  if (!item) return;
  const yeniYuzde = Math.max(0, Math.min(100, (item.INDIRIM_YUZDE || 0) + adim));
  item.INDIRIM_YUZDE = yeniYuzde;
  const birimToplam = item.FIYAT * item.ADET;
  item.INDIRIM_TL = birimToplam * (yeniYuzde / 100);
  renderSeciliUrunler();
  urunToplamiGuncelle();
}

async function urunFiyatGuncelle(urunId, yeniFiyat) {
  const yeniDeger = parseFloat(yeniFiyat) || 0;
  if (yeniDeger < 0) return;

  const item = seciliUrunlerListesi.find(i => String(i.URUN_ID) === String(urunId));
  if (!item) return;
  if (item.FIYAT === yeniDeger) return;

  const eskiFiyat = item.FIYAT;

  const onay = await showConfirm(`Birim fiyatı ₺${eskiFiyat.toFixed(0)} → ₺${yeniDeger.toFixed(0)} olarak değiştirilecek.\n\n⚠️ EĞER FİYATI DEĞİŞTİRİRENİZ ÜRÜN YÖNETİMİNDE DÜZELTME YAPILACAKTIR!\n\nDevam etmek istiyor musunuz?`, 'Birim Fiyat Değişikliği');

  if (!onay) {
    renderSeciliUrunler();
    return;
  }

  item.FIYAT = yeniDeger;
  item.INDIRIM_TL = 0;
  item.INDIRIM_YUZDE = 0;

  const urun = tumUrunler.find(u => String(u.URUN_ID) === String(urunId));
  if (urun) {
    urun.FIYAT = yeniDeger;
    await window.api.urunSave({
      URUN_ID: urun.URUN_ID,
      KATEGORI_ADI: urun.KATEGORI_ADI,
      URUN_ADI: urun.URUN_ADI,
      ALIS_FIYATI: parseFloat(urun.ALIS_FIYATI) || 0,
      FIYAT: yeniDeger,
      ADET: parseInt(urun.ADET) || 0
    });
    showToast('⚠️ Ürün Fiyatı Ürün Yönetimi Bölümünde Değiştirildi', 'warning');
  }

  renderSeciliUrunler();
  urunToplamiGuncelle();
}

function renderSeciliUrunler() {
  const container = document.getElementById('seciliUrunler');
  if (!container) return;

  if (seciliUrunlerListesi.length === 0) {
    container.innerHTML = '<div style="padding: 12px; text-align: center; color: var(--text-muted);">Henüz ürün eklenmedi</div>';
    return;
  }

  const rows = seciliUrunlerListesi.map(item => {
    const satirToplam = item.FIYAT * item.ADET;
    const indirimliTutar = satirToplam - (item.INDIRIM_TL || 0);
    const indirimTl = item.INDIRIM_TL || 0;
    const indirimYuzde = item.INDIRIM_YUZDE || 0;
    return `
    <tr>
      <td><span class="badge badge-pending">${item.KATEGORI_ADI}</span></td>
      <td><strong>${item.URUN_ADI}</strong></td>
      <td>
        <input type="number" value="${item.FIYAT.toFixed(0)}" min="0" step="1" style="width: 80px; padding: 4px; text-align: center; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); color: var(--text-primary); font-size: 0.8rem;"
          onchange="urunFiyatGuncelle('${item.URUN_ID}', this.value)">
      </td>
      <td>
        <input type="number" value="${item.ADET}" min="1" style="width: 60px; padding: 4px; text-align: center; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); color: var(--text-primary); font-size: 0.8rem;"
          onchange="urunAdetGuncelle('${item.URUN_ID}', this.value)">
      </td>
      <td style="text-align: right; font-weight: 600; color: var(--accent);">₺${satirToplam.toFixed(0)}</td>
      <td>
        <div style="display: flex; gap: 4px; align-items: center;">
          <input type="number" value="${indirimTl.toFixed(0)}" min="0" step="10" style="width: 80px; padding: 4px; text-align: center; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); color: var(--text-primary); font-size: 0.8rem;"
            onchange="urunIndirimTLGuncelle('${item.URUN_ID}', this.value)" placeholder="TL">
          <span style="font-size: 0.75rem; color: var(--text-muted);">₺</span>
          <input type="number" value="${indirimYuzde.toFixed(1)}" min="0" max="100" step="10" style="width: 70px; padding: 4px; text-align: center; border: 1px solid var(--border); border-radius: 4px; background: var(--bg-input); color: var(--text-primary); font-size: 0.8rem;"
            onchange="urunIndirimYuzdeGuncelle('${item.URUN_ID}', this.value)" placeholder="%">
          <span style="font-size: 0.75rem; color: var(--text-muted);">%</span>
        </div>
      </td>
      <td style="text-align: right;">
        ${indirimTl > 0 ? `<span style="text-decoration: line-through; color: var(--text-muted); font-size: 0.8rem;">₺${satirToplam.toFixed(0)}</span><br>` : ''}
        <strong style="color: ${indirimTl > 0 ? 'var(--success)' : 'var(--text-primary)'};">₺${indirimliTutar.toFixed(0)}</strong>
      </td>
      <td><button class="btn btn-danger btn-sm" onclick="urunCikar('${item.URUN_ID}')">✕</button></td>
    </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Kategori</th><th>Ürün</th><th>Birim Fiyat</th><th>Adet</th><th>Toplam</th><th>İndirim</th><th>Tutar</th><th>İşlem</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  urunToplamiGuncelle();
}

function urunToplamiGuncelle() {
  const toplamEl = document.getElementById('urunToplami');
  const indirimliToplamEl = document.getElementById('urunToplamiIndirimli');
  const ortalamaIndirimEl = document.getElementById('ortalamaIndirim');
  const toplamInput = document.getElementById('toplam');
  const kalanInput = document.getElementById('kalan');
  const alinanInput = document.getElementById('alinan');
  const toplamIndirimEl = document.getElementById('toplamIndirim');
  if (!toplamEl) return;
  const urunToplami = seciliUrunlerListesi.reduce((sum, item) => sum + (item.FIYAT * item.ADET), 0);
  const toplamIndirim = seciliUrunlerListesi.reduce((sum, item) => sum + (item.INDIRIM_TL || 0), 0);
  const indirimliToplam = urunToplami - toplamIndirim;
  const ortalamaIndirim = urunToplami > 0 ? ((toplamIndirim / urunToplami) * 100) : 0;

  if (seciliUrunlerListesi.length > 0) {
    toplamEl.textContent = urunToplami.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } else {
    toplamEl.textContent = '0';
  }

  if (indirimliToplamEl) {
    if (seciliUrunlerListesi.length > 0) {
      indirimliToplamEl.textContent = indirimliToplam.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else {
      indirimliToplamEl.textContent = '0';
    }
  }

  if (ortalamaIndirimEl) {
    if (seciliUrunlerListesi.length > 0 && toplamIndirim > 0) {
      ortalamaIndirimEl.textContent = `(Ort. İndirim: %${ortalamaIndirim.toFixed(1)})`;
    } else {
      ortalamaIndirimEl.textContent = '';
    }
  }

  if (toplamInput) {
    if (seciliUrunlerListesi.length > 0) {
      toplamInput.value = indirimliToplam.toFixed(0);
    } else {
      toplamInput.value = '';
    }
  }
  if (toplamInput && alinanInput && kalanInput) {
    const toplam = parseFloat(toplamInput.value);
    const alinan = parseFloat(alinanInput.value);
    if (isNaN(toplam) && isNaN(alinan)) {
      kalanInput.value = '';
    } else {
      kalanInput.value = ((isNaN(toplam) ? 0 : toplam) - (isNaN(alinan) ? 0 : alinan)).toFixed(0);
    }
  }
  if (toplamIndirimEl) {
    toplamIndirimEl.textContent = toplamIndirim.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  updateOdemeOzeti();
}

// ===== ÖDEME DETAYLARI =====
function odemeEkle() {
  const tipSelect = document.getElementById('yeniOdemeTipi');
  const tutarInput = document.getElementById('yeniOdemeTutar');
  const tarihInput = document.getElementById('yeniOdemeTarih');
  const tip = tipSelect.value;
  const tutar = parseFloat(tutarInput.value) || 0;
  const tarih = tarihInput.value || formatDateForInput(new Date());

  if (tutar <= 0) {
    showToast('Lütfen geçerli bir tutar giriniz.', 'error');
    return;
  }

  odemeListesi.push({ TIP: tip, TUTAR: tutar, TARIH: tarih });
  renderOdemeListesi();
  updateOdemeOzeti();
  tutarInput.value = '';
  showToast(`${tip} - ₺${tutar.toLocaleString('tr-TR')} eklendi.`, 'success');
}

let odemeSifreResolver = null;
let odemeSifreIndex = -1;

function odemeCikar(index) {
  odemeSifreIndex = index;
  document.getElementById('odemeSifreGiris').value = '';
  document.getElementById('odemeSifreModal').classList.add('active');
  setTimeout(() => document.getElementById('odemeSifreGiris').focus(), 100);
}

function odemeSifreOnayla() {
  const sifre = document.getElementById('odemeSifreGiris').value.trim();
  if (sifre === '') {
    showToast('Lütfen şifre girin.', 'error');
    return;
  }
  if (sifre !== '2516') {
    showToast('Şifre hatalı!', 'error');
    document.getElementById('odemeSifreGiris').value = '';
    document.getElementById('odemeSifreGiris').focus();
    return;
  }
  document.getElementById('odemeSifreModal').classList.remove('active');
  odemeListesi.splice(odemeSifreIndex, 1);
  renderOdemeListesi();
  updateOdemeOzeti();
  showToast('Ödeme silindi.', 'success');
}

function odemeSifreIptal() {
  document.getElementById('odemeSifreModal').classList.remove('active');
  odemeSifreIndex = -1;
}

function renderOdemeListesi() {
  const container = document.getElementById('odemeListesi');
  if (!container) return;

  if (odemeListesi.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 12px; font-size: 13px;">Henüz ödeme eklenmedi</div>';
    return;
  }

  const rows = odemeListesi.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${item.TIP}</td>
      <td>${formatDate(item.TARIH)}</td>
      <td>₺${item.TUTAR.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
      <td><button class="btn btn-danger btn-sm" onclick="odemeCikar(${index})">✕</button></td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>#</th><th>Ödeme Tipi</th><th>Tarih</th><th>Tutar</th><th>İşlem</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function updateOdemeOzeti() {
  const toplamOdemeEl = document.getElementById('toplamOdeme');
  const kalanTutarEl = document.getElementById('kalanTutar');
  const alinanInput = document.getElementById('alinan');
  const kalanInput = document.getElementById('kalan');
  const toplamInput = document.getElementById('toplam');
  const tarihlerEl = document.getElementById('odemeOzetiTarihler');

  const toplamOdeme = odemeListesi.reduce((sum, item) => sum + item.TUTAR, 0);

  if (tarihlerEl) {
    if (odemeListesi.length > 0) {
      const tarihGruplari = {};
      odemeListesi.forEach(item => {
        const t = item.TARIH || 'Tarihsiz';
        if (!tarihGruplari[t]) tarihGruplari[t] = [];
        tarihGruplari[t].push(item);
      });
      let html = '';
      Object.entries(tarihGruplari).forEach(([tarih, odemeler]) => {
        const tarihToplam = odemeler.reduce((s, o) => s + o.TUTAR, 0);
        html += `<div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span style="color: var(--text-secondary);">📅 ${formatDate(tarih)} (${odemeler.map(o => o.TIP).join(', ')})</span>
          <strong>₺${tarihToplam.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong>
        </div>`;
      });
      tarihlerEl.innerHTML = html;
      tarihlerEl.style.display = 'block';
    } else {
      tarihlerEl.innerHTML = '';
      tarihlerEl.style.display = 'none';
    }
  }

  if (toplamOdemeEl) {
    if (odemeListesi.length > 0) {
      toplamOdemeEl.textContent = toplamOdeme.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else {
      toplamOdemeEl.textContent = '0';
    }
  }

  const toplam = parseFloat(toplamInput?.value);
  const kalan = (isNaN(toplam) ? 0 : toplam) - toplamOdeme;

  if (kalanTutarEl) {
    if (!isNaN(toplam) || odemeListesi.length > 0) {
      kalanTutarEl.textContent = kalan.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else {
      kalanTutarEl.textContent = '0';
    }
  }
  if (alinanInput) {
    if (odemeListesi.length > 0) {
      alinanInput.value = toplamOdeme.toFixed(0);
    } else {
      alinanInput.value = '';
    }
  }
  if (kalanInput) {
    if (!isNaN(toplam) || odemeListesi.length > 0) {
      kalanInput.value = kalan.toFixed(0);
    } else {
      kalanInput.value = '';
    }
  }
}

// ===== ALIŞVERİŞ GEÇMİŞİ =====
let gecmisSonArama = '';
async function alisverisGecmisiYukle() {
  const container = document.getElementById('alisverisGecmisi');
  if (!container) return;

  const tc = document.getElementById('tcKimlik')?.value?.trim();
  const telefon = document.getElementById('telefon')?.value?.trim();
  const adSoyad = document.getElementById('adSoyad')?.value?.trim();

  const aramaAnahtari = `${tc}|${telefon}|${adSoyad}`;
  if (aramaAnahtari === gecmisSonArama) return;
  gecmisSonArama = aramaAnahtari;

  if (!tc && !telefon && !adSoyad) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px;">Müşteri bilgisi girildiğinde geçmiş siparişler burada gösterilecek</div>';
    return;
  }

  const params = {};
  if (tc && tc.length === 11) params.tc = tc;
  if (telefon && telefon.length === 11) params.telefon = telefon;
  if (adSoyad && adSoyad.length >= 3) params.adSoyad = adSoyad;

  if (Object.keys(params).length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px;">Müşteri bilgisi girildiğinde geçmiş siparişler burada gösterilecek</div>';
    return;
  }

  container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px;">Aranıyor...</div>';

  const tumSiparisler = await window.api.excelSearchOrder(params);
  const gecerliSiraNo = document.getElementById('siraNo')?.value;
  const oncekiSiparisler = tumSiparisler.filter(s => String(s.SIRA_NO) !== String(gecerliSiraNo));

  if (oncekiSiparisler.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px;">Bu müşteriye ait önceki sipariş bulunamadı</div>';
    return;
  }

  const sirali = oncekiSiparisler.sort((a, b) => (parseInt(b.SIRA_NO) || 0) - (parseInt(a.SIRA_NO) || 0));

  const html = sirali.map(s => {
    let urunOzeti = '';
    try {
      const urunler = JSON.parse(s.SECILEN_URUNLER || '[]');
      if (urunler.length > 0) {
        urunOzeti = urunler.map(u => `${u.URUN_ADI} (x${u.ADET})`).join(', ');
      }
    } catch {}

    let odemeOzeti = '';
    try {
      const odemeler = JSON.parse(s.ODEME_DETAYLARI || '[]');
      if (odemeler.length > 0) {
        odemeOzeti = odemeler.map(o => `${o.TIP}: ₺${Number(o.TUTAR).toLocaleString('tr-TR')}`).join(', ');
      }
    } catch {}

    const gozBilgisi = [
      s.SAG_SPH_UZAK ? `R:${s.SAG_SPH_UZAK}` : '',
      s.SAG_CYL_UZAK ? `R:${s.SAG_CYL_UZAK}` : '',
      s.SAG_AXE_UZAK ? `R:${s.SAG_AXE_UZAK}` : '',
      s.SOL_SPH_UZAK ? `L:${s.SOL_SPH_UZAK}` : '',
      s.SOL_CYL_UZAK ? `L:${s.SOL_CYL_UZAK}` : '',
      s.SOL_AXE_UZAK ? `L:${s.SOL_AXE_UZAK}` : '',
      s.ADD_DEGER ? `ADD:${s.ADD_DEGER}` : '',
    ].filter(Boolean).join(' / ');

    let toplamTutar = parseFloat(s.TOPLAM || 0);
    let alinanTutar = 0;
    try {
      const odemeler = JSON.parse(s.ODEME_DETAYLARI || '[]');
      alinanTutar = odemeler.reduce((sum, o) => sum + (parseFloat(o.TUTAR) || 0), 0);
    } catch {}
    const kalanTutar = toplamTutar - alinanTutar;

    return `
      <div style="padding: 10px; margin-bottom: 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg-secondary);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="color: var(--accent);">Sıra No: ${s.SIRA_NO}</strong>
          <span style="color: var(--text-muted); font-size: 0.75rem;">${s.SIPARIS_TARIHI || ''}</span>
        </div>
        ${gozBilgisi ? `<div style="margin-bottom: 4px;"><span style="color: var(--text-secondary);">👁️ Diyoptri:</span> <strong>${gozBilgisi}</strong></div>` : ''}
        ${urunOzeti ? `<div style="margin-bottom: 4px;"><span style="color: var(--text-secondary);">🛒 Ürün:</span> ${urunOzeti}</div>` : ''}
        ${odemeOzeti ? `<div style="margin-bottom: 4px;"><span style="color: var(--text-secondary);">💳 Ödeme:</span> ${odemeOzeti}</div>` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center;">
          ${kalanTutar > 0 ? `<span style="color: var(--danger); font-weight: 600;">Kalan Tutar: ₺${kalanTutar.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>` : `<span style="color: var(--success); font-weight: 600;">Tam Ödendi</span>`}
          <span><span style="color: var(--text-secondary);">💰 Toplam:</span> <strong>₺${toplamTutar.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div style="margin-bottom: 6px; color: var(--text-secondary); font-weight: 600;">${sirali.length} önceki sipariş:</div>${html}`;
}

let gecmisAramaTimeout = null;
function alisverisGecmisiKontrol() {
  clearTimeout(gecmisAramaTimeout);
  gecmisAramaTimeout = setTimeout(() => {
    alisverisGecmisiYukle();
  }, 600);
}

// ===== TC KİMLİK DOĞRULAMA =====
function tcKimlikDogrula(tc) {
  if (!tc || tc.length !== 11) return false;
  if (!/^\d{11}$/.test(tc)) return false;
  if (tc[0] === '0') return false;

  const haneler = tc.split('').map(Number);

  // 10. hane kontrolü
  const tekToplam = haneler[0] + haneler[2] + haneler[4] + haneler[6] + haneler[8];
  const ciftToplam = haneler[1] + haneler[3] + haneler[5] + haneler[7];
  const onuncuHane = ((tekToplam * 7) - ciftToplam) % 10;
  if (haneler[9] !== onuncuHane) return false;

  // 11. hane kontrolü
  const ilk10Toplam = haneler.slice(0, 10).reduce((a, b) => a + b, 0);
  const onbirinciHane = ilk10Toplam % 10;
  if (haneler[10] !== onbirinciHane) return false;

  return true;
}

// ===== SİPARİŞ İŞLEMLERİ =====
async function saveOrder() {
  const data = getFormData();

  if (!data.AD_SOYAD) {
    showToast('Lütfen Adı Soyadı giriniz.', 'error');
    return false;
  }

  if (data.TC_KIMLIK) {
    if (data.TC_KIMLIK === '11111111111') {
      // istisna
    } else if (data.TC_KIMLIK.length !== 11 || !tcKimlikDogrula(data.TC_KIMLIK)) {
      showToast('T.C. KİMLİK NO HATALI', 'error');
      return false;
    }
  }

  if (data.TELEFON) {
    let tel = data.TELEFON.replace(/\D/g, '');
    if (tel.length > 0 && tel[0] !== '0') {
      tel = '0' + tel;
    }
    if (tel.length !== 11) {
      showToast('TELEFON NUMARASI 11 HANELİ OLMALIDIR', 'error');
      return false;
    }
    data.TELEFON = tel;
  }

  data.SIPARIS_TARIHI = formatDate(data.SIPARIS_TARIHI);
  data.TESLIM_TARIHI = formatDate(data.TESLIM_TARIHI);

  const isEdit = sessionStorage.getItem('editOrder');
  const result = await saveOrderToExcel(data);

  if (result) {
    // Stok güncellemelerini tek seferde birleştir
    const stokDegisiklikleri = [];
    if (isEdit && eskiSiparisUrunleri.length > 0) {
      eskiSiparisUrunleri.forEach(u => stokDegisiklikleri.push({ URUN_ID: u.URUN_ID, ADET: parseInt(u.ADET) || 0 }));
      eskiSiparisUrunleri = [];
    }
    if (seciliUrunlerListesi.length > 0) {
      seciliUrunlerListesi.forEach(u => stokDegisiklikleri.push({ URUN_ID: u.URUN_ID, ADET: -(parseInt(u.ADET) || 0) }));
    }
    if (stokDegisiklikleri.length > 0) {
      await window.api.stokGuncelle(stokDegisiklikleri);
    }

    showToast('Sipariş başarıyla kaydedildi!', 'success');
    if (isEdit) {
      sessionStorage.removeItem('editOrder');
      duzenleniyor = false;
      duzenlemeModuKapat();
    }
    return true;
  } else {
    showToast('Kaydetme hatası!', 'error');
    return false;
  }
}

async function saveAndPrint() {
  const saved = await saveOrder();
  if (saved) {
    setTimeout(() => {
      window.print();
    }, 300);
  }
}

async function clearForm() {
  duzenleniyor = false;
  arananSiparisId = null;
  duzenlemeModuKapat();
  sessionStorage.removeItem('editOrder');
  sessionStorage.removeItem('orderDraft');
  clearFormData();
  const nextNo = await getNextSiraNo();
  document.getElementById('siraNo').value = nextNo;
  document.getElementById('siparisTarihi').value = formatDateForInput(new Date());
  document.getElementById('teslimTarihi').value = formatDateForInput(new Date());
  seciliUrunlerListesi = [];
  eskiSiparisUrunleri = [];
  renderSeciliUrunler();
  const toplamInput = document.getElementById('toplam');
  if (toplamInput) delete toplamInput.dataset.manuallyEdited;
  urunToplamiGuncelle();
  odemeListesi = [];
  renderOdemeListesi();
  updateOdemeOzeti();
  alisverisGecmisiTemizle();
}

function alisverisGecmisiTemizle() {
  clearTimeout(gecmisAramaTimeout);
  gecmisSonArama = '';
  arananSiparisId = null;
  const container = document.getElementById('alisverisGecmisi');
  if (container) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px;">Müşteri bilgisi girildiğinde geçmiş siparişler burada gösterilecek</div>';
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('zeren-theme', newTheme);
}

function initTheme() {
  const savedTheme = localStorage.getItem('zeren-theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
  }
}

function tcKimlikKontrol(input) {
  const tc = input.value.replace(/\D/g, '');
  input.value = tc;
  if (!tc) {
    input.style.borderColor = '';
    return;
  }
  if (tc === '11111111111') {
    input.style.borderColor = 'var(--success)';
  } else if (tc.length !== 11) {
    showToast('T.C. KİMLİK NO 11 HANELİ OLMALIDIR', 'error');
    input.style.borderColor = 'var(--danger)';
  } else if (!tcKimlikDogrula(tc)) {
    showToast('T.C. KİMLİK NO HATALI', 'error');
    input.style.borderColor = 'var(--danger)';
  } else {
    input.style.borderColor = 'var(--success)';
    if (!duzenleniyor) siparisAra('tc', tc);
  }
}

function telefonKontrol(input) {
  const tel = input.value.replace(/\D/g, '');
  if (!tel) {
    input.style.borderColor = '';
    return;
  }
  if (tel.length !== 11) {
    showToast('TELEFON NUMARASI 11 HANELİ OLMALIDIR', 'error');
    input.style.borderColor = 'var(--danger)';
  } else {
    input.style.borderColor = 'var(--success)';
  }
}

function adSoyadKontrol(input) {
  const val = (input.value || '').trim();
  if (!val) {
    input.style.borderColor = '';
    return;
  }
  if (!val.includes(' ')) {
    showToast('Soyisim girilmelidir.', 'error');
    input.style.borderColor = 'var(--danger)';
  } else {
    input.style.borderColor = 'var(--success)';
  }
}

// ===== SİPARİŞ ARAMA MODAL =====
function siparisAramaModalGoster(siparis, tumSiparisler) {
  return new Promise((resolve) => {
    const modal = document.getElementById('siparisAramaModal');
    const icerik = document.getElementById('aramaModalIcerik');
    const tamamBtn = document.getElementById('aramaModalTamam');
    const yeniSatisBtn = document.getElementById('aramaModalYeniSatis');
    const iptalBtn = document.getElementById('aramaModalIptal');

    const sirali = (tumSiparisler || [siparis]).sort((a, b) => (parseInt(b.SIRA_NO) || 0) - (parseInt(a.SIRA_NO) || 0));

    let siparisListesi = sirali.map(s =>
      `<div style="padding:6px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">` +
        `<span><strong>#${s.SIRA_NO}</strong> — ₺${parseFloat(s.TOPLAM || 0).toLocaleString('tr-TR')}</span>` +
        `<span style="color:var(--text-secondary); font-size:0.82rem;">📅 ${formatDate(s.SIPARIS_TARIHI) || 'Tarihsiz'}</span>` +
      `</div>`
    ).join('');

    icerik.innerHTML =
      `<strong>${siparis.AD_SOYAD}</strong> adına kayıtlı <strong>${sirali.length}</strong> sipariş bulundu.<br><br>` +
      `Telefon: ${siparis.TELEFON || '-'}<br><br>` +
      `<div style="max-height:200px; overflow-y:auto;">${siparisListesi}</div>`;

    modal.classList.add('active');

    function temizle() {
      modal.classList.remove('active');
      tamamBtn.onclick = null;
      yeniSatisBtn.onclick = null;
      iptalBtn.onclick = null;
    }

    tamamBtn.onclick = () => { temizle(); resolve('duzenle'); };
    yeniSatisBtn.onclick = () => { temizle(); resolve('yeniSatis'); };
    iptalBtn.onclick = () => { temizle(); resolve('iptal'); };
  });
}

// ===== MÜŞTERİ ARAMA & KAYIT YÜKLEME =====
let arananSiparisId = null;
let duzenleniyor = false;

async function siparisAra(alan, deger) {
  if (duzenleniyor) return;
  if (!deger || deger.trim() === '') return;

  const params = {};
  if (alan === 'tc') params.tc = deger.trim();
  if (alan === 'telefon') params.telefon = deger.trim();
  if (alan === 'adSoyad') params.adSoyad = deger.trim();

  const bulunanlar = await window.api.excelSearchOrder(params);
  if (bulunanlar.length === 0) return;

  const enYeni = bulunanlar.sort((a, b) => (parseInt(b.SIRA_NO) || 0) - (parseInt(a.SIRA_NO) || 0))[0];
  const siraNo = document.getElementById('siraNo').value;
  if (String(enYeni.SIRA_NO) === String(siraNo)) return;
  if (arananSiparisId === String(enYeni.SIRA_NO)) return;
  arananSiparisId = String(enYeni.SIRA_NO);

    const sonuc = await siparisAramaModalGoster(enYeni, bulunanlar);

  if (sonuc === 'duzenle') {
    duzenleniyor = true;
    setFormData(enYeni);
    duzenlemeModuAc(enYeni.SIRA_NO);
    showToast(`${enYeni.AD_SOYAD} - ${enYeni.SIRA_NO} nolu sipariş yüklendi.`, 'success');
  } else if (sonuc === 'yeniSatis') {
    await yeniSatisMusteriBilgisiYukle(enYeni);
  } else {
    duzenlemeModuKapat();
    alisverisGecmisiTemizle();
  }
}

async function yeniSatisMusteriBilgisiYukle(siparis) {
  const nextNo = await getNextSiraNo();

  document.getElementById('siraNo').value = nextNo;
  document.getElementById('tcKimlik').value = siparis.TC_KIMLIK || '';
  document.getElementById('adSoyad').value = siparis.AD_SOYAD || '';
  document.getElementById('telefon').value = siparis.TELEFON || '';
  document.getElementById('email').value = siparis.EMAIL || '';
  document.getElementById('adres').value = siparis.ADRES || '';
  document.getElementById('siparisTarihi').value = formatDateForInput(new Date());
  document.getElementById('teslimTarihi').value = '';

  const odemeTarihInput = document.getElementById('yeniOdemeTarih');
  if (odemeTarihInput) odemeTarihInput.value = formatDateForInput(new Date());

  const gozAlanlari = [
    'sagSphUzak','sagCylUzak','sagAxeUzak','solSphUzak','solCylUzak','solAxeUzak',
    'sagSphYakin','sagCylYakin','sagAxeYakin','solSphYakin','solCylYakin','solAxeYakin',
    'pdSagUzak','pdSolUzak','pdSagYakin','pdSolYakin',
    'yukseklikSagUzak','yukseklikSolUzak','yukseklikSagYakin','yukseklikSolYakin',
    'capSagUzak','capSolUzak','capSagYakin','capSolYakin'
  ];
  gozAlanlari.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  document.getElementById('siparisDetaylari').value = '';
  document.getElementById('toplam').value = '';
  document.getElementById('toplam').dataset.manuallyEdited = 'true';

  seciliUrunlerListesi = [];
  eskiSiparisUrunleri = [];
  renderSeciliUrunler();

  odemeListesi = [];
  renderOdemeListesi();
  updateOdemeOzeti();
  urunToplamiGuncelle();

  duzenlemeModuAc(nextNo);
  showToast(`${siparis.AD_SOYAD} - Yeni satış için müşteri bilgileri yüklendi.`, 'info');

  setTimeout(() => alisverisGecmisiYukle(), 300);
}

function duzenlemeModuAc(siraNo) {
  duzenleniyor = true;
  const bar = document.getElementById('duzenlemeModuBar');
  if (bar) {
    bar.style.display = 'flex';
    bar.querySelector('.duzenleme-info').textContent = `Düzenleme Modu — Sıra No: ${siraNo}`;
  }
  setTimeout(() => alisverisGecmisiYukle(), 300);
}

function duzenlemeModuKapat() {
  duzenleniyor = false;
  const bar = document.getElementById('duzenlemeModuBar');
  if (bar) bar.style.display = 'none';
}

async function duzenlemedenVazgec() {
  arananSiparisId = null;
  duzenleniyor = false;
  duzenlemeModuKapat();
  sessionStorage.removeItem('editOrder');
  sessionStorage.removeItem('orderDraft');
  clearFormData();
  const nextNo = await getNextSiraNo();
  document.getElementById('siraNo').value = nextNo;
  document.getElementById('siparisTarihi').value = formatDateForInput(new Date());
  document.getElementById('teslimTarihi').value = formatDateForInput(new Date());
  seciliUrunlerListesi = [];
  eskiSiparisUrunleri = [];
  renderSeciliUrunler();
  odemeListesi = [];
  renderOdemeListesi();
  updateOdemeOzeti();
  const toplamInput = document.getElementById('toplam');
  if (toplamInput) delete toplamInput.dataset.manuallyEdited;
  urunToplamiGuncelle();
  alisverisGecmisiTemizle();
  showToast('Düzenleme iptal edildi. Yeni sipariş oluşturulabilir.', 'info');
}

function telefonAraKontrol(input) {
  const tel = input.value.replace(/\D/g, '');
  input.value = tel;
  if (!duzenleniyor && tel.length === 11) {
    siparisAra('telefon', tel);
  }
}

let adSoyadAramaTimeout = null;
function adSoyadAraKontrol(input) {
  clearTimeout(adSoyadAramaTimeout);
  if (duzenleniyor) return;
  const deger = input.value.trim();
  if (deger.length < 3) return;
  adSoyadAramaTimeout = setTimeout(() => {
    siparisAra('adSoyad', deger);
  }, 500);
}

function turkceBuyukHarf(input) {
  input.value = input.value.toLocaleUpperCase('tr-TR');
}

function sphCylDuzenle(input) {
  let val = input.value.toLocaleUpperCase('tr-TR');
  val = val.replace(/[^0-9+\-.,]/g, '');
  val = val.replace(',', '.');

  let isaret = '';
  if (val.length > 0) {
    if (val[0] === '+' || val[0] === '-') {
      isaret = val[0];
      val = val.substring(1);
    }
  }

  val = val.replace(/[^0-9.]/g, '');
  const parts = val.split('.');
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('');
  }
  if (parts[0] && parts[0].length > 2) {
    parts[0] = parts[0].slice(0, 2);
    val = parts.join('.');
  }
  if (parts[1] && parts[1].length > 2) {
    parts[1] = parts[1].slice(0, 2);
    val = parts.join('.');
  }

  if (isaret === '' && val.length > 0) {
    isaret = '+';
  }

  input.value = isaret + val;
}

function diyoptriFormatla(val) {
  if (val === '' || val === '+' || val === '-') return val;
  let temiz = val.replace(',', '.');
  const sayi = parseFloat(temiz);
  if (isNaN(sayi)) return val;
  const isaret = sayi >= 0 ? '+' : '';
  return isaret + sayi.toFixed(2).replace('.', ',');
}

function sphCylDogrula(input) {
  let val = input.value.trim();
  if (val === '' || val === '+' || val === '-') return true;

  let temiz = val.replace(',', '.');
  if (!/^[+-]?\d+\.?\d*$/.test(temiz)) {
    input.style.borderColor = 'var(--danger)';
    return false;
  }

  const num = parseFloat(temiz);
  const absNum = Math.abs(num);
  const remainder = absNum % 0.25;
  const eskiVal = input.value;

  if (remainder > 0.001 && remainder < 0.249) {
    const yuvarlanmis = Math.round(absNum / 0.25) * 0.25;
    const isaret = num >= 0 ? '+' : '-';
    input.value = isaret + yuvarlanmis.toFixed(2).replace('.', ',');
    input.style.borderColor = 'var(--warning)';
    showToast('Bilgiler Düzeltildi', 'warning');
    return true;
  }

  input.value = diyoptriFormatla(temiz);
  input.style.borderColor = 'var(--success)';
  return true;
}

function axeDuzenle(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  
  if (val.length > 0) {
    let num = parseInt(val);
    if (num > 180) {
      num = 180;
    }
    val = num.toString();
  }
  
  input.value = val;
}

function pdDuzenle(input) {
  let val = input.value.replace(/[^0-9,.,]/g, '');
  val = val.replace('.', ',');

  const parts = val.split(',');
  if (parts.length > 2) {
    val = parts[0] + ',' + parts.slice(1).join('');
  }

  if (parts[0] && parts[0].length > 2) {
    parts[0] = parts[0].slice(0, 2);
    val = parts.join(',');
  }

  if (parts[1] && parts[1].length > 1) {
    parts[1] = parts[1].slice(0, 1);
    val = parts.join(',');
  }

  input.value = val;
}

function pdDogrula(input, min, max) {
  let val = input.value.trim();
  if (val === '' || val === ',') {
    input.style.borderColor = '';
    return true;
  }

  val = val.replace('.', ',');

  if (!val.includes(',')) {
    val = val + ',00';
  } else {
    const parts = val.split(',');
    if (parts[1] === undefined || parts[1] === '') {
      parts[1] = '00';
    } else if (parts[1].length === 1) {
      parts[1] = parts[1] + '0';
    }
    val = parts.join(',');
  }

  const num = parseFloat(val.replace(',', '.'));
  if (isNaN(num) || num < min || num > max) {
    input.style.borderColor = 'var(--danger)';
    return false;
  }

  input.value = val;
  input.style.borderColor = 'var(--success)';
  return true;
}

function olcuFormatla(input) {
  let val = input.value.trim();
  if (val === '') return;

  val = val.replace('.', ',');

  if (!val.includes(',')) {
    val = val + ',00';
  } else {
    const parts = val.split(',');
    if (parts[1] === undefined || parts[1] === '') {
      parts[1] = '00';
    } else if (parts[1].length === 1) {
      parts[1] = parts[1] + '0';
    }
    val = parts.join(',');
  }

  input.value = val;
}

function capDuzenle(input) {
  let val = input.value.replace(/[^0-9]/g, '');
  if (val.length > 2) {
    val = val.slice(0, 2);
  }
  input.value = val;
}

function capDogrula(input) {
  let val = input.value.trim();
  if (val === '') {
    input.style.borderColor = '';
    return true;
  }

  const num = parseInt(val);
  if (isNaN(num) || num < 48 || num > 80) {
    input.style.borderColor = 'var(--danger)';
    return false;
  }

  input.style.borderColor = 'var(--success)';
  return true;
}

function pdYakinHesapla(taraf) {
  const yakinDioAlanlari = ['sagSphYakin', 'sagCylYakin', 'sagAxeYakin', 'solSphYakin', 'solCylYakin', 'solAxeYakin'];
  const yakinDioDolu = yakinDioAlanlari.some(id => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== '';
  });

  if (!yakinDioDolu) return;

  const uzakId = taraf === 'sag' ? 'pdSagUzak' : 'pdSolUzak';
  const yakinId = taraf === 'sag' ? 'pdSagYakin' : 'pdSolYakin';

  const uzakInput = document.getElementById(uzakId);
  const yakinInput = document.getElementById(yakinId);

  if (!uzakInput || !yakinInput) return;

  let uzakVal = uzakInput.value.trim();
  if (!uzakVal || uzakVal === ',') return;

  uzakVal = uzakVal.replace(',', '.');
  const uzakNum = parseFloat(uzakVal);

  if (isNaN(uzakNum)) return;

  const yakinNum = uzakNum - 2.5;
  if (yakinNum < 5) return;

  yakinInput.value = yakinNum.toFixed(2).replace('.', ',');
  yakinInput.style.borderColor = 'var(--success)';
}

function yakinAlanKontrol() {
  const yakinAlanlari = ['sagSphYakin', 'sagCylYakin', 'sagAxeYakin', 'solSphYakin', 'solCylYakin', 'solAxeYakin'];
  const doluMu = yakinAlanlari.some(id => {
    const el = document.getElementById(id);
    return el && el.value.trim() !== '';
  });

  const yakinOlcuAlanlari = ['pdSagYakin', 'pdSolYakin', 'yukseklikSagYakin', 'yukseklikSolYakin', 'capSagYakin', 'capSolYakin'];
  yakinOlcuAlanlari.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = !doluMu;
      if (!doluMu) {
        el.value = '';
        el.style.opacity = '0.4';
      } else {
        el.style.opacity = '1';
      }
    }
  });
}

function axeDogrula(input) {
  let val = input.value.trim();
  if (val === '') return true;
  
  const num = parseInt(val);
  if (isNaN(num) || num < 0 || num > 180 || val !== num.toString()) {
    input.style.borderColor = 'var(--danger)';
    return false;
  }
  
  input.style.borderColor = 'var(--success)';
  return true;
}

const ADD_VALID_DEGERLER = [0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50];

function addDuzenle(input) {
  let val = input.value.replace(/[^0-9.,]/g, '');
  val = val.replace(',', '.');

  const parts = val.split('.');
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('');
  }

  if (parts[0].length > 1) {
    parts[0] = parts[0].slice(0, 1);
    val = parts.join('.');
  }

  if (parts[1] && parts[1].length > 2) {
    parts[1] = parts[1].slice(0, 2);
    val = parts.join('.');
  }

  input.value = val.replace('.', ',');
}

function addDogrula(input) {
  let val = input.value.trim();
  if (val === '') {
    input.style.borderColor = '';
    return true;
  }

  const num = parseFloat(val.replace(',', '.'));
  if (isNaN(num) || !ADD_VALID_DEGERLER.includes(num)) {
    input.style.borderColor = 'var(--danger)';
    showToast('ADD BİLGİSİ YANLIŞ', 'error');
    input.value = '';
    return false;
  }

  input.style.borderColor = 'var(--success)';
  return true;
}

function addHesapla(input) {
  if (!addDogrula(input)) return;

  const addVal = parseFloat(input.value.replace(',', '.')) || 0;
  
  const sagSphUzakEl = document.getElementById('sagSphUzak');
  const solSphUzakEl = document.getElementById('solSphUzak');
  const sagCylUzakEl = document.getElementById('sagCylUzak');
  const sagAxeUzakEl = document.getElementById('sagAxeUzak');
  const solCylUzakEl = document.getElementById('solCylUzak');
  const solAxeUzakEl = document.getElementById('solAxeUzak');
  
  const sagSphYakinEl = document.getElementById('sagSphYakin');
  const solSphYakinEl = document.getElementById('solSphYakin');
  const sagCylYakinEl = document.getElementById('sagCylYakin');
  const sagAxeYakinEl = document.getElementById('sagAxeYakin');
  const solCylYakinEl = document.getElementById('solCylYakin');
  const solAxeYakinEl = document.getElementById('solAxeYakin');
  
  const sagSphUzak = parseFloat(sagSphUzakEl.value.replace(',', '.')) || 0;
  const solSphUzak = parseFloat(solSphUzakEl.value.replace(',', '.')) || 0;
  
  if (addVal > 0) {
    const sagSonuc = sagSphUzak + addVal;
    const solSonuc = solSphUzak + addVal;
    
    sagSphYakinEl.value = diyoptriFormatla(sagSonuc.toString());
    solSphYakinEl.value = diyoptriFormatla(solSonuc.toString());
    
    sagCylYakinEl.value = sagCylUzakEl.value;
    sagAxeYakinEl.value = sagAxeUzakEl.value;
    solCylYakinEl.value = solCylUzakEl.value;
    solAxeYakinEl.value = solAxeUzakEl.value;
  } else {
    sagCylYakinEl.value = '';
    sagAxeYakinEl.value = '';
    solCylYakinEl.value = '';
    solAxeYakinEl.value = '';
  }
  
  addDogrula(input);
}

function kucukHarf(input) {
  input.value = input.value.toLocaleLowerCase('en-US');
}

function telefonInputDuzenle(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.length > 0 && val[0] !== '0') {
    val = '0' + val;
  }
  if (val.length > 11) {
    val = val.slice(0, 11);
  }
  input.value = val;
}

function navigate(page) {
  const token = (typeof getAuthToken === 'function') ? getAuthToken() : localStorage.getItem('oken_token');
  window.location.href = page + (token ? '?token=' + encodeURIComponent(token) : '');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== YEDEK =====
async function createBackup() {
  try {
    const result = await window.api.createBackup();
    if (result && result.success) {
      showToast('Yedek başarıyla alındı.', 'success');
      await loadBackupList();
    }
  } catch (err) {
    showToast('Yedek alma hatası: ' + err.message, 'error');
  }
}

function openBackupModal() {
  document.getElementById('backupModal').classList.add('active');
  loadBackupList();
}

function closeBackupModal() {
  document.getElementById('backupModal').classList.remove('active');
}

async function loadBackupList() {
  const backups = await window.api.getBackupList();
  const container = document.getElementById('backupList');
  if (backups.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Henüz yedek bulunmuyor.<br><small>Yukarıdaki "Yeni Yedek Al" ile yedek oluşturabilir veya "Yedek Yükle" ile mevcut yedeği içe aktarabilirsiniz.</small></div></div>';
    return;
  }
  const rows = backups.map(b => {
    const date = new Date(b.date);
    const dateStr = date.toLocaleDateString('tr-TR') + ' ' + date.toLocaleTimeString('tr-TR');
    const sizeStr = (b.size / 1024).toFixed(1) + ' KB';
    return `
      <tr>
        <td>${b.name}</td>
        <td>${dateStr}</td>
        <td>${sizeStr}</td>
        <td><button class="btn btn-outline btn-sm" onclick="restoreBackup('${b.filename.replace(/'/g, "\\'")}')">Geri Yükle</button></td>
      </tr>
    `;
  }).join('');
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Dosya Adı</th><th>Tarih</th><th>Boyut</th><th>İşlem</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function restoreBackup(filename) {
  if (!(await showConfirm('Bu yedekten geri yüklemek istediğinizden emin misiniz?\nTüm mevcut veriler yedek ile değiştirilecek!', 'Yedek Geri Yükleme'))) return;
  const result = await window.api.restoreBackup(filename);
  if (result.success) {
    showToast('Yedek geri yüklendi.', 'success');
    closeBackupModal();
    if (window.location.pathname.includes('list.html')) await loadOrders();
  } else {
    showToast('Geri yükleme hatası: ' + result.message, 'error');
  }
}

async function uploadBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  try {
    const text = await file.text();
    const yedek = JSON.parse(text);

    const siparisSayisi = yedek.siparisler ? yedek.siparisler.length : 0;
    const urunSayisi = yedek.urunler ? yedek.urunler.length : 0;
    const kategoriSayisi = yedek.kategoriler ? yedek.kategoriler.length : 0;

    if (!(await showConfirm(
      `Bu yedeği yüklemek istediğinize emin misiniz?\n\n` +
      `Yedek içeriği:\n- ${siparisSayisi} Sipariş\n- ${urunSayisi} Ürün\n- ${kategoriSayisi} Kategori\n\n` +
      `Mevcut tüm veriler yedek ile değiştirilecek!`,
      'Yedek Yükleme Onayı'
    ))) return;

    const result = await window.api.restoreBackupFromJson(yedek);
    if (result.success) {
      showToast('Yedek başarıyla yüklendi.', 'success');
      closeBackupModal();
      if (window.location.pathname.includes('list.html')) await loadOrders();
    } else {
      showToast('Yükleme hatası: ' + result.message, 'error');
    }
  } catch (err) {
    showToast('Yedek yükleme hatası: ' + err.message, 'error');
  }
}

async function exportToExcel() {
  const data = await readExcel();
  if (data.length === 0) {
    showToast('Dışa aktarılacak kayıt yok.', 'warning');
    return;
  }
  const filePath = await window.api.saveFileDialog();
  if (filePath) {
    const XLSX_LIB = window.XLSX;
    if (XLSX_LIB) {
      const worksheet = XLSX_LIB.utils.json_to_sheet(data);
      const workbook = XLSX_LIB.utils.book_new();
      XLSX_LIB.utils.book_append_sheet(workbook, worksheet, 'Siparişler');
      XLSX_LIB.writeFile(workbook, filePath);
      showToast('Tüm kayıtlar Excel dosyasına aktarıldı.', 'success');
    }
  }
}

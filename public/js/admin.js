let tumKategoriler = [];
let tumUrunlerAdmin = [];
let topluStokVerileri = [];
let urunDetayGoster = false;
let seciliUrunler = new Set();

// Sayfalama (Pagination)
let mevcutSayfa = 1;
let sayfaBoyutu = 100;
let aramaTimer = null;
let onizlemeTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadKategoriler();
  await loadUrunler();
});

// ===== KATEGORİ İŞLEMLERİ =====
async function loadKategoriler() {
  tumKategoriler = await window.api.kategoriRead();
  renderKategoriler();
  updateKategoriSelects();
}

function renderKategoriler() {
  const container = document.getElementById('kategoriListesi');
  if (tumKategoriler.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Henüz kategori eklenmemiş.</div></div>';
    return;
  }
  const rows = tumKategoriler.map(k => `
    <tr>
      <td>${k.KATEGORI_ID}</td>
      <td><strong>${k.KATEGORI_ADI}</strong></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="editKategori(${k.KATEGORI_ID})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteKategori(${k.KATEGORI_ID})">🗑️</button>
      </td>
    </tr>
  `).join('');
  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>ID</th><th>Kategori Adı</th><th>İşlem</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function updateKategoriSelects() {
  const filtreSelect = document.getElementById('kategoriFiltre');
  const urunKategoriSelect = document.getElementById('urunKategori');

  const options = tumKategoriler.map(k => `<option value="${k.KATEGORI_ADI}">${k.KATEGORI_ADI}</option>`).join('');

  if (filtreSelect) {
    const currentVal = filtreSelect.value;
    filtreSelect.innerHTML = '<option value="">Tüm Kategoriler</option>' + options;
    filtreSelect.value = currentVal;
  }
  if (urunKategoriSelect) {
    urunKategoriSelect.innerHTML = options;
  }
}

function openKategoriModal(kategori = null) {
  document.getElementById('kategoriModal').classList.add('active');
  if (kategori) {
    document.getElementById('kategoriModalTitle').textContent = 'Kategori Düzenle';
    document.getElementById('kategoriId').value = kategori.KATEGORI_ID;
    document.getElementById('kategoriAdi').value = kategori.KATEGORI_ADI;
  } else {
    document.getElementById('kategoriModalTitle').textContent = 'Yeni Kategori';
    document.getElementById('kategoriId').value = '';
    document.getElementById('kategoriAdi').value = '';
  }
}

function closeKategoriModal() {
  document.getElementById('kategoriModal').classList.remove('active');
}

async function editKategori(id) {
  const kategori = tumKategoriler.find(k => String(k.KATEGORI_ID) === String(id));
  if (kategori) openKategoriModal(kategori);
}

async function saveKategori() {
  const id = document.getElementById('kategoriId').value;
  const adi = document.getElementById('kategoriAdi').value.trim();

  if (!adi) {
    showToast('Kategori adı boş olamaz.', 'error');
    return;
  }

  let kategoriId = id;
  if (!kategoriId) {
    kategoriId = await window.api.kategoriGetNextId();
  }

  const kategori = { KATEGORI_ID: kategoriId, KATEGORI_ADI: adi };
  const result = await window.api.kategoriSave(kategori);

  if (result) {
    showToast('Kategori kaydedildi.', 'success');
    closeKategoriModal();
    await loadKategoriler();
  } else {
    showToast('Kaydetme hatası!', 'error');
  }
}

async function deleteKategori(id) {
  const kategori = tumKategoriler.find(k => String(k.KATEGORI_ID) === String(id));
  if (!kategori) return;

  const urunlerVar = tumUrunlerAdmin.some(u => u.KATEGORI_ADI === kategori.KATEGORI_ADI);
  if (urunlerVar) {
    showToast('Bu kategoride ürünler var! Önce ürünleri silin.', 'error');
    return;
  }

  if (!(await showConfirm(`"${kategori.KATEGORI_ADI}" kategorisini silmek istediğinize emin misiniz?`, 'Kategori Silme'))) return;

  const result = await window.api.kategoriDelete(id);
  if (result) {
    showToast('Kategori silindi.', 'success');
    await loadKategoriler();
  }
}

// ===== ÜRÜN İŞLEMLERİ =====
async function loadUrunler() {
  tumUrunlerAdmin = await window.api.urunRead();
  renderUrunler();
}

function filterUrunler() {
  mevcutSayfa = 1;
  renderUrunler();
}

function toggleUrunDetay() {
  urunDetayGoster = !urunDetayGoster;
  const btn = document.getElementById('urunDetayToggleBtn');
  if (btn) {
    btn.classList.toggle('active', urunDetayGoster);
    btn.classList.toggle('btn-primary', urunDetayGoster);
    btn.classList.toggle('btn-outline', !urunDetayGoster);
  }
  renderUrunler();
}

function renderUrunler() {
  const container = document.getElementById('urunListesi');
  const kategoriFiltre = document.getElementById('kategoriFiltre') ? document.getElementById('kategoriFiltre').value : '';
  const arama = document.getElementById('urunArama') ? document.getElementById('urunArama').value.toLowerCase() : '';

  let filtrelenmis = tumUrunlerAdmin;

  if (kategoriFiltre) {
    filtrelenmis = filtrelenmis.filter(u => u.KATEGORI_ADI === kategoriFiltre);
  }
  if (arama) {
    filtrelenmis = filtrelenmis.filter(u => u.URUN_ADI && u.URUN_ADI.toLowerCase().includes(arama));
  }

  const toplamUrun = filtrelenmis.length;
  const toplamSayfa = Math.ceil(toplamUrun / sayfaBoyutu);

  if (mevcutSayfa > toplamSayfa && toplamSayfa > 0) mevcutSayfa = toplamSayfa;

  if (filtrelenmis.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Ürün bulunamadı.</div></div>';
    renderUrunPagination(0, 0);
    return;
  }

  const baslangic = (mevcutSayfa - 1) * sayfaBoyutu;
  const bitis = Math.min(baslangic + sayfaBoyutu, toplamUrun);
  const sayfaUrunleri = filtrelenmis.slice(baslangic, bitis);

  const checkboxAll = `<th style="width:30px;text-align:center;"><input type="checkbox" id="tumuSecCheck" onchange="tumuSecKaldir(this.checked)" title="Tümünü Se/Kaldır"></th>`;
  const alisHeader = urunDetayGoster ? '<th>Alış Fiyatı (₺)</th>' : '';
  const rows = sayfaUrunleri.map(u => {
    const fiyatInput = `<input type="number" min="0" step="1" value="${parseFloat(u.FIYAT) || 0}" style="width:75px;padding:4px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.78rem;font-weight:600;" data-field="FIYAT" data-id="${u.URUN_ID}" onchange="urunFiyatKaydet(${u.URUN_ID}, this)">`;
    const alisInput = urunDetayGoster ? `<input type="number" min="0" step="1" value="${parseFloat(u.ALIS_FIYATI) || 0}" style="width:75px;padding:4px;text-align:right;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.78rem;" data-field="ALIS_FIYATI" data-id="${u.URUN_ID}" onchange="urunFiyatKaydet(${u.URUN_ID}, this)">` : '';
    const alisCell = urunDetayGoster ? `<td>${alisInput}</td>` : '';
    return `
    <tr>
      <td style="text-align:center;"><input type="checkbox" class="urun-sec-check" data-id="${u.URUN_ID}" ${seciliUrunler.has(u.URUN_ID) ? 'checked' : ''} onchange="urunSecKaldir(${u.URUN_ID}, this.checked)"></td>
      <td>${u.URUN_ID}</td>
      <td><span class="badge badge-pending">${u.KATEGORI_ADI}</span></td>
      <td><input type="text" value="${u.KAREKOD || ''}" style="width:90px;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.7rem;" onchange="karekodKaydet(${u.URUN_ID}, this.value)"></td>
      <td><strong>${u.URUN_ADI}</strong></td>
      ${alisCell}
      <td>${fiyatInput}</td>
      <td>${u.MENSEI || '-'}</td>
      <td><input type="number" min="0" step="1" value="${parseInt(u.ADET) || 0}" style="width:60px;padding:4px;text-align:center;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);" onchange="urunAdetKaydet(${u.URUN_ID}, this.value)"></td>
      <td>
        <button class="btn btn-success btn-sm" onclick="etiketModalAc(${u.URUN_ID})" title="Karekod Etiket Bas"><svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="2" height="14"/><rect x="5" y="1" width="1" height="14"/><rect x="8" y="1" width="3" height="14"/><rect x="13" y="1" width="2" height="14"/></svg></button>
        <button class="btn btn-outline btn-sm" onclick="editUrun(${u.URUN_ID})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUrun(${u.URUN_ID})">🗑️</button>
      </td>
    </tr>
  `}).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead><tr>${checkboxAll}<th>ID</th><th>Kategori</th><th>Karekod</th><th>Ürün Adı</th>${alisHeader}<th>Satış Fiyatı (₺)</th><th>Menşei</th><th>Adet</th><th>İşlem</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  renderUrunPagination(toplamUrun, toplamSayfa);
}

function renderUrunPagination(toplamUrun, toplamSayfa) {
  const paginationContainer = document.getElementById('urunPagination');
  if (!paginationContainer) return;

  if (toplamSayfa <= 1) {
    paginationContainer.innerHTML = toplamUrun > 0 ? `<span class="pagination-info">${toplamUrun} ürün</span>` : '';
    return;
  }

  const baslangic = (mevcutSayfa - 1) * sayfaBoyutu + 1;
  const bitis = Math.min(mevcutSayfa * sayfaBoyutu, toplamUrun);

  let sayfaButonlari = '';

  sayfaButonlari += `<button class="pagination-btn" onclick="sayfaDegistir(1)" ${mevcutSayfa === 1 ? 'disabled' : ''}>«</button>`;
  sayfaButonlari += `<button class="pagination-btn" onclick="sayfaDegistir(${mevcutSayfa - 1})" ${mevcutSayfa === 1 ? 'disabled' : ''}>‹</button>`;

  let sayfaAraligi = [];
  if (toplamSayfa <= 7) {
    for (let i = 1; i <= toplamSayfa; i++) sayfaAraligi.push(i);
  } else {
    sayfaAraligi.push(1);
    if (mevcutSayfa > 3) sayfaAraligi.push('...');
    for (let i = Math.max(2, mevcutSayfa - 1); i <= Math.min(toplamSayfa - 1, mevcutSayfa + 1); i++) {
      sayfaAraligi.push(i);
    }
    if (mevcutSayfa < toplamSayfa - 2) sayfaAraligi.push('...');
    sayfaAraligi.push(toplamSayfa);
  }

  for (const s of sayfaAraligi) {
    if (s === '...') {
      sayfaButonlari += `<span class="pagination-ellipsis">...</span>`;
    } else {
      sayfaButonlari += `<button class="pagination-btn ${s === mevcutSayfa ? 'active' : ''}" onclick="sayfaDegistir(${s})">${s}</button>`;
    }
  }

  sayfaButonlari += `<button class="pagination-btn" onclick="sayfaDegistir(${mevcutSayfa + 1})" ${mevcutSayfa === toplamSayfa ? 'disabled' : ''}>›</button>`;
  sayfaButonlari += `<button class="pagination-btn" onclick="sayfaDegistir(${toplamSayfa})" ${mevcutSayfa === toplamSayfa ? 'disabled' : ''}>»</button>`;

  paginationContainer.innerHTML = `
    <span class="pagination-info">${baslangic}-${bitis} / ${toplamUrun}</span>
    <div class="pagination-buttons">${sayfaButonlari}</div>
  `;
}

function sayfaDegistir(sayfa) {
  mevcutSayfa = sayfa;
  renderUrunler();
  document.getElementById('urunListesi').scrollTop = 0;
}

function urunSecKaldir(id, isaretli) {
  if (isaretli) seciliUrunler.add(id);
  else seciliUrunler.delete(id);
  seciliUrunAdetGuncelle();
}

function tumuSecKaldir(isaretli) {
  const checkboxlar = document.querySelectorAll('.urun-sec-check');
  checkboxlar.forEach(cb => {
    cb.checked = isaretli;
    const id = parseInt(cb.dataset.id);
    if (isaretli) seciliUrunler.add(id);
    else seciliUrunler.delete(id);
  });
  seciliUrunAdetGuncelle();
}

function seciliUrunAdetGuncelle() {
  const badge = document.getElementById('seciliUrunAdet');
  if (badge) badge.textContent = seciliUrunler.size;
}

async function seciliUrunleriYazdir() {
  if (seciliUrunler.size === 0) {
    showToast('Lütfen en az bir ürün seçin.', 'warning');
    return;
  }

  const designSonuc = await window.api.etiketDesignOku();
  if (designSonuc.success && designSonuc.design) {
    etiketTasarim = designSonuc.design;
    const gEl = document.getElementById('etiketGenislik');
    const yEl = document.getElementById('etiketYukseklik');
    if (gEl) gEl.value = etiketTasarim.genislik || 70;
    if (yEl) yEl.value = etiketTasarim.yukseklik || 40;
  }

  const seciliUrunVerileri = [];
  for (const id of seciliUrunler) {
    const u = tumUrunlerAdmin.find(urun => urun.URUN_ID === id);
    if (u) {
      const adetInput = document.querySelector(`input[onchange*="urunAdetKaydet(${id}"]`);
      const adet = adetInput ? parseInt(adetInput.value) || 1 : parseInt(u.ADET) || 1;
      seciliUrunVerileri.push({ ...u, ADET: adet });
    }
  }

  if (seciliUrunVerileri.length === 0) {
    showToast('Seçili ürünler bulunamadı.', 'warning');
    return;
  }

  const yaziciTipi = document.getElementById('etiketSayfaBoyutu').value;
  const genislik = etiketTasarim.genislik || parseInt(document.getElementById('etiketGenislik').value) || 70;
  const yukseklik = etiketTasarim.yukseklik || parseInt(document.getElementById('etiketYukseklik').value) || 40;
  const boslukY = parseInt(document.getElementById('etiketBoslukY').value) || 3;
  const bugun = new Date().toLocaleDateString('tr-TR');
  const tasarim = etiketTasarim.elemanlar && etiketTasarim.elemanlar.length > 0 ? etiketTasarim : etiketTasarimVarsayilan();

  function elemanHTML(eleman, u, qrUrl, tarih) {
    let icerik = '';
    if (eleman.tip === 'karekod') {
      icerik = `<img src="${qrUrl}" style="width:${eleman.genislik - 2}mm;height:${eleman.yukseklik - 2}mm;" />`;
      return `<div style="position:absolute;left:${eleman.x}mm;top:${eleman.y}mm;width:${eleman.genislik}mm;height:${eleman.yukseklik}mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">${icerik}</div>`;
    }
    if (eleman.tip === 'urun_adi') icerik = u.URUN_ADI || '';
    else if (eleman.tip === 'tarih') icerik = tarih;
    else if (eleman.tip === 'fiyat') icerik = '₺' + parseFloat(u.FIYAT || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    else if (eleman.tip === 'kategori') icerik = u.KATEGORI_ADI || '';
    else if (eleman.tip === 'menşei') icerik = u.MENSEI || '';
    else icerik = eleman.icerik || '';
    const sagmaSatir = eleman.tip === 'urun_adi' || eleman.tip === 'metin';
    const yaziBoyutu = elemanYaziBoyutuHesapla(eleman, icerik);
    let overflowCSS = sagmaSatir
      ? 'overflow:hidden;word-wrap:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.15;'
      : 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
    return `<div style="position:absolute;left:${eleman.x}mm;top:${eleman.y}mm;width:${eleman.genislik}mm;height:${eleman.yukseklik}mm;display:flex;align-items:center;justify-content:center;font-size:${yaziBoyutu}pt;font-weight:${eleman.bold ? 'bold' : 'normal'};color:${eleman.renk};text-align:center;padding:1mm;${overflowCSS}">${icerik}</div>`;
  }

  let tumEtiketler = '';

  if (yaziciTipi === 'termal') {
    for (const u of seciliUrunVerileri) {
      const karekodDegeri = u.KAREKOD || u.URUN_ID.toString();
      const qrDataUrl = await generateQRDataUrl(karekodDegeri, 150);
      let tekHTML = '';
      for (const eleman of tasarim.elemanlar) {
        tekHTML += elemanHTML(eleman, u, qrDataUrl, bugun);
      }
      const tekDiv = `<div class="etiket" style="width:${genislik}mm;height:${yukseklik}mm;position:relative;overflow:hidden;font-family:Arial,sans-serif;">${tekHTML}</div>`;
      for (let i = 0; i < u.ADET; i++) {
        tumEtiketler += tekDiv;
      }
    }
  } else {
    let sayfaG, sayfaY;
    if (yaziciTipi === 'A5') { sayfaG = 148; sayfaY = 210; } else { sayfaG = 210; sayfaY = 297; }
    const yatayAdet = Math.floor((sayfaG + 5) / (genislik + 5));
    const dikeyAdet = Math.floor((sayfaY + 5) / (yukseklik + 5));
    const sayfaBasinaEtiket = yatayAdet * dikeyAdet;
    let tumEtiketlerDuz = [];
    for (const u of seciliUrunVerileri) {
      const karekodDegeri = u.KAREKOD || u.URUN_ID.toString();
      const qrDataUrl = await generateQRDataUrl(karekodDegeri, 150);
      let tekHTML = '';
      for (const eleman of tasarim.elemanlar) {
        tekHTML += elemanHTML(eleman, u, qrDataUrl, bugun);
      }
      const tekDiv = `<div style="position:absolute;width:${genislik}mm;height:${yukseklik}mm;border:0.3px solid #ccc;overflow:hidden;font-family:Arial,sans-serif;">${tekHTML}</div>`;
      for (let i = 0; i < u.ADET; i++) {
        tumEtiketlerDuz.push(tekDiv);
      }
    }
    const toplamSayfa = Math.ceil(tumEtiketlerDuz.length / sayfaBasinaEtiket);
    let idx = 0;
    for (let sayfa = 0; sayfa < toplamSayfa; sayfa++) {
      tumEtiketler += `<div style="width:${sayfaG}mm;height:${sayfaY}mm;position:relative;page-break-after:always;">`;
      for (let dy = 0; dy < dikeyAdet && idx < tumEtiketlerDuz.length; dy++) {
        for (let yt = 0; yt < yatayAdet && idx < tumEtiketlerDuz.length; yt++) {
          const left = yt * (genislik + 5);
          const top = dy * (yukseklik + 5);
          tumEtiketler += `<div style="position:absolute;left:${left}mm;top:${top}mm;">${tumEtiketlerDuz[idx]}</div>`;
          idx++;
        }
      }
      tumEtiketler += '</div>';
    }
  }

  const htmlContent = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      @page{size:${genislik}mm ${yukseklik}mm;margin:0;padding:0;}
      html{margin:0;padding:0;}
      body{margin:0;padding:0;background:white;width:${genislik}mm;height:${yukseklik}mm;}
      *{margin:0;padding:0;box-sizing:border-box;}
      .etiket{width:${genislik}mm;height:${yukseklik}mm;position:relative;overflow:hidden;font-family:Arial,sans-serif;page-break-after:always;page-break-inside:avoid;}
      .etiket:last-child{page-break-after:auto;}
    </style>
  </head><body>${tumEtiketler}</body></html>`;

  if (window.api && window.api.etiketYazdir) {
    showToast(`${seciliUrunVerileri.length} ürün etiketi yazdırılıyor...`, 'info');
    const seciliYazici = document.getElementById('etiketYaziciSec') ? document.getElementById('etiketYaziciSec').value : '';
    const toplamAdet = seciliUrunVerileri.reduce((s, u) => s + u.ADET, 0);
    const sonuc = await window.api.etiketYazdir({ html: htmlContent, genislik, yukseklik, bosluk: boslukY, adet: toplamAdet, yaziciAdi: seciliYazici });
    if (sonuc && sonuc.success) showToast(`${toplamAdet} etiket yazdırma gönderildi.`, 'success');
    else showToast('Yazdırma hatası: ' + (sonuc ? sonuc.error : 'Bilinmeyen'), 'error');
  } else {
    showToast('Yazdırma API bulunamadı.', 'error');
  }
}

function debouncedFilterUrunler() {
  clearTimeout(aramaTimer);
  aramaTimer = setTimeout(() => {
    mevcutSayfa = 1;
    renderUrunler();
  }, 300);
}

function openUrunModal(urun = null) {
  document.getElementById('urunModal').classList.add('active');
  updateKategoriSelects();
  if (urun) {
    document.getElementById('urunModalTitle').textContent = 'Ürün Düzenle';
    document.getElementById('urunId').value = urun.URUN_ID;
    document.getElementById('urunKategori').value = urun.KATEGORI_ADI;
    document.getElementById('urunAdi').value = urun.URUN_ADI;
    document.getElementById('urunAlisFiyat').value = urun.ALIS_FIYATI || '';
    document.getElementById('urunFiyat').value = urun.FIYAT;
    document.getElementById('urunAdet').value = urun.ADET || '';
    document.getElementById('urunMensei').value = urun.MENSEI || '';
  } else {
    document.getElementById('urunModalTitle').textContent = 'Yeni Ürün';
    document.getElementById('urunId').value = '';
    document.getElementById('urunKategori').value = tumKategoriler.length > 0 ? tumKategoriler[0].KATEGORI_ADI : '';
    document.getElementById('urunAdi').value = '';
    document.getElementById('urunAlisFiyat').value = '';
    document.getElementById('urunFiyat').value = '';
    document.getElementById('urunAdet').value = '';
    document.getElementById('urunMensei').value = '';
  }
}

function closeUrunModal() {
  document.getElementById('urunModal').classList.remove('active');
}

async function editUrun(id) {
  const urun = tumUrunlerAdmin.find(u => String(u.URUN_ID) === String(id));
  if (urun) openUrunModal(urun);
}

async function saveUrun() {
  const id = document.getElementById('urunId').value;
  const kategori = document.getElementById('urunKategori').value;
  const adi = document.getElementById('urunAdi').value.trim();
  const alisFiyat = document.getElementById('urunAlisFiyat').value;
  const fiyat = document.getElementById('urunFiyat').value;
  const adet = document.getElementById('urunAdet').value;
  const mensei = document.getElementById('urunMensei').value.trim();

  if (!adi) {
    showToast('Ürün adı boş olamaz.', 'error');
    return;
  }
  if (!kategori) {
    showToast('Kategori seçiniz.', 'error');
    return;
  }

  let urunId = id;
  if (!urunId) {
    urunId = await window.api.urunGetNextId();
  }

  const existingUrun = id ? tumUrunlerAdmin.find(u => String(u.URUN_ID) === String(id)) : null;
  const urun = { URUN_ID: urunId, KATEGORI_ADI: kategori, URUN_ADI: adi, ALIS_FIYATI: parseFloat(alisFiyat) || 0, FIYAT: parseFloat(fiyat) || 0, ADET: parseInt(adet) || 0, KAREKOD: existingUrun ? (existingUrun.KAREKOD || '') : '', MENSEI: mensei };
  const result = await window.api.urunSave(urun);

  if (result) {
    showToast('Ürün kaydedildi.', 'success');
    closeUrunModal();
    await loadUrunler();
  } else {
    showToast('Kaydetme hatası!', 'error');
  }
}

async function deleteUrun(id) {
  if (!(await showConfirm('Bu ürünü silmek istediğinize emin misiniz?', 'Ürün Silme'))) return;
  const result = await window.api.urunDelete(id);
  if (result) {
    showToast('Ürün silindi.', 'success');
    await loadUrunler();
  }
}

async function urunAdetKaydet(urunId, yeniAdet) {
  const urun = tumUrunlerAdmin.find(u => String(u.URUN_ID) === String(urunId));
  if (!urun) return;
  urun.ADET = parseInt(yeniAdet) || 0;
  await window.api.urunSave(urun);
}

async function karekodKaydet(urunId, karekod) {
  const urun = tumUrunlerAdmin.find(u => String(u.URUN_ID) === String(urunId));
  if (!urun) return;
  urun.KAREKOD = karekod.trim();
  await window.api.urunSave(urun);
}

async function urunFiyatKaydet(urunId, inputEl) {
  const urun = tumUrunlerAdmin.find(u => String(u.URUN_ID) === String(urunId));
  if (!urun) return;
  const field = inputEl.dataset.field;
  const yeniDeger = parseFloat(inputEl.value) || 0;
  urun[field] = yeniDeger;
  await window.api.fiyatTekli({ URUN_ID: urunId, ALIS_FIYATI: urun.ALIS_FIYATI, FIYAT: urun.FIYAT });
}

async function filtrelenmisFiyatGuncelle() {
  const filtrelenmis = filtrelenmisUrunleriAl();
  if (filtrelenmis.length === 0) { showToast('Filtrelenmiş ürün bulunamadı', 'warning'); return; }

  // Modal'ı aç
  document.getElementById('topluAlisFiyat').value = '';
  document.getElementById('topluSatisFiyat').value = '';
  document.querySelector('input[name="fiyatIslem"][value="1"]').checked = true;
  fiyatIslemDegisti();

  document.getElementById('fiyatGuncelleUrunAdet').innerHTML =
    `<strong>${filtrelenmis.length}</strong> ürün filtrelendi. Bu ürünlerin fiyatları güncellenecek.`;
  document.getElementById('fiyatGuncelleModal').classList.add('active');

  fiyatOnizlemeGuncelle();
}

function closeFiyatGuncelleModal() {
  document.getElementById('fiyatGuncelleModal').classList.remove('active');
}

function fiyatIslemDegisti() {
  const islem = document.querySelector('input[name="fiyatIslem"]:checked').value;
  const alisLabel = document.getElementById('alisFiyatLabel');
  const satisLabel = document.getElementById('satisFiyatLabel');
  const alisInput = document.getElementById('topluAlisFiyat');
  const satisInput = document.getElementById('topluSatisFiyat');

  if (islem === '1') {
    alisLabel.textContent = 'Yeni Alış Fiyatı (₺)';
    satisLabel.textContent = 'Yeni Satış Fiyatı (₺)';
    alisInput.placeholder = 'ör: 100';
    satisInput.placeholder = 'ör: 150';
    alisInput.step = '0.01';
    satisInput.step = '0.01';
  } else if (islem === '2') {
    alisLabel.textContent = 'Alış Yüzde Artış (%)';
    satisLabel.textContent = 'Satış Yüzde Artış (%)';
    alisInput.placeholder = 'ör: 20';
    satisInput.placeholder = 'ör: 20';
    alisInput.step = '0.1';
    satisInput.step = '0.1';
  } else if (islem === '3') {
    alisLabel.textContent = 'Alış Yüzde İndirim (%)';
    satisLabel.textContent = 'Satış Yüzde İndirim (%)';
    alisInput.placeholder = 'ör: 10';
    satisInput.placeholder = 'ör: 10';
    alisInput.step = '0.1';
    satisInput.step = '0.1';
  } else if (islem === '4') {
    alisLabel.textContent = 'Alış Tutar Ekleme (₺)';
    satisLabel.textContent = 'Satış Tutar Ekleme (₺)';
    alisInput.placeholder = 'ör: 50';
    satisInput.placeholder = 'ör: 50';
    alisInput.step = '0.01';
    satisInput.step = '0.01';
  } else if (islem === '5') {
    alisLabel.textContent = 'Alış Tutar Çıkarma (₺)';
    satisLabel.textContent = 'Satış Tutar Çıkarma (₺)';
    alisInput.placeholder = 'ör: 25';
    satisInput.placeholder = 'ör: 25';
    alisInput.step = '0.01';
    satisInput.step = '0.01';
  }

  // Radio butonlarını görsel olarak güncelle
  document.querySelectorAll('.fiyat-islem-radio').forEach(r => {
    const radio = r.querySelector('input[type="radio"]');
    if (radio.checked) {
      r.style.borderColor = 'var(--color-primary)';
      r.style.background = 'var(--bg-secondary)';
      r.style.fontWeight = '600';
    } else {
      r.style.borderColor = 'var(--border)';
      r.style.background = 'var(--bg-card)';
      r.style.fontWeight = 'normal';
    }
  });

  fiyatOnizlemeGuncelle();
}

function fiyatHesapla(eskiFiyat, deger, islem) {
  if (!deger || deger === '') return eskiFiyat;
  const d = parseFloat(deger);
  if (isNaN(d)) return eskiFiyat;

  if (islem === '1') return d;
  if (islem === '2') return Math.round(eskiFiyat * (1 + d / 100));
  if (islem === '3') return Math.max(0, Math.round(eskiFiyat * (1 - d / 100)));
  if (islem === '4') return Math.round(eskiFiyat + d);
  if (islem === '5') return Math.max(0, Math.round(eskiFiyat - d));
  return eskiFiyat;
}

function fiyatOnizlemeGuncelle() {
  const filtrelenmis = filtrelenmisUrunleriAl();
  const islem = document.querySelector('input[name="fiyatIslem"]:checked').value;
  const alisDeger = document.getElementById('topluAlisFiyat').value;
  const satisDeger = document.getElementById('topluSatisFiyat').value;
  const sayac = document.getElementById('fiyatOnizlemeSayac');
  const tablo = document.getElementById('fiyatOnizlemeTablosu');

  if (filtrelenmis.length === 0) {
    tablo.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.8rem;">Ürün bulunamadı</div>';
    sayac.textContent = '';
    return;
  }

  const rows = filtrelenmis.slice(0, 200).map(u => {
    const yeniAlis = alisDeger !== '' ? fiyatHesapla(parseFloat(u.ALIS_FIYATI) || 0, alisDeger, islem) : null;
    const yeniSatis = satisDeger !== '' ? fiyatHesapla(parseFloat(u.FIYAT) || 0, satisDeger, islem) : null;

    const alisHtml = yeniAlis !== null
      ? `<span style="color:var(--text-muted);text-decoration:line-through;">${parseFloat(u.ALIS_FIYATI) || 0}</span> → <strong style="color:var(--color-primary);">${yeniAlis}</strong>`
      : `<span>${parseFloat(u.ALIS_FIYATI) || 0}</span>`;
    const satisHtml = yeniSatis !== null
      ? `<span style="color:var(--text-muted);text-decoration:line-through;">${parseFloat(u.FIYAT) || 0}</span> → <strong style="color:#22c55e;">${yeniSatis}</strong>`
      : `<span>${parseFloat(u.FIYAT) || 0}</span>`;

    return `<tr>
      <td style="padding:4px 8px;font-size:0.75rem;">${u.URUN_ID}</td>
      <td style="padding:4px 8px;font-size:0.75rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><strong>${u.URUN_ADI}</strong></td>
      <td style="padding:4px 8px;font-size:0.75rem;text-align:right;">${alisHtml}</td>
      <td style="padding:4px 8px;font-size:0.75rem;text-align:right;">${satisHtml}</td>
    </tr>`;
  }).join('');

  const geriKalan = filtrelenmis.length > 200 ? `<tr><td colspan="4" style="padding:4px 8px;font-size:0.75rem;color:var(--text-secondary);text-align:center;">... ve ${filtrelenmis.length - 200} ürün daha</td></tr>` : '';

  tablo.innerHTML = `<table class="data-table" style="margin:0;">
    <thead><tr><th>ID</th><th>Ürün Adı</th><th>Alış (₺)</th><th>Satış (₺)</th></tr></thead>
    <tbody>${rows}${geriKalan}</tbody>
  </table>`;

  sayac.textContent = `${filtrelenmis.length} ürün`;
}

async function fiyatGuncelleOnayla() {
  const filtrelenmis = filtrelenmisUrunleriAl();
  const islem = document.querySelector('input[name="fiyatIslem"]:checked').value;
  const alisDeger = document.getElementById('topluAlisFiyat').value;
  const satisDeger = document.getElementById('topluSatisFiyat').value;

  if (alisDeger === '' && satisDeger === '') {
    showToast('En az bir fiyat girmelisiniz', 'warning');
    return;
  }

  let guncellenen = [];
  for (const u of filtrelenmis) {
    let yeniAlis = u.ALIS_FIYATI || 0;
    let yeniSatis = u.FIYAT || 0;

    if (alisDeger !== '') yeniAlis = fiyatHesapla(yeniAlis, alisDeger, islem);
    if (satisDeger !== '') yeniSatis = fiyatHesapla(yeniSatis, satisDeger, islem);

    guncellenen.push({ URUN_ID: u.URUN_ID, ALIS_FIYATI: yeniAlis, FIYAT: yeniSatis });
  }

  if (guncellenen.length === 0) return;

  if (!(await showConfirm(`${guncellenen.length} ürünün fiyatı güncellenecek. Onaylıyor musunuz?`, 'Fiyat Güncelleme'))) return;

  const result = await window.api.fiyatGuncelle(guncellenen);
  if (result.success) {
    showToast(`${guncellenen.length} ürünün fiyatı güncellendi`, 'success');
    closeFiyatGuncelleModal();
    await loadUrunler();
  } else {
    showToast('Güncelleme başarısız: ' + (result.message || ''), 'error');
  }
}

function filtrelenmisUrunleriAl() {
  const kategoriFiltre = document.getElementById('kategoriFiltre') ? document.getElementById('kategoriFiltre').value : '';
  const arama = document.getElementById('urunArama') ? document.getElementById('urunArama').value.toLowerCase() : '';
  let filtrelenmis = tumUrunlerAdmin;
  if (kategoriFiltre) filtrelenmis = filtrelenmis.filter(u => u.KATEGORI_ADI === kategoriFiltre);
  if (arama) filtrelenmis = filtrelenmis.filter(u => u.URUN_ADI && u.URUN_ADI.toLowerCase().includes(arama));
  return filtrelenmis;
}

// ===== ADMİN TAB =====
function adminTabAc(tab) {
  const tabUrunler = document.getElementById('tabUrunler');
  const tabTopluStok = document.getElementById('tabTopluStok');
  const tabStokSayim = document.getElementById('tabStokSayim');
  const tabUTS = document.getElementById('tabUTS');
  const panelUrunler = document.getElementById('panelUrunler');
  const panelTopluStok = document.getElementById('panelTopluStok');
  const panelStokSayim = document.getElementById('panelStokSayim');
  const panelUTS = document.getElementById('panelUTS');
  const btnUrunler = document.getElementById('tabUrunlerBtns');

  tabUrunler.classList.remove('active');
  tabTopluStok.classList.remove('active');
  tabStokSayim.classList.remove('active');
  tabUTS.classList.remove('active');
  panelUrunler.style.display = 'none';
  panelTopluStok.style.display = 'none';
  panelStokSayim.style.display = 'none';
  panelUTS.style.display = 'none';
  btnUrunler.style.display = 'none';

  if (tab === 'urunler') {
    tabUrunler.classList.add('active');
    panelUrunler.style.display = '';
    btnUrunler.style.display = '';
  } else if (tab === 'toplustok') {
    tabTopluStok.classList.add('active');
    panelTopluStok.style.display = '';
    loadTopluStok();
  } else if (tab === 'stoksayim') {
    tabStokSayim.classList.add('active');
    panelStokSayim.style.display = '';
    if (stokSayimUrunler.length === 0) {
      window.api.urunRead().then(veriler => { stokSayimUrunler = veriler; stokSayimFiltreDoldur(); });
    }
    document.getElementById('stokSayimBarkod').focus();
  } else if (tab === 'uts') {
    tabUTS.classList.add('active');
    panelUTS.style.display = '';
    utsAlimListesiniYukle();
  }
}

async function loadTopluStok() {
  topluStokVerileri = await window.api.topluStokRead();
  renderTopluStok();
  initTopluStokDragDrop();
}

function initTopluStokDragDrop() {
  const dz = document.getElementById('topluStokDropZone');
  if (!dz || dz._initialized) return;
  dz._initialized = true;

  ['dragenter','dragover'].forEach(e => {
    dz.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); dz.style.borderColor = 'var(--color-primary)'; dz.style.background = 'var(--bg-secondary)'; });
  });
  ['dragleave','drop'].forEach(e => {
    dz.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); dz.style.borderColor = 'var(--border)'; dz.style.background = 'var(--bg-card)'; });
  });
  dz.addEventListener('drop', (ev) => {
    const dosya = ev.dataTransfer.files[0];
    if (dosya && (dosya.name.endsWith('.xlsx') || dosya.name.endsWith('.xls'))) {
      topluStokDosyaYukle(dosya);
    } else {
      showToast('Lütfen .xlsx veya .xls dosyası seçin.', 'error');
    }
  });
}

function topluStokDosyaSec(input) {
  if (input.files && input.files[0]) {
    topluStokDosyaYukle(input.files[0]);
  }
}

async function topluStokDosyaYukle(dosya) {
  const durumDiv = document.getElementById('topluStokYuklemeDurum');
  const durumText = document.getElementById('topluStokDurumText');
  const durumBar = document.getElementById('topluStokDurumBar');
  const durumProgress = document.getElementById('topluStokDurumProgress');
  const dz = document.getElementById('topluStokDropZone');

  durumDiv.style.display = 'block';
  durumBar.style.display = 'block';
  durumText.innerHTML = '⏳ <strong>' + dosya.name + '</strong> yükleniyor...';
  durumProgress.style.width = '30%';
  dz.style.borderColor = 'var(--color-primary)';

  try {
    const result = await window.api.topluStokYukle(dosya);
    if (result && result.success) {
      durumProgress.style.width = '100%';
      durumText.innerHTML = '✅ <strong>' + dosya.name + '</strong> başarıyla yüklendi. <span style="color:var(--color-primary);font-weight:600;">' + result.count + ' kayıt</span> bulundu.';
      dz.style.borderColor = '#22c55e';
      await loadTopluStok();
      setTimeout(() => {
        durumDiv.style.display = 'none';
        durumBar.style.display = 'none';
        durumProgress.style.width = '0%';
        dz.style.borderColor = 'var(--border)';
        document.getElementById('topluStokDosyaInput').value = '';
      }, 3000);
    } else {
      throw new Error(result ? result.message : 'Yükleme başarısız');
    }
  } catch (err) {
    durumProgress.style.width = '100%';
    durumProgress.style.background = '#ef4444';
    durumText.innerHTML = '❌ Yükleme hatası: ' + err.message;
    dz.style.borderColor = '#ef4444';
    setTimeout(() => {
      durumDiv.style.display = 'none';
      durumBar.style.display = 'none';
      durumProgress.style.width = '0%';
      durumProgress.style.background = 'var(--color-primary)';
      dz.style.borderColor = 'var(--border)';
    }, 4000);
  }
}

function topluStokTemizle() {
  topluStokVerileri = [];
  renderTopluStok();
  showToast('Tablo temizlendi.', 'info');
}

function renderTopluStok() {
  const container = document.getElementById('topluStokListesi');
  const onayBolumu = document.getElementById('topluStokOnayBolumu');
  const filtreAlani = document.getElementById('topluStokFiltreAlani');
  if (topluStokVerileri.length === 0) {
    container.innerHTML = '';
    if (onayBolumu) onayBolumu.style.display = 'none';
    if (filtreAlani) filtreAlani.style.display = 'none';
    return;
  }

  if (onayBolumu) onayBolumu.style.display = 'flex';
  if (filtreAlani) filtreAlani.style.display = 'flex';

  // Kategori filtresini doldur
  const kategoriSelect = document.getElementById('topluStokKategoriFiltre');
  if (kategoriSelect && kategoriSelect.options.length <= 1) {
    const kategoriler = [...new Set(topluStokVerileri.map(u => u.Kategori).filter(Boolean))];
    kategoriSelect.innerHTML = '<option value="">Tüm Kategoriler</option>' + kategoriler.map(k => `<option value="${k}">${k}</option>`).join('');
  }

  const filtrelenmis = topluStokFiltrelenmisUrunleriAl();

  const rows = filtrelenmis.map((item) => {
    const i = item._index;
    const u = item;
    return `
    <tr>
      <td>${u.ID || ''}</td>
      <td><span class="badge badge-pending">${u.Kategori || ''}</span></td>
      <td><input type="text" value="${u.KAREKOD || ''}" style="width:90px;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.7rem;" onchange="topluStokKarekodKaydet(${i}, this.value)"></td>
      <td><strong>${u['Urun Adi'] || u['Ürün Adı'] || ''}</strong></td>
      <td>₺${parseFloat(u['Alis Fiyati'] || u['Alış Fiyatı'] || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
      <td>₺${parseFloat(u['Satis Fiyati'] || u['Satış Fiyatı'] || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
      <td>${u['Mensei'] || u['Menşei'] || '-'}</td>
      <td><input type="number" min="0" step="1" value="${u.Adet || 0}" style="width:70px;padding:4px;text-align:center;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);" onchange="topluStokAdetGuncelle(${i}, this.value)"></td>
    </tr>`;
  }).join('');

  const filtreSayac = document.getElementById('topluStokFiltreSayac');
  if (filtreSayac) {
    if (filtrelenmis.length < topluStokVerileri.length) {
      filtreSayac.textContent = `${filtrelenmis.length} / ${topluStokVerileri.length} ürün`;
    } else {
      filtreSayac.textContent = '';
    }
  }

  container.innerHTML = `
    <div style="padding:8px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border);font-size:0.8rem;color:var(--text-secondary);display:flex;justify-content:space-between;">
      <span>📊 <strong>${topluStokVerileri.length}</strong> ürün yüklendi${filtrelenmis.length < topluStokVerileri.length ? ` (filtre: <strong>${filtrelenmis.length}</strong>)` : ''}</span>
      <span>Toplam adet: <strong>${topluStokVerileri.reduce((s, u) => s + (parseInt(u.Adet) || 0), 0)}</strong></span>
    </div>
    <table class="data-table">
      <thead><tr><th>ID</th><th>Kategori</th><th>Karekod</th><th>Ürün Adı</th><th>Alış Fiyatı</th><th>Satış Fiyatı</th><th>Menşei</th><th>Adet</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function topluStokAdetGuncelle(index, deger) {
  topluStokVerileri[index].Adet = parseInt(deger) || 0;
}

async function topluStokOnayla() {
  const girilenler = topluStokVerileri.filter(u => (parseInt(u.Adet) || 0) > 0);
  if (girilenler.length === 0) {
    showToast('En az bir ürün için adet giriniz.', 'error');
    return;
  }

  if (!(await showConfirm(`${girilenler.length} ürün için toplu stok girişini onaylamak istediğinize emin misiniz?`, 'Toplu Stok'))) return;

  const result = await window.api.topluStokOnayla(girilenler);
  if (result.success) {
    showToast(`Toplu stok girişi tamamlandı: ${result.eklenen} yeni ürün eklendi, ${result.guncellenen} ürün güncellendi.`, 'success');
    topluStokVerileri = [];
    renderTopluStok();
    await loadUrunler();
    adminTabAc('urunler');
  } else {
    showToast('Toplu stok onaylama hatası: ' + result.message, 'error');
  }
}

// ===== YEDEK =====
function openBackupModal() {
  document.getElementById('backupModal').classList.add('active');
  loadBackupList();
}

function closeBackupModal() {
  document.getElementById('backupModal').classList.remove('active');
}

async function createBackup() {
  const result = await window.api.createBackup();
  if (result.success) {
    showToast('Yedek başarıyla alındı.', 'success');
    if (document.getElementById('backupModal').classList.contains('active')) {
      await loadBackupList();
    }
  } else {
    showToast('Yedek alma hatası: ' + result.message, 'error');
  }
}

async function loadBackupList() {
  const backups = await window.api.getBackupList();
  const container = document.getElementById('backupList');
  if (backups.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Henüz yedek bulunmuyor.</div></div>';
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
        <td><button class="btn btn-outline btn-sm" onclick="restoreBackup('${b.path.replace(/\\/g, '\\\\')}')">Geri Yükle</button></td>
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

async function restoreBackup(backupPath) {
  if (!(await showConfirm('Bu yedekten geri yüklemek istediğinizden emin misiniz?', 'Yedek Geri Yükleme'))) return;
  const result = await window.api.restoreBackup(backupPath);
  if (result.success) {
    showToast('Yedek geri yüklendi.', 'success');
    closeBackupModal();
    await loadKategoriler();
    await loadUrunler();
  } else {
    showToast('Geri yükleme hatası: ' + result.message, 'error');
  }
}

function openBackupFolder() { window.api.openBackupFolder(); }

// ===== STOK SİLME =====
let sifreOnaybekleyen = null;
let stokSilindi = false;

function stokSilOnay() {
  if (stokSilindi) {
    showToast('STOK SİLİNMESİ İŞLEMİ TEHLİKELİ VE ÖNERİLMEZ. PROGRAMI KAPATIP YENİDEN AÇIN.', 'error');
    return;
  }

  const kategoriFiltre = document.getElementById('kategoriFiltre').value;
  if (!kategoriFiltre) {
    showToast('Lütfen bir kategori seçin.', 'error');
    return;
  }

  const kategoridekiUrunler = tumUrunlerAdmin.filter(u => u.KATEGORI_ADI === kategoriFiltre);
  if (kategoridekiUrunler.length === 0) {
    showToast('Bu kategoride ürün bulunmuyor.', 'warning');
    return;
  }

  const toplamStok = kategoridekiUrunler.reduce((sum, u) => sum + (parseInt(u.ADET) || 0), 0);
  sifreOnaybekleyen = { kategori: kategoriFiltre, urunler: kategoridekiUrunler, toplamStok };

  const sifreInput = document.getElementById('sifreGiris');
  sifreInput.value = '';
  document.getElementById('sifreModal').classList.add('active');
  sifreInput.focus();
}

function closeSifreModal() {
  document.getElementById('sifreModal').classList.remove('active');
  sifreOnaybekleyen = null;
}

async function sifreOnayla() {
  const sifreInput = document.getElementById('sifreGiris');
  const sifre = sifreInput.value.trim();

  if (sifre === '') {
    showToast('Lütfen şifre girin.', 'error');
    sifreInput.focus();
    return;
  }

  if (sifre !== '2516') {
    showToast('Hatalı şifre!', 'error');
    sifreInput.value = '';
    sifreInput.focus();
    return;
  }

  if (!sifreOnaybekleyen) {
    showToast('İşlem bilgisi bulunamadı.', 'error');
    closeSifreModal();
    return;
  }

  const { kategori, urunler, toplamStok } = sifreOnaybekleyen;

  if (!(await showConfirm(`"${kategori}" kategorisindeki ${urunler.length} ürün tamamen silinecek.\n\nDevam etmek istiyor musunuz?`, 'Stok Silme'))) {
    closeSifreModal();
    return;
  }

  const urunIdler = urunler.map(u => String(u.URUN_ID));
  const result = await window.api.urunDeleteBulk(urunIdler);

  if (result) {
    showToast(`"${kategori}" kategorisindeki ${urunler.length} ürün silindi.`, 'success');
    stokSilindi = true;
    await loadUrunler();
  } else {
    showToast('Ürün silme hatası!', 'error');
  }

  closeSifreModal();
}

// ===== ETİKET YAZDIRMA =====
let etiketSeciliUrun = null;

async function etiketModalAc(urunId) {
  etiketSeciliUrun = tumUrunlerAdmin.find(u => String(u.URUN_ID) === String(urunId));
  if (!etiketSeciliUrun) return;

  const karekodInput = document.querySelector(`#urunListesi input[onchange*="karekodKaydet(${urunId}"]`);
  if (karekodInput) {
    etiketSeciliUrun.KAREKOD = karekodInput.value.trim() || etiketSeciliUrun.KAREKOD;
  }

  const bilgiDiv = document.getElementById('etiketUrunBilgisi');
  bilgiDiv.innerHTML = `<strong>${etiketSeciliUrun.URUN_ADI}</strong> — ${etiketSeciliUrun.KATEGORI_ADI} — ₺${parseFloat(etiketSeciliUrun.FIYAT || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const karekodInput2 = document.getElementById('etiketKarekod');
  karekodInput2.value = etiketSeciliUrun.KAREKOD || etiketSeciliUrun.URUN_ID.toString();

  const sonuc = await window.api.etiketDesignOku();
  if (sonuc.success && sonuc.design) {
    etiketTasarim = sonuc.design;
    document.getElementById('etiketGenislik').value = etiketTasarim.genislik || 70;
    document.getElementById('etiketYukseklik').value = etiketTasarim.yukseklik || 40;
  }

  document.getElementById('etiketModal').classList.add('active');
  etiketOnizlemeGuncelle();

  const yaziciSelect = document.getElementById('etiketYaziciSec');
  if (window.api && window.api.yaziciListesi) {
    try {
      const yazicilar = await window.api.yaziciListesi();
      const kayitliYazici = localStorage.getItem('etiketYaziciAdi') || '';
      yaziciSelect.innerHTML = '';
      if (yazicilar && yazicilar.length > 0) {
        yazicilar.forEach(y => {
          const opt = document.createElement('option');
          opt.value = y.name;
          opt.textContent = y.displayName || y.name;
          if (y.isDefault) opt.textContent += ' (Varsayılan)';
          if (y.name === kayitliYazici) opt.selected = true;
          yaziciSelect.appendChild(opt);
        });
        if (!kayitliYazici && yazicilar.length > 0) {
          const varsayilan = yazicilar.find(y => y.isDefault);
          if (varsayilan) yaziciSelect.value = varsayilan.name;
        }
      } else {
        yaziciSelect.innerHTML = '<option value="">Yazıcı bulunamadı</option>';
      }
      yaziciSelect.onchange = function() {
        localStorage.setItem('etiketYaziciAdi', this.value);
      };
    } catch(e) {
      yaziciSelect.innerHTML = '<option value="">Yazıcı yüklenemedi</option>';
    }
  }
}

function closeEtiketModal() {
  document.getElementById('etiketModal').classList.remove('active');
  document.getElementById('etiketTasarimModal').classList.remove('active');
  etiketSeciliUrun = null;
}

// ===== YAZI BOYUTU HESAPLA =====
function yaziBoyutuHesapla(metin, alanGenislikMM, maxFontMM) {
  const karakterGenisligi = maxFontMM * 0.6;
  const siganKarakter = Math.floor(alanGenislikMM / karakterGenisligi);
  if (metin.length <= siganKarakter) return maxFontMM;
  return Math.max(2, (alanGenislikMM / metin.length) / 0.6);
}

// ===== QR KOD (IPC - qrcode kütüphanesi) =====
async function generateQRDataUrl(text, size) {
  return await window.api.qrGenerate(String(text), size || 150);
}

async function generateQRCode(canvas, text) {
  const dataUrl = await window.api.qrGenerate(String(text), canvas.width);
  if (!dataUrl) return;
  const img = new Image();
  await new Promise(resolve => { img.onload = resolve; img.src = dataUrl; });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
}


// ===== TARİHE GÖRE SATILAN ÜRÜNLER =====
function parseDate(dateStr) {
  if (!dateStr && dateStr !== 0) return null;
  const str = String(dateStr).trim();

  // Excel serial number (ör: 46250)
  if (/^\d{5}$/.test(str)) {
    const serial = parseInt(str);
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + serial * 86400000);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  }

  // YYYY-MM-DD formatı (HTML date input)
  let match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  // DD/MM/YYYY veya DD.MM.YYYY formatı
  match = str.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;

  // M/D/YYYY formatı
  match = str.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
  if (match) {
    let yil = match[3].length === 2 ? '20' + match[3] : match[3];
    return `${yil}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  // Date objesi
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  return str;
}

async function satisTarihiUrunleri() {
  const tarihInput = document.getElementById('satisTarihFiltre');
  const container = document.getElementById('satisUrunListesi');
  if (!tarihInput || !container) return;

  const secilenTarih = tarihInput.value;
  if (!secilenTarih) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px;">Bir tarih seçin</div>';
    return;
  }

  const tumSiparisler = await window.api.excelRead();

  const filtrelenmis = tumSiparisler.filter(s => {
    const parsed = parseDate(s.SIPARIS_TARIHI);
    return parsed === secilenTarih;
  });

  console.log('Seçilen tarih:', secilenTarih);
  console.log('Toplam sipariş:', tumSiparisler.length);
  tumSiparisler.slice(0, 5).forEach(s => console.log('  Sipariş tarihi:', s.SIPARIS_TARIHI, '-> parse:', parseDate(s.SIPARIS_TARIHI)));
  console.log('Eşleşen sipariş:', filtrelenmis.length);

  // Debug: bulunan tüm benzersiz tarihleri göster
  const benzersizTarihler = [...new Set(tumSiparisler.map(s => s.SIPARIS_TARIHI))].slice(0, 10);
  console.log('Mevcut tarihler (ilk 10):', benzersizTarihler);

  if (filtrelenmis.length === 0) {
    const mevcutTarihler = tumSiparisler.map(s => parseDate(s.SIPARIS_TARIHI)).filter(Boolean);
    const benzersizParsed = [...new Set(mevcutTarihler)].slice(0, 10);
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 12px;">Bu tarihte sipariş bulunamadı.<br><small>Mevcut tarihler: ${benzersizParsed.join(', ')}</small></div>`;
    return;
  }

  let tumUrunler = [];
  filtrelenmis.forEach(s => {
    try {
      let urunlerData = s.SECILEN_URUNLER || s['SECILEN_URUNLER'] || '';
      if (typeof urunlerData === 'string') {
        urunlerData = JSON.parse(urunlerData);
      }
      if (!Array.isArray(urunlerData)) urunlerData = [];
      urunlerData.forEach(u => {
        tumUrunler.push({
          SIRA_NO: s.SIRA_NO,
          AD_SOYAD: s.AD_SOYAD,
          URUN_ADI: u.URUN_ADI || '',
          KATEGORI_ADI: u.KATEGORI_ADI || '',
          FIYAT: parseFloat(u.FIYAT) || 0,
          ADET: parseInt(u.ADET) || 0,
          INDIRIM_TL: parseFloat(u.INDIRIM_TL) || 0
        });
      });
    } catch (e) {
      console.error('SECILEN_URUNLER parse hatası:', e, s.SECILEN_URUNLER);
    }
  });

  if (tumUrunler.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px;">Bu tarihte satılan ürün bulunamadı.</div>';
    return;
  }

  const rows = tumUrunler.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><span class="badge badge-pending">${u.KATEGORI_ADI}</span></td>
      <td><strong>${u.URUN_ADI}</strong></td>
      <td>${u.ADET}</td>
    </tr>
  `).join('');

  const toplamAdet = tumUrunler.reduce((sum, u) => sum + u.ADET, 0);

  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Sıra No</th><th>Kategori</th><th>Ürün Adı</th><th>Adet</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top: 8px; text-align: right; font-weight: 600; color: var(--accent);">
      ${toplamAdet} ürün, ${filtrelenmis.length} sipariş
    </div>
  `;
}

// ===== UTS ÜRÜNLERİ EŞİTLE =====
async function utsPenceresiAc() {
  const durumDiv = document.getElementById('utsDurum');
  const durumText = document.getElementById('utsDurumText');
  const acBtn = document.getElementById('utsAcBtn');

  if (durumDiv) durumDiv.style.display = 'block';
  if (durumText) durumText.innerHTML = '⏳ UTS sayfası açılıyor... Lütfen e-Devlet ile giriş yapın.';
  if (acBtn) acBtn.disabled = true;

  const result = await window.api.utsPencereAc();
  if (result && result.success) {
    if (durumText) durumText.innerHTML = '✅ UTS sayfası açıldı. E-Devlet ile giriş yapıp ürünleri çekin.';
  } else {
    if (durumText) durumText.innerHTML = '❌ UTS sayfası açılamadı.';
    if (acBtn) acBtn.disabled = false;
  }
}

// UTS durum güncellemelerini dinle
if (window.api && window.api.utsDurumDinle) {
  window.api.utsDurumDinle((durum) => {
    const durumDiv = document.getElementById('utsDurum');
    const durumText = document.getElementById('utsDurumText');
    const acBtn = document.getElementById('utsAcBtn');
    const tabloDiv = document.getElementById('utsUrunTablosu');

    if (durumDiv) durumDiv.style.display = 'block';

    if (durum.type === 'bilgi') {
      if (durumText) durumText.innerHTML = 'ℹ️ ' + durum.mesaj;
    } else if (durum.type === 'basari') {
      if (durumText) durumText.innerHTML = '✅ ' + durum.mesaj;
      if (acBtn) acBtn.disabled = false;
      if (durum.urunler && tabloDiv) {
        utsUrunleriGoster(durum.urunler);
      }
    } else if (durum.type === 'hata') {
      if (durumText) durumText.innerHTML = '❌ ' + durum.mesaj;
      if (acBtn) acBtn.disabled = false;
    }
  });
}

function utsUrunleriGoster(urunler) {
  const tabloDiv = document.getElementById('utsUrunTablosu');
  if (!tabloDiv || !urunler || urunler.length === 0) {
    if (tabloDiv) tabloDiv.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 12px;">Çekilen ürün bulunamadı.</div>';
    return;
  }

  const rows = urunler.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${u.barkod || '-'}</td>
      <td><strong>${u.ad || '-'}</strong></td>
      <td>${u.firma || '-'}</td>
    </tr>
  `).join('');

  tabloDiv.innerHTML = `
    <div style="margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">${urunler.length} UTS ürünü bulundu</div>
    <table class="data-table">
      <thead><tr><th>Sıra</th><th>Barkod</th><th>Ürün Adı</th><th>Firma</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ===== UTS GİRİŞ BİLGİLERİ =====
function openCredentialModal() {
  document.getElementById('utsSifreGiris').value = '';
  document.getElementById('utsSifreModal').classList.add('active');
  document.getElementById('utsSifreGiris').focus();
}

function closeUtsSifreModal() {
  document.getElementById('utsSifreModal').classList.remove('active');
}

async function utsSifreOnayla() {
  const sifre = document.getElementById('utsSifreGiris').value.trim();
  if (sifre !== '2516') {
    showToast('Hatalı şifre!', 'error');
    document.getElementById('utsSifreGiris').value = '';
    document.getElementById('utsSifreGiris').focus();
    return;
  }
  closeUtsSifreModal();
  document.getElementById('credentialModal').classList.add('active');
  const sonuc = await window.api.credentialOku();
  if (sonuc.success) {
    document.getElementById('credTc').value = sonuc.tc;
    document.getElementById('credSifre').value = sonuc.sifre;
  } else {
    document.getElementById('credTc').value = '';
    document.getElementById('credSifre').value = '';
  }
}

function closeCredentialModal() {
  document.getElementById('credentialModal').classList.remove('active');
}

async function credentialKaydet() {
  const tc = document.getElementById('credTc').value.trim();
  const sifre = document.getElementById('credSifre').value.trim();

  if (!tc || tc.length !== 11) {
    showToast('TC Kimlik No 11 haneli olmalıdır.', 'error');
    return;
  }
  if (!sifre) {
    showToast('Şifre boş olamaz.', 'error');
    return;
  }

  const sonuc = await window.api.credentialKaydet({ tc, sifre });
  if (sonuc.success) {
    showToast('Giriş bilgileri kaydedildi.', 'success');
    closeCredentialModal();
  } else {
    showToast('Kaydetme hatası!', 'error');
  }
}

// ===== ETİKET TASARIM SİSTEMİ =====
let etiketTasarim = {
  genislik: 70,
  yukseklik: 40,
  elemanlar: []
};

let tasarimSuruklenen = null;
let tasarimSeciliEleman = null;
let tasarimOffsetX = 0;
let tasarimOffsetY = 0;
let tasarimPikselOrani = 4;

const ELEMAN_TANIMLARI = [
  { tip: 'urun_adi', varsayilan: 'Ürün Adı', ozel: true, varsayilanYaziBoyutu: 8, varsayilanRenk: '#333333', varsayilanBold: true },
  { tip: 'tarih', varsayilan: 'Tarih', ozel: true, varsayilanYaziBoyutu: 6, varsayilanRenk: '#666666', varsayilanBold: false },
  { tip: 'fiyat', varsayilan: '₺0,00', ozel: true, varsayilanYaziBoyutu: 9, varsayilanRenk: '#d32f2f', varsayilanBold: true },
  { tip: 'kategori', varsayilan: 'Kategori', ozel: true, varsayilanYaziBoyutu: 5, varsayilanRenk: '#888888', varsayilanBold: false },
  { tip: 'menşei', varsayilan: 'Menşei', ozel: true, varsayilanYaziBoyutu: 5, varsayilanRenk: '#888888', varsayilanBold: false },
  { tip: 'karekod', varsayilan: 'QR Kod', ozel: true, varsayilanYaziBoyutu: 6, varsayilanRenk: '#000000', varsayilanBold: false },
  { tip: 'metin', varsayilan: 'Özel Metin', ozel: false, varsayilanYaziBoyutu: 6, varsayilanRenk: '#333333', varsayilanBold: false }
];

function elemanYaziBoyutuHesapla(eleman, icerik) {
  const minPt = 4;
  const maxWmm = eleman.genislik - 2;
  const maxHmm = eleman.yukseklik - 2;
  let pt = eleman.yaziBoyutu || 8;

  if (!icerik || icerik.length === 0) return Math.max(minPt, pt);

  const sagmaSatir = eleman.tip === 'urun_adi' || eleman.tip === 'metin';

  if (sagmaSatir) {
    const words = icerik.split(/\s+/);
    let wrapPt = pt;
    while (wrapPt > minPt) {
      const charWmm = wrapPt * 0.35 * 0.55;
      const maxChars = Math.floor(maxWmm / charWmm);
      if (maxChars <= 0) { wrapPt--; continue; }
      let lines = 0, curLen = 0;
      for (let i = 0; i < words.length; i++) {
        const wl = words[i].length;
        if (wl > maxChars) { lines++; curLen = 0; continue; }
        if (curLen === 0) { curLen = wl; }
        else if (curLen + 1 + wl <= maxChars) { curLen += 1 + wl; }
        else { lines++; curLen = wl; }
      }
      if (curLen > 0) lines++;
      const lineH = wrapPt * 0.35 * 1.15;
      if (lines * lineH <= maxHmm) break;
      wrapPt--;
    }
    pt = Math.max(minPt, wrapPt);
  } else {
    let tempPt = pt;
    while (tempPt > minPt) {
      const charWmm = tempPt * 0.35 * 0.55;
      const maxChars = Math.floor(maxWmm / charWmm);
      if (maxChars <= 0 || icerik.length <= maxChars) break;
      tempPt--;
    }
    pt = Math.max(minPt, tempPt);
    const fontH = pt * 0.35;
    if (fontH > maxHmm) {
      pt = Math.max(minPt, Math.floor(maxHmm / 0.35));
    }
  }

  return pt;
}

function etiketTasarimVarsayilan() {
  return {
    genislik: 70,
    yukseklik: 40,
    elemanlar: [
      { tip: 'urun_adi', x: 2, y: 3, genislik: 33, yukseklik: 10, yaziBoyutu: 8, renk: '#333333', bold: true, icerik: 'Ürün Adı' },
      { tip: 'tarih', x: 2, y: 15, genislik: 33, yukseklik: 7, yaziBoyutu: 6, renk: '#666666', bold: false, icerik: 'Tarih' },
      { tip: 'fiyat', x: 2, y: 25, genislik: 33, yukseklik: 10, yaziBoyutu: 9, renk: '#d32f2f', bold: true, icerik: '₺0,00' },
      { tip: 'karekod', x: 38, y: 3, genislik: 28, yukseklik: 32, yaziBoyutu: 6, renk: '#000000', bold: false, icerik: 'QR Kod' }
    ]
  };
}

function etiketTasarimPikselDonustur(mm) {
  return Math.round(mm * tasarimPikselOrani);
}

function etiketTasarimMMDonustur(piksel) {
  return Math.round((piksel / tasarimPikselOrani) * 10) / 10;
}

async function etiketTasarlamaAc() {
  const sonuc = await window.api.etiketDesignOku();
  if (sonuc.success && sonuc.design) {
    etiketTasarim = sonuc.design;
  } else {
    etiketTasarim = etiketTasarimVarsayilan();
  }

  etiketTasarimElemanlariSığdir();

  document.getElementById('tasarimGenislik').value = etiketTasarim.genislik;
  document.getElementById('tasarimYukseklik').value = etiketTasarim.yukseklik;

  document.getElementById('etiketTasarimModal').classList.add('active');
  etiketTasarimElemanlariniOlustur();
  etiketTasarimAlaniGuncelle();
}

function etiketTasarimElemanlariSığdir() {
  if (!etiketTasarim.elemanlar || etiketTasarim.elemanlar.length === 0) {
    const varsayilan = etiketTasarimVarsayilan();
    etiketTasarim.elemanlar = varsayilan.elemanlar.map(e => ({...e}));
  }

  const maxGenislik = etiketTasarim.genislik;
  const maxYukseklik = etiketTasarim.yukseklik;

  etiketTasarim.elemanlar.forEach(eleman => {
    if (eleman.x + eleman.genislik > maxGenislik) {
      eleman.genislik = Math.max(10, maxGenislik - eleman.x - 1);
    }
    if (eleman.x + eleman.genislik > maxGenislik) {
      eleman.x = Math.max(0, maxGenislik - eleman.genislik - 1);
    }
    if (eleman.y + eleman.yukseklik > maxYukseklik) {
      eleman.yukseklik = Math.max(5, maxYukseklik - eleman.y - 1);
    }
    if (eleman.y + eleman.yukseklik > maxYukseklik) {
      eleman.y = Math.max(0, maxYukseklik - eleman.yukseklik - 1);
    }
    if (eleman.yaziBoyutu > eleman.yukseklik * 0.8) {
      eleman.yaziBoyutu = Math.max(5, Math.floor(eleman.yukseklik * 0.6));
    }
  });
}

function etiketTasarlamaKapat() {
  document.getElementById('etiketTasarimModal').classList.remove('active');
  etiketOnizlemeGuncelle();
}

function etiketTasarimElemanlariniOlustur() {
  const liste = document.getElementById('etiketElemanListesi');
  const varOlanTipler = etiketTasarim.elemanlar.map(e => e.tip);

  liste.innerHTML = ELEMAN_TANIMLARI.map(t => {
    const mevcut = etiketTasarim.elemanlar.filter(e => e.tip === t.tip);
    const sayi = mevcut.length;
    const eklenebilirMi = !t.ozel || sayi === 0;
    const eklendi = varOlanTipler.includes(t.tip);

    return `
      <div class="etiket-eleman-sürükle" draggable="${eklenebilirMi}" data-tip="${t.tip}"
        ondragstart="etiketTasarimSurukleBasla(event, '${t.tip}')"
        style="padding:8px 10px;background:${eklendi ? 'var(--accent);color:white' : 'var(--bg-secondary)'};border:1px solid ${eklendi ? 'var(--accent)' : 'var(--border)'};border-radius:4px;font-size:0.75rem;cursor:${eklenebilirMi ? 'grab' : 'not-allowed'};opacity:1;display:flex;align-items:center;gap:6px;user-select:none;">
        <span style="font-size:0.9rem;">${t.tip === 'karekod' ? '▓▒░' : t.tip === 'urun_adi' ? '🏷️' : t.tip === 'tarih' ? '📅' : t.tip === 'fiyat' ? '💰' : t.tip === 'kategori' ? '📂' : t.tip === 'menşei' ? '🌍' : '📝'}</span>
        <span style="font-weight:500;">${t.tip === 'karekod' ? 'Karekod' : t.tip === 'urun_adi' ? 'Ürün Adı' : t.tip === 'tarih' ? 'Tarih' : t.tip === 'fiyat' ? 'Fiyat' : t.tip === 'kategori' ? 'Kategori' : t.tip === 'menşei' ? 'Menşei' : 'Özel Metin'}</span>
        ${sayi > 0 && t.tip === 'metin' ? `<span style="margin-left:auto;font-size:0.65rem;opacity:0.8;">+${sayi}</span>` : ''}
      </div>
    `;
  }).join('');
}

function etiketTasarimSurukleBasla(e, tip) {
  e.dataTransfer.setData('text/plain', tip);
  e.dataTransfer.effectAllowed = 'copy';
}

function etiketTasarimAlaniGuncelle() {
  const alan = document.getElementById('etiketTasarimAlani');
  if (!alan) return;
  const genislikMM = parseInt(document.getElementById('tasarimGenislik').value) || 70;
  const yukseklikMM = parseInt(document.getElementById('tasarimYukseklik').value) || 40;

  etiketTasarim.genislik = genislikMM;
  etiketTasarim.yukseklik = yukseklikMM;

  const genislikPiksel = etiketTasarimPikselDonustur(genislikMM);
  const yukseklikPiksel = etiketTasarimPikselDonustur(yukseklikMM);

  alan.style.width = genislikPiksel + 'px';
  alan.style.height = yukseklikPiksel + 'px';
  alan.style.minWidth = genislikPiksel + 'px';
  alan.style.minHeight = yukseklikPiksel + 'px';

  alan.ondragover = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  alan.ondrop = (e) => { e.preventDefault(); etiketTasarimElemanEkle(e); };

  void alan.offsetHeight;
  etiketTasarimElemanlariCiz();
}

function etiketTasarimElemanEkle(e) {
  const tip = e.dataTransfer.getData('text/plain');
  const tanim = ELEMAN_TANIMLARI.find(t => t.tip === tip);
  if (!tanim) return;

  if (tanim.ozel) {
    const mevcut = etiketTasarim.elemanlar.find(el => el.tip === tip);
    if (mevcut) return;
  }

  const alan = document.getElementById('etiketTasarimAlani');
  const rect = alan.getBoundingClientRect();
  const xMM = etiketTasarimMMDonustur(e.clientX - rect.left);
  const yMM = etiketTasarimMMDonustur(e.clientY - rect.top);

  const yeniEleman = {
    tip: tip,
    x: Math.max(0, Math.min(xMM, etiketTasarim.genislik - 10)),
    y: Math.max(0, Math.min(yMM, etiketTasarim.yukseklik - 5)),
    genislik: tip === 'karekod' ? 28 : 33,
    yukseklik: tip === 'karekod' ? 32 : 10,
    yaziBoyutu: tanim.varsayilanYaziBoyutu,
    renk: tanim.varsayilanRenk,
    bold: tanim.varsayilanBold,
    icerik: tanim.varsayilan
  };

  etiketTasarim.elemanlar.push(yeniEleman);
  etiketTasarimSeciliEleman = yeniEleman;
  etiketTasarimElemanlariniOlustur();
  etiketTasarimElemanlariCiz();
  etiketElemanAyarlariniGoster(yeniEleman);
}

function etiketTasarimElemanlariCiz() {
  const alan = document.getElementById('etiketTasarimAlani');
  if (!alan) return;
  const genislikPiksel = etiketTasarimPikselDonustur(etiketTasarim.genislik);
  const yukseklikPiksel = etiketTasarimPikselDonustur(etiketTasarim.yukseklik);

  alan.style.width = genislikPiksel + 'px';
  alan.style.height = yukseklikPiksel + 'px';
  alan.style.minWidth = genislikPiksel + 'px';
  alan.style.minHeight = yukseklikPiksel + 'px';

  let html = '';
  if (etiketTasarim.elemanlar.length === 0) {
    html = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#bbb;font-size:11px;pointer-events:none;text-align:center;line-height:1.6;">Sol panelden elemanları sürükleyip bırakın</div>';
  } else {
    etiketTasarim.elemanlar.forEach((eleman, index) => {
      const solPiksel = etiketTasarimPikselDonustur(eleman.x);
      const ustPiksel = etiketTasarimPikselDonustur(eleman.y);
      const genislikElPiksel = etiketTasarimPikselDonustur(eleman.genislik);
      const yukseklikElPiksel = etiketTasarimPikselDonustur(eleman.yukseklik);
      const secili = etiketTasarimSeciliEleman === eleman;

      const icerik = eleman.tip === 'karekod'
        ? '<span style="font-size:1.5rem;pointer-events:none;"><svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="2" height="14"/><rect x="5" y="1" width="1" height="14"/><rect x="8" y="1" width="3" height="14"/><rect x="13" y="1" width="2" height="14"/></svg></span>'
        : `<span style="pointer-events:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${eleman.icerik || eleman.tip}</span>`;

      html += `<div class="tasarim-eleman" data-index="${index}" style="position:absolute;left:${solPiksel}px;top:${ustPiksel}px;width:${genislikElPiksel}px;height:${yukseklikElPiksel}px;border:1px ${secili ? 'solid var(--accent)' : 'dashed var(--border)'};border-radius:3px;display:flex;align-items:center;justify-content:center;cursor:move;font-size:${Math.max(8, eleman.yaziBoyutu)}px;color:${eleman.renk};font-weight:${eleman.bold ? 'bold' : 'normal'};overflow:visible;background:${secili ? 'rgba(13,110,253,0.08)' : 'rgba(255,255,255,0.9)'};user-select:none;">${icerik}<div class="tasarim-eleman-sil" style="position:absolute;top:-8px;right:-8px;width:18px;height:18px;background:var(--danger);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;cursor:pointer;z-index:10;box-shadow:0 1px 3px rgba(0,0,0,0.3);line-height:1;pointer-events:auto;">✕</div></div>`;
    });
  }

  alan.innerHTML = html;

  alan.querySelectorAll('.tasarim-eleman-sil').forEach((silBtn, i) => {
    silBtn.onmousedown = (e) => e.stopPropagation();
    silBtn.onclick = (e) => {
      e.stopPropagation();
      etiketElemanSil(i);
    };
  });

  alan.querySelectorAll('.tasarim-eleman').forEach((div, index) => {
    const eleman = etiketTasarim.elemanlar[index];
    div.onmousedown = (e) => {
      if (e.target.closest('.tasarim-eleman-sil')) return;
      e.stopPropagation();
      etiketTasarimSeciliEleman = eleman;
      const alanRect = alan.getBoundingClientRect();
      tasarimOffsetX = e.clientX - alanRect.left - etiketTasarimPikselDonustur(eleman.x);
      tasarimOffsetY = e.clientY - alanRect.top - etiketTasarimPikselDonustur(eleman.y);

      document.onmousemove = (e2) => {
        const newX = etiketTasarimMMDonustur(e2.clientX - alanRect.left - tasarimOffsetX);
        const newY = etiketTasarimMMDonustur(e2.clientY - alanRect.top - tasarimOffsetY);
        eleman.x = Math.max(0, Math.min(newX, etiketTasarim.genislik - eleman.genislik));
        eleman.y = Math.max(0, Math.min(newY, etiketTasarim.yukseklik - eleman.yukseklik));
        etiketTasarimElemanlariCiz();
      };

      document.onmouseup = () => {
        document.onmousemove = null;
        document.onmouseup = null;
      };

      etiketTasarimElemanlariCiz();
      etiketElemanAyarlariniGoster(eleman);
    };
  });
}

function etiketElemanSil(index) {
  const eleman = etiketTasarim.elemanlar[index];
  const tanim = ELEMAN_TANIMLARI.find(t => t.tip === eleman.tip);
  const isim = tanim ? (tanim.tip === 'karekod' ? 'Karekod' : tanim.tip === 'urun_adi' ? 'Ürün Adı' : tanim.tip === 'tarih' ? 'Tarih' : tanim.tip === 'fiyat' ? 'Fiyat' : tanim.tip === 'kategori' ? 'Kategori' : tanim.tip === 'menşei' ? 'Menşei' : 'Özel Metin') : eleman.tip;

  if (confirm(`"${isim}" elemanını silmek istediğinize emin misiniz?`)) {
    etiketTasarim.elemanlar.splice(index, 1);
    etiketTasarimSeciliEleman = null;
    etiketTasarimElemanlariniOlustur();
    etiketTasarimElemanlariCiz();
    document.getElementById('etiketElemanAyarlari').innerHTML = '<span style="font-size:0.7rem;color:var(--text-muted);">Bir eleman seçin</span>';
  }
}

function etiketElemanAyarlariniGoster(eleman) {
  const container = document.getElementById('etiketElemanAyarlari');
  const tanim = ELEMAN_TANIMLARI.find(t => t.tip === eleman.tip);
    const ozelMi = eleman.tip === 'metin';
    const index = etiketTasarim.elemanlar.indexOf(eleman);

    container.innerHTML = `
      <div class="form-group" style="margin-bottom:6px;">
        <label>Tür</label>
        <div style="font-size:0.75rem;font-weight:500;color:var(--text-primary);padding:3px 0;">${tanim ? (tanim.tip === 'karekod' ? '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="2" height="14"/><rect x="5" y="1" width="1" height="14"/><rect x="8" y="1" width="3" height="14"/><rect x="13" y="1" width="2" height="14"/></svg> Karekod' : tanim.tip === 'urun_adi' ? '🏷️ Ürün Adı' : tanim.tip === 'tarih' ? '📅 Tarih' : tanim.tip === 'fiyat' ? '💰 Fiyat' : tanim.tip === 'kategori' ? '📂 Kategori' : tanim.tip === 'menşei' ? '🌍 Menşei' : '📝 Özel Metin') : eleman.tip}</div>
    </div>
    ${ozelMi ? `
    <div class="form-group" style="margin-bottom:6px;">
      <label>İçerik</label>
      <input type="text" value="${(eleman.icerik || '').replace(/"/g, '&quot;')}" oninput="etiketElemanGuncelle('icerik', this.value)" style="width:100%;padding:3px 4px;border:1px solid var(--border);border-radius:3px;font-size:0.7rem;background:var(--bg-input);color:var(--text-primary);">
    </div>
    ` : ''}
    <div class="form-group" style="margin-bottom:6px;">
      <label>Yazı Boyutu</label>
      <input type="number" value="${eleman.yaziBoyutu}" min="3" max="20" onchange="etiketElemanGuncelle('yaziBoyutu', parseInt(this.value))" style="width:100%;padding:3px 4px;border:1px solid var(--border);border-radius:3px;font-size:0.7rem;background:var(--bg-input);color:var(--text-primary);">
    </div>
    <div class="form-group" style="margin-bottom:6px;">
      <label>Renk</label>
      <input type="color" value="${eleman.renk}" onchange="etiketElemanGuncelle('renk', this.value)" style="width:100%;height:24px;padding:0;border:1px solid var(--border);border-radius:3px;cursor:pointer;">
    </div>
    <div class="form-group" style="margin-bottom:6px;">
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
        <input type="checkbox" ${eleman.bold ? 'checked' : ''} onchange="etiketElemanGuncelle('bold', this.checked)" style="accent-color:var(--accent);">
        Kalın Yazı
      </label>
    </div>
    <div class="form-group" style="margin-bottom:6px;">
      <label>Genişlik (mm)</label>
      <input type="number" value="${eleman.genislik}" min="5" max="200" onchange="etiketElemanGuncelle('genislik', parseInt(this.value))" style="width:100%;padding:3px 4px;border:1px solid var(--border);border-radius:3px;font-size:0.7rem;background:var(--bg-input);color:var(--text-primary);">
    </div>
    <div class="form-group" style="margin-bottom:6px;">
      <label>Yükseklik (mm)</label>
      <input type="number" value="${eleman.yukseklik}" min="5" max="150" onchange="etiketElemanGuncelle('yukseklik', parseInt(this.value))" style="width:100%;padding:3px 4px;border:1px solid var(--border);border-radius:3px;font-size:0.7rem;background:var(--bg-input);color:var(--text-primary);">
    </div>
    <button class="btn btn-danger btn-sm" onclick="etiketElemanSil(${index})" style="width:100%;margin-top:4px;">🗑️ Elemanı Sil</button>
  `;
}

function etiketElemanGuncelle(alan, deger) {
  if (!etiketTasarimSeciliEleman) return;
  etiketTasarimSeciliEleman[alan] = deger;
  etiketTasarimElemanlariCiz();
}

async function etiketTasarakimKaydet() {
  etiketTasarim.genislik = parseInt(document.getElementById('tasarimGenislik').value) || 70;
  etiketTasarim.yukseklik = parseInt(document.getElementById('tasarimYukseklik').value) || 40;

  const sonuc = await window.api.etiketDesignKaydet(etiketTasarim);
  if (sonuc.success) {
    showToast('Etiket tasarımı kaydedildi.', 'success');
    document.getElementById('etiketGenislik').value = etiketTasarim.genislik;
    document.getElementById('etiketYukseklik').value = etiketTasarim.yukseklik;
    etiketTasarlamaKapat();
  } else {
    showToast('Kaydetme hatası!', 'error');
  }
}

function etiketTasarimSifirla() {
  if (!confirm('Tasarımı varsayılana sıfırlamak istediğinize emin misiniz?')) return;
  etiketTasarim = etiketTasarimVarsayilan();
  document.getElementById('tasarimGenislik').value = etiketTasarim.genislik;
  document.getElementById('tasarimYukseklik').value = etiketTasarim.yukseklik;
  etiketTasarimElemanlariniOlustur();
  etiketTasarimAlaniGuncelle();
  etiketTasarimSeciliEleman = null;
  document.getElementById('etiketElemanAyarlari').innerHTML = '<span style="font-size:0.7rem;color:var(--text-muted);">Bir eleman seçin</span>';
}

// ===== GÜNCELLENMİŞ ETİKET ÖNİZLEME =====
function etiketOnizlemeGuncelle() {
  clearTimeout(onizlemeTimer);
  onizlemeTimer = setTimeout(() => etiketOnizlemeGuncelleInternal(), 200);
}

async function etiketOnizlemeGuncelleInternal() {
  const onizleme = document.getElementById('etiketOnizleme');
  if (!etiketSeciliUrun) return;

  const genislik = parseInt(document.getElementById('etiketGenislik').value) || 70;
  const yukseklik = parseInt(document.getElementById('etiketYukseklik').value) || 40;

  const mmToPiksel = 3.78;
  const onizlemeGenislik = Math.round(genislik * mmToPiksel);
  const onizlemeYukseklik = Math.round(yukseklik * mmToPiksel);

  const karekodInput = document.getElementById('etiketKarekod');
  const karekodDegeri = (karekodInput ? karekodInput.value.trim() : '') || etiketSeciliUrun.KAREKOD || etiketSeciliUrun.URUN_ID.toString();
  const qrDataUrl = await generateQRDataUrl(karekodDegeri, 150);
  const bugun = new Date().toLocaleDateString('tr-TR');

  const tasarim = etiketTasarim.elemanlar && etiketTasarim.elemanlar.length > 0 ? etiketTasarim : etiketTasarimVarsayilan();

  let html = `<div style="width:${onizlemeGenislik}px;height:${onizlemeYukseklik}px;position:relative;border:1px solid var(--border);border-radius:4px;overflow:hidden;background:white;font-family:Arial,sans-serif;">`;

  for (const eleman of tasarim.elemanlar) {
    const sol = Math.round(eleman.x * mmToPiksel);
    const ust = Math.round(eleman.y * mmToPiksel);
    const w = Math.round(eleman.genislik * mmToPiksel);
    const h = Math.round(eleman.yukseklik * mmToPiksel);

    let icerik = '';
    if (eleman.tip === 'karekod') {
      icerik = `<img src="${qrDataUrl}" style="width:${Math.max(10, w - 8)}px;height:${Math.max(10, h - 8)}px;" />`;
    } else if (eleman.tip === 'urun_adi') {
      icerik = etiketSeciliUrun.URUN_ADI || '';
    } else if (eleman.tip === 'tarih') {
      icerik = bugun;
    } else if (eleman.tip === 'fiyat') {
      icerik = '₺' + parseFloat(etiketSeciliUrun.FIYAT || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    } else if (eleman.tip === 'kategori') {
      icerik = etiketSeciliUrun.KATEGORI_ADI || '';
    } else if (eleman.tip === 'menşei') {
      icerik = etiketSeciliUrun.MENSEI || '';
    } else {
      icerik = eleman.icerik || '';
    }

    const sagmaSatir = eleman.tip === 'karekod' || eleman.tip === 'urun_adi' || eleman.tip === 'metin';
    const ptHesap = eleman.tip === 'karekod' ? (eleman.yaziBoyutu || 8) : elemanYaziBoyutuHesapla(eleman, icerik);
    const fontPx = Math.round(ptHesap * mmToPiksel * 0.35);

    let overflowCSS;
    if (sagmaSatir) {
      overflowCSS = 'overflow:hidden;word-wrap:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.15;';
    } else {
      overflowCSS = 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
    }

    html += `<div style="position:absolute;left:${sol}px;top:${ust}px;width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;font-size:${Math.max(6, fontPx)}px;font-weight:${eleman.bold ? 'bold' : 'normal'};color:${eleman.renk};text-align:center;padding:2px;${overflowCSS}">${icerik}</div>`;
  }

  html += '</div>';
  onizleme.innerHTML = html;
}

// ===== YAZDIRMA - TERMAL YAZICI & KAĞIT =====
async function etiketYazdir() {
  if (!etiketSeciliUrun) return;

  const yaziciTipi = document.getElementById('etiketSayfaBoyutu').value;
  const genislik = parseInt(document.getElementById('etiketGenislik').value) || 70;
  const yukseklik = parseInt(document.getElementById('etiketYukseklik').value) || 40;
  const boslukY = parseInt(document.getElementById('etiketBoslukY').value) || 3;
  const adet = parseInt(document.getElementById('etiketAdet').value) || 1;

  const bugun = new Date().toLocaleDateString('tr-TR');
  const karekodInput = document.getElementById('etiketKarekod');
  const karekodDegeri = (karekodInput ? karekodInput.value.trim() : '') || etiketSeciliUrun.KAREKOD || etiketSeciliUrun.URUN_ID.toString();
  const qrDataUrl = await generateQRDataUrl(karekodDegeri, 150);

  const tasarim = etiketTasarim.elemanlar && etiketTasarim.elemanlar.length > 0 ? etiketTasarim : etiketTasarimVarsayilan();

  function elemanHTML(eleman, u, qrUrl, tarih) {
    let icerik = '';
    if (eleman.tip === 'karekod') {
      icerik = `<img src="${qrUrl}" style="width:${eleman.genislik - 2}mm;height:${eleman.yukseklik - 2}mm;" />`;
      return `<div style="position:absolute;left:${eleman.x}mm;top:${eleman.y}mm;width:${eleman.genislik}mm;height:${eleman.yukseklik}mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">${icerik}</div>`;
    }

    if (eleman.tip === 'urun_adi') icerik = u.URUN_ADI || '';
    else if (eleman.tip === 'tarih') icerik = tarih;
    else if (eleman.tip === 'fiyat') icerik = '₺' + parseFloat(u.FIYAT || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    else if (eleman.tip === 'kategori') icerik = u.KATEGORI_ADI || '';
    else if (eleman.tip === 'menşei') icerik = u.MENSEI || '';
    else icerik = eleman.icerik || '';

    const mmToPt = 2.835;
    const sagmaSatir = eleman.tip === 'urun_adi' || eleman.tip === 'metin';
    const yaziBoyutu = elemanYaziBoyutuHesapla(eleman, icerik);

    let overflowCSS;
    if (sagmaSatir) {
      overflowCSS = 'overflow:hidden;word-wrap:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.15;';
    } else {
      overflowCSS = 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
    }

    return `<div style="position:absolute;left:${eleman.x}mm;top:${eleman.y}mm;width:${eleman.genislik}mm;height:${eleman.yukseklik}mm;display:flex;align-items:center;justify-content:center;font-size:${yaziBoyutu}pt;font-weight:${eleman.bold ? 'bold' : 'normal'};color:${eleman.renk};text-align:center;padding:1mm;${overflowCSS}">${icerik}</div>`;
  }

  let tumEtiketler = '';

  let tekEtiketHTML = '';
  for (const eleman of tasarim.elemanlar) {
    tekEtiketHTML += elemanHTML(eleman, etiketSeciliUrun, qrDataUrl, bugun);
  }
  const tekEtiketDiv = `<div class="etiket" style="width:${genislik}mm;height:${yukseklik}mm;position:relative;overflow:hidden;font-family:Arial,sans-serif;">${tekEtiketHTML}</div>`;

  if (yaziciTipi === 'termal') {
    for (let i = 0; i < adet; i++) {
      tumEtiketler += tekEtiketDiv;
    }
  } else {
    let sayfaG, sayfaY;
    if (yaziciTipi === 'A5') { sayfaG = 148; sayfaY = 210; } else { sayfaG = 210; sayfaY = 297; }
    const yatayAdet = Math.floor((sayfaG + 5) / (genislik + 5));
    const dikeyAdet = Math.floor((sayfaY + 5) / (yukseklik + 5));
    const sayfaBasinaEtiket = yatayAdet * dikeyAdet;
    const toplamSayfa = Math.ceil(adet / sayfaBasinaEtiket);
    let etiketSayisi = 0;

    for (let sayfa = 0; sayfa < toplamSayfa; sayfa++) {
      tumEtiketler += `<div class="etiket-sayfa" style="width:${sayfaG}mm;height:${sayfaY}mm;position:relative;page-break-after:always;">`;
      for (let dy = 0; dy < dikeyAdet && etiketSayisi < adet; dy++) {
        for (let yt = 0; yt < yatayAdet && etiketSayisi < adet; yt++) {
          const left = yt * (genislik + 5);
          const top = dy * (yukseklik + 5);
          tumEtiketler += `<div style="position:absolute;left:${left}mm;top:${top}mm;">${tekEtiketHTML}</div>`;
          etiketSayisi++;
        }
      }
      tumEtiketler += '</div>';
    }
  }

  const htmlContent = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      @page{size:${genislik}mm ${yukseklik}mm;margin:0;padding:0;}
      html{margin:0;padding:0;}
      body{margin:0;padding:0;background:white;width:${genislik}mm;height:${yukseklik}mm;}
      *{margin:0;padding:0;box-sizing:border-box;}
      .etiket{width:${genislik}mm;height:${yukseklik}mm;position:relative;overflow:hidden;font-family:Arial,sans-serif;page-break-after:always;page-break-inside:avoid;}
      .etiket:last-child{page-break-after:auto;}
    </style>
  </head><body>${tumEtiketler}</body></html>`;

  if (window.api && window.api.etiketYazdir) {
    showToast('Yazdırılıyor...', 'info');
    const seciliYazici = document.getElementById('etiketYaziciSec') ? document.getElementById('etiketYaziciSec').value : '';
    const sonuc = await window.api.etiketYazdir({ html: htmlContent, genislik, yukseklik, bosluk: boslukY, adet, yaziciAdi: seciliYazici });
    if (sonuc && sonuc.success) {
      showToast('Yazdırma gönderildi.', 'success');
      closeEtiketModal();
    } else {
      showToast('Yazdırma hatası: ' + (sonuc ? sonuc.error : 'Bilinmeyen'), 'error');
    }
  } else {
    const pw = window.open('', '_blank', 'width=800,height=600');
    pw.document.write(htmlContent);
    pw.document.close();
    setTimeout(function() { pw.focus(); pw.print(); }, 1500);
    closeEtiketModal();
  }
}

async function tumunuYazdir(kaynak) {
  let urunler = [];
  if (kaynak === 'urunler') {
    urunler = tumUrunlerAdmin;
  } else if (kaynak === 'toplustok') {
    urunler = topluStokVerileri.map((u, i) => ({
      URUN_ID: u.ID || (i + 1), URUN_ADI: u['Ürün Adı'] || '', KATEGORI_ADI: u.Kategori || '',
      FIYAT: u['Satış Fiyatı'] || 0, KAREKOD: u.KAREKOD || '', MENSEI: u.Menşei || ''
    }));
  }
  if (urunler.length === 0) { showToast('Yazdırılacak ürün bulunamadı.', 'warning'); return; }

  const yaziciTipi = document.getElementById('etiketSayfaBoyutu').value;
  const genislik = parseInt(document.getElementById('etiketGenislik').value) || 70;
  const yukseklik = parseInt(document.getElementById('etiketYukseklik').value) || 40;
  const boslukY = parseInt(document.getElementById('etiketBoslukY').value) || 3;
  const bugun = new Date().toLocaleDateString('tr-TR');
  const tasarim = etiketTasarim.elemanlar && etiketTasarim.elemanlar.length > 0 ? etiketTasarim : etiketTasarimVarsayilan();

  function elemanHTML(eleman, u, qrUrl, tarih) {
    let icerik = '';
    if (eleman.tip === 'karekod') {
      icerik = `<img src="${qrUrl}" style="width:${eleman.genislik - 2}mm;height:${eleman.yukseklik - 2}mm;" />`;
      return `<div style="position:absolute;left:${eleman.x}mm;top:${eleman.y}mm;width:${eleman.genislik}mm;height:${eleman.yukseklik}mm;display:flex;align-items:center;justify-content:center;overflow:hidden;">${icerik}</div>`;
    }

    if (eleman.tip === 'urun_adi') icerik = u.URUN_ADI || '';
    else if (eleman.tip === 'tarih') icerik = tarih;
    else if (eleman.tip === 'fiyat') icerik = '₺' + parseFloat(u.FIYAT || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    else if (eleman.tip === 'kategori') icerik = u.KATEGORI_ADI || '';
    else if (eleman.tip === 'menşei') icerik = u.MENSEI || '';
    else icerik = eleman.icerik || '';

    const sagmaSatir = eleman.tip === 'urun_adi' || eleman.tip === 'metin';
    const yaziBoyutu = elemanYaziBoyutuHesapla(eleman, icerik);

    let overflowCSS;
    if (sagmaSatir) {
      overflowCSS = 'overflow:hidden;word-wrap:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.15;';
    } else {
      overflowCSS = 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;';
    }

    return `<div style="position:absolute;left:${eleman.x}mm;top:${eleman.y}mm;width:${eleman.genislik}mm;height:${eleman.yukseklik}mm;display:flex;align-items:center;justify-content:center;font-size:${yaziBoyutu}pt;font-weight:${eleman.bold ? 'bold' : 'normal'};color:${eleman.renk};text-align:center;padding:1mm;${overflowCSS}">${icerik}</div>`;
  }

  let tumEtiketler = '';

  if (yaziciTipi === 'termal') {
    for (let i = 0; i < urunler.length; i++) {
      const u = urunler[i];
      const qrUrl = await generateQRDataUrl(u.KAREKOD || String(u.URUN_ID), 150);
      let icerik = '';
      for (const eleman of tasarim.elemanlar) {
        icerik += elemanHTML(eleman, u, qrUrl, bugun);
      }
      tumEtiketler += `<div class="etiket" style="width:${genislik}mm;height:${yukseklik}mm;position:relative;overflow:hidden;font-family:Arial,sans-serif;">${icerik}</div>`;
    }
  } else {
    let sayfaG, sayfaY;
    if (yaziciTipi === 'A5') { sayfaG = 148; sayfaY = 210; } else { sayfaG = 210; sayfaY = 297; }
    const yatayAdet = Math.floor((sayfaG + 5) / (genislik + 5));
    const dikeyAdet = Math.floor((sayfaY + 5) / (yukseklik + 5));
    const sayfaBasinaEtiket = yatayAdet * dikeyAdet;
    let tumEtiketlerDuz = [];
    for (const u of urunler) {
      const qrUrl = await generateQRDataUrl(u.KAREKOD || String(u.URUN_ID), 150);
      let icerik = '';
      for (const eleman of tasarim.elemanlar) {
        icerik += elemanHTML(eleman, u, qrUrl, bugun);
      }
      tumEtiketlerDuz.push(`<div style="position:absolute;width:${genislik}mm;height:${yukseklik}mm;border:0.3px solid #ccc;overflow:hidden;font-family:Arial,sans-serif;">${icerik}</div>`);
    }
    const toplamSayfa = Math.ceil(tumEtiketlerDuz.length / sayfaBasinaEtiket);
    let idx = 0;
    for (let sayfa = 0; sayfa < toplamSayfa; sayfa++) {
      tumEtiketler += `<div style="width:${sayfaG}mm;height:${sayfaY}mm;position:relative;page-break-after:always;">`;
      for (let dy = 0; dy < dikeyAdet && idx < tumEtiketlerDuz.length; dy++) {
        for (let yt = 0; yt < yatayAdet && idx < tumEtiketlerDuz.length; yt++) {
          const left = yt * (genislik + 5);
          const top = dy * (yukseklik + 5);
          tumEtiketler += `<div style="position:absolute;left:${left}mm;top:${top}mm;">${tumEtiketlerDuz[idx]}</div>`;
          idx++;
        }
      }
      tumEtiketler += '</div>';
    }
  }

  const htmlContent = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <style>
      @page{size:${genislik}mm ${yukseklik}mm;margin:0;padding:0;}
      html{margin:0;padding:0;}
      body{margin:0;padding:0;background:white;width:${genislik}mm;height:${yukseklik}mm;}
      *{margin:0;padding:0;box-sizing:border-box;}
      .etiket{width:${genislik}mm;height:${yukseklik}mm;position:relative;overflow:hidden;font-family:Arial,sans-serif;page-break-after:always;page-break-inside:avoid;}
      .etiket:last-child{page-break-after:auto;}
    </style>
  </head><body>${tumEtiketler}</body></html>`;

  if (window.api && window.api.etiketYazdir) {
    showToast('Toplu yazdırılıyor...', 'info');
    const seciliYazici = document.getElementById('etiketYaziciSec') ? document.getElementById('etiketYaziciSec').value : '';
    const sonuc = await window.api.etiketYazdir({ html: htmlContent, genislik, yukseklik, bosluk: boslukY, adet: urunler.length, yaziciAdi: seciliYazici });
    if (sonuc && sonuc.success) showToast('Yazdırma gönderildi.', 'success');
    else showToast('Yazdırma hatası: ' + (sonuc ? sonuc.error : 'Bilinmeyen'), 'error');
  } else {
    const pw = window.open('', '_blank', 'width=800,height=600');
    pw.document.write(htmlContent);
    pw.document.close();
    setTimeout(function() { pw.focus(); pw.print(); }, 1500);
  }
}

// ===== UTS TOPLU ALIM VERİ ÇEKME =====
async function utsVerileriCek() {
  const btn = document.getElementById('utsVeriCekBtn');
  if (btn) btn.disabled = true;

  showToast('UTS sayfasından veriler çekiliyor...', 'info');

  const result = await window.api.utsVeriCek();
  if (!result.success) {
    showToast('Veri çekme hatası: ' + result.message, 'error');
    if (btn) btn.disabled = false;
    return;
  }

  const veri = result.veri;
  if (veri.headers) {
    console.log('UTS Sütun Başlıkları:', veri.headers);
    showToast('UTS Sütunları: ' + veri.headers.join(' | '), 'info');
  }
  if (!veri.rows || veri.rows.length === 0) {
    showToast('Seçili (işaretli) ürün bulunamadı. Lütfen UTS sayfasında ürünleri işaretleyin.', 'warning');
    if (btn) btn.disabled = false;
    return;
  }

  showToast(`${veri.rows.length} ürün bulundu, kaydediliyor...`, 'info');

  const kaydedilecek = veri.rows.map(row => {
    const headers = Object.keys(row);
    const finds = (keywords) => {
      for (const h of headers) {
        const hl = h.toLowerCase();
        if (keywords.some(k => hl.includes(k))) return row[h];
      }
      return '';
    };

    const urunNumarasi = finds(['ürün numarası', 'urun numarası', 'barkod', 'ürün no']);
    const lotBatchNo = finds(['lot', 'batch']);
    const seriSiraNo = finds(['seri', 'sıra']);
    return {
      urunNumarasi: urunNumarasi,
      lotBatchNo: lotBatchNo,
      seriSiraNo: seriSiraNo,
      urunTanimi: finds(['ürün tanımı', 'urun tanimi', 'tanım', 'tanim', 'açıklama']),
      gonderenKurum: finds(['gönderen kurum', 'gonderen kurum', 'firma']),
      adet: finds(['adet', 'miktar'])
    };
  });

  const saveResult = await window.api.utsAlimKaydet(kaydedilecek);
  if (saveResult.success) {
    showToast(`${saveResult.kaydedilen} ürün başarıyla kaydedildi.`, 'success');
    await utsAlimListesiniYukle();
  } else {
    showToast('Kaydetme hatası: ' + saveResult.message, 'error');
  }

  if (btn) btn.disabled = false;
}

let utsAramalar = { urunTanimi: '', alisFiyati: '', satisFiyati: '' };
let utsSeciliSatirlar = new Set();
let utsFiltrelenmisIndexler = [];

async function utsAlimListesiniYukle() {
  const veriler = await window.api.utsAlimOku();
  const container = document.getElementById('utsAlimListesi');
  if (!container) return;

  if (veriler.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 12px;">Henüz veri çekilmedi</div>';
    return;
  }

  utsSeciliSatirlar.clear();

  let filtrelenmis = veriler.map((v, i) => ({ ...v, _index: i }));

  if (utsAramalar.urunTanimi) {
    const q = utsAramalar.urunTanimi.toLowerCase();
    filtrelenmis = filtrelenmis.filter(v => (v.URUN_TANIMI || '').toLowerCase().includes(q));
  }

  utsFiltrelenmisIndexler = filtrelenmis.map(v => v._index);

  const rows = filtrelenmis.map(v => {
    const i = v._index;
    return `
    <tr data-index="${i}">
      <td style="text-align:center;"><input type="checkbox" class="uts-sec-check" data-index="${i}" onchange="utsSeciliGuncelle(${i}, this.checked)"></td>
      <td>${i + 1}</td>
      <td>${v.URUN_NUMARASI || '-'}</td>
      <td>${v.LOT_BATCH_NO || '-'}</td>
      <td>${v.SERI_SIRA_NO || '-'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${v.URUN_TANIMI || ''}">${v.URUN_TANIMI || '-'}</td>
      <td>${v.ADET || '-'}</td>
      <td><input type="number" step="0.01" min="0" value="${parseFloat(v.ALIS_FIYATI) || 0}" style="width:80px;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;text-align:right;" onchange="utsAlanGuncelle(${i}, 'ALIS_FIYATI', this.value)"></td>
      <td><input type="number" step="0.01" min="0" value="${parseFloat(v.SATIS_FIYATI) || 0}" style="width:80px;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;text-align:right;" onchange="utsAlanGuncelle(${i}, 'SATIS_FIYATI', this.value)"></td>
      <td>${v.KAYIT_TARIHI || '-'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="utsAlimSil(${i})">🗑️</button></td>
    </tr>
  `}).join('');

  container.innerHTML = `
    <div style="display:flex;gap:8px;padding:8px;flex-wrap:wrap;align-items:end;">
      <div style="flex:2;min-width:150px;">
        <label style="font-size:0.65rem;color:var(--text-secondary);margin-bottom:2px;display:block;">🔍 Ürün Tanımı Ara</label>
        <input type="text" id="utsAraUrunTanimi" placeholder="Ürün adı yazın..." value="${utsAramalar.urunTanimi}" oninput="utsAramaFiltre()" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;">
      </div>
      <div style="flex:1;min-width:100px;">
        <label style="font-size:0.65rem;color:var(--text-secondary);margin-bottom:2px;display:block;">💰 Alış Fiyatı (Seçililere Uygula)</label>
        <div style="display:flex;gap:4px;">
          <input type="number" id="utsTopluAlis" step="0.01" min="0" placeholder="₺" style="flex:1;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;text-align:right;">
          <button class="btn btn-primary btn-sm" onclick="utsTopluFiyatGuncelle('ALIS_FIYATI')" style="white-space:nowrap;">Uygula</button>
        </div>
      </div>
      <div style="flex:1;min-width:100px;">
        <label style="font-size:0.65rem;color:var(--text-secondary);margin-bottom:2px;display:block;">💰 Satış Fiyatı (Seçililere Uygula)</label>
        <div style="display:flex;gap:4px;">
          <input type="number" id="utsTopluSatis" step="0.01" min="0" placeholder="₺" style="flex:1;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;text-align:right;">
          <button class="btn btn-primary btn-sm" onclick="utsTopluFiyatGuncelle('SATIS_FIYATI')" style="white-space:nowrap;">Uygula</button>
        </div>
      </div>
    </div>
    <div style="padding:0 8px 4px 8px;font-size:0.7rem;color:var(--text-muted);" id="utsFiltreSayac">
      ${filtrelenmis.length} / ${veriler.length} ürün${utsSeciliSatirlar.size > 0 ? ' • ' + utsSeciliSatirlar.size + ' seçili' : ''}
    </div>
    <table class="data-table">
      <thead><tr>
        <th style="width:30px;text-align:center;"><input type="checkbox" id="utsTumuSecCheck" onchange="utsTumuSecKaldir(this.checked)"></th>
        <th>#</th><th>Ürün No</th><th>Lot/Batch</th><th>Seri/Sıra</th>
        <th>Ürün Tanımı</th><th>Bildirim</th><th>Adet</th><th>Alış ₺</th><th>Satış ₺</th><th>Kayıt Tarihi</th><th>İşlem</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function utsAramaFiltre() {
  utsAramalar.urunTanimi = document.getElementById('utsAraUrunTanimi')?.value || '';
  utsTabloyuFiltrele();
}

function utsTabloyuFiltrele() {
  window.api.utsAlimOku().then(veriler => {
    const tbody = document.querySelector('#utsAlimListesi tbody');
    if (!tbody) return;

    let filtrelenmis = veriler.map((v, i) => ({ ...v, _index: i }));

    if (utsAramalar.urunTanimi) {
      const q = utsAramalar.urunTanimi.toLowerCase();
      filtrelenmis = filtrelenmis.filter(v => (v.URUN_TANIMI || '').toLowerCase().includes(q));
    }

    utsFiltrelenmisIndexler = filtrelenmis.map(v => v._index);

    const rows = filtrelenmis.map(v => {
      const i = v._index;
      return `
      <tr data-index="${i}">
        <td style="text-align:center;"><input type="checkbox" class="uts-sec-check" data-index="${i}" ${utsSeciliSatirlar.has(i) ? 'checked' : ''} onchange="utsSeciliGuncelle(${i}, this.checked)"></td>
        <td>${i + 1}</td>
        <td>${v.URUN_NUMARASI || '-'}</td>
        <td>${v.LOT_BATCH_NO || '-'}</td>
        <td>${v.SERI_SIRA_NO || '-'}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${v.URUN_TANIMI || ''}">${v.URUN_TANIMI || '-'}</td>
        <td>${v.ADET || '-'}</td>
        <td><input type="number" step="0.01" min="0" value="${parseFloat(v.ALIS_FIYATI) || 0}" style="width:80px;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;text-align:right;" onchange="utsAlanGuncelle(${i}, 'ALIS_FIYATI', this.value)"></td>
        <td><input type="number" step="0.01" min="0" value="${parseFloat(v.SATIS_FIYATI) || 0}" style="width:80px;padding:4px;border:1px solid var(--border);border-radius:4px;background:var(--bg-input);color:var(--text-primary);font-size:0.75rem;text-align:right;" onchange="utsAlanGuncelle(${i}, 'SATIS_FIYATI', this.value)"></td>
        <td>${v.KAYIT_TARIHI || '-'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="utsAlimSil(${i})">🗑️</button></td>
      </tr>
    `}).join('');

    tbody.innerHTML = rows;

    const tumCheck = document.getElementById('utsTumuSecCheck');
    if (tumCheck) {
      const filtrelenenHepSecili = utsFiltrelenmisIndexler.length > 0 && utsFiltrelenmisIndexler.every(i => utsSeciliSatirlar.has(i));
      tumCheck.checked = filtrelenenHepSecili;
    }

    const sayac = document.getElementById('utsFiltreSayac');
    if (sayac) sayac.textContent = `${filtrelenmis.length} / ${veriler.length} ürün${utsSeciliSatirlar.size > 0 ? ' • ' + utsSeciliSatirlar.size + ' seçili' : ''}`;
  });
}

function utsSeciliGuncelle(index, checked) {
  if (checked) {
    utsSeciliSatirlar.add(index);
  } else {
    utsSeciliSatirlar.delete(index);
  }
  const sayac = document.getElementById('utsFiltreSayac');
  if (sayac) {
    window.api.utsAlimOku().then(veriler => {
      sayac.textContent = `${veriler.length} ürün${utsSeciliSatirlar.size > 0 ? ' • ' + utsSeciliSatirlar.size + ' seçili' : ''}`;
    });
  }
}

function utsTumuSecKaldir(hepsiniSec) {
  if (typeof hepsiniSec === 'undefined') {
    const filtrelenenHepSecili = utsFiltrelenmisIndexler.every(i => utsSeciliSatirlar.has(i));
    hepsiniSec = !filtrelenenHepSecili;
  }

  if (hepsiniSec) {
    utsFiltrelenmisIndexler.forEach(i => utsSeciliSatirlar.add(i));
  } else {
    utsFiltrelenmisIndexler.forEach(i => utsSeciliSatirlar.delete(i));
  }

  document.querySelectorAll('.uts-sec-check').forEach(cb => {
    const idx = parseInt(cb.dataset.index);
    cb.checked = utsSeciliSatirlar.has(idx);
  });

  const tumCheck = document.getElementById('utsTumuSecCheck');
  if (tumCheck) {
    const filtrelenenHepSecili = utsFiltrelenmisIndexler.length > 0 && utsFiltrelenmisIndexler.every(i => utsSeciliSatirlar.has(i));
    tumCheck.checked = filtrelenenHepSecili;
  }

  const sayac = document.getElementById('utsFiltreSayac');
  if (sayac) {
    window.api.utsAlimOku().then(veriler => {
      sayac.textContent = `${utsFiltrelenmisIndexler.length} / ${veriler.length} ürün${utsSeciliSatirlar.size > 0 ? ' • ' + utsSeciliSatirlar.size + ' seçili' : ''}`;
    });
  }
}

async function utsTopluFiyatGuncelle(alan) {
  if (utsSeciliSatirlar.size === 0) {
    showToast('Önce ürün seçin.', 'warning');
    return;
  }
  const inputId = alan === 'ALIS_FIYATI' ? 'utsTopluAlis' : 'utsTopluSatis';
  const deger = parseFloat(document.getElementById(inputId)?.value);
  if (isNaN(deger) || deger < 0) {
    showToast('Geçerli bir fiyat girin.', 'warning');
    return;
  }

  const guncellemeler = Array.from(utsSeciliSatirlar);
  const result = await window.api.utsAlimTopluFiyatGuncelle({ guncellemeler, alan, deger });

  if (result.success) {
    showToast(`${result.basarili} ürüne ₺${deger.toLocaleString('tr-TR')} uygulandı.`, 'success');
  } else {
    showToast(`Hata: ${result.message}`, 'error');
  }

  utsSeciliSatirlar.clear();
  document.getElementById(inputId).value = '';
  await utsTabloyuFiltrele();
}

async function utsAlimSil(index) {
  if (!(await showConfirm('Bu kaydı silmek istediğinize emin misiniz?', 'UTS Kayıt Silme'))) return;
  const result = await window.api.utsAlimSil(index);
  if (result.success) {
    showToast('Kayıt silindi.', 'success');
    await utsAlimListesiniYukle();
  } else {
    showToast('Silme hatası: ' + result.message, 'error');
  }
}

async function utsStogaKaydet() {
  const veriler = await window.api.utsAlimOku();
  if (!veriler || veriler.length === 0) {
    showToast('Önce UTS verilerini çekin.', 'warning');
    return;
  }

  if (utsSeciliSatirlar.size === 0) {
    showToast('Stoğa kaydetmek için ürün seçin.', 'warning');
    return;
  }

  const seciliIndexler = Array.from(utsSeciliSatirlar);
  const seciliVeriler = seciliIndexler.map(i => veriler[i]).filter(Boolean);

  if (!(await showConfirm(`${seciliVeriler.length} seçili UTS ürününü stoğa eklemek istediğinize emin misiniz?\n\nMevcut ürünlerle aynı ürün varsa atlanır. Seçili ürünler UTS listesinden silinecektir.`, 'UTS Stoğa Kaydet'))) return;

  const mevcutKategoriler = await window.api.kategoriRead();
  const utsKategoriVar = mevcutKategoriler.some(k => k.KATEGORI_ADI === 'UTS Ürünleri');
  if (!utsKategoriVar) {
    const nextKatId = await window.api.kategoriGetNextId();
    await window.api.kategoriSave({ KATEGORI_ID: nextKatId, KATEGORI_ADI: 'UTS Ürünleri' });
  }

  const mevcutUrunler = await window.api.urunRead();
  let eklenen = 0, atlanan = 0;

  for (const v of seciliVeriler) {
    const urunAdi = (v.URUN_TANIMI || '').trim();
    if (!urunAdi) { atlanan++; continue; }

    const ayni = mevcutUrunler.find(u => u.URUN_ADI === urunAdi);
    if (ayni) { atlanan++; continue; }

    const nextId = await window.api.urunGetNextId();
    const urun = {
      URUN_ID: nextId,
      KATEGORI_ADI: 'UTS Ürünleri',
      URUN_ADI: urunAdi,
      ALIS_FIYATI: parseFloat(v.ALIS_FIYATI) || 0,
      FIYAT: parseFloat(v.SATIS_FIYATI) || 0,
      ADET: parseInt(v.ADET) || 0,
      KAREKOD: v.URUN_NUMARASI || '',
      MENSEI: v.GONDEREN_KURUM || ''
    };
    await window.api.urunSave(urun);
    mevcutUrunler.push(urun);
    eklenen++;
  }

  await window.api.utsAlimSilToplu(seciliIndexler);
  utsSeciliSatirlar.clear();

  showToast(`${eklenen} ürün stoğa eklendi, ${atlanan} ürün atlandı. UTS listesinden silindi.`, 'success');
  await loadUrunler();
  await utsAlimListesiniYukle();
}

async function utsVerileriTemizle() {
  const veriler = await window.api.utsAlimOku();
  if (veriler.length === 0) {
    showToast('Silinecek veri yok.', 'warning');
    return;
  }
  if (!(await showConfirm(`${veriler.length} kaydı silmek istediğinize emin misiniz?`, 'UTS Veri Temizleme'))) return;

  await window.api.utsAlimTemizle();
  showToast('Tüm veriler silindi.', 'success');
  await utsAlimListesiniYukle();
}

async function utsAlanGuncelle(index, alan, deger, sessiz) {
  const result = await window.api.utsAlimFiyatGuncelle({ index, alan, deger });
  if (!sessiz) {
    if (result.success) {
      showToast('Güncellendi.', 'success');
    } else {
      showToast('Güncelleme hatası: ' + result.message, 'error');
    }
  }
  return result;
}

let stokSayimListesi = [];
let stokSayimUrunler = [];
let stokSayimFiltreUrunleri = [];

function stokSayimFiltreDoldur() {
  const kategoriSelect = document.getElementById('stokSayimKategori');
  const mevcutKategori = kategoriSelect.value;
  const kategoriler = [...new Set(stokSayimUrunler.map(u => u.KATEGORI_ADI).filter(Boolean))].sort();
  kategoriSelect.innerHTML = '<option value="">Tum Kategoriler (' + stokSayimUrunler.length + ')</option>' + kategoriler.map(k => {
    const sayi = stokSayimUrunler.filter(u => u.KATEGORI_ADI === k).length;
    return '<option value="' + k + '"' + (k === mevcutKategori ? ' selected' : '') + '>' + k + ' (' + sayi + ')</option>';
  }).join('');
}

function stokSayimFiltreleUrunler() {
  const kategori = document.getElementById('stokSayimKategori').value;
  const arama = (document.getElementById('stokSayimUrunAra').value || '').trim().toLowerCase();
  if (!kategori && !arama) {
    showToast('Kategori veya urun adi girin.', 'warning');
    return;
  }
  let liste = stokSayimUrunler;
  if (kategori) liste = liste.filter(u => u.KATEGORI_ADI === kategori);
  if (arama) liste = liste.filter(u => (u.URUN_ADI || '').toLowerCase().includes(arama));
  stokSayimFiltreUrunleri = liste;

  const bilgi = document.getElementById('stokSayimFiltreBilgi');
  const parcalar = [];
  if (kategori) parcalar.push(kategori);
  if (arama) parcalar.push('"' + arama + '"');
  bilgi.textContent = parcalar.join(' + ') + ' → ' + liste.length + ' urun';

  stokSayimFiltreListesiRender();
}

function stokSayimFiltreTemizle() {
  stokSayimFiltreUrunleri = [];
  document.getElementById('stokSayimUrunAra').value = '';
  document.getElementById('stokSayimFiltreBilgi').textContent = '';
  const container = document.getElementById('stokSayimFiltreListesi');
  container.style.display = 'none';
  container.innerHTML = '';
}

function stokSayimFiltreListesiRender() {
  const container = document.getElementById('stokSayimFiltreListesi');
  if (stokSayimFiltreUrunleri.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  let html = '<table style="width:100%;border-collapse:collapse;font-size:0.75rem;"><thead><tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border);">';
  html += '<th style="padding:4px 6px;text-align:left;">Urun Adi</th>';
  html += '<th style="padding:4px 6px;text-align:left;">Barkod</th>';
  html += '<th style="padding:4px 6px;text-align:center;">Stok</th>';
  html += '<th style="padding:4px 6px;text-align:center;">Islem</th>';
  html += '</tr></thead><tbody>';
  for (let i = 0; i < stokSayimFiltreUrunleri.length; i++) {
    const u = stokSayimFiltreUrunleri[i];
    const zatenVar = stokSayimListesi.find(s => s.URUN_ID === u.URUN_ID);
    const kisaAd = (u.URUN_ADI || '').length > 40 ? u.URUN_ADI.substring(0, 40) + '...' : (u.URUN_ADI || '-');
    html += '<tr style="border-bottom:1px solid var(--border);' + (zatenVar ? 'background:var(--bg-secondary);' : '') + '">';
    html += '<td style="padding:4px 6px;" title="' + (u.URUN_ADI || '') + '">' + kisaAd + '</td>';
    html += '<td style="padding:4px 6px;font-family:monospace;font-size:0.7rem;">' + (u.KAREKOD || '-') + '</td>';
    html += '<td style="padding:4px 6px;text-align:center;">' + (parseInt(u.ADET) || 0) + '</td>';
    html += '<td style="padding:4px 6px;text-align:center;">';
    if (zatenVar) {
      html += '<span style="color:var(--color-success);font-size:0.7rem;">Eklendi (' + zatenVar.SAYIM_ADEDI + ')</span>';
    } else {
      html += '<button class="btn btn-primary btn-sm" onclick="stokSayimFiltredenEkle(' + i + ')" style="padding:2px 8px;font-size:0.7rem;">Ekle</button>';
    }
    html += '</td></tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function stokSayimFiltredenEkle(i) {
  const u = stokSayimFiltreUrunleri[i];
  const mevcut = stokSayimListesi.find(s => s.URUN_ID === u.URUN_ID);
  if (mevcut) {
    mevcut.SAYIM_ADEDI = toNum(mevcut.SAYIM_ADEDI) + 1;
  } else {
    stokSayimListesi.push({ URUN_ID: u.URUN_ID, URUN_ADI: u.URUN_ADI || '', KAREKOD: u.KAREKOD || '', KATEGORI_ADI: u.KATEGORI_ADI || '', MENSEI: u.MENSEI || '', MEVCUT_ADET: toNum(u.ADET), SAYIM_ADEDI: 1 });
  }
  stokSayimListesiRender();
  stokSayimFiltreListesiRender();
}

async function stokSayimUrunEkle() {
  const input = document.getElementById('stokSayimBarkod');
  const barkod = (input.value || '').trim();
  if (!barkod) return;
  if (stokSayimUrunler.length === 0) {
    stokSayimUrunler = await window.api.urunRead();
    stokSayimFiltreDoldur();
  }
  const aramaListesi = stokSayimFiltreUrunleri.length > 0 ? stokSayimFiltreUrunleri : stokSayimUrunler;
  const urun = aramaListesi.find(u => String(u.KAREKOD || '').trim() === barkod || String(u.URUN_ADI || '').toLowerCase().includes(barkod.toLowerCase()));
  if (!urun) {
    showToast(barkod + ' eslesen urun bulunamadi.', 'warning');
    input.value = '';
    input.focus();
    return;
  }
  const mevcut = stokSayimListesi.find(s => s.URUN_ID === urun.URUN_ID);
  if (mevcut) {
    mevcut.SAYIM_ADEDI++;
  } else {
    stokSayimListesi.push({ URUN_ID: urun.URUN_ID, URUN_ADI: urun.URUN_ADI || '', KAREKOD: urun.KAREKOD || '', KATEGORI_ADI: urun.KATEGORI_ADI || '', MENSEI: urun.MENSEI || '', MEVCUT_ADET: toNum(urun.ADET), SAYIM_ADEDI: 1 });
  }
  input.value = '';
  input.focus();
  stokSayimListesiRender();
}

function stokSayimListesiRender() {
  const container = document.getElementById('stokSayimListesi');
  const sayac = document.getElementById('stokSayimSayac');
  sayac.textContent = stokSayimListesi.length + ' urun sayildi';
  if (stokSayimListesi.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">Barkod okutarak urun ekleyin.</p>';
    return;
  }
  let html = '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;"><thead><tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border);">';
  html += '<th style="padding:6px 8px;text-align:left;">Urun Adi</th>';
  html += '<th style="padding:6px 8px;text-align:left;">Barkod</th>';
  html += '<th style="padding:6px 8px;text-align:left;">Kategori</th>';
  html += '<th style="padding:6px 8px;text-align:center;">Mevcut</th>';
  html += '<th style="padding:6px 8px;text-align:center;">Sayim</th>';
  html += '<th style="padding:6px 8px;text-align:center;"></th>';
  html += '<th style="padding:6px 8px;text-align:center;"></th>';
  html += '</tr></thead><tbody>';
  for (let i = 0; i < stokSayimListesi.length; i++) {
    const s = stokSayimListesi[i];
    const renk = toNum(s.SAYIM_ADEDI) !== toNum(s.MEVCUT_ADET) ? 'var(--color-danger)' : 'var(--color-success)';
    const kisaAd = (s.URUN_ADI || '').length > 35 ? s.URUN_ADI.substring(0, 35) + '...' : (s.URUN_ADI || '-');
    html += '<tr style="border-bottom:1px solid var(--border);">';
    html += '<td style="padding:6px 8px;" title="' + (s.URUN_ADI || '') + '">' + kisaAd + '</td>';
    html += '<td style="padding:6px 8px;font-family:monospace;font-size:0.75rem;">' + (s.KAREKOD || '-') + '</td>';
    html += '<td style="padding:6px 8px;">' + (s.KATEGORI_ADI || '-') + '</td>';
    html += '<td style="padding:6px 8px;text-align:center;">' + toNum(s.MEVCUT_ADET) + '</td>';
    html += '<td style="padding:6px 8px;text-align:center;font-weight:bold;color:' + renk + ';">' + toNum(s.SAYIM_ADEDI) + '</td>';
    html += '<td style="padding:6px 8px;text-align:center;"><button class="btn btn-sm btn-outline" onclick="stokSayimAdetAzalt(' + i + ')" style="padding:2px 6px;">-</button> <button class="btn btn-sm btn-outline" onclick="stokSayimAdetArtir(' + i + ')" style="padding:2px 6px;">+</button></td>';
    html += '<td style="padding:6px 8px;text-align:center;"><button class="btn btn-sm btn-danger" onclick="stokSayimUrunSil(' + i + ')" style="padding:2px 6px;">Sil</button></td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

function stokSayimAdetArtir(i) { stokSayimListesi[i].SAYIM_ADEDI = toNum(stokSayimListesi[i].SAYIM_ADEDI) + 1; stokSayimListesiRender(); }
function stokSayimAdetAzalt(i) { if (toNum(stokSayimListesi[i].SAYIM_ADEDI) > 0) { stokSayimListesi[i].SAYIM_ADEDI = toNum(stokSayimListesi[i].SAYIM_ADEDI) - 1; stokSayimListesiRender(); } }
function stokSayimUrunSil(i) { stokSayimListesi.splice(i, 1); stokSayimListesiRender(); }

function stokSayimiTemizle() {
  stokSayimListesi = [];
  stokSayimListesiRender();
  document.getElementById('stokSayimFark').style.display = 'none';
}

function toNum(v) { const n = Number(v); return isNaN(n) ? 0 : n; }

function stokSayimGozdenGecir() {
  if (stokSayimListesi.length === 0 && stokSayimFiltreUrunleri.length === 0) {
    showToast('Once urun ekleyin veya filtreleme yapin.', 'warning');
    return;
  }
  let html = '<h4 style="margin:0 0 10px 0;color:var(--text-primary);">Stok Fark Raporu</h4>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;"><thead><tr style="background:var(--bg-secondary);border-bottom:1px solid var(--border);">';
  html += '<th style="padding:6px 8px;text-align:left;">Urun</th>';
  html += '<th style="padding:6px 8px;text-align:left;">Kategori</th>';
  html += '<th style="padding:6px 8px;text-align:center;">Mevcut Stok</th>';
  html += '<th style="padding:6px 8px;text-align:center;">Sayilan</th>';
  html += '<th style="padding:6px 8px;text-align:center;">Fark</th></tr></thead><tbody>';
  let fazla = 0, eksik = 0, eslesme = 0;

  const sayilanIdler = new Set(stokSayimListesi.map(s => s.URUN_ID));

  for (const s of stokSayimListesi) {
    const mevcut = toNum(s.MEVCUT_ADET);
    const sayim = toNum(s.SAYIM_ADEDI);
    const fark = sayim - mevcut;
    if (fark > 0) fazla += fark; else if (fark < 0) eksik += Math.abs(fark); else eslesme++;
    const renk = fark > 0 ? 'var(--color-success)' : fark < 0 ? 'var(--color-danger)' : 'var(--text-secondary)';
    const kisaAd = (s.URUN_ADI || '').length > 35 ? s.URUN_ADI.substring(0, 35) + '...' : (s.URUN_ADI || '-');
    html += '<tr style="border-bottom:1px solid var(--border);">';
    html += '<td style="padding:6px 8px;" title="' + (s.URUN_ADI || '') + '">' + kisaAd + '</td>';
    html += '<td style="padding:6px 8px;">' + (s.KATEGORI_ADI || '-') + '</td>';
    html += '<td style="padding:6px 8px;text-align:center;">' + mevcut + '</td>';
    html += '<td style="padding:6px 8px;text-align:center;font-weight:bold;">' + sayim + '</td>';
    html += '<td style="padding:6px 8px;text-align:center;font-weight:bold;color:' + renk + ';">' + (fark > 0 ? '+' + fark : fark) + '</td>';
    html += '</tr>';
  }

  if (stokSayimFiltreUrunleri.length > 0) {
    for (const u of stokSayimFiltreUrunleri) {
      if (sayilanIdler.has(u.URUN_ID)) continue;
      const mevcut = toNum(u.ADET);
      if (mevcut > 0) eksik += mevcut;
      const kisaAd = (u.URUN_ADI || '').length > 35 ? u.URUN_ADI.substring(0, 35) + '...' : (u.URUN_ADI || '-');
      const farkGoster = mevcut > 0 ? '-' + mevcut : '0';
      const farkRenk = mevcut > 0 ? 'var(--color-danger)' : 'var(--text-secondary)';
      html += '<tr style="border-bottom:1px solid var(--border);' + (mevcut > 0 ? 'background:rgba(220,53,69,0.05);' : '') + '">';
      html += '<td style="padding:6px 8px;' + (mevcut > 0 ? 'color:var(--color-danger);' : '') + '" title="' + (u.URUN_ADI || '') + '">' + kisaAd + '</td>';
      html += '<td style="padding:6px 8px;">' + (u.KATEGORI_ADI || '-') + '</td>';
      html += '<td style="padding:6px 8px;text-align:center;">' + mevcut + '</td>';
      html += '<td style="padding:6px 8px;text-align:center;font-weight:bold;color:var(--color-danger);">0</td>';
      html += '<td style="padding:6px 8px;text-align:center;font-weight:bold;color:' + farkRenk + ';">' + farkGoster + '</td>';
      html += '</tr>';
    }
  }

  html += '</tbody></table>';
  html += '<div style="margin-top:10px;font-size:0.8rem;color:var(--text-secondary);">';
  html += 'Fazla: <b style="color:var(--color-success);">' + fazla + '</b> | ';
  html += 'Eksik: <b style="color:var(--color-danger);">' + eksik + '</b> | ';
  html += 'Eslesme: <b>' + eslesme + '</b></div>';
  const farkDiv = document.getElementById('stokSayimFark');
  farkDiv.innerHTML = html;
  farkDiv.style.display = '';
}

async function stokSayimiEsitle() {
  if (stokSayimListesi.length === 0) {
    showToast('Once barkod okutarak urun ekleyin.', 'warning');
    return;
  }
  if (!(await showConfirm(stokSayimListesi.length + ' urunun stok adedini sayim degerlerine esitlemek istediginize emin misiniz?', 'Stok Esitleme'))) return;
  try {
    const guncelleme = stokSayimListesi.map(s => ({ URUN_ID: s.URUN_ID, ADET: s.SAYIM_ADEDI }));
    const sonuc = await window.api.stokAyarla(guncelleme);
    if (sonuc === false) {
      showToast('Veritabaninda guncelleme basarisiz oldu.', 'error');
      return;
    }
    for (const s of stokSayimListesi) {
      s.MEVCUT_ADET = toNum(s.SAYIM_ADEDI);
    }
    stokSayimUrunler = await window.api.urunRead();
    showToast(stokSayimListesi.length + ' urunun stok adedi guncellendi.', 'success');
    stokSayimListesiRender();
    stokSayimGozdenGecir();
  } catch (err) {
    showToast('Hata: ' + err.message, 'error');
  }
}

// ===== TOPLU STOK FİLTRELEME =====
function topluStokFiltrele() {
  renderTopluStok();
}

function topluStokFiltrelenmisUrunleriAl() {
  const arama = (document.getElementById('topluStokArama') ? document.getElementById('topluStokArama').value : '').toLowerCase();
  const kategoriFiltre = document.getElementById('topluStokKategoriFiltre') ? document.getElementById('topluStokKategoriFiltre').value : '';

  return topluStokVerileri.map((u, i) => ({ ...u, _index: i })).filter(u => {
    if (kategoriFiltre && u.Kategori !== kategoriFiltre) return false;
    if (arama) {
      const adi = (u['Urun Adi'] || u['Ürün Adı'] || '').toLowerCase();
      const karekod = (u.KAREKOD || '').toLowerCase();
      if (!adi.includes(arama) && !karekod.includes(arama)) return false;
    }
    return true;
  });
}

// ===== TOPLU STOK FİYAT GÜNCELLEME =====
function topluStokFiyatGuncelleAc() {
  const filtrelenmis = topluStokFiltrelenmisUrunleriAl();
  if (filtrelenmis.length === 0) {
    showToast('Filtrelenmiş ürün bulunamadı', 'warning');
    return;
  }

  document.getElementById('tsAlisFiyat').value = '';
  document.getElementById('tsSatisFiyat').value = '';
  document.querySelector('input[name="tsFiyatIslem"][value="1"]').checked = true;
  tsFiyatIslemDegisti();

  document.getElementById('topluStokFiyatAdet').innerHTML =
    `<strong>${filtrelenmis.length}</strong> ürün filtrelendi. Bu ürünlerin fiyatları güncellenecek.`;
  document.getElementById('topluStokFiyatModal').classList.add('active');
  tsFiyatOnizleme();
}

function topluStokFiyatModalKapat() {
  document.getElementById('topluStokFiyatModal').classList.remove('active');
}

function tsFiyatIslemDegisti() {
  const islem = document.querySelector('input[name="tsFiyatIslem"]:checked').value;
  const alisLabel = document.getElementById('tsAlisLabel');
  const satisLabel = document.getElementById('tsSatisLabel');
  const alisInput = document.getElementById('tsAlisFiyat');
  const satisInput = document.getElementById('tsSatisFiyat');

  if (islem === '1') {
    alisLabel.textContent = 'Yeni Alış Fiyatı (₺)';
    satisLabel.textContent = 'Yeni Satış Fiyatı (₺)';
    alisInput.placeholder = 'ör: 100';
    satisInput.placeholder = 'ör: 150';
  } else if (islem === '2') {
    alisLabel.textContent = 'Alış Yüzde Artış (%)';
    satisLabel.textContent = 'Satış Yüzde Artış (%)';
    alisInput.placeholder = 'ör: 20';
    satisInput.placeholder = 'ör: 20';
  } else if (islem === '3') {
    alisLabel.textContent = 'Alış Yüzde İndirim (%)';
    satisLabel.textContent = 'Satış Yüzde İndirim (%)';
    alisInput.placeholder = 'ör: 10';
    satisInput.placeholder = 'ör: 10';
  } else if (islem === '4') {
    alisLabel.textContent = 'Alış +₺ Tutar';
    satisLabel.textContent = 'Satış +₺ Tutar';
    alisInput.placeholder = 'ör: 50';
    satisInput.placeholder = 'ör: 50';
  } else if (islem === '5') {
    alisLabel.textContent = 'Alış -₺ Tutar';
    satisLabel.textContent = 'Satış -₺ Tutar';
    alisInput.placeholder = 'ör: 25';
    satisInput.placeholder = 'ör: 25';
  }

  document.querySelectorAll('.ts-fiyat-islem-radio').forEach(r => {
    const radio = r.querySelector('input[type="radio"]');
    if (radio.checked) {
      r.style.borderColor = 'var(--color-primary)';
      r.style.background = 'var(--bg-secondary)';
      r.style.fontWeight = '600';
    } else {
      r.style.borderColor = 'var(--border)';
      r.style.background = 'var(--bg-card)';
      r.style.fontWeight = 'normal';
    }
  });

  tsFiyatOnizleme();
}

function tsFiyatHesapla(eskiFiyat, deger, islem) {
  if (!deger || deger === '') return eskiFiyat;
  const d = parseFloat(deger);
  if (isNaN(d)) return eskiFiyat;
  if (islem === '1') return d;
  if (islem === '2') return Math.round(eskiFiyat * (1 + d / 100));
  if (islem === '3') return Math.max(0, Math.round(eskiFiyat * (1 - d / 100)));
  if (islem === '4') return Math.round(eskiFiyat + d);
  if (islem === '5') return Math.max(0, Math.round(eskiFiyat - d));
  return eskiFiyat;
}

function tsFiyatOnizleme() {
  const filtrelenmis = topluStokFiltrelenmisUrunleriAl();
  const islem = document.querySelector('input[name="tsFiyatIslem"]:checked').value;
  const alisDeger = document.getElementById('tsAlisFiyat').value;
  const satisDeger = document.getElementById('tsSatisFiyat').value;
  const sayac = document.getElementById('tsOnizlemeSayac');
  const tablo = document.getElementById('tsOnizlemeTablosu');

  if (filtrelenmis.length === 0) {
    tablo.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.8rem;">Ürün bulunamadı</div>';
    sayac.textContent = '';
    return;
  }

  const eskiAlis = (u) => parseFloat(u['Alis Fiyati'] || u['Alış Fiyatı'] || 0);
  const eskiSatis = (u) => parseFloat(u['Satis Fiyati'] || u['Satış Fiyatı'] || 0);

  const rows = filtrelenmis.slice(0, 200).map(u => {
    const yeniAlis = alisDeger !== '' ? tsFiyatHesapla(eskiAlis(u), alisDeger, islem) : null;
    const yeniSatis = satisDeger !== '' ? tsFiyatHesapla(eskiSatis(u), satisDeger, islem) : null;

    const alisHtml = yeniAlis !== null
      ? `<span style="color:var(--text-muted);text-decoration:line-through;">₺${eskiAlis(u)}</span> → <strong style="color:var(--color-primary);">₺${yeniAlis}</strong>`
      : `<span>₺${eskiAlis(u)}</span>`;
    const satisHtml = yeniSatis !== null
      ? `<span style="color:var(--text-muted);text-decoration:line-through;">₺${eskiSatis(u)}</span> → <strong style="color:#22c55e;">₺${yeniSatis}</strong>`
      : `<span>₺${eskiSatis(u)}</span>`;

    return `<tr>
      <td style="padding:4px 8px;font-size:0.75rem;">${u.ID || ''}</td>
      <td style="padding:4px 8px;font-size:0.75rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><strong>${u['Urun Adi'] || u['Ürün Adı'] || ''}</strong></td>
      <td style="padding:4px 8px;font-size:0.75rem;text-align:right;">${alisHtml}</td>
      <td style="padding:4px 8px;font-size:0.75rem;text-align:right;">${satisHtml}</td>
    </tr>`;
  }).join('');

  const geriKalan = filtrelenmis.length > 200 ? `<tr><td colspan="4" style="padding:4px 8px;font-size:0.75rem;color:var(--text-secondary);text-align:center;">... ve ${filtrelenmis.length - 200} ürün daha</td></tr>` : '';

  tablo.innerHTML = `<table class="data-table" style="margin:0;">
    <thead><tr><th>ID</th><th>Ürün Adı</th><th>Alış (₺)</th><th>Satış (₺)</th></tr></thead>
    <tbody>${rows}${geriKalan}</tbody>
  </table>`;

  sayac.textContent = `${filtrelenmis.length} ürün`;
}

async function topluStokFiyatOnayla() {
  const filtrelenmis = topluStokFiltrelenmisUrunleriAl();
  const islem = document.querySelector('input[name="tsFiyatIslem"]:checked').value;
  const alisDeger = document.getElementById('tsAlisFiyat').value;
  const satisDeger = document.getElementById('tsSatisFiyat').value;

  if (alisDeger === '' && satisDeger === '') {
    showToast('En az bir fiyat girmelisiniz', 'warning');
    return;
  }

  const eskiAlis = (u) => parseFloat(u['Alis Fiyati'] || u['Alış Fiyatı'] || 0);
  const eskiSatis = (u) => parseFloat(u['Satis Fiyati'] || u['Satış Fiyatı'] || 0);

  for (const item of filtrelenmis) {
    const i = item._index;
    if (alisDeger !== '') {
      const yeniAlis = tsFiyatHesapla(eskiAlis(item), alisDeger, islem);
      topluStokVerileri[i]['Alis Fiyati'] = yeniAlis;
      topluStokVerileri[i]['Alış Fiyatı'] = yeniAlis;
    }
    if (satisDeger !== '') {
      const yeniSatis = tsFiyatHesapla(eskiSatis(item), satisDeger, islem);
      topluStokVerileri[i]['Satis Fiyati'] = yeniSatis;
      topluStokVerileri[i]['Satış Fiyatı'] = yeniSatis;
    }
  }

  showToast(`${filtrelenmis.length} ürünün fiyatı güncellendi`, 'success');
  topluStokFiyatModalKapat();
  renderTopluStok();
}

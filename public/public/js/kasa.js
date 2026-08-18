let tumSiparisler = [];
let filtrelenmisSiparisler = [];

document.addEventListener('DOMContentLoaded', async () => {
  tumSiparisler = await window.api.excelRead();
  filtrelenmisSiparisler = [...tumSiparisler];
  todayDefaults();
  hesapla();
});

function todayDefaults() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('kasaTarihBitis').value = `${yyyy}-${mm}-${dd}`;
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmm = String(firstDay.getMonth() + 1).padStart(2, '0');
  const fdd = String(firstDay.getDate()).padStart(2, '0');
  document.getElementById('kasaTarihBaslangic').value = `${firstDay.getFullYear()}-${fmm}-${fdd}`;
}

function hesapla() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const gunBasi = new Date(today);
  gunBasi.setHours(0, 0, 0, 0);

  const haftaBasi = new Date(today);
  haftaBasi.setDate(today.getDate() - today.getDay());
  haftaBasi.setHours(0, 0, 0, 0);

  const ayBasi = new Date(today.getFullYear(), today.getMonth(), 1);
  ayBasi.setHours(0, 0, 0, 0);

  const gunluk = filtreSiparisler(gunBasi, today);
  const haftalik = filtreSiparisler(haftaBasi, today);
  const aylik = filtreSiparisler(ayBasi, today);

  document.getElementById('gunlukCiro').textContent = formatCurrency(toplamTutar(gunluk));
  document.getElementById('haftalikCiro').textContent = formatCurrency(toplamTutar(haftalik));
  document.getElementById('aylikCiro').textContent = formatCurrency(toplamTutar(aylik));
  document.getElementById('toplamCiro').textContent = formatCurrency(toplamTutar(filtrelenmisSiparisler));

  odemeDagitimiGoster(filtrelenmisSiparisler);
  siparisTablosuGoster(filtrelenmisSiparisler);
}

function filtreSiparisler(baslangic, bitis) {
  return filtrelenmisSiparisler.filter(s => {
    const tarih = parseDateTR(s.SIPARIS_TARIHI);
    if (!tarih) return false;
    return tarih >= baslangic && tarih <= bitis;
  });
}

function toplamTutar(siparisler) {
  return siparisler.reduce((sum, s) => sum + (parseFloat(s.TOPLAM) || 0), 0);
}

function parseDateTR(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split(/[./-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

function formatCurrency(num) {
  return parseFloat(num || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺';
}

function odemeDagitimiGoster(siparisler) {
  const container = document.getElementById('odemeDagitimi');
  const dagilim = {};

  siparisler.forEach(s => {
    let odemeler = [];
    try { odemeler = JSON.parse(s.ODEME_DETAYLARI || '[]'); } catch {}
    if (odemeler.length === 0) {
      const tip = 'Kalan';
      if (!dagilim[tip]) dagilim[tip] = { adet: 0, toplam: 0 };
      dagilim[tip].adet++;
      dagilim[tip].toplam += parseFloat(s.TOPLAM) || 0;
    } else {
      odemeler.forEach(o => {
        const tip = o.TIP || 'Kalan';
        if (!dagilim[tip]) dagilim[tip] = { adet: 0, toplam: 0 };
        dagilim[tip].adet++;
        dagilim[tip].toplam += parseFloat(o.TUTAR) || 0;
      });
    }
  });

  const renkler = {
    'Nakit': 'var(--success)',
    'Kredi Kartı': 'var(--accent)',
    'KK Taksitli': '#8b5cf6',
    'Mail Order': 'var(--warning)',
    'Havale': 'var(--info)',
    'Kalan': 'var(--text-muted)'
  };

  const iconlar = {
    'Nakit': '💵',
    'Kredi Kartı': '💳',
    'KK Taksitli': '🔄',
    'Mail Order': '📧',
    'Havale': '🏦',
    'Kalan': '❓'
  };

  const html = Object.entries(dagilim).map(([tip, veri]) => `
    <div class="card" style="text-align: center; border-top: 3px solid ${renkler[tip] || 'var(--border)'};">
      <div style="font-size: 1.5rem; margin-bottom: 4px;">${iconlar[tip] || '💰'}</div>
      <div style="font-weight: 600; margin-bottom: 2px;">${tip}</div>
      <div style="font-size: 0.8rem; color: var(--text-secondary);">${veri.adet} sipariş</div>
      <div style="font-size: 1.1rem; font-weight: 700; color: ${renkler[tip] || 'var(--text-primary)'};">₺${veri.toplam.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
    </div>
  `).join('');

  container.innerHTML = html || '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Henüz veri yok</div>';
}

function siparisTablosuGoster(siparisler) {
  const tbody = document.getElementById('kasaTableBody');
  const emptyState = document.getElementById('kasaEmptyState');
  const toplamEl = document.getElementById('kasaToplam');

  if (siparisler.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (toplamEl) toplamEl.textContent = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const rows = siparisler.map(s => `
    <tr>
      <td>${s.SIRA_NO || ''}</td>
      <td><strong>${s.AD_SOYAD || ''}</strong></td>
      <td>${s.TELEFON || ''}</td>
      <td>${s.SIPARIS_TARIHI || ''}</td>
      <td>${(() => { try { const odemeler = JSON.parse(s.ODEME_DETAYLARI || '[]'); return odemeler.map(o => o.TIP).join(', ') || ''; } catch { return ''; } })()}</td>
      <td><strong>₺${formatNumber(s.TOPLAM)}</strong></td>
      <td>₺${formatNumber(s.ALINAN)}</td>
      <td style="color: ${parseFloat(s.KALAN) > 0 ? 'var(--danger)' : 'var(--success)'}"><strong>₺${formatNumber(s.KALAN)}</strong></td>
    </tr>
  `).join('');

  tbody.innerHTML = rows;

  const toplamTutarVal = siparisler.reduce((sum, s) => sum + (parseFloat(s.TOPLAM) || 0), 0);
  const toplamAlinan = siparisler.reduce((sum, s) => sum + (parseFloat(s.ALINAN) || 0), 0);
  const toplamKalan = siparisler.reduce((sum, s) => sum + (parseFloat(s.KALAN) || 0), 0);
  if (toplamEl) {
    toplamEl.innerHTML = `Toplam: ₺${formatNumber(toplamTutarVal)} | Alınan: ₺${formatNumber(toplamAlinan)} | Kalan: ₺<span style="color: ${toplamKalan > 0 ? 'var(--danger)' : 'var(--success)'}">${formatNumber(toplamKalan)}</span>`;
  }
}

function formatNumber(num) {
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

async function filtrele() {
  const baslangic = document.getElementById('kasaTarihBaslangic').value;
  const bitis = document.getElementById('kasaTarihBitis').value;

  tumSiparisler = await window.api.excelRead();
  filtrelenmisSiparisler = tumSiparisler.filter(s => {
    const tarih = parseDateTR(s.SIPARIS_TARIHI);
    if (!tarih) return false;

    if (baslangic) {
      const basDate = new Date(baslangic);
      basDate.setHours(0, 0, 0, 0);
      if (tarih < basDate) return false;
    }
    if (bitis) {
      const bitDate = new Date(bitis);
      bitDate.setHours(23, 59, 59, 999);
      if (tarih > bitDate) return false;
    }
    return true;
  });

  hesapla();
}

async function filtreTemizle() {
  tumSiparisler = await window.api.excelRead();
  filtrelenmisSiparisler = [...tumSiparisler];
  todayDefaults();
  hesapla();
}

function excelAktar() {
  if (filtrelenmisSiparisler.length === 0) {
    showToast('Dışa aktarılacak veri yok.', 'warning');
    return;
  }
  window.api.saveFileDialog().then(filePath => {
    if (filePath) {
      const XLSX_LIB = window.XLSX;
      if (XLSX_LIB) {
        const data = filtrelenmisSiparisler.map(s => {
        let odemeOzet = '';
        try { const odemeler = JSON.parse(s.ODEME_DETAYLARI || '[]'); odemeOzet = odemeler.map(o => `${o.TIP}: ₺${o.TUTAR}`).join(', '); } catch {}
        return {
          'Sıra No': s.SIRA_NO,
          'Adı Soyadı': s.AD_SOYAD,
          'Telefon': s.TELEFON,
          'Tarih': s.SIPARIS_TARIHI,
          'Ödeme Detayları': odemeOzet,
          'Toplam': s.TOPLAM,
          'Alınan': s.ALINAN,
          'Kalan': s.KALAN
        };
      });
        const ws = XLSX_LIB.utils.json_to_sheet(data);
        const wb = XLSX_LIB.utils.book_new();
        XLSX_LIB.utils.book_append_sheet(wb, ws, 'Kasa');
        XLSX_LIB.writeFile(wb, filePath);
        showToast('Kasa raporu dışa aktarıldı.', 'success');
      }
    }
  });
}

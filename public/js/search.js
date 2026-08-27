let allOrders = [];
let filteredOrders = [];
let selectedOrders = new Set();
let selectionMode = false;

async function loadAllOrders() {
  allOrders = await readExcel();
  filteredOrders = [...allOrders];
  return filteredOrders;
}

function filterOrders() {
  const searchInput = document.getElementById('searchInput');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const filterOdeme = document.getElementById('filterOdeme');

  const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const fromDate = dateFrom ? dateFrom.value : '';
  const toDate = dateTo ? dateTo.value : '';
  const odemeFilter = filterOdeme ? filterOdeme.value : '';

  filteredOrders = allOrders.filter(order => {
    if (searchTerm) {
      const matchFields = [
        order.AD_SOYAD, order.TC_KIMLIK, order.TELEFON, order.EMAIL,
        order.ADRES, order.SIRA_NO
      ];
      if (!matchFields.some(f => f && String(f).toLowerCase().includes(searchTerm))) {
        return false;
      }
    }

    if (fromDate) {
      const orderDate = parseDate(order.SIPARIS_TARIHI);
      const filterDate = new Date(fromDate);
      if (orderDate && orderDate < filterDate) return false;
    }

    if (toDate) {
      const orderDate = parseDate(order.SIPARIS_TARIHI);
      const filterDate = new Date(toDate);
      filterDate.setHours(23, 59, 59);
      if (orderDate && orderDate > filterDate) return false;
    }

    if (odemeFilter) {
      let odemeler = [];
      try { odemeler = JSON.parse(order.ODEME_DETAYLARI || '[]'); } catch {}
      const hasMatch = odemeler.some(o => o.TIP === odemeFilter);
      if (!hasMatch) return false;
    }

    return true;
  });

  renderOrderTable();
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split(/[./-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

function clearFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';
  document.getElementById('filterOdeme').value = '';
  filteredOrders = [...allOrders];
  renderOrderTable();
}

function toggleSelectionMode() {
  selectionMode = !selectionMode;
  selectedOrders.clear();

  const toggleBtn = document.getElementById('selectionToggleBtn');
  const checkboxHeader = document.getElementById('checkboxHeader');
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  const printBtn = document.getElementById('printSelectedBtn');
  const selectAll = document.getElementById('selectAllCheckbox');

  if (selectionMode) {
    toggleBtn.classList.remove('btn-outline');
    toggleBtn.classList.add('btn-primary');
    checkboxHeader.style.display = '';
    deleteBtn.style.display = '';
    printBtn.style.display = '';
  } else {
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-outline');
    checkboxHeader.style.display = 'none';
    deleteBtn.style.display = 'none';
    printBtn.style.display = 'none';
  }

  if (selectAll) selectAll.checked = false;
  renderOrderTable();
}

function toggleOrderSelection(siraNo, checkbox) {
  if (checkbox.checked) {
    selectedOrders.add(String(siraNo));
  } else {
    selectedOrders.delete(String(siraNo));
  }
  updateDeleteButtonState();
}

function toggleAllSelections(checked) {
  selectedOrders.clear();
  if (checked) {
    filteredOrders.forEach(order => {
      if (order.SIRA_NO) selectedOrders.add(String(order.SIRA_NO));
    });
  }
  updateDeleteButtonState();
  renderOrderTable();
}

function updateDeleteButtonState() {
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  const printBtn = document.getElementById('printSelectedBtn');
  const hasSelection = selectedOrders.size > 0;
  if (deleteBtn) deleteBtn.style.display = hasSelection ? '' : 'none';
  if (printBtn) printBtn.style.display = hasSelection ? '' : 'none';
}

function renderOrderTable() {
  const tbody = document.getElementById('orderTableBody');
  const emptyState = document.getElementById('emptyState');
  const recordCount = document.getElementById('recordCount');

  if (!tbody) return;

  if (filteredOrders.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (recordCount) recordCount.textContent = 'Toplam 0 kayıt';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  const rows = filteredOrders.map(order => {
    const today = new Date();
    const teslimDate = parseDate(order.TESLIM_TARIHI);
    const isDelivered = teslimDate && teslimDate < today;
    const statusBadge = isDelivered
      ? '<span class="badge badge-delivered">✓ Teslim</span>'
      : '<span class="badge badge-pending">⏳ Bekliyor</span>';

    const checkboxCell = selectionMode
      ? `<td><input type="checkbox" ${selectedOrders.has(String(order.SIRA_NO)) ? 'checked' : ''} onclick="event.stopPropagation(); toggleOrderSelection('${order.SIRA_NO}', this)"></td>`
      : '';

    return `
      <tr onclick="${selectionMode ? '' : `showDetail('${order.SIRA_NO}')`}" data-sira="${order.SIRA_NO}" ${selectionMode ? `style="cursor: default;"` : ''}>
        ${checkboxCell}
        <td>${order.SIRA_NO || ''}</td>
        <td><strong>${order.AD_SOYAD || ''}</strong></td>
        <td>${order.TC_KIMLIK || ''}</td>
        <td>${order.TELEFON || ''}</td>
        <td>${order.SIPARIS_TARIHI || ''}</td>
        <td>${order.TESLIM_TARIHI || ''}</td>
        <td>${(() => { try { const odemeler = JSON.parse(order.ODEME_DETAYLARI || '[]'); return odemeler.map(o => o.TIP).join(', ') || ''; } catch { return ''; } })()}</td>
        <td>₺${formatNumber(order.TOPLAM)}</td>
        <td>₺${formatNumber(order.KALAN)}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editOrder('${order.SIRA_NO}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteOrderByNo('${order.SIRA_NO}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;

  if (recordCount) {
    const toplamTutar = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.TOPLAM) || 0), 0);
    const kalanTutar = filteredOrders.reduce((sum, o) => sum + (parseFloat(o.KALAN) || 0), 0);
    recordCount.textContent = `Toplam ${filteredOrders.length} kayıt | Toplam Tutar: ₺${formatNumber(toplamTutar)} | Kalan: ₺${formatNumber(kalanTutar)}`;
  }
}

function formatNumber(num) {
  const n = parseFloat(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function showDetail(siraNo) {
  const order = allOrders.find(o => String(o.SIRA_NO) === String(siraNo));
  if (!order) return;

  let secilenUrunlerHTML = '';
  try {
    const urunler = JSON.parse(order.SECILEN_URUNLER || '[]');
    if (urunler.length > 0) {
      const urunRows = urunler.map(u => {
        const satirToplam = parseFloat(u.FIYAT || 0) * (u.ADET || 1);
        const indirimTl = parseFloat(u.INDIRIM_TL || 0);
        const indirimYuzde = parseFloat(u.INDIRIM_YUZDE || 0);
        const indirimliTutar = satirToplam - indirimTl;
        return `
        <tr>
          <td><span class="badge badge-pending">${u.KATEGORI_ADI || ''}</span></td>
          <td>${u.URUN_ADI || ''}</td>
          <td>₺${parseFloat(u.FIYAT || 0).toFixed(0)}</td>
          <td>${u.ADET || 1}</td>
          <td style="text-align: right;">
            ${indirimTl > 0 ? `<span style="font-size: 0.75rem; color: var(--success);">-${indirimTl.toFixed(0)}₺ (${indirimYuzde.toFixed(1)}%)</span><br>` : ''}
            <strong style="color: ${indirimTl > 0 ? 'var(--success)' : 'var(--text-primary)'};">₺${indirimliTutar.toFixed(0)}</strong>
          </td>
        </tr>
        `;
      }).join('');
      secilenUrunlerHTML = `
        <h4 style="margin: 12px 0 8px; color: var(--accent);">🛒 Sipariş Edilen Ürünler</h4>
        <table class="eye-table" style="margin-bottom: 16px;">
          <thead><tr><th>Kategori</th><th>Ürün</th><th>Fiyat</th><th>Adet</th><th>İndirimli Tutar</th></tr></thead>
          <tbody>${urunRows}</tbody>
        </table>
      `;
    }
  } catch {}

  const content = document.getElementById('detailContent');
  content.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
      <div>
        <h4 style="margin-bottom: 12px; color: var(--accent);">👤 Müşteri Bilgileri</h4>
        <table style="width: 100%; font-size: 0.85rem;">
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">Sıra No:</td><td><strong>${order.SIRA_NO}</strong></td></tr>
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">Adı Soyadı:</td><td><strong>${order.AD_SOYAD}</strong></td></tr>
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">TC Kimlik:</td><td>${order.TC_KIMLIK}</td></tr>
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">Telefon:</td><td>${order.TELEFON}</td></tr>
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">E-Mail:</td><td>${order.EMAIL}</td></tr>
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">Sipariş Tarihi:</td><td>${order.SIPARIS_TARIHI}</td></tr>
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">Teslim Tarihi:</td><td>${order.TESLIM_TARIHI}</td></tr>
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">Adres:</td><td>${order.ADRES}</td></tr>
          <tr><td style="padding: 4px 0; color: var(--text-secondary);">Ödeme Detayları:</td><td>${(() => { try { const odemeler = JSON.parse(order.ODEME_DETAYLARI || '[]'); if (odemeler.length === 0) return 'Belirtilmemiş'; return odemeler.map(o => `<span style="display:inline-block; background:var(--accent);color:#fff;padding:2px 8px;border-radius:10px;font-size:0.75rem;margin:2px;">${o.TIP}: ₺${Number(o.TUTAR).toLocaleString('tr-TR')}</span>`).join(' '); } catch { return order.ODEME_DETAYLARI || 'Belirtilmemiş'; } })()}</td></tr>
        </table>
        ${secilenUrunlerHTML}
      </div>
      <div>
        <h4 style="margin-bottom: 12px; color: var(--accent);">👁️ DİYOPTRİ BİLGİLERİ</h4>
        <table class="eye-table" style="margin-bottom: 16px;">
          <thead>
            <tr><th></th><th>SPH</th><th>CYL</th><th>AXE</th></tr>
          </thead>
          <tbody>
            <tr>
              <td class="row-header section-header">Sğ Uzak</td>
              <td>${order.SAG_SPH_UZAK || ''}</td><td>${order.SAG_CYL_UZAK || ''}</td><td>${order.SAG_AXE_UZAK || ''}</td>
            </tr>
            <tr>
              <td class="row-header section-header">Sl Uzak</td>
              <td>${order.SOL_SPH_UZAK || ''}</td><td>${order.SOL_CYL_UZAK || ''}</td><td>${order.SOL_AXE_UZAK || ''}</td>
            </tr>
            <tr>
              <td class="row-header section-header">Sğ Yakın</td>
              <td>${order.SAG_SPH_YAKIN || ''}</td><td>${order.SAG_CYL_YAKIN || ''}</td><td>${order.SAG_AXE_YAKIN || ''}</td>
            </tr>
            <tr>
              <td class="row-header section-header">Sl Yakın</td>
              <td>${order.SOL_SPH_YAKIN || ''}</td><td>${order.SOL_CYL_YAKIN || ''}</td><td>${order.SOL_AXE_YAKIN || ''}</td>
            </tr>
          </tbody>
        </table>
        <h4 style="margin-bottom: 8px; color: var(--accent);">📏 Ölçü Değerleri</h4>
        <table class="eye-table" style="margin-bottom: 16px;">
          <thead>
            <tr><th></th><th>Uzak Sağ</th><th>Uzak Sol</th><th>Yakın Sağ</th><th>Yakın Sol</th></tr>
          </thead>
          <tbody>
            <tr><td class="row-header">P.D.</td><td>${order.PD_SAG_UZAK || ''}</td><td>${order.PD_SOL_UZAK || ''}</td><td>${order.PD_SAG_YAKIN || ''}</td><td>${order.PD_SOL_YAKIN || ''}</td></tr>
            <tr><td class="row-header">Yükseklik</td><td>${order.YUKSEKLIK_SAG_UZAK || ''}</td><td>${order.YUKSEKLIK_SOL_UZAK || ''}</td><td>${order.YUKSEKLIK_SAG_YAKIN || ''}</td><td>${order.YUKSEKLIK_SOL_YAKIN || ''}</td></tr>
            <tr><td class="row-header">Çap</td><td>${order.CAP_SAG_UZAK || ''}</td><td>${order.CAP_SOL_UZAK || ''}</td><td>${order.CAP_SAG_YAKIN || ''}</td><td>${order.CAP_SOL_YAKIN || ''}</td></tr>
          </tbody>
        </table>
        <h4 style="margin-bottom: 8px; color: var(--accent);">💰 Ödeme Özeti</h4>
        <table style="width: 100%; font-size: 0.85rem;">
          ${order.INDIRIM && parseFloat(order.INDIRIM) > 0 ? `<tr><td style="padding: 4px 0;">İndirim:</td><td style="color: var(--success);">-₺${formatNumber(order.INDIRIM)} ${order.INDIRIM_NOTU ? `(${order.INDIRIM_NOTU})` : ''}</td></tr>` : ''}
          <tr><td style="padding: 4px 0;">Toplam:</td><td><strong>₺${formatNumber(order.TOPLAM)}</strong></td></tr>
          <tr><td style="padding: 4px 0;">Alınan:</td><td>₺${formatNumber(order.ALINAN)}</td></tr>
          <tr><td style="padding: 4px 0;">Kalan:</td><td style="color: ${parseFloat(order.KALAN) > 0 ? 'var(--danger)' : 'var(--success)'}"><strong>₺${formatNumber(order.KALAN)}</strong></td></tr>
        </table>
        ${order.SIPARIS_DETAYLARI ? `
          <h4 style="margin: 12px 0 8px; color: var(--accent);">📝 Sipariş Detayları</h4>
          <p>${order.SIPARIS_DETAYLARI}</p>
        ` : ''}
      </div>
    </div>
  `;

  document.getElementById('detailModal').classList.add('active');
  document.getElementById('detailModal').dataset.siraNo = siraNo;
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('active');
}

function editOrderFromDetail() {
  const siraNo = document.getElementById('detailModal').dataset.siraNo;
  if (siraNo) editOrder(siraNo);
}

async function deleteOrderFromDetail() {
  const siraNo = document.getElementById('detailModal').dataset.siraNo;
  if (siraNo) {
    await deleteOrderByNo(siraNo);
    closeDetailModal();
  }
}

let currentDetailSiraNo = null;

function editOrder(siraNo) {
  const order = allOrders.find(o => String(o.SIRA_NO) === String(siraNo));
  if (!order) return;

  sessionStorage.setItem('editOrder', JSON.stringify(order));
  window.location.href = 'index.html';
}

async function deleteOrderByNo(siraNo) {
  if (!(await showConfirm(`${siraNo} nolu siparişi silmek istediğinizden emin misiniz?`, 'Sipariş Silme'))) return;

  const result = await deleteOrderFromExcel(siraNo);
  if (result) {
    showToast('Sipariş başarıyla silindi.', 'success');
    await loadOrders();
  } else {
    showToast('Silme hatası!', 'error');
  }
}

async function deleteSelected() {
  if (selectedOrders.size === 0) {
    showToast('Önce kayıt seçin.', 'warning');
    return;
  }
  if (!(await showConfirm(`${selectedOrders.size} adet siparişi silmek istediğinizden emin misiniz?`, 'Toplu Sipariş Silme'))) return;

  let successCount = 0;
  const toDelete = [...selectedOrders];
  let completed = 0;

  for (const siraNo of toDelete) {
    deleteOrderFromExcel(siraNo).then(ok => {
      if (ok) successCount++;
      completed++;
      if (completed === toDelete.length) {
        showToast(`${successCount} sipariş silindi.`, 'success');
        selectedOrders.clear();
        const selectAll = document.getElementById('selectAllCheckbox');
        if (selectAll) selectAll.checked = false;
        updateDeleteButtonState();
        loadOrders();
      }
    });
  }
}

async function loadOrders() {
  await loadAllOrders();
  renderOrderTable();
}

function printDetail() {
  const detailContent = document.getElementById('detailContent');
  if (!detailContent) { window.print(); return; }

  const printWindow = window.open('', '_blank', 'width=1000,height=700');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Sipariş Detayı - Yazdır</title>
      <link rel="stylesheet" href="styles/main.css">
      <style>
        @page { size: A4 landscape; margin: 4mm; }
        body { font-size: 9px; line-height: 1.2; margin: 0; padding: 8px; background: white; }
        .header, .nav, .action-bar, .btn, .toast, .modal-overlay,
        .theme-toggle, .search-panel, .table-container { display: none !important; }
        .container { padding: 0 !important; max-width: 100% !important; }
        .card { box-shadow: none !important; border: 1px solid #ccc !important; padding: 3px 5px !important; margin-bottom: 3px !important; }
        .card-header { margin-bottom: 2px !important; padding-bottom: 2px !important; }
        .card-title { font-size: 9px !important; }
        .eye-table { font-size: 8px !important; }
        .eye-table th, .eye-table td { padding: 1px 2px !important; font-size: 7px !important; }
        .eye-table .row-header { font-size: 7px !important; min-width: 40px !important; }
        .badge { font-size: 6px !important; padding: 1px 3px !important; }
        table { font-size: 8px !important; }
        table td { padding: 2px 4px !important; }
        h4 { font-size: 9px !important; margin: 4px 0 3px !important; }
        p { font-size: 8px !important; margin: 2px 0 !important; }
      </style>
    </head>
    <body>
      ${detailContent.innerHTML}
      <script>window.onload=function(){window.print();window.close();}<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

async function exportFilteredToExcel() {
  if (filteredOrders.length === 0) {
    showToast('Dışa aktarılacak kayıt yok.', 'warning');
    return;
  }

  const filePath = await window.api.saveFileDialog();
  if (filePath) {
    const XLSX_LIB = window.XLSX;
    if (XLSX_LIB) {
      const worksheet = XLSX_LIB.utils.json_to_sheet(filteredOrders);
      const workbook = XLSX_LIB.utils.book_new();
      XLSX_LIB.utils.book_append_sheet(workbook, worksheet, 'Siparişler');
      XLSX_LIB.writeFile(workbook, filePath);
      showToast(`${filteredOrders.length} kayıt dışa aktarıldı.`, 'success');
    }
  }
}

function printSelectedPreview() {
  if (selectedOrders.size === 0) {
    showToast('Önce kayıt seçin.', 'warning');
    return;
  }

  const secilenSiparisler = allOrders.filter(o => selectedOrders.has(String(o.SIRA_NO)));
  if (secilenSiparisler.length === 0) {
    showToast('Seçili sipariş bulunamadı.', 'warning');
    return;
  }

  const content = document.getElementById('printPreviewContent');
  content.innerHTML = secilenSiparisler.map(order => {
    let urunlerHTML = '';
    try {
      const urunler = JSON.parse(order.SECILEN_URUNLER || '[]');
      if (urunler.length > 0) {
        urunlerHTML = `
          <table class="eye-table" style="margin-top: 6px; font-size: 0.75rem;">
            <thead><tr><th>Ürün</th><th>Adet</th><th>Fiyat</th></tr></thead>
            <tbody>${urunler.map(u => `<tr><td>${u.URUN_ADI || ''}</td><td>${u.ADET || 1}</td><td>₺${parseFloat(u.FIYAT || 0).toFixed(0)}</td></tr>`).join('')}</tbody>
          </table>
        `;
      }
    } catch {}

    let odemelerHTML = '';
    try {
      const odemeler = JSON.parse(order.ODEME_DETAYLARI || '[]');
      if (odemeler.length > 0) {
        odemelerHTML = odemeler.map(o => `<span style="display:inline-block; background:var(--accent);color:#fff;padding:2px 6px;border-radius:8px;font-size:0.7rem;margin:2px;">${o.TIP}: ₺${Number(o.TUTAR).toLocaleString('tr-TR')}</span>`).join(' ');
      }
    } catch {}

    return `
      <div style="padding: 12px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-secondary);">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <strong style="color: var(--accent);">Sıra No: ${order.SIRA_NO}</strong>
          <span style="color: var(--text-muted); font-size: 0.75rem;">${order.SIPARIS_TARIHI || ''}</span>
        </div>
        <div style="font-size: 0.85rem; margin-bottom: 4px;"><strong>${order.AD_SOYAD || ''}</strong> - ${order.TELEFON || ''}</div>
        ${urunlerHTML}
        <div style="margin-top: 6px; font-size: 0.8rem;">
          <span style="color: var(--text-secondary);">Toplam:</span> <strong>₺${formatNumber(order.TOPLAM)}</strong>
          ${parseFloat(order.KALAN) > 0 ? `<span style="margin-left: 8px; color: var(--danger); font-weight: 600;">Kalan: ₺${formatNumber(order.KALAN)}</span>` : ''}
          ${odemelerHTML ? `<span style="margin-left: 8px;">${odemelerHTML}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('printPreviewModal').classList.add('active');
}

function closePrintPreview() {
  document.getElementById('printPreviewModal').classList.remove('active');
}

function confirmPrint() {
  const secilenSiparisler = allOrders.filter(o => selectedOrders.has(String(o.SIRA_NO)));
  if (secilenSiparisler.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=1000,height=700');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Sipariş Listesi - Yazdır</title>
      <link rel="stylesheet" href="styles/main.css">
      <style>
        @page { size: A4 landscape; margin: 4mm; }
        body { font-size: 9px; line-height: 1.2; margin: 0; padding: 8px; background: white; }
        .header, .nav, .action-bar, .btn, .toast, .modal-overlay,
        .theme-toggle, .search-panel, .table-container, .empty-state { display: none !important; }
        .container { padding: 0 !important; max-width: 100% !important; }
        .card { box-shadow: none !important; border: 1px solid #ccc !important; padding: 3px 5px !important; margin-bottom: 3px !important; }
        .card-header { margin-bottom: 2px !important; padding-bottom: 2px !important; }
        .card-title { font-size: 9px !important; }
        .eye-table { font-size: 8px !important; }
        .eye-table th, .eye-table td { padding: 1px 2px !important; font-size: 7px !important; }
        table { font-size: 8px !important; }
        table td { padding: 2px 4px !important; }
        h4 { font-size: 9px !important; margin: 4px 0 3px !important; }
      </style>
    </head>
    <body>
      <h3 style="margin-bottom: 8px;">Sipariş Listesi (${secilenSiparisler.length} kayıt)</h3>
      ${secilenSiparisler.map(order => {
        let urunOzeti = '';
        try {
          const urunler = JSON.parse(order.SECILEN_URUNLER || '[]');
          if (urunler.length > 0) urunOzeti = urunler.map(u => `${u.URUN_ADI} (x${u.ADET})`).join(', ');
        } catch {}
        return `
          <div style="padding: 4px 0; border-bottom: 1px solid #ddd; font-size: 8px;">
            <strong>${order.SIRA_NO}</strong> - ${order.AD_SOYAD || ''} - ${order.TELEFON || ''} - ${order.SIPARIS_TARIHI || ''} - ₺${formatNumber(order.TOPLAM)}
            ${parseFloat(order.KALAN) > 0 ? ` <span style="color:red; font-weight:600;">Kalan: ₺${formatNumber(order.KALAN)}</span>` : ''}
            ${urunOzeti ? `<br><span style="color:#666;">Ürünler: ${urunOzeti}</span>` : ''}
          </div>
        `;
      }).join('')}
      <script>window.onload=function(){window.print();window.close();}<\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
  closePrintPreview();
}

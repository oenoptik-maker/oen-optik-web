(function() {
  if (document.getElementById('oen-utss-btn')) return;
  var isUtsPage = location.href.includes('utsuygulama.saglik.gov.tr');

  var btnStyle = 'padding:14px 24px;border-radius:12px;font-size:15px;font-weight:bold;cursor:pointer;font-family:Arial,sans-serif;user-select:none;border:none;color:#fff;';

  var container = document.createElement('div');
  container.id = 'oen-utss-btn';
  container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;display:flex;gap:10px;align-items:center;';

  var btn = document.createElement('div');
  btn.textContent = 'ÜRÜNLERİ ÇEK';
  btn.style.cssText = btnStyle + 'background:linear-gradient(135deg,#00b894,#00cec9);box-shadow:0 4px 20px rgba(0,206,201,0.5);';

  var btnExcel = document.createElement('div');
  btnExcel.textContent = 'EXCELE AKTAR';
  btnExcel.style.cssText = btnStyle + 'background:linear-gradient(135deg,#217346,#33a867);box-shadow:0 4px 20px rgba(33,168,103,0.5);';

  container.appendChild(btn);
  container.appendChild(btnExcel);

  var durum = document.createElement('div');
  durum.id = 'oen-utss-durum';
  durum.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:999999;background:#1a1a2e;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-family:Arial,sans-serif;display:none;max-width:300px;box-shadow:0 2px 10px rgba(0,0,0,0.3);';

  function showDurum(msg, type) {
    durum.textContent = msg;
    durum.style.display = 'block';
    durum.style.background = type === 'ok' ? '#065f46' : type === 'err' ? '#7f1d1d' : '#1a1a2e';
    if (type) setTimeout(function() { durum.style.display = 'none'; }, 5000);
  }

  function aktarUrunleri() {
    var rows = document.querySelectorAll('table tbody tr');
    var secili = [];
    rows.forEach(function(row) {
      var cb = row.querySelector('input[type=checkbox]:checked');
      if (cb) {
        var cells = row.querySelectorAll('td');
        secili.push({
          urunNo: (cells[1] && cells[1].innerText || '').trim(),
          kurumKodu: (cells[2] && cells[2].innerText || '').trim(),
          bildirimKodu: (cells[3] && cells[3].innerText || '').trim(),
          lotBatch: (cells[4] && cells[4].innerText || '').trim(),
          seriNo: (cells[5] && cells[5].innerText || '').trim(),
          urunTanimi: (cells[6] && cells[6].innerText || '').trim(),
          gonderenKurum: (cells[7] && cells[7].innerText || '').trim(),
          adet: (cells[8] && cells[8].innerText || '').trim() || '1'
        });
      }
    });
    if (secili.length === 0) { showDurum('Isaretli urun bulunamadi!', 'err'); return; }
    showDurum(secili.length + ' urun aktariliyor...', '');
    try {
      chrome.storage.local.set({ utsAktarim: { urunler: secili, timestamp: Date.now() } }, function() {
        if (chrome.runtime.lastError) { showDurum('Hata: ' + chrome.runtime.lastError.message, 'err'); }
        else { showDurum(secili.length + ' urun aktarildi!', 'ok'); }
      });
    } catch(e) { showDurum('Hata: ' + e.message, 'err'); }
  }

  function exceleAktar() {
    var rows = document.querySelectorAll('table tbody tr');
    if (rows.length === 0) { showDurum('Tabloda urun bulunamadi!', 'err'); return; }

    showDurum(rows.length + ' urun hazirlaniyor...', '');

    var headerCells = document.querySelectorAll('table thead th');
    var headers = [];
    headerCells.forEach(function(th) {
      var txt = th.innerText.replace(/[↑↓]/g, '').trim();
      if (txt) headers.push(txt);
    });
    if (headers.length === 0) {
      headers = ['Ürün Numarası','Seri/Sıra Numarası','Lot/Batch Numarası','Eşsiz Kimlik','Ürün Tanımı','Üretim Tarihi','Son Kullanma Tarihi','Adet','Kullanılabilir Adet'];
    }

    var firstRowCells = rows[0].querySelectorAll('td');
    var offset = firstRowCells.length - headerCells.length;
    if (offset < 0) offset = 0;

    function esc(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    var h = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    h += '<head><meta charset="UTF-8">';
    h += '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>';
    h += '<x:Name>TEKIL URUNLER</x:Name>';
    h += '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>';
    h += '</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->';
    h += '<style>td,th{mso-number-format:"\\@";}</style>';
    h += '</head><body><table border="1" cellpadding="3" cellspacing="0">';

    h += '<tr>';
    headers.forEach(function(hdr) {
      h += '<th style="background:#217346;color:#fff;font-weight:bold;font-family:Arial;font-size:11px;">' + esc(hdr) + '</th>';
    });
    h += '</tr>';

    rows.forEach(function(row) {
      var cells = row.querySelectorAll('td');
      h += '<tr>';
      for (var i = 0; i < headers.length; i++) {
        var cellIdx = offset + i;
        var val = '';
        if (cells[cellIdx]) val = cells[cellIdx].innerText.trim();
        h += '<td style="font-family:Arial;font-size:10px;mso-number-format:\\@;">' + esc(val) + '</td>';
      }
      h += '</tr>';
    });

    h += '</table></body></html>';

    var htmlBlob = new Blob(['\ufeff' + h], { type: 'application/vnd.ms-excel;charset=utf-8' });
    var url = URL.createObjectURL(htmlBlob);

    var a = document.createElement('a');
    a.href = url;
    a.download = 'TEKIL URUNLER.xls';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showDurum(rows.length + ' urun Excel olarak indirildi!', 'ok');
    setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
  }

  btn.addEventListener('click', aktarUrunleri);
  btnExcel.addEventListener('click', exceleAktar);
  document.body.appendChild(container);
  document.body.appendChild(durum);

  if (isUtsPage) {
    chrome.storage.local.get('autoExtract', function(data) {
      if (!data || !data.autoExtract) return;
      chrome.storage.local.remove('autoExtract');
      showDurum('Otomatik urun cekiliyor...', '');
      var bekleme = setInterval(function() {
        var rows = document.querySelectorAll('table tbody tr');
        if (rows.length > 0) {
          clearInterval(bekleme);
          rows.forEach(function(row) {
            var cb = row.querySelector('input[type=checkbox]');
            if (cb && !cb.checked) cb.click();
          });
          showDurum(rows.length + ' urun isaretlendi, aktariliyor...', '');
          setTimeout(aktarUrunleri, 1500);
        }
      }, 500);
      setTimeout(function() { clearInterval(bekleme); }, 15000);
    });
  }
})();
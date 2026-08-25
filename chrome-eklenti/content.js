(function() {
  if (document.getElementById('oen-utss-btn')) return;
  var isUtsPage = location.href.includes('utsuygulama.saglik.gov.tr');

  var btn = document.createElement('div');
  btn.id = 'oen-utss-btn';
  btn.textContent = 'OEN Optike Aktar';
  btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:999999;background:linear-gradient(135deg,#00b894,#00cec9);color:#fff;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:bold;cursor:pointer;box-shadow:0 4px 20px rgba(0,206,201,0.5);font-family:Arial,sans-serif;user-select:none;';

  var durum = document.createElement('div');
  durum.id = 'oen-utss-durum';
  durum.style.cssText = 'position:fixed;bottom:70px;right:20px;z-index:999999;background:#1a1a2e;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-family:Arial,sans-serif;display:none;max-width:300px;box-shadow:0 2px 10px rgba(0,0,0,0.3);';

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

  btn.addEventListener('click', aktarUrunleri);
  document.body.appendChild(btn);
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
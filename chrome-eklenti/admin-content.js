(function() {
  console.log('[OEN] admin-content.js yuklendi, sayfa:', location.href);

  var sonUtsCheck = '';

  // Background'tan gelen veriyi sayfaya ilet
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes.utsAktarim) {
      var urunler = changes.utsAktarim.newValue && changes.utsAktarim.newValue.urunler;
      if (urunler && urunler.length > 0) {
        console.log('[OEN] UTS verisi geldi:', urunler.length, 'urun');
        document.documentElement.setAttribute('data-uts-result', JSON.stringify(urunler));
      }
    }
  });

  // Sayfadaki istegi background'a ilet
  function checkUtsRequest() {
    try {
      var attr = document.documentElement.getAttribute('data-uts-request');
      if (!attr || attr === sonUtsCheck) return;
      sonUtsCheck = attr;

      var gkk = parseInt(attr.split('_')[0]);
      if (!gkk) return;

      console.log('[OEN] UTS istegi alindi, GKK:', gkk);
      chrome.runtime.sendMessage({ type: 'UTS_BEKLEYENLERI_CEK', gkk: gkk }, function(resp) {
        if (chrome.runtime.lastError) {
          console.error('[OEN] Background hatasi:', chrome.runtime.lastError.message);
          document.documentElement.setAttribute('data-uts-result', JSON.stringify({ error: chrome.runtime.lastError.message }));
          return;
        }
        console.log('[OEN] Background yaniti:', resp);
        if (resp && resp.ok && resp.data) {
          chrome.storage.local.set({ utsAktarim: { urunler: resp.data, timestamp: Date.now() } });
        } else {
          document.documentElement.setAttribute('data-uts-result', JSON.stringify({ error: resp ? resp.error : 'Bilinmeyen hata' }));
        }
      });
    } catch(e) {
      console.error('[OEN] checkUtsRequest hata:', e);
    }
  }

  setInterval(checkUtsRequest, 500);
})();

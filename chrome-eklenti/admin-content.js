(function() {
  console.log('[OEN] admin-content.js v2 yuklendi:', location.href);

  // Background'tan gelen veriyi localStorage'a yaz
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes.utsAktarim) {
      var val = changes.utsAktarim.newValue;
      if (val && val.urunler && val.urunler.length > 0) {
        console.log('[OEN] UTS verisi localStorage\'a yaziliyor:', val.urunler.length);
        try { localStorage.setItem('utsAktarim', JSON.stringify(val)); } catch(e) {}
        document.documentElement.setAttribute('data-uts-result', JSON.stringify(val.urunler));
      }
    }
  });

  // Sayfadaki istegi background'a ilet
  function checkRequest() {
    try {
      var attr = document.documentElement.getAttribute('data-uts-request');
      if (!attr) return;
      if (checkRequest._last === attr) return;
      checkRequest._last = attr;

      var gkk = parseInt(attr.split('_')[0]);
      if (!gkk) return;

      console.log('[OEN] UTS istegi:', gkk);
      chrome.runtime.sendMessage({ type: 'UTS_BEKLEYENLERI_CEK', gkk: gkk }, function(resp) {
        if (chrome.runtime.lastError) {
          console.error('[OEN] hata:', chrome.runtime.lastError.message);
          document.documentElement.setAttribute('data-uts-result', JSON.stringify({ error: chrome.runtime.lastError.message }));
          return;
        }
        console.log('[OEN] yanit:', resp);
        if (resp && resp.ok && resp.data) {
          chrome.storage.local.set({ utsAktarim: { urunler: resp.data, timestamp: Date.now() } });
        } else {
          document.documentElement.setAttribute('data-uts-result', JSON.stringify({ error: resp ? resp.error : 'Bilinmeyen' }));
        }
      });
    } catch(e) { console.error('[OEN]', e); }
  }

  setInterval(checkRequest, 500);
})();

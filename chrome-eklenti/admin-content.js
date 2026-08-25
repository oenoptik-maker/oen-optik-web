(function() {
  console.log('[OEN] admin-content.js v10 yuklendi:', location.href);

  // Token'i DOM'dan oku ve chrome.storage'a kaydet
  function getToken() {
    return document.documentElement.getAttribute('data-uts-token') || '';
  }

  // Background'tan gelen veriyi sayfaya ilet
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes.utsAktarim) {
      var val = changes.utsAktarim.newValue;
      if (val && val.urunler && val.urunler.length > 0) {
        console.log('[OEN] UTS verisi geldi:', val.urunler.length);
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

      var parts = attr.split('_');
      var gkk = parseInt(parts[0]);
      if (!gkk) return;

      // Token'i al ve storage'a kaydet
      var token = getToken();
      if (token) {
        chrome.storage.local.set({ utsToken: token });
      }

      console.log('[OEN] UTS istegi:', gkk, 'token:', token ? 'var' : 'yok');
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

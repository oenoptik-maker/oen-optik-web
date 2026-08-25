(function() {
  console.log('[OEN] admin-content.js v12 yuklendi:', location.href);

  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes.utsAktarim) {
      var val = changes.utsAktarim.newValue;
      if (val && val.urunler && val.urunler.length > 0) {
        console.log('[OEN] UTS verisi geldi:', val.urunler.length);
        document.documentElement.setAttribute('data-uts-result', JSON.stringify(val.urunler));
      }
    }
  });

  setInterval(function() {
    var attr = document.documentElement.getAttribute('data-uts-auto-extract');
    if (attr) {
      document.documentElement.removeAttribute('data-uts-auto-extract');
      console.log('[OEN] autoExtract tetiklendi');
      chrome.storage.local.set({ autoExtract: true });
    }
  }, 300);

  function checkRequest() {
    try {
      var attr = document.documentElement.getAttribute('data-uts-request');
      if (!attr) return;
      if (checkRequest._last === attr) return;
      checkRequest._last = attr;

      var parts = attr.split('_');
      var gkk = parseInt(parts[0]);
      if (!gkk) return;

      var token = document.documentElement.getAttribute('data-uts-token') || '';
      console.log('[OEN] UTS istegi:', gkk, 'token:', token ? token.substring(0, 10) + '...' : 'YOK');

      chrome.storage.local.set({ utsToken: token }, function() {
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
      });
    } catch(e) { console.error('[OEN]', e); }
  }

  setInterval(checkRequest, 500);
})();

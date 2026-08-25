(function() {
  var sonCheck = 0;
  var sonUtsCheck = '';

  function checkUtsData() {
    try {
      if (!chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get('utsAktarim', function(data) {
        if (chrome.runtime.lastError) return;
        if (!data || !data.utsAktarim) return;
        if (data.utsAktarim.timestamp <= sonCheck) return;
        sonCheck = data.utsAktarim.timestamp;

        var urunler = data.utsAktarim.urunler;
        if (!urunler || urunler.length === 0) return;

        document.documentElement.setAttribute('data-uts-result', JSON.stringify(urunler));
        document.dispatchEvent(new CustomEvent('utsTransfer', { detail: urunler }));
      });
    } catch(e) {}
  }

  function checkUtsRequest() {
    try {
      var attr = document.documentElement.getAttribute('data-uts-request');
      if (!attr) return;
      if (attr === sonUtsCheck) return;
      sonUtsCheck = attr;

      var parts = attr.split('_');
      var gkk = parseInt(parts[0]);
      if (!gkk) return;

      chrome.runtime.sendMessage(
        { type: 'UTS_BEKLEYENLERI_CEK', gkk: gkk },
        function(resp) {
          if (chrome.runtime.lastError) {
            document.documentElement.setAttribute('data-uts-result', JSON.stringify({ error: chrome.runtime.lastError.message }));
            return;
          }
          if (resp && resp.ok && resp.data) {
            chrome.storage.local.set({
              utsAktarim: { urunler: resp.data, timestamp: Date.now() }
            });
          } else {
            document.documentElement.setAttribute('data-uts-result', JSON.stringify({ error: resp ? resp.error : 'Bilinmeyen hata' }));
          }
        }
      );
    } catch(e) {}
  }

  setTimeout(checkUtsData, 500);
  setInterval(checkUtsData, 1500);
  setTimeout(checkUtsRequest, 500);
  setInterval(checkUtsRequest, 1000);
})();

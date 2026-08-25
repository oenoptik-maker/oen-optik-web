(function() {
  var sonCheck = 0;
  var sonUtsCheck = 0;

  // UTS verilerini sayfaya aktar
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

        var script = document.createElement('script');
        script.textContent = '(' + function(urunler) {
          if (typeof utsVeriAktar === 'function') {
            utsVeriAktar(urunler);
          } else if (typeof utsBekleyenUrunleriGoster === 'function' && typeof adminTabAc === 'function') {
            adminTabAc('uts');
            setTimeout(function() {
              window.utsBekleyenUrunler = urunler;
              utsBekleyenUrunleriGoster(urunler);
              if (typeof showToast === 'function') showToast(urunler.length + ' UTS urunu aktarildi!', 'success');
            }, 300);
          }
        }.toString() + ')(' + JSON.stringify(urunler) + ')';
        document.head.appendChild(script);
        script.remove();
      });
    } catch(e) {}
  }

  // Sayfadaki uts-request attribute'unu kontrol et
  function checkUtsRequest() {
    try {
      var attr = document.documentElement.getAttribute('data-uts-request');
      if (!attr) return;
      if (attr === sonUtsCheck) return;
      sonUtsCheck = attr;

      var gkk = parseInt(attr);
      if (!gkk) return;

      // Background'a UTS verisi cekmesini soyle
      chrome.runtime.sendMessage(
        { type: 'UTS_BEKLEYENLERI_CEK', gkk: gkk },
        function(resp) {
          if (chrome.runtime.lastError) return;
          if (resp && resp.ok && resp.data) {
            // Sonucu storage'a kaydet (checkUtsData bunu alacak)
            chrome.storage.local.set({
              utsAktarim: {
                urunler: resp.data,
                timestamp: Date.now()
              }
            });
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

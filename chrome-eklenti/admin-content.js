(function() {
  var sonCheck = 0;

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
              if (typeof showToast === 'function') showToast(urunler.length + ' ürün aktarıldı!', 'success');
            }, 300);
          }
        }.toString() + ')(' + JSON.stringify(urunler) + ')';
        document.head.appendChild(script);
        script.remove();
      });
    } catch(e) {
      console.error('UTS admin-content hata:', e);
    }
  }

  setTimeout(checkUtsData, 1000);
  setInterval(checkUtsData, 2000);
})();

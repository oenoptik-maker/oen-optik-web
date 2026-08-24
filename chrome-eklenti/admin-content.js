(function() {
  let sonCheck = 0;

  function checkUtsData() {
    chrome.storage.local.get('utsAktarim', (data) => {
      if (!data.utsAktarim) return;
      if (data.utsAktarim.timestamp <= sonCheck) return;
      sonCheck = data.utsAktarim.timestamp;

      const urunler = data.utsAktarim.urunler;
      if (!urunler || urunler.length === 0) return;

      function tryAktar() {
        if (typeof window.adminTabAc === 'function' && typeof window.utsBekleyenUrunleriGoster === 'function') {
          window.adminTabAc('uts');
          setTimeout(() => {
            window.utsBekleyenUrunler = urunler;
            window.utsBekleyenUrunleriGoster(urunler);
            if (typeof window.showToast === 'function') {
              window.showToast(urunler.length + ' ürün UTS sayfasından aktarıldı!', 'success');
            }
          }, 300);
          return true;
        }
        return false;
      }

      if (!tryAktar()) {
        const interval = setInterval(() => {
          if (tryAktar()) clearInterval(interval);
        }, 200);
        setTimeout(() => clearInterval(interval), 10000);
      }
    });
  }

  checkUtsData();
  setInterval(checkUtsData, 2000);
})();

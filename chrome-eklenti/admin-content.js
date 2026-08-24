(function() {
  let sonCheck = 0;

  function checkUtsData() {
    try {
      chrome.storage.local.get('utsAktarim', (data) => {
        if (!data || !data.utsAktarim) return;
        if (data.utsAktarim.timestamp <= sonCheck) return;
        sonCheck = data.utsAktarim.timestamp;

        const urunler = data.utsAktarim.urunler;
        if (!urunler || urunler.length === 0) return;

        if (typeof utsVeriAktar === 'function') {
          utsVeriAktar(urunler);
          return;
        }

        window.utsVeriAktar = null;
        const checkFunc = setInterval(() => {
          if (typeof utsVeriAktar === 'function') {
            clearInterval(checkFunc);
            utsVeriAktar(urunler);
          }
        }, 200);
        setTimeout(() => clearInterval(checkFunc), 10000);
      });
    } catch(e) {}
  }

  setTimeout(checkUtsData, 1000);
  setInterval(checkUtsData, 2000);
})();

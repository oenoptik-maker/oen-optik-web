(function() {
  let sonCheck = 0;

  function checkUtsData() {
    try {
      if (!chrome.storage || !chrome.storage.local) return;
      chrome.storage.local.get('utsAktarim', (data) => {
        if (chrome.runtime.lastError) return;
        if (!data || !data.utsAktarim) return;
        if (data.utsAktarim.timestamp <= sonCheck) return;
        sonCheck = data.utsAktarim.timestamp;

        const urunler = data.utsAktarim.urunler;
        if (!urunler || urunler.length === 0) return;

        function tryAktar() {
          if (typeof utsVeriAktar === 'function') {
            utsVeriAktar(urunler);
            return true;
          }
          return false;
        }

        if (tryAktar()) return;

        const checkFunc = setInterval(() => {
          if (tryAktar()) clearInterval(checkFunc);
        }, 200);
        setTimeout(() => clearInterval(checkFunc), 10000);
      });
    } catch(e) {}
  }

  setTimeout(checkUtsData, 1000);
  setInterval(checkUtsData, 2000);
})();

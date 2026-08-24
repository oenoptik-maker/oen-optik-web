(function() {
  let sonCheck = 0;

  function checkUtsData() {
    chrome.storage.local.get('utsAktarim', (data) => {
      if (!data.utsAktarim) return;
      if (data.utsAktarim.timestamp <= sonCheck) return;
      sonCheck = data.utsAktarim.timestamp;

      const urunler = data.utsAktarim.urunler;
      if (!urunler || urunler.length === 0) return;

      window.postMessage({ type: 'UTS_URUNLER_AKTAR', urunler: urunler }, '*');
    });
  }

  checkUtsData();
  setInterval(checkUtsData, 2000);
})();

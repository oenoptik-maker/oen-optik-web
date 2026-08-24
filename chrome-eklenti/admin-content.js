(function() {
  let sonCheck = 0;

  function checkUtsData() {
    chrome.storage.local.get('utsAktarim', (data) => {
      if (!data.utsAktarim) return;
      if (data.utsAktarim.timestamp <= sonCheck) return;
      sonCheck = data.utsAktarim.timestamp;

      const urunler = data.utsAktarim.urunler;
      if (!urunler || urunler.length === 0) return;

      const textarea = document.getElementById('utsYapistirmaAlani');
      if (textarea) {
        textarea.value = JSON.stringify(urunler);
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  checkUtsData();
  setInterval(checkUtsData, 2000);
})();

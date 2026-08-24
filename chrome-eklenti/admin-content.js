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

        const ta = document.getElementById('utsYapistirmaAlani');
        if (ta) {
          ta.value = JSON.stringify(urunler);
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    } catch(e) {}
  }

  setTimeout(checkUtsData, 500);
  setInterval(checkUtsData, 2000);
})();

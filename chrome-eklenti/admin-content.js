(function() {
  var sonCheck = 0;
  var bekleyenPromiseler = [];

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

  function bekleyenleriCek(gkk) {
    return new Promise(function(resolve, reject) {
      chrome.runtime.sendMessage(
        { type: 'UTS_BEKLEYENLERI_CEK', gkk: gkk },
        function(resp) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(resp);
        }
      );
    });
  }

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'UTS_BEKLEYENLERI_CEK') {
      var gkk = e.data.gkk;
      bekleyenleriCek(gkk).then(function(resp) {
        window.postMessage({ type: 'UTS_BEKLEYENLERI_SONUC', success: true, data: resp }, '*');
      }).catch(function(err) {
        window.postMessage({ type: 'UTS_BEKLEYENLERI_SONUC', success: false, error: err.message }, '*');
      });
    }
  });

  setTimeout(checkUtsData, 1000);
  setInterval(checkUtsData, 2000);
})();

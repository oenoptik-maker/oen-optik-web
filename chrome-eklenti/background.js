chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AKTAR_UTS') {
    chrome.storage.local.set({
      utsAktarim: {
        urunler: msg.urunler,
        timestamp: Date.now()
      }
    }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'UTS_BEKLEYENLERI_CEK') {
    const gkk = msg.gkk;
    if (!gkk) {
      sendResponse({ ok: false, error: 'GKK eksik' });
      return;
    }

    chrome.storage.local.get('utsToken', async function(tokenData) {
      const token = tokenData.utsToken;
      if (!token) {
        sendResponse({ ok: false, error: 'Token bulunamadi' });
        return;
      }

      try {
        const resp = await fetch('https://utsuygulama.saglik.gov.tr/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula', {
          method: 'POST',
          headers: { 'utsToken': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ GKK: parseInt(gkk), BNO: '', UNO: '', BID: '', SAN: 1 })
        });
        const data = await resp.json();

        chrome.storage.local.set({
          utsAktarim: {
            urunler: data,
            timestamp: Date.now()
          }
        }, () => {
          sendResponse({ ok: true, data: data });
        });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    });
    return true;
  }
});

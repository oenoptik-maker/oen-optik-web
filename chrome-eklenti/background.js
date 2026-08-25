chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AKTAR_UTS') {
    chrome.storage.local.set({
      utsAktarim: { urunler: msg.urunler, timestamp: Date.now() }
    }, () => { sendResponse({ ok: true }); });
    return true;
  }

  if (msg.type === 'UTS_BEKLEYENLERI_CEK') {
    const gkk = msg.gkk;
    if (!gkk) { sendResponse({ ok: false, error: 'GKK eksik' }); return false; }

    chrome.storage.local.get(['utsToken'], (result) => {
      const token = result.utsToken;
      if (!token) { sendResponse({ ok: false, error: 'Token yok' }); return; }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      fetch('https://utsuygulama.saglik.gov.tr/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula', {
        method: 'POST',
        headers: { 'utsToken': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ GKK: parseInt(gkk), BNO: '', UNO: '', BID: '', SAN: 1 }),
        signal: controller.signal
      })
      .then(resp => { clearTimeout(timeout); return resp.json(); })
      .then(data => {
        sendResponse({ ok: true, data: data });
      })
      .catch(err => {
        clearTimeout(timeout);
        sendResponse({ ok: false, error: err.name === 'AbortError' ? 'UTS sunucusu timeout (15sn). Ag baglantinizi kontrol edin.' : err.message });
      });
    });

    return true;
  }
});

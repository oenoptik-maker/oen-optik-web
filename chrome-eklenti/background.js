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
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AKTAR_UTS') {
    chrome.tabs.query({}, (tabs) => {
      let oenTab = null;
      for (const t of tabs) {
        if (!t.url) continue;
        const u = t.url.toLowerCase();
        if (u.includes('oenoptik') || u.includes('oen-optik')) {
          oenTab = t;
          break;
        }
      }

      if (!oenTab) {
        chrome.storage.local.set({ utsAktarim: { urunler: msg.urunler, timestamp: Date.now() } });
        sendResponse({ ok: false, error: 'OEN Optik sayfasi acik degil (veri kaydedildi, sayfayi acinca yuklenecek)' });
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: oenTab.id },
        allFrames: true,
        func: (urunler) => {
          if (typeof utsVeriAktar === 'function') {
            utsVeriAktar(urunler);
          } else {
            window.__pendingUts = urunler;
          }
        },
        args: [msg.urunler]
      }).then(() => {
        sendResponse({ ok: true });
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    });

    return true;
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AKTAR_UTS') {
    chrome.tabs.query({}, (tabs) => {
      const oenTab = tabs.find(t => t.url && (
        t.url.includes('oenoptik.com') && t.url.includes('yonetici')
      ) || (t.url && t.url.includes('oen-optik-web.vercel.app')));

      if (!oenTab) {
        sendResponse({ ok: false, error: 'OEN Optik sayfasi acik degil' });
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: oenTab.id },
        allFrames: true,
        func: (urunler) => {
          if (typeof utsVeriAktar === 'function') {
            utsVeriAktar(urunler);
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

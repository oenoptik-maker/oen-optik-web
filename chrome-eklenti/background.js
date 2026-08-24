chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AKTAR_UTS') {
    chrome.tabs.query({}, (tabs) => {
      const oenTab = tabs.find(t => t.url && (
        t.url.includes('oenoptik.com/yonetici') ||
        t.url.includes('oen-optik-web.vercel.app')
      ));

      if (!oenTab) {
        sendResponse({ ok: false, error: 'OEN Optik sayfası açık değil' });
        return;
      }

      const jsonStr = JSON.stringify(msg.urunler);

      chrome.scripting.executeScript({
        target: { tabId: oenTab.id },
        func: (data) => {
          try {
            const urunler = JSON.parse(data);
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
              try {
                iframe.contentWindow.postMessage({ type: 'UTS_URUNLER_AKTAR', urunler: urunler }, '*');
              } catch(e) {}
            }
            window.postMessage({ type: 'UTS_URUNLER_AKTAR', urunler: urunler }, '*');
          } catch(e) {}
        },
        args: [jsonStr]
      }).then(() => {
        sendResponse({ ok: true });
      }).catch(err => {
        sendResponse({ ok: false, error: err.message });
      });
    });

    return true;
  }
});

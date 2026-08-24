chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.url) continue;
      const u = tab.url.toLowerCase();
      if (u.includes('oen-optik-web.vercel.app')) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['admin-content.js']
        }).catch(() => {});
      }
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'AKTAR_UTS') {
    chrome.tabs.query({}, (tabs) => {
      let oenTab = null;
      for (const t of tabs) {
        if (!t.url) continue;
        const u = t.url.toLowerCase();
        if (u.includes('oenoptik') || u.includes('oen-optik') || u.includes('yonetici')) {
          oenTab = t;
          break;
        }
      }

      if (!oenTab) {
        sendResponse({ ok: false, error: 'OEN Optik sayfasi acik degil' });
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: oenTab.id, allFrames: true },
        func: (urunler) => {
          try {
            if (typeof utsVeriAktar === 'function') {
              utsVeriAktar(urunler);
              return;
            }
          } catch(e) {}
          try {
            const ta = document.getElementById('utsYapistirmaAlani');
            if (ta) {
              ta.value = JSON.stringify(urunler);
              ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
          } catch(e) {}
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

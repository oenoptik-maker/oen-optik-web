document.getElementById('aktarBtn').addEventListener('click', async () => {
  const durum = document.getElementById('durum');
  durum.className = '';
  durum.style.display = 'none';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('utsuygulama.saglik.gov.tr')) {
      durum.className = 'hata';
      durum.textContent = 'Lütfen UTS sayfasında olun!';
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const rows = document.querySelectorAll('table tbody tr');
        const secili = [];
        rows.forEach(row => {
          const cb = row.querySelector('input[type=checkbox]:checked');
          if (cb) {
            const cells = row.querySelectorAll('td');
            secili.push({
              urunNo: cells[1]?.innerText?.trim() || '',
              kurumKodu: cells[2]?.innerText?.trim() || '',
              bildirimKodu: cells[3]?.innerText?.trim() || '',
              lotBatch: cells[4]?.innerText?.trim() || '',
              seriNo: cells[5]?.innerText?.trim() || '',
              urunTanimi: cells[6]?.innerText?.trim() || '',
              gonderenKurum: cells[7]?.innerText?.trim() || '',
              adet: cells[8]?.innerText?.trim() || '1'
            });
          }
        });
        return secili;
      }
    });

    const urunler = results[0]?.result || [];

    if (urunler.length === 0) {
      durum.className = 'hata';
      durum.textContent = 'İşaretli ürün bulunamadı! UTS sayfasında ürün işaretleyin.';
      return;
    }

    await chrome.storage.local.set({ utsUrunler: urunler });

    durum.className = 'basarili';
    durum.textContent = `${urunler.length} ürün hazır! "OEN Optik'i Aç" butonuna basın.`;
  } catch (err) {
    durum.className = 'hata';
    durum.textContent = 'Hata: ' + err.message;
  }
});

document.getElementById('oenAcBtn').addEventListener('click', async () => {
  const data = await chrome.storage.local.get('utsUrunler');
  const urunler = data.utsUrunler || [];

  if (urunler.length === 0) {
    durum.className = 'hata';
    durum.textContent = 'Önce ürünleri aktarın!';
    return;
  }

  const json = encodeURIComponent(JSON.stringify(urunler));
  chrome.tabs.create({ url: `https://www.oenoptik.com/yonetici#uts=${json}` });
});

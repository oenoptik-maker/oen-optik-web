(function() {
  if (document.getElementById('oen-utss-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'oen-utss-btn';
  btn.innerHTML = '📋 OEN Optik\'e Aktar';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    background: linear-gradient(135deg, #00b894, #00cec9);
    color: #fff;
    padding: 14px 24px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 20px rgba(0,206,201,0.5);
    font-family: Arial, sans-serif;
    user-select: none;
    transition: transform 0.2s, box-shadow 0.2s;
  `;
  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 6px 25px rgba(0,206,201,0.7)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 4px 20px rgba(0,206,201,0.5)';
  });

  const durum = document.createElement('div');
  durum.id = 'oen-utss-durum';
  durum.style.cssText = `
    position: fixed;
    bottom: 70px;
    right: 20px;
    z-index: 999999;
    background: #1a1a2e;
    color: #fff;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-family: Arial, sans-serif;
    display: none;
    max-width: 300px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;

  function showDurum(msg, type) {
    durum.textContent = msg;
    durum.style.display = 'block';
    durum.style.background = type === 'ok' ? '#065f46' : type === 'err' ? '#7f1d1d' : '#1a1a2e';
    if (type) setTimeout(() => durum.style.display = 'none', 4000);
  }

  btn.addEventListener('click', async () => {
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

    if (secili.length === 0) {
      showDurum('⚠️ İşaretli ürün bulunamadı!', 'err');
      return;
    }

    await chrome.storage.local.set({
      utsAktarim: {
        urunler: secili,
        timestamp: Date.now()
      }
    });

    showDurum(`✅ ${secili.length} ürün aktarıldı! OEN Optik sayfasında görünecek.`, 'ok');
  });

  document.body.appendChild(btn);
  document.body.appendChild(durum);
})();

const express = require('express');
const router = express.Router();

const UTS_BASE = 'https://utsuygulama.saglik.gov.tr';
const UTS_TOKEN = process.env.UTS_TOKEN;

async function utsPost(path, body) {
  const url = `${UTS_BASE}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'utsToken': UTS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

router.get('/health', async (req, res) => {
  res.json({ hasToken: !!UTS_TOKEN, tokenLength: UTS_TOKEN ? UTS_TOKEN.length : 0 });
});

router.post('/bekleyen-urunleri-sorgula', async (req, res) => {
  try {
    if (!UTS_TOKEN) return res.status(500).json({ success: false, message: 'UTS_TOKEN tanımlı değil' });
    const { gkk, bno, uno, bid, san } = req.body;
    const result = await utsPost('/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula', {
      GKK: gkk || null,
      BNO: bno || '',
      UNO: uno || '',
      BID: bid || '',
      SAN: san || 1
    });
    res.json({ success: true, veri: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/bekleyen-sayisi', async (req, res) => {
  try {
    if (!UTS_TOKEN) return res.status(500).json({ success: false, message: 'UTS_TOKEN tanımlı değil' });
    const { gkk, bno, uno, adt, off } = req.body;
    const result = await utsPost('/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula/offset', {
      GKK: gkk || null,
      BNO: bno || '',
      UNO: uno || '',
      ADT: adt || 20,
      OFF: off || null
    });
    res.json({ success: true, veri: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/alma-bildirimi', async (req, res) => {
  try {
    if (!UTS_TOKEN) return res.status(500).json({ success: false, message: 'UTS_TOKEN tanımlı değil' });
    const { vbi, adt, gkk, udi, uno, lno, sno } = req.body;
    const result = await utsPost('/UTS/uh/rest/bildirim/alma/ekle', {
      VBI: vbi || null,
      ADT: adt || 1,
      GKK: gkk || null,
      UDI: udi || '',
      UNO: uno || '',
      LNO: lno || '',
      SNO: sno || ''
    });
    res.json({ success: true, sonuc: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/toplu-alma-bildirimi', async (req, res) => {
  try {
    if (!UTS_TOKEN) return res.status(500).json({ success: false, message: 'UTS_TOKEN tanımlı değil' });
    const { bildirimler } = req.body;
    if (!Array.isArray(bildirimler) || bildirimler.length === 0) {
      return res.status(400).json({ success: false, message: 'Bildirim listesi boş' });
    }
    const sonuclar = [];
    for (const b of bildirimler) {
      const result = await utsPost('/UTS/uh/rest/bildirim/alma/ekle', {
        VBI: b.vbi || null,
        ADT: b.adt || 1,
        GKK: b.gkk || null,
        UDI: b.udi || '',
        UNO: b.uno || '',
        LNO: b.lno || '',
        SNO: b.sno || ''
      });
      sonuclar.push({ bildirim: b, sonuc: result });
    }
    res.json({ success: true, sonuclar });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/urun-sorgula', async (req, res) => {
  try {
    if (!UTS_TOKEN) return res.status(500).json({ success: false, message: 'UTS_TOKEN tanımlı değil' });
    const { uno, lno, sno } = req.body;
    const result = await utsPost('/UTS/uh/rest/tekilUrun/sorgula', {
      UNO: uno || '',
      LNO: lno || '',
      SNO: sno || ''
    });
    res.json({ success: true, veri: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ayrintili-sorgula', async (req, res) => {
  try {
    if (!UTS_TOKEN) return res.status(500).json({ success: false, message: 'UTS_TOKEN tanımlı değil' });
    const { uno, sno, lno, udi, uik, adt, say } = req.body;
    const result = await utsPost('/UTS/rest/ayrintiliTekilUrun/sorgula', {
      UNO: uno || '',
      SNO: sno || '',
      LNO: lno || '',
      UDI: udi || '',
      UIK: uik || null,
      ADT: adt || 15,
      SAY: say || 0
    });
    res.json({ success: true, veri: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/debug-sorgula', async (req, res) => {
  try {
    if (!UTS_TOKEN) return res.json({ success: false, message: 'UTS_TOKEN tanımlı değil', tokenVar: false });

    // Test 1: Basit bir UTS sorgulama
    const url1 = `${UTS_BASE}/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula`;
    let resp1, raw1;
    try {
      resp1 = await fetch(url1, {
        method: 'POST',
        headers: { 'utsToken': UTS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ GKK: null, BNO: '', UNO: '', BID: '', SAN: 1 })
      });
      raw1 = await resp1.text();
    } catch (e) {
      raw1 = 'FETCH_HATA: ' + e.message;
      resp1 = { status: 0 };
    }

    // Test 2: UTS ürün sorgulama
    const url2 = `${UTS_BASE}/UTS/rest/tibbiCihaz/urunSorgula`;
    let resp2, raw2;
    try {
      resp2 = await fetch(url2, {
        method: 'POST',
        headers: { 'utsToken': UTS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ UNO: '8680275853451' })
      });
      raw2 = await resp2.text();
    } catch (e) {
      raw2 = 'FETCH_HATA: ' + e.message;
      resp2 = { status: 0 };
    }

    res.json({
      tokenLength: UTS_TOKEN.length,
      tokenPrefix: UTS_TOKEN.substring(0, 10),
      test1: { url: url1, status: resp1.status || resp1.statusCode, yanit: (raw1 || '').substring(0, 1000) },
      test2: { url: url2, status: resp2.status || resp2.statusCode, yanit: (raw2 || '').substring(0, 1000) }
    });
  } catch (err) {
    res.json({ success: false, message: err.message, stack: err.stack });
  }
});

module.exports = router;

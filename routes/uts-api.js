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
    if (!UTS_TOKEN) return res.json({ success: false, message: 'UTS_TOKEN tanımlı değil' });

    // Test 1: DNS ve SSL kontrolü
    let dnsTest;
    try {
      const { lookup } = require('dns').promises || require('dns');
      const dnsResult = await new Promise((resolve, reject) => {
        require('dns').lookup('utsuygulama.saglik.gov.tr', (err, address) => {
          if (err) reject(err); else resolve(address);
        });
      });
      dnsTest = { basarili: true, ip: dnsResult };
    } catch (e) {
      dnsTest = { basarili: false, hata: e.message };
    }

    // Test 2: Basit GET isteği
    let getTest;
    try {
      const resp = await fetch('https://utsuygulama.saglik.gov.tr/UTS', {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(15000)
      });
      getTest = { status: resp.status, ok: resp.ok, headers: Object.fromEntries(resp.headers) };
    } catch (e) {
      getTest = { hata: e.message, code: e.code, cause: e.cause ? e.cause.message : null };
    }

    // Test 3: POST isteği
    let postTest;
    try {
      const resp = await fetch('https://utsuygulama.saglik.gov.tr/UTS/uh/rest/bildirim/alma/bekleyenler/sorgula', {
        method: 'POST',
        headers: { 'utsToken': UTS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ GKK: null, BNO: '', UNO: '', BID: '', SAN: 1 }),
        signal: AbortSignal.timeout(15000)
      });
      const text = await resp.text();
      postTest = { status: resp.status, yanit: text.substring(0, 500) };
    } catch (e) {
      postTest = { hata: e.message, code: e.code, cause: e.cause ? e.cause.message : null };
    }

    res.json({ dnsTest, getTest, postTest, tokenLength: UTS_TOKEN.length });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;

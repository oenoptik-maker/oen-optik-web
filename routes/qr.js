const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// QR kod üret
router.get('/:text', async (req, res) => {
  try {
    const text = decodeURIComponent(req.params.text);
    const size = parseInt(req.query.size) || 150;
    const dataUrl = await QRCode.toDataURL(text, {
      width: size,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M'
    });
    res.json(dataUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

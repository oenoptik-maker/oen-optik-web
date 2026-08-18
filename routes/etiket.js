const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');

router.post('/tasarim', async (req, res) => {
  try {
    await getDb();
    const design = JSON.stringify(req.body);
    const existing = dbGet('SELECT id FROM etiket_tasarim WHERE id = 1');
    if (existing) {
      dbRun('UPDATE etiket_tasarim SET design = ? WHERE id = 1', [design]);
    } else {
      dbRun('INSERT INTO etiket_tasarim (id, design) VALUES (1, ?)', [design]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/tasarim', async (req, res) => {
  try {
    await getDb();
    const row = dbGet('SELECT design FROM etiket_tasarim WHERE id = 1');
    if (!row) return res.json({ success: false, design: null });
    res.json({ success: true, design: JSON.parse(row.design) });
  } catch (err) {
    res.status(500).json({ success: false, design: null });
  }
});

router.get('/yazicilar', (req, res) => {
  const { exec } = require('child_process');
  exec('powershell -NoProfile -Command "Get-CimInstance -ClassName Win32_Printer | Select-Object Name,DriverName,Default | ConvertTo-Json"', { timeout: 10000 }, (err, stdout) => {
    if (err) return res.json([]);
    try {
      let printers = JSON.parse(stdout.trim());
      if (!Array.isArray(printers)) printers = [printers];
      res.json(printers.map(p => ({
        name: p.Name,
        displayName: p.Name,
        description: p.DriverName || '',
        isDefault: p.Default === true
      })));
    } catch (e) {
      res.json([]);
    }
  });
});

module.exports = router;

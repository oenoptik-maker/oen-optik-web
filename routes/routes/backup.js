const express = require('express');
const router = express.Router();
const { getDb, dbAll, dbGet, dbRun } = require('../db/database');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '../data/yedekler');
const DB_PATH = path.join(__dirname, '../db/oen-optik.db');

router.post('/olustur', async (req, res) => {
  try {
    await getDb();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `oen-optik_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, filename);
    fs.copyFileSync(DB_PATH, backupPath);
    res.json({ success: true, filename });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/liste', async (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .map(f => ({
        name: f,
        filename: f,
        size: fs.statSync(path.join(BACKUP_DIR, f)).size,
        date: fs.statSync(path.join(BACKUP_DIR, f)).mtime
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(files);
  } catch (err) {
    res.status(500).json([]);
  }
});

router.get('/indir/:dosya', (req, res) => {
  try {
    const filePath = path.join(BACKUP_DIR, req.params.dosya);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Dosya bulunamadi' });
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/geri-yukle', async (req, res) => {
  try {
    await getDb();
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, message: 'Dosya adi gerekli' });
    }
    const backupPath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(backupPath)) {
      return res.status(400).json({ success: false, message: 'Yedek dosyasi bulunamadi' });
    }
    // Current DB'yi yedekle
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, `onceden-yedek_${timestamp}.db`));
    // Geri yukle
    fs.copyFileSync(backupPath, DB_PATH);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

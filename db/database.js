const path = require('path');
const fs = require('fs');

const IS_VERCEL = !!process.env.VERCEL;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'oen-optik.db');

let db = null;
let dbType = null;

async function getDb() {
  if (db) return db;

  let tursoUrl = (process.env.TURSO_DATABASE_URL || '').replace(/[\r\n]/g, '').trim();
  let tursoToken = (process.env.TURSO_AUTH_TOKEN || '').replace(/[\r\n]/g, '').trim();
  
  // Vercel env variable'larinda bazen fazladan on ek olabiliyor - temizle
  const libsqlIdx = tursoUrl.indexOf('libsql://');
  if (libsqlIdx > 0) tursoUrl = tursoUrl.substring(libsqlIdx);
  
  // Token'da da ayni sorun olabiliyor - JWT (eyJ...) baslangicina kadar temizle
  const jwtIdx = tursoToken.indexOf('eyJ');
  if (jwtIdx > 0) tursoToken = tursoToken.substring(jwtIdx);

  if (IS_VERCEL && tursoUrl && tursoUrl.startsWith('libsql://')) {
    try {
      const { createClient } = require('@libsql/client');
      const client = createClient({
        url: tursoUrl,
        authToken: tursoToken,
      });
      await client.execute('SELECT 1');
      db = { type: 'turso', client };
      dbType = 'turso';
      console.log('Turso veritabanina baglanildi');
    } catch (err) {
      console.error('Turso baglanti hatasi:', err.message);
      db = null;
      dbType = null;
    }
  }

  if (!db) {
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();
    if (!IS_VERCEL && fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = { type: 'sqljs', client: new SQL.Database(fileBuffer) };
    } else {
      db = { type: 'sqljs', client: new SQL.Database() };
    }
    dbType = 'sqljs';
  }

  await initTables();
  return db;
}

async function initTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullname TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS siparisler (
      SIRA_NO INTEGER PRIMARY KEY,
      AD_SOYAD TEXT, TC_KIMLIK TEXT, TELEFON TEXT,
      SIPARIS_TARIHI TEXT, TESLIM_TARIHI TEXT,
      EMAIL TEXT, ADRES TEXT,
      SAG_SPH_UZAK TEXT, SAG_CYL_UZAK TEXT, SAG_AXE_UZAK TEXT,
      SOL_SPH_UZAK TEXT, SOL_CYL_UZAK TEXT, SOL_AXE_UZAK TEXT,
      SAG_SPH_YAKIN TEXT, SAG_CYL_YAKIN TEXT, SAG_AXE_YAKIN TEXT,
      SOL_SPH_YAKIN TEXT, SOL_CYL_YAKIN TEXT, SOL_AXE_YAKIN TEXT,
      ADD_DEGER TEXT,
      PD_SAG_UZAK TEXT, PD_SOL_UZAK TEXT, PD_SAG_YAKIN TEXT, PD_SOL_YAKIN TEXT,
      YUKSEKLIK_SAG_UZAK TEXT, YUKSEKLIK_SOL_UZAK TEXT, YUKSEKLIK_SAG_YAKIN TEXT, YUKSEKLIK_SOL_YAKIN TEXT,
      CAP_SAG_UZAK TEXT, CAP_SOL_UZAK TEXT, CAP_SAG_YAKIN TEXT, CAP_SOL_YAKIN TEXT,
      ACIKLAMA_UZAK TEXT, ACIKLAMA_YAKIN TEXT,
      ODEME_DETAYLARI TEXT, SECILEN_URUNLER TEXT,
      TOPLAM TEXT, ALINAN TEXT, KALAN TEXT, INDIRIM TEXT, INDIRIM_NOTU TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS kategoriler (
      KATEGORI_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      KATEGORI_ADI TEXT UNIQUE NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS urunler (
      URUN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
      KATEGORI_ADI TEXT, URUN_ADI TEXT,
      ALIS_FIYATI REAL DEFAULT 0, FIYAT REAL DEFAULT 0,
      ADET INTEGER DEFAULT 0, KAREKOD TEXT, MENSEI TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS uts_alimlar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      URUN_NUMARASI TEXT, LOT_BATCH_NO TEXT, SERI_SIRA_NO TEXT,
      URUN_TANIMI TEXT, GONDEREN_KURUM TEXT, ADET TEXT,
      ALIS_FIYATI REAL DEFAULT 0, SATIS_FIYATI REAL DEFAULT 0, KAYIT_TARIHI TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS etiket_tasarim (id INTEGER PRIMARY KEY CHECK (id = 1), design TEXT)`,
    `CREATE TABLE IF NOT EXISTS credentials (id INTEGER PRIMARY KEY CHECK (id = 1), tc TEXT, sifre TEXT)`,
    `CREATE TABLE IF NOT EXISTS toplu_stok (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      KATEGORI TEXT, KAREKOD TEXT, URUN_ADI TEXT,
      ALIS_FIYATI REAL DEFAULT 0, SATIS_FIYATI REAL DEFAULT 0,
      MENSEI TEXT, ADET INTEGER DEFAULT 0
    )`
  ];

  if (dbType === 'turso') {
    for (const stmt of tables) {
      await db.client.execute(stmt);
    }
  } else {
    for (const stmt of tables) {
      db.client.run(stmt);
    }
    if (!IS_VERCEL) saveDb();
  }

  // Ilk acilis: admin kullanici olustur
  const existingUser = await dbAll('SELECT id FROM users LIMIT 1');
  if (existingUser.length === 0) {
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash('admin123', 10);
    await dbRun('INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)', ['admin', hash, 'Admin', 'admin']);
    console.log('Varsayilan admin kullanici olusturuldu: admin / admin123');
  }
}

async function dbAll(sql, params = []) {
  const cleanParams = params.map(p => p === undefined ? null : p);
  if (dbType === 'turso') {
    const result = await db.client.execute({ sql, args: cleanParams });
    return result.rows || [];
  }
  const stmt = db.client.prepare(sql);
  if (cleanParams.length) stmt.bind(cleanParams);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

async function dbGet(sql, params = []) {
  const rows = await dbAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function dbRun(sql, params = []) {
  const cleanParams = params.map(p => p === undefined ? null : p);
  if (dbType === 'turso') {
    await db.client.execute({ sql, args: cleanParams });
    return;
  }
  db.client.run(sql, cleanParams);
}

async function dbBatch(statements) {
  if (dbType === 'turso') {
    const stmts = statements.map(s => ({
      sql: s.sql,
      args: (s.params || []).map(p => p === undefined ? null : p)
    }));
    await db.client.batch(stmts);
    return;
  }
  for (const s of statements) {
    const cleanParams = (s.params || []).map(p => p === undefined ? null : p);
    db.client.run(s.sql, cleanParams);
  }
}

function saveDb() {
  if (IS_VERCEL) return;
  if (dbType === 'sqljs' && db && db.client) {
    const data = db.client.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function closeDb() {
  if (db) {
    if (dbType === 'sqljs') saveDb();
    db = null;
  }
}

if (!IS_VERCEL) {
  setInterval(() => { if (db && dbType === 'sqljs') saveDb(); }, 5000);
}

process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });

function getDbType() { return dbType; }

module.exports = { getDb, closeDb, saveDb, dbAll, dbGet, dbRun, dbBatch, getDbType };

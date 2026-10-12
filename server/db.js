const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'content_engine.db');

let dbInstance = null;

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function saveDb() {
  if (!dbInstance) return;
  const buffer = Buffer.from(dbInstance.export());
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, DB_PATH);
}

async function initDatabase() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Create tables
  dbInstance.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source_type TEXT,
      source_url TEXT,
      author TEXT,
      raw_notes TEXT,
      content_pillar TEXT,
      research_pack TEXT,
      status TEXT DEFAULT 'INBOX',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS content_masters (
      id TEXT PRIMARY KEY,
      idea_id TEXT,
      interview_answers TEXT,
      master_article TEXT,
      clear_review TEXT,
      is_approved INTEGER DEFAULT 0,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS podcasts (
      id TEXT PRIMARY KEY,
      master_id TEXT,
      titles TEXT,
      hook TEXT,
      talking_points TEXT,
      full_script TEXT,
      show_notes TEXT,
      references_list TEXT,
      notebooklm_markdown TEXT,
      status TEXT DEFAULT 'DRAFT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS platform_outputs (
      id TEXT PRIMARY KEY,
      master_id TEXT,
      platform TEXT,
      variant_type TEXT,
      content_payload TEXT,
      copy_text TEXT,
      media_specs TEXT,
      status TEXT DEFAULT 'DRAFT',
      scheduled_at DATETIME,
      published_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_library (
      id TEXT PRIMARY KEY,
      category TEXT,
      title TEXT,
      content TEXT,
      tags TEXT,
      source_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS master_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      master_id TEXT,
      content TEXT,
      origin TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trusted_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      citation TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inbox_imports (
      row_key TEXT PRIMARY KEY,
      idea_id TEXT,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS performance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      published_url TEXT,
      reach INTEGER DEFAULT 0,
      saves INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrations for databases created by earlier versions
  try { dbInstance.run('ALTER TABLE learning_library ADD COLUMN is_active INTEGER DEFAULT 1'); } catch (_) { /* already exists */ }

  // Seed trusted sources with the classic references from the framework KB (only once, when empty)
  try {
    const countRes = dbInstance.exec("SELECT COUNT(*) FROM trusted_sources");
    const count = countRes[0]?.values?.[0]?.[0] || 0;
    if (count === 0) {
      const frameworks = require('./knowledge/psychology_frameworks.json').frameworks;
      frameworks.forEach(f => {
        dbInstance.run(
          "INSERT INTO trusted_sources (citation, note) VALUES (?, ?)",
          [f.reference_citation, `系統預設（${f.name}），建議 Betty 親自確認後保留`]
        );
      });
    }
  } catch (err) {
    console.warn('Trusted sources seed skipped:', err.message);
  }

  // Attempt auto-importing Gemini API key from sister project clarity-coaching if available
  try {
    const currentKey = getSetting('gemini_api_key');
    if (!currentKey) {
      const siblingDbPath = path.join(__dirname, '..', '..', 'clarity-coaching', 'server', 'data', 'clarity.db');
      if (fs.existsSync(siblingDbPath)) {
        const siblingBuffer = fs.readFileSync(siblingDbPath);
        const siblingDb = new SQL.Database(siblingBuffer);
        const res = siblingDb.exec("SELECT value FROM settings WHERE key = 'gemini_api_key'");
        if (res && res.length > 0 && res[0].values && res[0].values.length > 0) {
          const keyVal = res[0].values[0][0];
          if (keyVal && keyVal.trim()) {
            setSetting('gemini_api_key', keyVal.trim());
            console.log('✓ 自動從 clarity-coaching 帶入 Gemini API Key');
          }
        }
      }
    }
  } catch (err) {
    // Ignore silent fallback
  }

  saveDb();
  return dbInstance;
}

function getSetting(key) {
  if (!dbInstance) return null;
  const stmt = dbInstance.prepare("SELECT value FROM settings WHERE key = :key");
  stmt.bind({ ':key': key });
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject().value;
  }
  stmt.free();
  return result;
}

function setSetting(key, value) {
  if (!dbInstance) return;
  dbInstance.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  saveDb();
}

module.exports = {
  initDatabase,
  getDb: () => dbInstance,
  saveDb,
  getSetting,
  setSetting
};

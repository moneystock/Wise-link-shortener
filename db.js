const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Ruta configurable para persistencia en volúmenes de la nube (ej. /data/database.sqlite)
const dbPath = process.env.DB_PATH || path.join(process.env.DB_DIR || __dirname, 'database.sqlite');

// Asegurar que el directorio de la base de datos exista
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Configuración de optimización y consistencia de SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_url TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    workspace TEXT NOT NULL DEFAULT 'wise',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    clicks_count INTEGER DEFAULT 0,
    expires_at DATETIME NULL
  );

  CREATE TABLE IF NOT EXISTS clicks_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_links_short_code ON links(short_code);
  CREATE INDEX IF NOT EXISTS idx_links_workspace ON links(workspace);
  CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks_log(link_id);
  CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON clicks_log(clicked_at);
`);

console.log('✓ Base de datos SQLite inicializada correctamente en:', dbPath);

module.exports = db;

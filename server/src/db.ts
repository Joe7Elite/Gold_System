import initSqlJs, { Database as SqlJsDb } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(dataDir, 'gold.db');

let sqlDb: SqlJsDb;

function saveDb() {
  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Wrapper to provide better-sqlite3-like API over sql.js
const db = {
  prepare(sql: string) {
    return {
      run(...params: any[]) {
        sqlDb.run(sql, params);
        const lastId = sqlDb.exec('SELECT last_insert_rowid() as id');
        const changes = sqlDb.getRowsModified();
        saveDb();
        return { lastInsertRowid: lastId[0]?.values[0]?.[0] || 0, changes };
      },
      get(...params: any[]): any {
        const stmt = sqlDb.prepare(sql);
        try {
          if (params.length) stmt.bind(params);
          if (stmt.step()) {
            return stmt.getAsObject();
          }
          return undefined;
        } finally {
          stmt.free();
        }
      },
      all(...params: any[]): any[] {
        const stmt = sqlDb.prepare(sql);
        try {
          if (params.length) stmt.bind(params);
          const rows: any[] = [];
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          return rows;
        } finally {
          stmt.free();
        }
      },
    };
  },
  exec(sql: string) {
    sqlDb.exec(sql);
    saveDb();
  },
  pragma(sql: string) {
    try { sqlDb.exec(`PRAGMA ${sql}`); } catch { /* ignore */ }
  },
};

export async function initDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db.pragma('foreign_keys = ON');

  sqlDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS traders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS gold_deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_id INTEGER NOT NULL REFERENCES traders(id),
      weight REAL NOT NULL,
      price_per_gram REAL NOT NULL,
      total_amount REAL NOT NULL,
      original_karat INTEGER DEFAULT 21,
      original_weight REAL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS cash_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trader_id INTEGER NOT NULL REFERENCES traders(id),
      amount REAL NOT NULL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS gold_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_trader_id INTEGER NOT NULL REFERENCES traders(id),
      to_trader_id INTEGER NOT NULL REFERENCES traders(id),
      weight REAL NOT NULL,
      original_karat INTEGER DEFAULT 21,
      original_weight REAL,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  saveDb();

  // Migration: add new columns for existing databases
  try { sqlDb.exec("ALTER TABLE gold_deals ADD COLUMN deal_type TEXT DEFAULT 'buy'"); saveDb(); } catch {}
  try { sqlDb.exec("ALTER TABLE cash_payments ADD COLUMN payment_type TEXT DEFAULT 'payment'"); saveDb(); } catch {}
  try { sqlDb.exec("ALTER TABLE users ADD COLUMN is_protected INTEGER DEFAULT 0"); saveDb(); } catch {}

  // Create default admin user if not exists
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
    ).run('admin', hash, 'المدير', 'admin');
  }

  // Ensure Joe7Elite is always protected
  db.prepare('UPDATE users SET is_protected = 1 WHERE username = ?').run('Joe7Elite');
}

export default db;

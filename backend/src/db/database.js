/**
 * backend/src/db/database.js
 * Tầng Database Adapter bọc node:sqlite.
 * Khi nâng cấp sang PostgreSQL (pg) hoặc MySQL (mysql2), chỉ cần thay thế
 * phần kết nối và 3 hàm queryAll / queryOne / execute tại module này.
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const STORAGE_DIR = path.join(__dirname, "..", "..", "storage");
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(STORAGE_DIR, "smarttro.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

let _db = null;

function getDb() {
  if (_db) return _db;

  if (DB_PATH !== ":memory:" && !fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  _db = new DatabaseSync(DB_PATH);
  _db.exec("PRAGMA journal_mode = WAL;");
  _db.exec("PRAGMA foreign_keys = ON;");

  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf8");
  _db.exec(schemaSql);

  return _db;
}

function queryAll(sql, params = []) {
  const stmt = getDb().prepare(sql);
  return stmt.all(...params);
}

function queryOne(sql, params = []) {
  const stmt = getDb().prepare(sql);
  return stmt.get(...params) || null;
}

function execute(sql, params = []) {
  const stmt = getDb().prepare(sql);
  return stmt.run(...params);
}

function transaction(workFn) {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE TRANSACTION;");
  try {
    const result = workFn();
    db.exec("COMMIT;");
    return result;
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = {
  DB_PATH,
  getDb,
  queryAll,
  queryOne,
  execute,
  transaction,
  closeDb
};

// @ts-check
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { sm2, INITIAL_EASE_FACTOR } from './sm2.mjs'

const _require = createRequire(import.meta.url)

const DB_DIR = `${homedir()}/.ydd`
const DB_PATH = `${DB_DIR}/history.db`

/** @type {import('node:sqlite').DatabaseSync | null} */
let _db = null

/**
 * Try to load node:sqlite. Returns null if not available.
 * @returns {typeof import('node:sqlite') | null}
 */
function tryLoadSqlite() {
  try {
    // @ts-ignore
    return _require('node:sqlite')
  } catch {
    return null
  }
}

/** @returns {import('node:sqlite').DatabaseSync} */
function getDb() {
  if (_db) return _db

  const sqlite = tryLoadSqlite()
  if (!sqlite) {
    throw Object.assign(
      new Error(
        'node:sqlite is not available. Run with: NODE_OPTIONS="--experimental-sqlite" ydd --flash',
      ),
      { code: 'SQLITE_NOT_AVAILABLE' },
    )
  }

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  _db = new sqlite.DatabaseSync(DB_PATH)
  _db.exec('PRAGMA journal_mode=WAL')
  initSchema(_db)
  return _db
}

/**
 * @param {import('node:sqlite').DatabaseSync} db
 */
function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      word TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      query_count INTEGER NOT NULL DEFAULT 1,
      first_queried_at TEXT NOT NULL,
      last_queried_at TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS reviews (
      word TEXT PRIMARY KEY,
      ease_factor REAL NOT NULL DEFAULT ${INITIAL_EASE_FACTOR},
      interval INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      next_review_at TEXT,
      last_reviewed_at TEXT,
      FOREIGN KEY (word) REFERENCES cards(word)
    )
  `)
}

/**
 * Save or update a word query result.
 * If the word already exists, increment query_count and update last_queried_at.
 *
 * @param {string} word
 * @param {object} data - the IParsedResult to persist
 */
export function saveCard(word, data) {
  const db = getDb()
  const now = new Date().toISOString()
  /** @type {{ query_count: number } | undefined} */
  const existing = /** @type {any} */ (db
    .prepare('SELECT query_count FROM cards WHERE word = ?')
    .get(word))

  if (existing) {
    db.prepare(
      `UPDATE cards SET data = ?, query_count = query_count + 1, last_queried_at = ? WHERE word = ?`,
    ).run(JSON.stringify(data), now, word)
  } else {
    db.prepare(
      `INSERT INTO cards (word, data, query_count, first_queried_at, last_queried_at) VALUES (?, ?, 1, ?, ?)`,
    ).run(word, JSON.stringify(data), now, now)

    db.prepare(
      `INSERT INTO reviews (word, ease_factor, interval, repetitions, next_review_at, last_reviewed_at)
       VALUES (?, ?, 0, 0, ?, NULL)`,
    ).run(word, INITIAL_EASE_FACTOR, now)
  }
}

/**
 * @typedef {{ word: string; data: string; query_count: number; ease_factor: number; interval: number; repetitions: number; next_review_at: string | null }} RawCardRow
 * @typedef {{ word: string; data: any; query_count: number; ease_factor: number; interval: number; repetitions: number; next_review_at: string | null }} CardRow
 */

/**
 * Get cards due for review, ordered by next_review_at ASC.
 * Includes never-reviewed cards (next_review_at is NULL).
 *
 * @param {number} [limit]
 * @returns {CardRow[]}
 */
export function getDueCards(limit) {
  const db = getDb()
  const now = new Date().toISOString()

  /** @type {RawCardRow[]} */
  const rows = /** @type {any} */ (db
    .prepare(
      `SELECT c.word, c.data, c.query_count,
              r.ease_factor, r.interval, r.repetitions, r.next_review_at
       FROM cards c
       LEFT JOIN reviews r ON r.word = c.word
       WHERE r.next_review_at IS NULL OR r.next_review_at <= ?
       ORDER BY r.next_review_at ASC, c.last_queried_at DESC`,
    )
    .all(now))

  const parsed = /** @type {CardRow[]} */ (rows.map(r => ({ ...r, data: JSON.parse(r.data) })))

  return limit ? parsed.slice(0, limit) : parsed
}

/**
 * @param {string} word
 * @param {1 | 2 | 3 | 4} grade
 */
export function updateReview(word, grade) {
  const db = getDb()
  /** @type {{ ease_factor: number; interval: number; repetitions: number } | undefined} */
  const review = /** @type {any} */ (db
    .prepare(
      `SELECT ease_factor, interval, repetitions FROM reviews WHERE word = ?`,
    )
    .get(word))

  if (!review) {
    throw new Error(`No review entry for word "${word}"`)
  }

  const now = new Date()
  const result = sm2(
    {
      repetitions: review.repetitions,
      easeFactor: review.ease_factor,
      interval: review.interval,
    },
    grade,
  )

  db.prepare(
    `UPDATE reviews
     SET ease_factor = ?, interval = ?, repetitions = ?,
         next_review_at = ?, last_reviewed_at = ?
     WHERE word = ?`,
  ).run(
    result.easeFactor,
    result.interval,
    result.repetitions,
    result.nextReviewAt.toISOString(),
    now.toISOString(),
    word,
  )
}

/**
 * @returns {{ total: number; reviewed: number; due: number }}
 */
export function getStats() {
  const db = getDb()
  const now = new Date().toISOString()

  /** @type {{ c: number } | undefined} */
  const total = /** @type {any} */ (db.prepare('SELECT COUNT(*) AS c FROM cards').get())
  /** @type {{ c: number } | undefined} */
  const reviewed = /** @type {any} */ (db
    .prepare('SELECT COUNT(*) AS c FROM reviews WHERE repetitions > 0')
    .get())
  /** @type {{ c: number } | undefined} */
  const due = /** @type {any} */ (db
    .prepare(
      'SELECT COUNT(*) AS c FROM reviews WHERE next_review_at IS NOT NULL AND next_review_at <= ?',
    )
    .get(now))

  return {
    total: total?.c ?? 0,
    reviewed: reviewed?.c ?? 0,
    due: due?.c ?? 0,
  }
}

/**
 * Get a single card with its review data (regardless of due status).
 * Returns null if the word doesn't exist.
 *
 * @param {string} word
 * @returns {CardRow | null}
 */
export function getCard(word) {
  const db = getDb()
  /** @type {RawCardRow | undefined} */
  const row = /** @type {any} */ (db
    .prepare(
      `SELECT c.word, c.data, c.query_count,
              r.ease_factor, r.interval, r.repetitions, r.next_review_at
       FROM cards c
       LEFT JOIN reviews r ON r.word = c.word
       WHERE c.word = ?`,
    )
    .get(word))

  if (!row) return null
  return { ...row, data: JSON.parse(row.data) }
}

/**
 * Close the database connection.
 */
export function closeDb() {
  if (_db) {
    _db.close()
    _db = null
  }
}

/**
 * Print all cards and review state to console (for debugging).
 * Skips the full data JSON to keep output readable.
 * @param {string} [word]
 */
export function debugDump(word) {
  const db = getDb()

  const sql = word
    ? `SELECT c.word, c.query_count, c.last_queried_at,
              r.ease_factor, r.interval, r.repetitions, r.next_review_at
       FROM cards c
       LEFT JOIN reviews r ON r.word = c.word
       WHERE c.word = ?
       ORDER BY c.last_queried_at DESC`
    : `SELECT c.word, c.query_count, c.last_queried_at,
              r.ease_factor, r.interval, r.repetitions, r.next_review_at
       FROM cards c
       LEFT JOIN reviews r ON r.word = c.word
       ORDER BY c.last_queried_at DESC`

  const params = word ? [word] : []
  const cards = /** @type {any[]} */ (db.prepare(sql).all(...params))

  console.log()
  console.log('  ── Flash card database ──')
  console.log(`  Path: ${DB_PATH}`)
  console.log(`  Cards: ${cards.length}`)
  console.log()

  if (cards.length > 0) {
    for (const card of cards) {
      console.log(
        `  ${card.word.padEnd(16)} q:${String(card.query_count).padEnd(2)} EF:${String(card.ease_factor).padEnd(4)} int:${String(card.interval).padEnd(3)} reps:${String(card.repetitions).padEnd(2)} next:${card.next_review_at || '-'}`,
      )
    }
  }

  console.log()
}

/**
 * Check if node:sqlite is available and db can be initialized.
 *
 * @returns {boolean}
 */
export function isSqliteAvailable() {
  return tryLoadSqlite() !== null
}

/**
 * For testing: set a custom db path.
 * @param {string} dbPath
 */
export function useDbPathForTest(dbPath) {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const sqlite = tryLoadSqlite()
  if (sqlite) {
    _db = new sqlite.DatabaseSync(dbPath)
    _db.exec('PRAGMA journal_mode=WAL')
    initSchema(_db)
  }
}

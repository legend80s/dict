// @ts-check
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { sm2, MIN_EASE_FACTOR, INITIAL_EASE_FACTOR } from '../src/flash/sm2.mjs'

const {
  saveCard,
  getCard,
  getDueCards,
  updateReview,
  getStats,
  closeDb,
  isSqliteAvailable,
  useDbPathForTest,
  debugDump,
} = await import('../src/flash/db.mjs')

/** @param {string} filePath */
function cleanupFile(filePath) {
  try { fs.unlinkSync(filePath) } catch { /* ignore */ }
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ydd-test-'))
}

test('sm2: grade 1 (Again) resets to 0 interval', () => {
  const result = sm2({ repetitions: 5, easeFactor: 2.5, interval: 30 }, 1)

  assert.strictEqual(result.repetitions, 0)
  assert.strictEqual(result.interval, 0)
  assert.strictEqual(result.easeFactor, 2.3) // 2.5 - 0.2
})

test('sm2: grade 2 (Hard) sets interval to 1', () => {
  const result = sm2({ repetitions: 3, easeFactor: 2.5, interval: 15 }, 2)

  assert.strictEqual(result.repetitions, 0)
  assert.strictEqual(result.interval, 1)
  assert.strictEqual(result.easeFactor, 2.35) // 2.5 - 0.15
})

test('sm2: grade 3 (Good) increases interval', () => {
  const result = sm2({ repetitions: 2, easeFactor: 2.5, interval: 6 }, 3)

  assert.strictEqual(result.repetitions, 3)
  assert.strictEqual(result.interval, 15) // 6 * 2.5 = 15
  assert.strictEqual(result.easeFactor, 2.5) // unchanged
})

test('sm2: grade 3 on first review sets interval to 1', () => {
  const result = sm2({ repetitions: 0, easeFactor: 2.5, interval: 0 }, 3)

  assert.strictEqual(result.repetitions, 1)
  assert.strictEqual(result.interval, 1)
})

test('sm2: grade 3 on second review sets interval to 6', () => {
  const result = sm2({ repetitions: 1, easeFactor: 2.5, interval: 1 }, 3)

  assert.strictEqual(result.repetitions, 2)
  assert.strictEqual(result.interval, 6)
})

test('sm2: grade 4 (Easy) boosts interval by 1.3x', () => {
  const result = sm2({ repetitions: 2, easeFactor: 2.5, interval: 6 }, 4)

  assert.strictEqual(result.repetitions, 3)
  assert.strictEqual(result.interval, 20) // Math.round(6 * 2.5 * 1.3) = Math.round(19.5) = 20
  assert.strictEqual(result.easeFactor, 2.65) // 2.5 + 0.15
})

test('sm2: ease factor clamped to MIN_EASE_FACTOR', () => {
  const result = sm2({ repetitions: 10, easeFactor: 1.3, interval: 100 }, 1)

  assert.strictEqual(result.easeFactor, 1.3) // 1.3 - 0.2 = 1.1, clamped to 1.3
})

test('sm2: nextReviewAt is set correctly for today + interval', () => {
  const now = new Date()
  const result = sm2({ repetitions: 0, easeFactor: 2.5, interval: 0 }, 3)

  const expected = new Date()
  expected.setDate(expected.getDate() + 1)
  expected.setHours(0, 0, 0, 0)

  assert.strictEqual(result.nextReviewAt.getTime(), expected.getTime())
})

test('sm2: invalid grade throws', () => {
  assert.throws(
    // @ts-expect-error testing invalid input
    () => sm2({ repetitions: 0, easeFactor: 2.5, interval: 0 }, 5),
    /Invalid grade/,
  )
})

// -------------------------------------------------------------------------
// DB tests (require --experimental-sqlite)
// -------------------------------------------------------------------------
test('db: saveCard inserts new word', { skip: !isSqliteAvailable() }, () => {
  const dbPath = `${tmpDir()}/test-flash-${Date.now()}.db`
  useDbPathForTest(dbPath)

  saveCard('silhouette', { explanations: ['n. 轮廓，剪影'] })
  const due = getDueCards()
  assert.ok(due.length >= 1)
  const card = due.find(c => c.word === 'silhouette')
  assert.ok(card)
  assert.strictEqual(card.data.explanations[0], 'n. 轮廓，剪影')
  assert.strictEqual(card.query_count, 1)

  closeDb()
  cleanupFile(dbPath)
})

test('db: saveCard increments query_count on repeat', { skip: !isSqliteAvailable() }, () => {
  const dbPath = `${tmpDir()}/test-flash-${Date.now()}.db`
  useDbPathForTest(dbPath)

  saveCard('apple', { explanations: ['n. 苹果'] })
  saveCard('apple', { explanations: ['n. 苹果'] })
  const due2 = getDueCards()
  const card2 = due2.find(c => c.word === 'apple')
  assert.ok(card2)
  assert.strictEqual(card2.query_count, 2)

  closeDb()
  cleanupFile(dbPath)
})

test('db: updateReview updates SM-2 parameters', { skip: !isSqliteAvailable() }, () => {
  const dbPath = `${tmpDir()}/test-flash-${Date.now()}.db`
  useDbPathForTest(dbPath)

  saveCard('banana', { explanations: ['n. 香蕉'] })
  updateReview('banana', 3) // Good

  const card3 = getCard('banana')
  assert.ok(card3)
  assert.strictEqual(card3.repetitions, 1)
  assert.strictEqual(card3.interval, 1)
  const due3 = getDueCards()
  assert.strictEqual(due3.find(c => c.word === 'banana'), undefined)

  closeDb()
  cleanupFile(dbPath)
})

test('db: getStats returns correct counts', { skip: !isSqliteAvailable() }, () => {
  const dbPath = `${tmpDir()}/test-flash-${Date.now()}.db`
  useDbPathForTest(dbPath)

  saveCard('cherry', { explanations: ['n. 樱桃'] })
  saveCard('date', { explanations: ['n. 日期'] })
  const beforeReview = getStats()
  assert.strictEqual(beforeReview.total, 2)

  updateReview('cherry', 3)
  const afterReview = getStats()
  assert.strictEqual(afterReview.reviewed, 1)

  closeDb()
  cleanupFile(dbPath)
})

test('db: debugDump prints all cards', { skip: !isSqliteAvailable() }, () => {
  const dbPath = `${tmpDir()}/test-dump-all-${Date.now()}.db`
  useDbPathForTest(dbPath)
  saveCard('dump-all-a', { explanations: ['n. A'] })
  saveCard('dump-all-b', { explanations: ['n. B'] })

  /** @type {string[]} */
  const logs = []
  const origLog = console.log
  console.log = (...args) => logs.push(args.join(' '))

  try {
    debugDump()
    const output = logs.join('\n')
    assert.match(output, /## Dump-all-a/)
    assert.match(output, /## Dump-all-b/)
    assert.match(output, /查询: 1/)
  } finally {
    console.log = origLog
    closeDb()
    cleanupFile(dbPath)
  }
})

test('db: debugDump prints single card', { skip: !isSqliteAvailable() }, () => {
  const dbPath = `${tmpDir()}/test-dump-one-${Date.now()}.db`
  useDbPathForTest(dbPath)
  saveCard('dump-one-x', { explanations: ['n. X'] })
  saveCard('dump-one-y', { explanations: ['n. Y'] })

  /** @type {string[]} */
  const logs = []
  const origLog = console.log
  console.log = (...args) => logs.push(args.join(' '))

  try {
    debugDump('dump-one-x')
    const output = logs.join('\n')
    assert.match(output, /## Dump-one-x/)
    assert.doesNotMatch(output, /## Dump-one-y/)
  } finally {
    console.log = origLog
    closeDb()
    cleanupFile(dbPath)
  }
})

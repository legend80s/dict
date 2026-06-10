// @ts-check
import { saveCard } from './db.mjs'

/**
 * Silently record a word query to the flash card history database.
 * Fails gracefully — a warning is logged in verbose mode.
 *
 * @param {string} word
 * @param {import('../../typings').IParsedResult} result
 */
export async function recordQueryToHistory(word, result) {
  try {
    saveCard(word, result)
  } catch (/** @type {unknown} */ err) {
    const { parsed } = await import('../utils/arg-parser.mjs')
    if (parsed.verbose) {
      console.warn('⚠️ 无法保存查询历史:', err instanceof Error ? err.message : String(err))
    }
  }
}

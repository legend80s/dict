// @ts-check
import { exec } from 'node:child_process'
import { italic, green, white, bold } from '../utils/lite-lodash.mjs'

/** @import { ICollinsItem, IExample } from '../../typings' */

const HORIZONTAL = '\u2500'
const VERTICAL = '\u2502'
const TOP_LEFT = '\u250c'
const TOP_RIGHT = '\u2510'
const BOTTOM_LEFT = '\u2514'
const BOTTOM_RIGHT = '\u2518'

// Box dimensions
const INNER_WIDTH = 34
const MARGIN = 2
const TEXT_WIDTH = INNER_WIDTH - MARGIN * 2

/**
 * @param {string} str
 * @returns {number}
 */
function displayWidth(str) {
  const clean = str.replace(/\x1b\[[0-9;]*m/g, '')
  let width = 0
  for (const char of clean) {
    const code = char.codePointAt(0) || 0
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef) ||
      (code >= 0x1f300 && code <= 0x1f9ff) ||
      (code >= 0x2600 && code <= 0x26ff) ||
      (code >= 0x2700 && code <= 0x27bf)
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

/**
 * @param {string} str
 * @param {number} targetWidth
 * @returns {string}
 */
function padText(str, targetWidth) {
  const w = displayWidth(str)
  return w >= targetWidth ? str : str + ' '.repeat(targetWidth - w)
}

/**
 * Build a content line inside the card box.
 * @param {string} content
 * @returns {string}
 */
function contentLine(content) {
  return `${VERTICAL}${' '.repeat(MARGIN)}${padText(content, TEXT_WIDTH)}${' '.repeat(MARGIN)}${VERTICAL}`
}

/**
 * Build a blank separator line across the card.
 * @returns {string}
 */
function blankLine() {
  return `${VERTICAL}${' '.repeat(INNER_WIDTH)}${VERTICAL}`
}

function topBorder() {
  return `${TOP_LEFT}${HORIZONTAL.repeat(INNER_WIDTH)}${TOP_RIGHT}`
}

function bottomBorder() {
  return `${BOTTOM_LEFT}${HORIZONTAL.repeat(INNER_WIDTH)}${BOTTOM_RIGHT}`
}

/**
 * @typedef {{ word: string; explanations: string[]; englishExplanation?: ICollinsItem[]; examples?: IExample[]; query_count: number }} CardData
 */

/**
 * @param {CardData} card
 * @param {number} index
 * @param {number} total
 */
export function renderFront(card, index, total) {
  const word = card.word || ''
  const lines = []

  lines.push(topBorder())
  lines.push(blankLine())
  lines.push(blankLine())
  lines.push(blankLine())
  lines.push(contentLine(centerText(bold(word), TEXT_WIDTH)))
  lines.push(blankLine())
  lines.push(blankLine())
  lines.push(blankLine())
  lines.push(bottomBorder())
  lines.push(`  ${italic(`📊 ${index + 1}/${total}`)}  [${bold('p', { underlined: false })}] Speak  [${bold('q', { underlined: false })}] Quit`)
  lines.push(`  ${white('Press any key to reveal answer')}`)

  drawFrame(lines)
}

/**
 * @param {CardData} card
 * @param {number} index
 * @param {number} total
 */
export function renderBack(card, index, total) {
  const word = card.word || ''
  const explanations = card.explanations || []
  const englishExplanation = card.englishExplanation || []
  const examples = card.examples || []
  const queryCount = card.query_count || 1
  const lines = []

  lines.push(topBorder())
  lines.push(blankLine())
  lines.push(contentLine(bold(word)))
  lines.push(blankLine())

  for (const exp of explanations) {
    const cleaned = exp.replace(/（.+?）|<.+?>|\[.+?\]/g, '').trim()
    for (const line of wrapText(cleaned, TEXT_WIDTH)) {
      lines.push(contentLine(white(line)))
    }
  }

  lines.push(blankLine())

  if (englishExplanation.length > 0) {
    for (const item of englishExplanation) {
      const english = Array.isArray(item) ? item[0] : item.english
      const partOfSpeech = !Array.isArray(item) ? item.partOfSpeech : undefined
      const cleaned = english.replace(/^\d+\.\s/, '')
      const label = partOfSpeech ? `[${partOfSpeech}] ${cleaned}` : cleaned
      for (const line of wrapText(label, TEXT_WIDTH)) {
        lines.push(contentLine(italic(line)))
      }

      const sentences = Array.isArray(item)
        ? (item[1] ? [String(item[1])] : [])
        : [item.eng_sent, item.chn_sent].filter(/** @returns {val is string} */ val => !!val)

      for (const sent of sentences.slice(0, 2)) {
        for (const line of wrapText(sent, TEXT_WIDTH - 2)) {
          lines.push(contentLine(`  ${highlightBoldTags(line)}`))
        }
      }
    }
    lines.push(blankLine())
  }

  if (examples.length > 0) {
    const [sentence, translation] = examples[0]
    for (const line of wrapText(sentence, TEXT_WIDTH)) {
      lines.push(contentLine(highlightBoldTags(line)))
    }
    for (const line of wrapText(translation, TEXT_WIDTH)) {
      lines.push(contentLine(italic(line)))
    }
    lines.push(blankLine())
  }

  lines.push(contentLine(white(`Queries: ${queryCount}`)))
  lines.push(blankLine())

  const btnLine = `1.${green('Again')} 2.${green('Hard')} 3.${green('Good')} 4.${green('Easy')}`
  lines.push(contentLine(btnLine))
  lines.push(blankLine())

  lines.push(bottomBorder())
  lines.push(`  📊 ${index + 1}/${total}  [${bold('p', { underlined: false })}] Speak [${bold('q', { underlined: false })}] Quit`)

  drawFrame(lines)
}

export function renderNoCards() {
  const lines = []
  lines.push(topBorder())
  lines.push(blankLine())
  lines.push(contentLine(white('No cards to review')))
  lines.push(blankLine())
  lines.push(contentLine(white('Query some words first')))
  lines.push(blankLine())
  lines.push(bottomBorder())

  drawFrame(lines)
}

/**
 * @param {{ total: number; reviewed: number }} stats
 */
export function renderComplete(stats) {
  const lines = []
  lines.push(topBorder())
  lines.push(blankLine())
  lines.push(contentLine(white('All cards reviewed!')))
  lines.push(blankLine())
  lines.push(contentLine(`Today: ${stats.reviewed}  Total: ${stats.total}`))
  lines.push(blankLine())
  lines.push(contentLine(italic('See you tomorrow 🎉')))
  lines.push(blankLine())
  lines.push(bottomBorder())
  lines.push('')

  drawFrame(lines)
}

/**
 * @param {string} message
 */
export function renderError(message) {
  const lines = []
  lines.push(topBorder())
  lines.push(blankLine())
  for (const line of wrapText(message, TEXT_WIDTH)) {
    lines.push(contentLine(line))
  }
  lines.push(blankLine())
  lines.push(bottomBorder())
  lines.push('')

  drawFrame(lines)
}

/**
 * @param {string[]} lines
 */
/**
 * Replace `<b>...</b>` tags with ANSI bold formatting.
 * @param {string} text
 * @returns {string}
 */
/**
 * Center text within a given display width.
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function centerText(text, width) {
  const w = displayWidth(text)
  const leftPad = Math.max(0, Math.floor((width - w) / 2))
  return ' '.repeat(leftPad) + text
}

/**
 * @param {string} text
 * @returns {string}
 */
function highlightBoldTags(text) {
  return text.replace(/<b>(.+?)<\/b>/g, (/** @type {string} */ _, /** @type {string} */ p1) => bold(p1))
}

/** @param {string[]} lines */
function drawFrame(lines) {
  process.stdout.write('\x1b[2J\x1b[H')

  const pad = '  '
  const terminalWidth = process.stdout.columns || 80
  const leftPad = Math.max(0, Math.floor((terminalWidth - INNER_WIDTH - 4) / 2))

  for (const line of lines) {
    process.stdout.write(' '.repeat(leftPad) + pad + line + '\n')
  }
}

export function enterRawMode() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
  }
}

export function exitRawMode() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false)
    process.stdin.pause()
  }
}

/**
 * @returns {Promise<string>}
 */
function waitForKey() {
  return new Promise(resolve => {
    /** @param {Buffer} buf */
    const handler = buf => {
      process.stdin.removeListener('data', handler)
      const key = buf.toString()
      resolve(key)
    }
    process.stdin.on('data', handler)
  })
}

/**
 * @returns {Promise<{ action: 'flip' } | { action: 'speak' } | { action: 'quit' }>}
 */
export async function waitForAnyKey() {
  const key = await waitForKey()

  if (key === 'q' || key === '\u0003') {
    return { action: 'quit' }
  }

  if (key === 'p') {
    return { action: 'speak' }
  }

  return { action: 'flip' }
}

/**
 * @returns {Promise<{ action: 'grade'; grade: 1|2|3|4 } | { action: 'speak' } | { action: 'quit' }>}
 */
export async function waitForGrade() {
  while (true) {
    const key = await waitForKey()

    if (key === 'q' || key === '\u0003') {
      return { action: 'quit' }
    }

    if (key === '1') return { action: 'grade', grade: 1 }
    if (key === '2') return { action: 'grade', grade: 2 }
    if (key === '3') return { action: 'grade', grade: 3 }
    if (key === '4') return { action: 'grade', grade: 4 }

    if (key === 'p') return { action: 'speak' }
  }
}

/**
 * @param {string} word
 */
export function speak(word) {
  exec(`say ${word}`, err => {
    if (err && process.stdout.isTTY) {
      process.stdout.write(`\x1b[2K\r${' '.repeat(5)}⚠️ Speak failed\n`)
    }
  })
}

/**
 * Word-wrap: break text at maxWidth visual columns, preferring word breaks.
 * Uses displayWidth for CJK-aware line length.
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(text, maxWidth) {
  if (!text) return ['']
  const str = String(text).trim()
  if (displayWidth(str) <= maxWidth) return [str]

  if (!str.includes(' ')) {
    return splitByGrapheme(str, maxWidth)
  }

  const words = str.split(' ')
  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? current + ' ' + word : word
    if (displayWidth(candidate) > maxWidth) {
      if (current) {
        lines.push(current.trim())

        if (displayWidth(word) > maxWidth) {
          lines.push(...splitByGrapheme(word, maxWidth))
          current = ''
        } else {
          current = word
        }
      } else {
        lines.push(...splitByGrapheme(word, maxWidth))
      }
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current.trim())

  return lines
}

/**
 * Split a CJK/non-spaced string into lines that fit maxWidth.
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function splitByGrapheme(text, maxWidth) {
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
  const chars = [...segmenter.segment(text)].map(s => s.segment)
  const lines = []
  let current = ''
  for (const char of chars) {
    if (displayWidth(current) + displayWidth(char) > maxWidth) {
      if (current) lines.push(current)
      current = char
    } else {
      current += char
    }
  }
  if (current) lines.push(current)
  return lines
}

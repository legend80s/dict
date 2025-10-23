// @ts-check
import { parser, verbose } from '../utils/arg-parser.mjs'
import { fetchIt } from '../utils/fetch.mjs'
import { evaluateNuxtInScriptTagUseVM, timeit } from '../utils/lite-lodash.mjs'
import { debugC } from '../utils/logger.mjs'
import { text } from './constants.mjs'

/** @typedef {import('../../typings').ICollinsItem} ICollinsItem  */
/** @typedef {import('../../typings').IParsedResult} IParsedResult */

const lookup = verbose ? timeit('? by nuxt fetch', lookupByNuxtInHTML) : lookupByNuxtInHTML

/**
 * @param {string} word
 * @returns {string}
 */
function makeHTMLUrl(word) {
  return `https://dict.youdao.com/result?word=${encodeURIComponent(word)}&lang=en`
}

/** @type {import('../../typings').IDictionary} */
export const dictionaryByNuxt = { makeHTMLUrl, lookup }

/**
 * @type {import('../../typings').IDictionary['lookup']}
 */
async function lookupByNuxtInHTML(word, { example = false, collins = false }) {
  const label = '? [core] by nuxt fetch'
  verbose && console.time(label)

  const htmlUrl = makeHTMLUrl(word)
  // const html = execSync(`curl --silent ${htmlUrl}`).toString("utf-8"); // 367.983ms
  let html = ''
  try {
    ;[html] = await fetchIt(htmlUrl, { type: 'text' }) // 241.996ms
  } catch (/** @type {Error} */ error) {
    return { errorMsg: `fetch "${htmlUrl}" FAILED.`, error }
  }

  // debugC('lookupByNuxtInHTML', { method });

  const nuxt = evaluateNuxtInScriptTagUseVM(html)

  const data = nuxt.data[0]
  // console.log('data:', JSON.stringify(data, null, 2));
  // 找不到单词或输入了非英语
  if (!data) {
    debugC('No translate found:', { nuxt, html })

    return {
      errorMsg: text.error.notFound(word),
      error: new Error(text.error.notFound(word)),
    }
  }

  const explanations = data.wordData.ec.word.trs.map(item =>
    [item.pos, item.tran].filter(Boolean).join(' '),
  )

  // console.log('englishExplanation:', englishExplanation);
  if (!example && !collins) {
    return { explanations }
  }

  const examples = !example ? [] : extractExamples(data)

  const [englishExplanation, englishExplanationTotalCount] = collins ? extractCollins(data) : []

  verbose && console.timeEnd(label)

  return {
    explanations,
    examples,
    englishExplanation,
    englishExplanationTotalCount,
  }
}

/**
 * @param {import('../../typings').IData} data
 * @returns {import('../../typings').IExample[]}
 */
function extractExamples(data) {
  return data.wordData.blng_sents_part['sentence-pair'].map(item => {
    /** @type {import('../../typings').IExample} */
    const example = [item['sentence-eng'], item['sentence-translation'], item.source || '']

    return example
  })
}

/**
 * @param {import('../../typings').IData} data
 * @returns {[ICollinsItem[]?, number?]}
 */
function extractCollins(data) {
  console.log('data:', JSON.stringify(data))
  const collinsInData = data.wordData.collins

  if (!collinsInData) {
    return []
  }

  const list = collinsInData.collins_entries[0].entries.entry

  const num = parser.get('collins')
  // `--collins=all` to show all collins
  // @ts-expect-error
  // oxlint-disable-next-line prefer-string-starts-ends-with
  const size = /^a/.test(num) ? list.length : Number(num) || 1

  debugC('size:', size)
  // console.log('list:', list);

  const collins = list
    .slice(0, size)
    .filter(item => item.tran_entry[0].tran)
    .map(item => {
      const entry = item.tran_entry[0]
      /** @type {ICollinsItem} */
      const tuple = [
        // @ts-expect-error
        entry.tran,
        // @ts-expect-error
        [entry.exam_sents.sent[0].eng_sent, entry.exam_sents.sent[0].chn_sent],
      ]

      return tuple
    })

  return [collins, list.length]
}

// @ts-check
import { DEFAULTS, parsed } from '../utils/arg-parser.mjs'
import { fetchIt } from '../utils/fetch.mjs'
import { evaluateNuxtInScriptTagUseVM, red, timeit } from '../utils/lite-lodash.mjs'
import { debugNuxt } from '../utils/logger.mjs'
import { text } from './constants.mjs'

/** @typedef {import('../../typings').ICollinsItem} ICollinsItem  */
/** @typedef {import('../../typings').IParsedResult} IParsedResult */

const verbose = parsed.verbose
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
  } catch (
    // @ts-expect-error
    /** @type {Error} */ error
  ) {
    return { errorMsg: `fetch "${htmlUrl}" FAILED.`, error }
  }

  // debugNuxt('lookupByNuxtInHTML', { method });

  const nuxt = evaluateNuxtInScriptTagUseVM(html)

  const data = nuxt.data[0]
  // console.log('data:', JSON.stringify(data))
  // 找不到单词或输入了非英语
  if (!data) {
    debugNuxt('No translate found:', { nuxt, html })

    return {
      errorMsg: text.error.notFound(word),
      error: new Error(text.error.notFound(word)),
    }
  }

  const explanations =
    data.wordData.ec?.word.trs.map(item => [item.pos, item.tran].filter(Boolean).join(' ')) ||
    (data.wordData.fanyi?.tran ? [data.wordData.fanyi?.tran] : [])

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
  // console.log('🚀 ~ extractExamples ~ data:', data)

  return (
    data.wordData.blng_sents_part?.['sentence-pair'].map(item => {
      /** @type {import('../../typings').IExample} */
      const example = [item['sentence-eng'], item['sentence-translation'], item.source || '']

      return example
    }) || []
  )
}

/**
 * @param {import('../../typings').IData} data
 * @returns {[ICollinsItem[]?, number?]}
 */
function extractCollins(data) {
  // console.log('data:', JSON.stringify(data))
  const collinsInData = data.wordData.collins

  if (!collinsInData) {
    return []
  }

  const list = collinsInData.collins_entries[0].entries.entry.filter(
    item => item.tran_entry[0].tran,
  )

  const num = parsed.collins
  if (!num) {
    debugNuxt(
      red(`in extractCollins num SHOULD NOT BE NIL! typeof num: ${typeof num}, num: ${num}`),
    )
  }
  // console.log('num:', num)
  // `--collins=all` to show all collins
  // oxlint-disable-next-line prefer-string-starts-ends-with
  /** @type {import('../../typings').int} */
  // @ts-expect-error
  // oxlint-disable-next-line prefer-string-starts-ends-with
  // 如果 num 是 all 则展示全部
  // 如果 num 是数字 则展示 num 个
  // 如果 num 是其他 则展示默认的
  const size = (/^a/.test(num) ? list.length : num && Number(num)) || DEFAULTS.collins

  debugNuxt('size:', size)
  debugNuxt('list:', JSON.stringify(list))

  const collins = list.slice(0, size).map(item => {
    const entry = item.tran_entry[0]
    /** @type {ICollinsItem} */
    const parsed = {
      partOfSpeech: [entry.pos_entry?.pos, entry.pos_entry?.pos_tips].filter(Boolean).join(' '),
      // @ts-expect-error
      english: entry.tran,

      eng_sent: entry.exam_sents?.sent[0].eng_sent,
      chn_sent: entry.exam_sents?.sent[0].chn_sent,
    }

    return parsed
  })

  return [collins, list.length]
}

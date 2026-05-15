// oxlint-disable no-console
/** biome-ignore-all lint/correctness/noUnreachable: <explanation> */
// @ts-check
import { exec } from 'node:child_process'
import { log } from 'node:console'

import { config, genErrorResult, text } from './core/constants.mjs'
import { dictionary } from './core/dictionary.mjs'
import { help, parsed } from './utils/arg-parser.mjs'
import { Fatigue } from './utils/fatigue.mjs'
import { fetchIt } from './utils/fetch.mjs'
import { bold, green, h1, h2, highlight, italic, red, white } from './utils/lite-lodash.mjs'
import { streamToStdout } from './utils/stream.mjs'
import { debugC } from './utils/logger.mjs'

/** @import { IParsedResult, IErrorResult } from '../typings' */

/** @type {(sentence: string) => string} */
let highlightWord

const verbose = parsed.verbose

/**
 * 主入口。获取单词，查询，输出结果。
 * 编排逻辑：
 * 1. 如果某个渠道获取失败，则尝试下一个渠道。
 * 2. 参数增加疲劳度控制
 * @param {string} word
 * @returns {Promise<boolean>} false: 没有发起查询请求，true: 发起了查询请求
 */
export const query = async word => {
  debugC('Word:', `"${word}"`)

  if (!word) {
    exitWithErrorMsg(word, genErrorResult(word, 'noWord'))

    return false
  }

  const showExamples = parsed.example
  const showCollins = !!parsed.collins

  /** @type {IParsedResult} */
  let result = { explanations: [] }

  if (showExamples || showCollins) {
    result = await translateWithExamples(word, {
      example: showExamples,
      collins: showCollins,
    })
  } else {
    const json = await byJSON(word)

    // failed
    if ('errorMsg' in json) {
      result = await dictionary.lookup(word, {
        example: false,
        collins: false,
      })
    } else {
      result = json
    }
  }

  return print(word, result)
}

/**
 * @type {import('../typings').IDictionary['lookup']}
 */
async function translateWithExamples(word, { example, collins }) {
  const htmlResult = await dictionary.lookup(word, { example, collins })

  if ('errorMsg' in htmlResult) {
    debugC('Fallback to JSON when HTML fetch failed')

    const jsonResult = await byJSON(word)

    return jsonResult
  }

  return htmlResult
}

/**
 * @param {string} word
 * @param {IErrorResult} param0
 */
function exitWithErrorMsg(word, { errorMsg, error, errorType }) {
  if (verbose) {
    error && console.error(error)
  } else {
    console.error(`\n> ❌ ${errorMsg}`)
  }

  if (errorType === 'notFound') {
    console.info(`> ${dictionary.makeHTMLUrl(word)}`)
  } else {
    help({ showVersion: false, showDescription: false })
  }
}

/**
 * @param {string} word
 * @param {IParsedResult} result
 */
async function print(word, result) {
  if ('errorMsg' in result) {
    exitWithErrorMsg(word, result)

    return false
  }

  const {
    explanations,
    englishExplanation,
    englishExplanationTotalCount = 0,
    examples,
    suggestions,
  } = result

  /** @type {string[]} */
  // @ts-expect-error
  const collinsChineseExplanation = !englishExplanation
    ? []
    : englishExplanation
        .flatMap(item => (Array.isArray(item) ? item[0] : item.english).match(/[\u4e00-\u9fa5]+/g))
        // filter out the `null`s
        .filter(Boolean)

  const explanationWords = explanations
    .map(row => row.replace(/（.+?）|<.+?>|\[.+?\]/g, ''))
    .reduce((/** @type {string[]} */ acc, row) => {
      return acc.concat(row.split(/[，；\s]/).slice(1))
    }, [])
    .concat(collinsChineseExplanation)
    .map(w => w.trim())
    .filter(w => !!w && w !== '的')
    // match as longer as possible
    .sort((a, b) => b.length - a.length)
    .map(w => w.replaceAll('?', '').replace(/([的地])$/, '$1?'))

  // console.log('explanationWords:', explanationWords);

  highlightWord = sentence => {
    // 如果句子包含<b>，则直接对其内容高亮
    if (sentence.includes('<b>')) {
      return sentence.replaceAll(/<b>(.+?)<\/b>/g, (_match, p1) => {
        // console.log('match:', {match, p1});
        return bold(p1)
      })
    }

    // 否则自定义高亮规则
    // 如果句子包含explanationWords中的词，则高亮
    return highlight(sentence, [word, ...explanationWords])
  }

  const hasExample = !!examples?.length

  verbose && log(h1(`"${word}"`))

  const output = buildOutputString({
    word,
    explanations,
    englishExplanation,
    englishExplanationTotalCount,
    examples,
    suggestions,
    hasExample,
    highlightWord,
  })

  if (parsed.stream) {
    await streamToStdout(output)
  } else {
    console.log(output)
  }

  return true
}

/**
 * @param {{
 *   word: string
 *   explanations: string[]
 *   englishExplanation: import('../typings').ICollinsItem[] | undefined
 *   englishExplanationTotalCount: number
 *   examples: import('../typings').IExample[] | undefined
 *   suggestions: string[] | undefined
 *   hasExample: boolean
 *   highlightWord: (sentence: string) => string
 * }} _
 */
function buildOutputString({
  word,
  explanations,
  englishExplanation,
  englishExplanationTotalCount,
  examples,
  suggestions,
  hasExample,
  highlightWord,
}) {
  let output = ''

  output += '\n'
  if (hasExample) {
    output += h2('Explanations 💡') + '\n'
  }

  output += explanations.map(exp => config.listItemIcon + ' ' + white(exp)).join('\n') + '\n'

  const suggestedWord = suggestions?.[0]
  if (suggestedWord) {
    output += '\n你要找的是不是: ' + white(suggestedWord) + '\n'
  }

  if (englishExplanation?.[0]) {
    output += '\n'

    let sub = ''

    const isDefaultValue = parsed.collins === undefined

    if (englishExplanationTotalCount > 1 && isDefaultValue) {
      /** @param {string} str */
      const surround = str => `\`${italic(white(str))}\``
      const tips = ['-c=2', '-c=all'].map(surround).join(' or ')

      sub = `. Add ${tips} to show more examples.`
    }

    const header = `柯林斯英汉双解大词典 [#${englishExplanationTotalCount}] 📖`
    output += h2(header) + sub + '\n'

    const str = englishExplanation
      .map((item, index) => {
        const { english, sentences, partOfSpeech } = Array.isArray(item)
          ? { english: item[0], sentences: item[1] }
          : {
              partOfSpeech: item.partOfSpeech,
              english: item.english,
              sentences: [item.eng_sent, item.chn_sent].filter(Boolean),
            }
        // console.log('english:', english);
        // console.log('sentences:', sentences);
        const rendered =
          typeof sentences === 'string'
            ? `  ${sentences.replace('例： ', '例：')}`
            : sentences
                ?.map((s, i) => {
                  // const THREE_SPACES = '   '
                  // const spaces =
                  //   len < 10 ? THREE_SPACES : THREE_SPACES + (index + 1 >= 10 ? ' ' : '')
                  const spaces = ''

                  return `${spaces}${green(i !== sentences.length - 1 ? '├──' : '└──')} ${s}`
                })
                .join('\n')

        const highlighted = [
          // remove prefix index
          `${english.replace(/^\d+\.\s/, '')}`,
          rendered || '',
        ]
          .map(highlightWord)
          .join('\n')

        return [colorIndex(index), partOfSpeech && `[${partOfSpeech}]`, white(highlighted)]
          .filter(Boolean)
          .join(' ')
      })
      .join('\n\n')

    output += red(str) + '\n'

    if (englishExplanation.length < englishExplanationTotalCount) {
      output += '...\n'
    }
  }

  // console.log('hasExample:', hasExample);

  if (hasExample) {
    output += buildExamplesString(examples, highlightWord)
  }

  output += buildFeaturesString(word, suggestedWord)

  output += '\n' + italic(`See more at ${dictionary.makeHTMLUrl(word)}`)

  return output
}

/**
 *
 * @param {string} word
 * @param {string | undefined} suggestedWord
 */
function buildFeaturesString(word, suggestedWord) {
  let output = ''
  const fatigue = new Fatigue(verbose)

  const exampleFlagSet = parsed.example
  if (exampleFlagSet) {
    fatigue.setTired('example')
  }

  const speakFlagSet = parsed.speak
  if (speakFlagSet) {
    fatigue.setTired('speak')
  }

  if (!exampleFlagSet && !fatigue.hit('example')) {
    output += '\n'
    output +=
      white(
        `Try \`npx ydd ${suggestedWord || word} ${bold('-e -c=2|all')}\` to get some examples ✨.`,
      ) + '\n'
    fatigue.increment('example')
  } else if (!speakFlagSet && !fatigue.hit('speak')) {
    output += '\n'
    output +=
      white(`Try \`npx ydd ${suggestedWord || word} ${bold('-s')}\` to speak it out 📣.`) + '\n'
    fatigue.increment('speak')
  }

  return output
}

/**
 *
 * @param {Array<[sentence: string, translation: string, via: string]>} examples
 * @param {(sentence: string) => string} highlightWord
 */
function buildExamplesString(examples, highlightWord) {
  let output = ''

  output += '\n' + h2('Examples ⭐') + '\n'

  examples.forEach(([sentence, translation, via], idx) => {
    output += colorIndex(idx) + ' ' + white(highlightWord(sentence)) + '\n'
    output += white(highlightWord(translation)) + '\n'
    via && (output += italic(via) + '\n')

    idx !== examples.length - 1 && (output += '\n')
  })

  return output
}

/**
 * cost: 173.837ms
 * @param {string} word
 * @returns {Promise<{ explanations: string[], suggestions: string[] } | IErrorResult>}
 * @throws no error
 */
async function byJSON(word) {
  // https://fanyi.youdao.com/ not available
  return genErrorResult(word, 'notFound')

  const label = '? by fetch JSON'
  verbose && console.time(label)

  const encoded = encodeURIComponent(word)
  const url = `https://fanyi.youdao.com/openapi.do?keyfrom=Nino-Tips&key=1127122345&type=data&doctype=json&version=1.1&q=${encoded}`

  /** @type {import('../typings').IDictResult | null} */
  const json = null
  let msg = ''
  const method = ''

  try {
    // [json, method] = await fetchIt(url, { type: 'json' });
  } catch (error) {
    msg = `Fetch "${url}" failed.`
    console.error(error)
  }

  const explains = json?.basic?.explains
  const hasExplanations = !!explains

  !hasExplanations && debugC('byJSON: not has `explains` in json. try to suggest')

  const suggestions = hasExplanations ? [] : await fetchSuggestions(encoded)
  const explanations = explains || json?.translation

  !hasExplanations && debugC('suggest result = %j', { suggestions, method, json })
  verbose && console.timeEnd(label)

  if (!explanations) {
    return {
      errorMsg: text.error.notFound + (msg ? '. ' + msg : ''),
    }
  }

  // @ts-expect-error
  return { explanations, suggestions }
}

/**
 *
 * @param {string} word encoded
 * @returns string[]
 */
async function fetchSuggestions(word) {
  const url = `https://dsuggest.ydstatic.com/suggest.s?query=${word}&keyfrom=dict2.top.suggest&o=form&rn=10&h=19&le=eng`
  // curl 'https://dict.youdao.com/suggest?num=5&ver=3.0&doctype=json&cache=false&le=en&q=silhouette' \ -H 'Accept: application/json, text/plain, */*'
  const [str] = await fetchIt(url, { type: 'text' })

  let first = ''

  try {
    first =
      decodeURIComponent(str.match(/form.updateCall\((.+?)\)/)?.[1] || '').match(
        />([^><]+?)<\/td>/,
      )?.[1] || ''
  } catch (error) {
    verbose && debugC(error)
  }

  if (!first) {
    debugC('url=[%s]', url)
    debugC('str=[%s]', str)
  }

  return first ? [first] : []
}

/** @param {string} word */
export function speak(word) {
  if (!parsed.speak) {
    debugC('Not speak because "speak" flag', parsed.speak, 'is off.')

    return
  }

  const cmd = `say ${word}`

  debugC(`executing \`${cmd}\``)

  exec(cmd, error => {
    if (error) {
      debugC(`Execute \`${cmd}\` failed:`, error)
    }
  })
}

// /**
//  * @param {import('../typings').AllHTMLTags} tag
//  * @param {string} html
//  * @returns {string}
//  * @example
//  * removeTag('div', '<div class="collins">Hello World</div>') // => 'Hello World'
//  */
// function removeTag(tag, html) {
//   return html.replace(new RegExp(`<${tag}[^>]*>`, 'g'), '').replace(new RegExp(`</${tag}>`, 'g'), '');
// }

/**
 *
 * @param {import('../typings').int} index
 * @returns {string}
 */
function colorIndex(index) {
  const prefix = `${index + 1}.`
  return green(prefix)
}

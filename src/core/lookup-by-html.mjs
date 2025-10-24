import { parsed } from '../utils/arg-parser.mjs'
import { fetchIt } from '../utils/fetch.mjs'
import { chunk, timeit } from '../utils/lite-lodash.mjs'
import { debugC } from '../utils/logger.mjs'
import { text } from './constants.mjs'

const verbose = parsed.verbose

// const args = process.argv.slice(2);

/**
 * @typedef {'en-US' | 'zh-CN'} ILang
 */

/** @type {import('../../typings').IDictionary} */
export const dictionaryByHTML = {
  makeHTMLUrl,
  lookup: verbose ? timeit('? [lookup-by-html] fetch', lookUpByMatchHtml) : lookUpByMatchHtml,
}

/** @type {import('../../typings').IDictionary['makeHTMLUrl']} */
function makeHTMLUrl(word) {
  return `https://dict.youdao.com/w/${encodeURIComponent(word)}/#keyfrom=dict2.top`
}
/**
 * @type {import('../../typings').IDictionary['lookup']}
 */
async function lookUpByMatchHtml(word, { example = false, collins = false }) {
  const htmlUrl = `https://dict.youdao.com/w/${encodeURIComponent(word)}/#keyfrom=dict2.top`
  // const html = execSync(`curl --silent ${htmlUrl}`).toString("utf-8"); // 367.983ms
  const [html] = await fetchIt(htmlUrl, { type: 'text' }) // 241.996ms

  // debugC('byHtml', { method });

  // 尽量少依赖故未使用查询库和渲染库
  // https://www.npmjs.com/package/node-html-parser
  // https://github.com/charmbracelet/glow
  const matches = html.match(/<div class="trans-container">\s*<ul>([\s\S]+?)<\/ul>/s)
  const lis = matches ? matches[1].trim() : ''

  // 中文不支持
  if (!lis || !lis.includes('<li>')) {
    debugC('No list found:', { lis, html })

    return {
      errorMsg: text.error.notFound(word),
    }
  }

  const explanations = lis
    .replace(/\s{2,}/g, ' ')
    // .matchAll(/<li>([\s\S]+?)<\/li>/g))
    // .map(([, item]) => item)
    .split('<li>')
    .map(x => x.replace('</li>', '').trim())
    .filter(Boolean)

  // console.log('englishExplanation:', englishExplanation);

  if (!example && !collins) {
    return { explanations }
  }

  const bilingual = html.match(/(<div id="bilingual".+?<\/div>)/s)?.[1].trim() || ''

  // console.log('bilingual:', bilingual);

  const examples = example ? (bilingual.match(/<p(?:.*?)>(.+?)<\/p>/gs) || []).map(removeTags) : []

  const [englishExplanation, englishExplanationTotalCount] = collins ? extractCollins(html) : []

  // console.log('examples 2:', examples);
  return {
    explanations,
    // @ts-expect-error
    examples: chunk(examples, 3),
    englishExplanation,
    englishExplanationTotalCount,
  }
}

/** @typedef {[english: string, chinese?: string]} ICollinsItem */

/**
 * @param {string} html
 * @returns {[ICollinsItem[]?, number?]}
 */
function extractCollins(html) {
  const englishExplanationHtml = html
    .match(/<div id="collinsResult".+?<\/ul>\s*<\/div>\s*<\/div>/s)?.[0]
    .trim()

  if (!englishExplanationHtml) {
    return []
  }

  // console.log('englishExplanationHtml:', englishExplanationHtml);
  // debug(englishExplanationHtml)

  const list = englishExplanationHtml
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .match(/<li>.+?<\/li>/gs)

  if (!list) {
    return []
  }

  const num = parsed.collins
  // `--collins=all` to show all collins
  // @ts-expect-error
  // oxlint-disable-next-line prefer-string-starts-ends-with
  const size = /^a/.test(num) ? list.length : Number(num) || 1

  debugC('size:', size)
  // console.log('list:', list);

  const collins = list.slice(0, size).map(li =>
    // @ts-expect-error
    li
      .match(/<div.+?>(.+?)<\/div>/g)
      .map(m =>
        removeTags(m)
          .replace(/\s{2,}/g, ' ')
          .trim(),
      ),
  )

  // @ts-expect-error
  return [collins, list.length]
}

/**
 *
 * @param {string} html
 * @returns {string}
 */
function removeTags(html) {
  return html.replace(/<\/?.+?>/g, '').trim()
}

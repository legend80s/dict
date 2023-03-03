import https from "node:https";
import { exec } from "node:child_process";

import { ArgParser } from "./args.mjs";
import { italic, chunk, bold, h2, white, debug } from "./utils/lite-lodash.mjs";
import { Fatigue } from './utils/fatigue.mjs';

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const flags = {
  help: ['-h', '--help'],
  version: ['-v', '--version'],
  verbose: '--verbose',

  speak: ['-s', '--speak', false],
  example: ['-e', '--example', false],
  collins: ['-c', '--collins', 1],
};

/**
 * @typedef {{
 *  explanations: string[];
 *  englishExplanation?: ICollinsItem[];
 *  englishExplanationTotalCount?: number;
 *  suggestions?: string[];
 *  examples?: IExample[];
 * } | { errorMsg: string }} IParsedResult
 */

export const parser = new ArgParser(flags)

const verbose = parser.get('verbose');

export function debugC(...args) {
  if (!verbose) {
    return false
  }

  debug('[core]', ...args);

  return true
}

// const args = process.argv.slice(2);

const config = {
  // listItemIcon: "🟢",
  // listItemIcon: "⭕️",
  // listItemIcon: "✅",
  listItemIcon: "💬",
};

/**
 * @type {I18n}
 */
const i18n = {
  'en-US': {
    error: {
      noWord: 'Please input word to query.',
      englishWordOnly: 'Please input an valid English word.',
      notFound: 'Not found',
    }
  },
  'zh-CN': {
    error: {
      noWord: '请输入需要查询的单词',
      englishWordOnly: '目前仅支持英文单词查询',
      notFound: '未查询到该词',
    }
  },
}

const text = i18n[getLanguage()];

/** @type {(sentence: string) => string} */
let highlightWord;

export const query = async function (word) {
  debugC('Word:', `"${word}"`);

  if (!word) {
    exitWithErrorMsg(text.error.noWord);

    return false;
  }

  const showExamples = parser.get('example');

  /** @type {IParsedResult} */
  let result = {};

  if (showExamples) {
    result = await translateWithExamples(word);
  } else {
    const json = await byJSON(word);

    // failed
    if ('errorMsg' in json) {
      result = await byHtml(word, { example: false })
    } else {
      result = json;
    }
  }

  return print(word, result)
}

/**
 *
 * @param {string} word
 * @returns {Promise<IParsedResult>}
 */
async function translateWithExamples(word) {
  const htmlResult = await byHtml(word, { example: true });

  if ('errorMsg' in htmlResult) {
    debugC('Fallback to JSON when HTML fetch failed');

    const jsonResult = await byJSON(word);

    return jsonResult;
  }

  return htmlResult
}

function exitWithErrorMsg(msg) {
  console.error(`\n> ❌ ${msg}`);
  // console.info('\n> Example: $ npx dict water');

  help();
}

/**
 * @typedef {[sentence: string, translation: string, via: string]} IExample
 */

/**
 * @param {string} word
 * @param {IParsedResult} result
 */
function print(word, result) {
  if ('errorMsg' in result) {
    exitWithErrorMsg(result.errorMsg);

    return false;
  }

  const {
    explanations,
    englishExplanation,
    englishExplanationTotalCount,
    examples,
    suggestions,
  } = result;

  const collinsChineseExplanation = !englishExplanation ? [] : englishExplanation
    .flatMap(([english]) => english.match(/[\u4e00-\u9fa5]+/g))
    // filter out the `null`s
    .filter(Boolean)
  ;

  const explanationWords = explanations
    .map((row) => row.replace(/（.+?）|<.+?>|\[.+?\]/g, ''))
    .reduce((acc, row) => {
      return acc.concat(row.split(/[，；\s]/).slice(1))
    }, [])
    .concat(collinsChineseExplanation)
    .map(w => w.trim())
    .filter(w => !!w && w !== '的')
    // match as longer as possible
    .sort((a, b) => b.length - a.length)
    .map(w => w.replace(/([的地])$/, '$1?'));

  // console.log('explanationWords:', explanationWords);

  highlightWord = (sentence) => highlight(sentence, [word, ...explanationWords]);

  const hasExample = !!examples?.length;

  verbose && h2("Word:", `"${word}"`);
  verbose && console.log();
  hasExample && h2("Explanations");

  explanations.forEach(exp => {
    console.log(config.listItemIcon, white(exp));
  });

  const suggestedWord = suggestions && suggestions[0];
  suggestedWord && console.log('\n你要找的是不是:', white(suggestedWord));

  if (englishExplanation?.[0]) {
    console.log();
    h2(`柯林斯英汉双解大词典 [#${englishExplanationTotalCount}]`)

    const str = englishExplanation.map(([english, chinese]) => {
      return [english, chinese].filter(Boolean).map(highlightWord).join('\n');
    }).join('\n\n');

    console.log(str);

    if (englishExplanation.length < englishExplanationTotalCount) {
      console.log('...');
    }
  }

  if (hasExample) {
    printExamples(examples);
  }

  introduceFeatures(word, suggestedWord)

  console.log();
  console.log(italic(`See more at https://dict.youdao.com/w/${encodeURIComponent(word)}/#keyfrom=dict2.top`));

  return true;
}

function introduceFeatures(word, suggestedWord) {
  const fatigue = new Fatigue(verbose);

  const exampleFlagSet = parser.get('example');
  if (exampleFlagSet) {
    fatigue.setTired('example')
  }

  const speakFlagSet = parser.get('speak');
  if (speakFlagSet) {
    fatigue.setTired('speak')
  }

  if (!exampleFlagSet && !fatigue.hit('example')) {
    console.log();
    console.log(white(`Try \`npx ydd ${suggestedWord || word} ${bold('-e -c=2')}\` to get some examples ✨.`));
    fatigue.increment('example')
  } else if (!speakFlagSet && !fatigue.hit('speak')) {
    console.log();
    console.log(white(`Try \`npx ydd ${suggestedWord || word} ${bold('-s')}\` to speak it out 📣.`));
    fatigue.increment('speak')
  }
}

/**
 *
 * @param {Array<[sentence: string, translation: string, via: string]>} examples
 */
function printExamples(examples) {
  console.log();
  h2('Examples');

  examples.forEach(([sentence, translation, via], idx) => {
    console.log(white(highlightWord(sentence)));
    console.log(white(highlightWord(translation)));
    console.log(italic(via));
    idx !== examples.length -1 && console.log();
  });
}

/**
 *
 * @param {string} sentence
 * @param {string[]} words
 * @returns
 */
function highlight(sentence, words) {
  // console.log('sentence:', sentence);
  const uniqWords = uniq(words);
  // console.log('words:', { uniqWords });

  return sentence.replace(new RegExp(words.join('|'), 'gi'), (m) => bold(m))
}

function uniq(arr) {
  return [...new Set(arr)];
}

/**
 * @typedef {'en-US' | 'zh-CN'} ILang
 */

/**
 * @returns {ILang}
 */
function getLanguage(configLang) {
  const lang = configLang
    || Intl.DateTimeFormat().resolvedOptions().locale
  ;

  return lang || 'zh-CN';
}

/**
 * cost: 367.983ms
 * @returns {Promise<{ errorMsg: string; } | { englishExplanation?: ICollinsItem[], explanations: string[]; examples?: string[] } >}
 */
async function byHtml(word, { example = false } = {}) {
  const label = '? [core] by html fetch';
  verbose && console.time(label);

  const htmlUrl = `https://dict.youdao.com/w/${encodeURIComponent(word)}/#keyfrom=dict2.top`
  // const html = execSync(`curl --silent ${htmlUrl}`).toString("utf-8"); // 367.983ms
  const [html, method] = await fetchIt(htmlUrl, { type: 'text' }); // 241.996ms

  debugC('byHtml', { method });

  // 尽量少依赖故未使用查询库和渲染库
  // https://www.npmjs.com/package/node-html-parser
  // https://github.com/charmbracelet/glow
  const matches = html.match(/<div class="trans-container">\s*<ul>([\s\S]+?)<\/ul>/s);
  const lis = matches ? matches[1].trim() : '';

  // 中文不支持
  if (!lis || !lis.includes("<li>")) {
    debugC('No list found:', { lis, html });

    return {
      errorMsg: text.error.englishWordOnly
    };
  }

  const explanations = lis.replace(/\s{2,}/g, " ")
    // .matchAll(/<li>([\s\S]+?)<\/li>/g))
    // .map(([, item]) => item)
    .split('<li>')
    .map(x => x.replace('</li>', '').trim())
    .filter(Boolean)
  ;


  // console.log('englishExplanation:', englishExplanation);

  if (!example) {
    return { explanations };
  }

  const bilingual = html.match(/(<div id="bilingual".+?<\/div>)/s)?.[1].trim() || '';

  // console.log('bilingual:', bilingual);

  const examples = (bilingual.match(/<p(?:.*?)>(.+?)<\/p>/gs) || [])
    .map(removeTags);

  const [englishExplanation, englishExplanationTotalCount] = extractCollins(html);

  verbose && console.timeEnd(label);

  return {
    explanations,
    examples: chunk(examples, 3),
    englishExplanation,
    englishExplanationTotalCount,
  };
}

/** @typedef {[english: string, chinese?: string]} ICollinsItem */

/**
 * @param {string} html
 * @returns {[ICollinsItem[]?, number?]}
 */
function extractCollins(html) {
  const englishExplanationHtml = html.match(/<div id="collinsResult".+?<\/ul>\s*<\/div>\s*<\/div>/s)?.[0].trim();

  if (!englishExplanationHtml) {
    return [];
  }

  // console.log('englishExplanationHtml:', englishExplanationHtml);
  const size = Number(parser.get('collins')) || 1;

  debugC('size:', size);

  // debug(englishExplanationHtml)

  const list = englishExplanationHtml
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .match(/<li>.+?<\/li>/sg);

  if (!list) {
    return [];
  }

  // console.log('list:', list);

  const collins = list.slice(0, size)
    .map(li => li
      .match(/<div.+?>(.+?)<\/div>/g)
      .map(m =>
        removeTags(m).replace(/\s{2,}/g, ' ').trim()
      )
    )
  ;

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

/**
 * cost: 173.837ms
 * @param {string} word
 * @returns {Promise<{ explanations: string[], suggestions: string[] } | { errorMsg: string }>}
 * @throws no error
 */
async function byJSON(word) {
  const label = '? by fetch JSON';
  verbose && console.time(label);

  const encoded = encodeURIComponent(word);
  const url = `https://fanyi.youdao.com/openapi.do?keyfrom=Nino-Tips&key=1127122345&type=data&doctype=json&version=1.1&q=${encoded}`;

  /** @type {IDictResult | null} */
  let json = null;
  let msg = '';
  let method = '';

  try {
    [json, method] = await fetchIt(url, { type: 'json' });
  } catch (error) {
    msg = `Fetch "${url}" failed.`;
    console.error(error);
  }

  const explains = json?.basic?.explains;
  const hasExplanations = !!explains;

  !hasExplanations && debugC('byJSON: not has `explains` in json. try to suggest')

  const suggestions = hasExplanations ? [] : await fetchSuggestions(encoded);
  const explanations = explains || json?.translation;

  !hasExplanations && debugC('suggest result = %j', { suggestions, method, json })
  verbose && console.timeEnd(label);

  if (!explanations) {
    return {
      errorMsg: text.error.notFound + (msg ? '. ' + msg : '')
    };
  }

  return { explanations, suggestions };
}

/**
 *
 * @param {string} word encoded
 * @returns string[]
 */
async function fetchSuggestions(word) {
  const url = `https://dsuggest.ydstatic.com/suggest.s?query=${word}&keyfrom=dict2.top.suggest&o=form&rn=10&h=19&le=eng`

  const [str] = await fetchIt(url, { type: 'text' });

  let first = '';

  try {
    first = decodeURIComponent(str.match(/form.updateCall\((.+?)\)/)?.[1] || '').match(/>([^><]+?)<\/td>/)?.[1];
  } catch (error) {
    verbose && debugC(error);
  }

  if (!first) {
    debugC('url=[%s]', url)
    debugC('str=[%s]', str)
  }

  return first ? [first] : [];
}

/**
 * @typedef {Record<string, any>} IJSON
 */

/**
 * @template {'json' | 'text' | undefined} T
 * @param {string} url
 * @param {{ type: T }} [settings]
 * @returns {Promise<[T extends 'json' | undefined ? IJSON : string, method: string]>}
 */
async function fetchIt(url, { type = 'json' } = {}) {
  const asJSON = type === 'json';

  if (typeof fetch === 'function') {
    // html 391.83ms
    // json 175.426ms
    const parse = (resp) => asJSON ? resp.json() : resp.text();

    return [await fetch(url).then(parse), 'fetch']
  }

  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      res.setEncoding('utf-8');
      let result = '';

      res.on('data', function (data) {
        result += data;
      });

      res.on('end', () => {
        const parsed = asJSON ? JSON.parse(result) : result;

        // console.log('parsed:', parsed);

        try {
          resolve([parsed, 'https']);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', function (error) {
      reject(error);
    });
  });
}

export function showHelp() {
  return parser.get('help', 'version')
}

export function help() {
  const { name, description, version } = require("../package.json");

  console.log();
  console.log([name, version].join('@'));
  console.log();
  console.log('>', description);
  console.log();
  console.log('> Example:');
  console.log(`> $ npx dict <word> [${Object.values(flags).flat().join(' ')}]`);
}

export function speak(word) {
  if (!parser.get('speak')) {
    debugC('Not speak because "speak" flag', parser.flags.speak ,'is off.');

    return;
  }

  const cmd = `say ${word}`;

  debugC(`executing \`${cmd}\``);

  exec(cmd, (error) => {
    if (error) {
      debugC(`Execute \`${cmd}\` failed:`, error);
    }
  });
}

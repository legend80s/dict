const https = require("node:https");
const { exec } = require('node:child_process');

const { ArgParser } = require('./args');
const { italic, chunk, bold, h2, white, isString } = require('./utils');

const flags = {
  help: ['-h', '--help'],
  version: ['-v', '--version'],
  verbose: '--verbose',
  speak: ['-s', '--speak', false],
  example: ['-e', '--example', false],
};

/**
 * @typedef {{
 *  explanations: string[];
 *  suggestions?: string[];
 *  examples?: IExample[];
 * } | { errorMsg: string }} IParsedResult
 */

const parser = new ArgParser(flags)
exports.parser = parser;

const verbose = parser.isHit('verbose');

function debug(...args) {
  if (!verbose) {
    return;
  }

  const containsError = args.some((arg) => arg instanceof Error || /error|fail/i.test(arg));

  const level = containsError ? 'error' : 'log';
  const DEBUG_ICON = '?';

  // console.log(debugIcon, 'level =', level)
  let first = DEBUG_ICON;
  let rest = args;

  if (isString(args[0])) {
    first = `${DEBUG_ICON} ${args[0]}`
    rest = args.slice(1);
  }

  console[level](first, ...rest)
}

exports.debug = debug;

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

exports.query = async function (word) {
  debug('Word:', `"${word}"`);

  if (!word) {
    exitWithErrorMsg(text.error.noWord);

    return;
  }

  const showExamples = parser.isHit('example');

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

  print(word, result)
}

/**
 *
 * @param {string} word
 * @returns {Promise<IParsedResult>}
 */
async function translateWithExamples(word) {
  const htmlResult = await byHtml(word, { example: true });

  if ('errorMsg' in htmlResult) {
    debug('Fallback to JSON when HTML fetch failed');

    const jsonResult = await byJSON(word);

    return jsonResult;
  }

  return htmlResult
}

function exitWithErrorMsg(msg) {
  console.error(`\n> ❌ ${msg}`);
  // console.info('\n> Example: $ npx dict water');

  help();
  process.exitCode = 1;
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
    return exitWithErrorMsg(result.errorMsg);
  }

  const { explanations, examples, suggestions } = result;

  const showExample = !!examples?.length;

  verbose && h2("Word:", `"${word}"`);
  verbose && console.log();
  showExample && h2("Explanations:");

  explanations.forEach(exp => {
    console.log(config.listItemIcon, white(exp));
  });

  const sug = suggestions && suggestions[0];
  sug && console.log('\n你要找的是不是:', white(sug));

  if (showExample) {
    printExamples(word, examples);
  }

  console.log();
  console.log(italic(`See more at https://dict.youdao.com/w/${encodeURIComponent(word)}/#keyfrom=dict2.top`));
}

/**
 *
 * @param {Array<[sentence: string, translation: string, via: string]>} examples
 */
function printExamples(word, examples) {
  console.log();
  h2('Examples:');

  examples.forEach(([sentence, translation, via], idx) => {
    console.log(white(sentence.replace(new RegExp(word, 'gi'), (m) => bold(m))));
    console.log(white(translation));
    console.log(italic(via));
    idx !== examples.length -1 && console.log();
  });
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
 * @returns {Promise<{ errorMsg: string; } | { explanations: string[]; examples?: string[] } >}
 */
async function byHtml(word, { example = false } = {}) {
  const label = '? by html fetch';
  verbose && console.time(label);

  const htmlUrl = `https://dict.youdao.com/w/${encodeURIComponent(word)}/#keyfrom=dict2.top`
  // const html = execSync(`curl --silent ${htmlUrl}`).toString("utf-8"); // 367.983ms
  const [html] = await fetchIt(htmlUrl, { type: 'text' }); // 241.996ms

  // 尽量少依赖故未使用查询库和渲染库
  // https://www.npmjs.com/package/node-html-parser
  // https://github.com/charmbracelet/glow
  const matches = html.match(/<div class="trans-container">\s*<ul>([\s\S]+?)<\/ul>/s);
  const lis = matches ? matches[1].trim() : '';

  // 中文不支持
  if (!lis || !lis.includes("<li>")) {
    debug('No list found:', { lis, html });

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

  if (!example) {
    return { explanations };
  }

  const bilingual = html.match(/(<div id="bilingual".+?<\/div>)/s)?.[1].trim() || '';

  // console.log('bilingual:', bilingual);

  const examples = (bilingual.match(/<p(?:.*?)>(.+?)<\/p>/gs) || [])
    .map(m => m.replace(/<\/?.+?>/g, '').trim());

  verbose && console.timeEnd(label);

  return {
    explanations,
    examples: chunk(examples, 3),
  };
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

  const suggestions = hasExplanations ? [] : await fetchSuggestions(encoded);
  const explanations = explains || json?.translation;

  !hasExplanations && debug('not has `explains` in json. try to suggest %j', { suggestions, method, json })
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

  const first = decodeURIComponent(str.match(/form.updateCall\((.+?)\)/)?.[1] || '').match(/>([^><]+?)<\/td>/)?.[1];

  !first && debug(str);

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

function showHelp() {
  return parser.isHit('help', 'version')
}

function help() {
  const { name, description, version } = require('../package.json')

  console.log();
  console.log([name, version].join('@'));
  console.log();
  console.log('>', description);
  console.log();
  console.log('> Example:');
  console.log(`> $ npx dict <word> [${Object.values(flags).flat().join(' ')}]`);
}

function speak(word) {
  if (!parser.isHit('speak')) {
    debug('Not speak because "speak" flag', parser.flags.speak ,'is off.');

    return;
  }

  const cmd = `say ${word}`;

  debug(`executing \`${cmd}\``);

  exec(cmd, (error) => {
    if (error) {
      debug(`Execute \`${cmd}\` failed:`, error);
    }
  });
}

exports.help = help;
exports.speak = speak;
exports.showHelp = showHelp;

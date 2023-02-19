const https = require("node:https");
const { exec } = require('node:child_process');

const { ArgParser } = require('./args');

const flags = {
  help: ['-h', '--help'],
  version: ['-v', '--version'],
  verbose: '--verbose',
  speak: ['-s', '--speak', false],
};

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
  console[level](DEBUG_ICON, ...args)
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

  let explanations = await byJSON(word);

  if (!Array.isArray(explanations)) {
    debug('Fallback to HTML when json fetch failed');
    explanations = await byHtml(word);
  }

  print(word, explanations)
}

function exitWithErrorMsg(msg) {
  console.error(`\n> ❌ ${msg}`);
  // console.info('\n> Example: $ npx dict water');

  help();
  process.exitCode = 1;
}

/**
 * @param {string} word
 * @param {string | string[]} explanations
 */
function print(word, explanations) {
  if (typeof explanations === 'string') {
    return exitWithErrorMsg(explanations);
  }

  console.log();
  console.log("Word:", `"${word}"`);
  console.log();
  console.log("Explanations:");

  explanations.forEach(exp => {
    console.log(config.listItemIcon, exp);
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
 * @type {IQuerierAsync}
 */
async function byHtml(word) {
  const label = '? by html fetch';
  verbose && console.time(label);

  const htmlUrl = `https://dict.youdao.com/w/${word}/#keyfrom=dict2.top`
  // const html = execSync(`curl --silent ${htmlUrl}`).toString("utf-8"); // 367.983ms
  const [html] = await fetchIt(htmlUrl, { type: 'html' }); // 241.996ms

  // 尽量少依赖故未使用查询库和渲染库
  // https://www.npmjs.com/package/node-html-parser
  // https://github.com/charmbracelet/glow
  const lis = html.match(/<div class=\"trans-container\">\s*<ul>([\s\S]+?)<\/ul>/)?.[1].trim();

  // 中文不支持
  if (!lis || !lis.includes("<li>")) {
    debug('No list found:', { lis, html });

    return text.error.englishWordOnly;
  }

  const explanations = lis.replace(/\s{2,}/g, " ")
    // .matchAll(/<li>([\s\S]+?)<\/li>/g))
    // .map(([, item]) => item)
    .split('<li>')
    .map(x => x.replace('</li>', '').trim())
    .filter(Boolean)
  ;

  verbose && console.timeEnd(label);

  return explanations;
}

/**
 * cost: 173.837ms
 * @type {IQuerierAsync}
 * @throws no error
 */
async function byJSON(word) {
  const label = '? by fetch JSON';
  verbose && console.time(label);
  const url = `https://fanyi.youdao.com/openapi.do?keyfrom=Nino-Tips&key=1127122345&type=data&doctype=json&version=1.1&q=${word}`;

  /** @type {IDictResult | null} */
  let json = null;
  let msg = '';
  let method = '';

  try {
    [json, method] = await fetchIt(url);
  } catch (error) {
    msg = `Fetch "${url}" failed.`;
    console.error(error);
  }

  const explains = json?.basic?.explains;

  debug({ method })
  verbose && console.timeEnd(label);

  if (!explains) {
    debug({ json });
    return text.error.notFound + (msg ? '. ' + msg : '');
  }

  return explains;
}

/**
 *
 * @returns {Promise<[unknown, method: string]>}
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

      res.on('data', function (data) {
      const parsed = asJSON ? JSON.parse(data) : data;

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

  exec(cmd, (error) => {
    if (error) {
      debug(`Execute \`${cmd}\` failed:`, error);
    }
  });
}

exports.help = help;
exports.speak = speak;
exports.showHelp = showHelp;

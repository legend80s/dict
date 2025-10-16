// @ts-check
import { exec } from 'node:child_process';
import { createRequire } from 'node:module';
import { log } from 'node:console';

import { ArgParser } from './args.mjs';

import {
  italic,
  chunk,
  bold,
  h2,
  white,
  debug,
  highlight,
} from '../utils/lite-lodash.mjs';

import { Fatigue } from '../utils/fatigue.mjs';
import { fetchIt } from '../utils/fetch.mjs';
import { parser } from '../utils/parser.mjs';

/** @typedef {import('../../typings').IParsedResult} IParsedResult */

const require = createRequire(import.meta.url);

const flags = {
  help: ['-h', '--help'],
  version: ['-v', '--version'],
  verbose: '--verbose',

  speak: ['-s', '--speak', false],
  example: ['-e', '--example', false],
  collins: ['-c', '--collins', 1],
};

const verbose = parser.get('verbose');

// const args = process.argv.slice(2);

/**
 * @type {I18n}
 */
const i18n = {
  'en-US': {
    error: {
      noWord: 'Please input word to query.',
      englishWordOnly: 'Please input an valid English word.',
      notFound: 'Not found',
    },
  },
  'zh-CN': {
    error: {
      noWord: '请输入需要查询的单词',
      englishWordOnly: '目前仅支持英文单词查询',
      notFound: '未查询到该词',
    },
  },
};

const text = i18n[getLanguage()];

/**
 * @typedef {'en-US' | 'zh-CN'} ILang
 */

/**
 * @returns {ILang}
 */
function getLanguage(configLang) {
  const lang = configLang || Intl.DateTimeFormat().resolvedOptions().locale;

  return lang || 'zh-CN';
}

/**
 * @type {import('../../typings').lookup}
 */
export async function byHtml(word, { example = false, collins = false }) {
  const label = '? [core] by html fetch';
  verbose && console.time(label);

  const htmlUrl = `https://dict.youdao.com/w/${encodeURIComponent(word)}/#keyfrom=dict2.top`;
  // const html = execSync(`curl --silent ${htmlUrl}`).toString("utf-8"); // 367.983ms
  const [html, method] = await fetchIt(htmlUrl, { type: 'text' }); // 241.996ms

  debugC('byHtml', { method });

  // 尽量少依赖故未使用查询库和渲染库
  // https://www.npmjs.com/package/node-html-parser
  // https://github.com/charmbracelet/glow
  const matches = html.match(
    /<div class="trans-container">\s*<ul>([\s\S]+?)<\/ul>/s,
  );
  const lis = matches ? matches[1].trim() : '';

  // 中文不支持
  if (!lis || !lis.includes('<li>')) {
    debugC('No list found:', { lis, html });

    return {
      errorMsg: text.error.englishWordOnly,
    };
  }

  const explanations = lis
    .replace(/\s{2,}/g, ' ')
    // .matchAll(/<li>([\s\S]+?)<\/li>/g))
    // .map(([, item]) => item)
    .split('<li>')
    .map((x) => x.replace('</li>', '').trim())
    .filter(Boolean);

  // console.log('englishExplanation:', englishExplanation);

  if (!example && !collins) {
    return { explanations };
  }

  const bilingual =
    html.match(/(<div id="bilingual".+?<\/div>)/s)?.[1].trim() || '';

  // console.log('bilingual:', bilingual);

  const examples = example
    ? (bilingual.match(/<p(?:.*?)>(.+?)<\/p>/gs) || []).map(removeTags)
    : [];

  const [englishExplanation, englishExplanationTotalCount] = collins
    ? extractCollins(html)
    : [];

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
  const englishExplanationHtml = html
    .match(/<div id="collinsResult".+?<\/ul>\s*<\/div>\s*<\/div>/s)?.[0]
    .trim();

  if (!englishExplanationHtml) {
    return [];
  }

  // console.log('englishExplanationHtml:', englishExplanationHtml);
  // debug(englishExplanationHtml)

  const list = englishExplanationHtml
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .match(/<li>.+?<\/li>/gs);

  if (!list) {
    return [];
  }

  const num = parser.get('collins');
  // `--collins=all` to show all collins
  const size = /^a/.test(num) ? list.length : Number(num) || 1;

  debugC('size:', size);
  // console.log('list:', list);

  const collins = list.slice(0, size).map((li) =>
    li.match(/<div.+?>(.+?)<\/div>/g).map((m) =>
      removeTags(m)
        .replace(/\s{2,}/g, ' ')
        .trim(),
    ),
  );

  return [collins, list.length];
}

/**
 *
 * @param {string} html
 * @returns {string}
 */
function removeTags(html) {
  return html.replace(/<\/?.+?>/g, '').trim();
}

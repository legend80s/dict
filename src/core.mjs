// oxlint-disable no-unused-expressions
// @ts-check
import { exec } from 'node:child_process';
import { log } from 'node:console';

import { config, text } from './core/constants.mjs';
import {
  dictionaryByNuxt,
  makeHTMLUrl,
} from './core/lookup-by-nuxt-in-html.mjs';
import { debugC, help, parser, verbose } from './utils/arg-parser.mjs';
import { Fatigue } from './utils/fatigue.mjs';
import { fetchIt } from './utils/fetch.mjs';
import { bold, h2, highlight, italic, white } from './utils/lite-lodash.mjs';

/** @typedef {import('../typings').ICollinsItem} ICollinsItem  */
/** @typedef {import('../typings').IParsedResult} IParsedResult */
/** @typedef {import('../typings').IErrorResult} IErrorResult */

/** @type {(sentence: string) => string} */
let highlightWord;

/**
 * 主入口。获取单词，查询，输出结果。
 * 编排逻辑：
 * 1. 如果某个渠道获取失败，则尝试下一个渠道。
 * 2. 参数增加疲劳度控制
 * @param {string} word
 * @returns {Promise<boolean>}
 */
export const query = async (word) => {
  debugC('Word:', `"${word}"`);

  if (!word) {
    exitWithErrorMsg(word, { errorMsg: text.error.noWord });

    return false;
  }

  const showExamples = parser.get('example');
  const showCollins = shouldShowCollins(parser.get('collins'));

  /** @type {IParsedResult} */
  let result = { explanations: [] };

  if (showExamples || showCollins) {
    result = await translateWithExamples(word, {
      example: showExamples,
      collins: showCollins,
    });
  } else {
    const json = await byJSON(word);

    // failed
    if ('errorMsg' in json) {
      result = await dictionaryByNuxt.lookup(word, {
        example: false,
        collins: false,
      });
    } else {
      result = json;
    }
  }

  return print(word, result);
};

/**
 * @type {import('../typings').lookup}
 */
async function translateWithExamples(word, { example, collins }) {
  const htmlResult = await dictionaryByNuxt.lookup(word, { example, collins });

  if ('errorMsg' in htmlResult) {
    debugC('Fallback to JSON when HTML fetch failed');

    const jsonResult = await byJSON(word);

    return jsonResult;
  }

  return htmlResult;
}

/**
 * @param {string} word
 * @param {IErrorResult} param0
 */
function exitWithErrorMsg(word, { errorMsg, error }) {
  if (verbose) {
    console.error(error);
  } else {
    console.error(`\n> ❌ ${errorMsg}`);
    // console.info('\n> Example: $ npx dict water');
  }

  console.error(`> ${makeHTMLUrl(word)}`);

  help();
}

/**
 * @param {string} word
 * @param {IParsedResult} result
 */
function print(word, result) {
  if ('errorMsg' in result) {
    exitWithErrorMsg(word, result);

    return false;
  }

  const {
    explanations,
    englishExplanation,
    englishExplanationTotalCount = 0,
    examples,
    suggestions,
  } = result;

  /** @type {string[]} */
  // @ts-expect-error
  const collinsChineseExplanation = !englishExplanation
    ? []
    : englishExplanation
        .flatMap(([english]) => english.match(/[\u4e00-\u9fa5]+/g))
        // filter out the `null`s
        .filter(Boolean);

  const explanationWords = explanations
    .map((row) => row.replace(/（.+?）|<.+?>|\[.+?\]/g, ''))
    .reduce((/** @type {string[]} */ acc, row) => {
      return acc.concat(row.split(/[，；\s]/).slice(1));
    }, [])
    .concat(collinsChineseExplanation)
    .map((w) => w.trim())
    .filter((w) => !!w && w !== '的')
    // match as longer as possible
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replaceAll('?', '').replace(/([的地])$/, '$1?'));

  // console.log('explanationWords:', explanationWords);

  highlightWord = (sentence) =>
    highlight(sentence, [word, ...explanationWords]);

  const hasExample = !!examples?.length;

  verbose && log(h2('Word:', `"${word}"`));
  console.log();
  hasExample && log(h2('Explanations 💡'));

  explanations.forEach((exp) => {
    console.log(config.listItemIcon, white(exp));
  });

  const suggestedWord = suggestions?.[0];
  suggestedWord && console.log('\n你要找的是不是:', white(suggestedWord));

  if (englishExplanation?.[0]) {
    console.log();

    let sub = '';

    // number 1 - is default value `npx ydd`
    // string 1 - is passed value `npx ydd -c=1`
    const isDefaultValue = parser.get('collins') === 1;

    if (englishExplanationTotalCount > 1 && isDefaultValue) {
      /** @param {string} str */
      const surround = (str) => `\`${italic(white(str))}\``;
      const tips = ['-c=2', '-c=all'].map(surround).join(' or ');

      sub = `. Add ${tips} to show more examples.`;
    }

    const header = `柯林斯英汉双解大词典 [#${englishExplanationTotalCount}] 📖`;
    log(h2(header) + sub);

    const str = englishExplanation
      .map(([english, [eng_sent, chn_sent]]) => {
        return highlightWord(`${english}\n  | ${eng_sent}\n  | ${chn_sent}`);
      })
      .join('\n\n');

    console.log(str);

    if (englishExplanation.length < englishExplanationTotalCount) {
      console.log('...');
    }
  }

  if (hasExample) {
    printExamples(examples);
  }

  introduceFeatures(word, suggestedWord);

  console.log();
  console.log(italic(`See more at ${makeHTMLUrl(word)}`));

  return true;
}

/**
 *
 * @param {string} word
 * @param {string | undefined} suggestedWord
 */
function introduceFeatures(word, suggestedWord) {
  const fatigue = new Fatigue(verbose);

  const exampleFlagSet = parser.get('example');
  if (exampleFlagSet) {
    fatigue.setTired('example');
  }

  const speakFlagSet = parser.get('speak');
  if (speakFlagSet) {
    fatigue.setTired('speak');
  }

  if (!exampleFlagSet && !fatigue.hit('example')) {
    console.log();
    console.log(
      white(
        `Try \`npx ydd ${suggestedWord || word} ${bold('-e -c=2|all')}\` to get some examples ✨.`,
      ),
    );
    fatigue.increment('example');
  } else if (!speakFlagSet && !fatigue.hit('speak')) {
    console.log();
    console.log(
      white(
        `Try \`npx ydd ${suggestedWord || word} ${bold('-s')}\` to speak it out 📣.`,
      ),
    );
    fatigue.increment('speak');
  }
}

/**
 *
 * @param {Array<[sentence: string, translation: string, via: string]>} examples
 */
function printExamples(examples) {
  console.log();
  log(h2('Examples ⭐'));

  examples.forEach(([sentence, translation, via], idx) => {
    log(white(highlightWord(sentence)));
    log(white(highlightWord(translation)));
    via && log(italic(via));

    idx !== examples.length - 1 && console.log();
  });
}

/**
 * cost: 173.837ms
 * @param {string} word
 * @returns {Promise<{ explanations: string[], suggestions: string[] } | IErrorResult>}
 * @throws no error
 */
async function byJSON(word) {
  // https://fanyi.youdao.com/ not available
  return {
    errorMsg: text.error.notFound(word),
  };

  const label = '? by fetch JSON';
  verbose && console.time(label);

  const encoded = encodeURIComponent(word);
  const url = `https://fanyi.youdao.com/openapi.do?keyfrom=Nino-Tips&key=1127122345&type=data&doctype=json&version=1.1&q=${encoded}`;

  /** @type {IDictResult | null} */
  const json = null;
  let msg = '';
  const method = '';

  try {
    // [json, method] = await fetchIt(url, { type: 'json' });
  } catch (error) {
    msg = `Fetch "${url}" failed.`;
    console.error(error);
  }

  const explains = json?.basic?.explains;
  const hasExplanations = !!explains;

  !hasExplanations &&
    debugC('byJSON: not has `explains` in json. try to suggest');

  const suggestions = hasExplanations ? [] : await fetchSuggestions(encoded);
  const explanations = explains || json?.translation;

  !hasExplanations &&
    debugC('suggest result = %j', { suggestions, method, json });
  verbose && console.timeEnd(label);

  if (!explanations) {
    return {
      errorMsg: text.error.notFound + (msg ? '. ' + msg : ''),
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
  const url = `https://dsuggest.ydstatic.com/suggest.s?query=${word}&keyfrom=dict2.top.suggest&o=form&rn=10&h=19&le=eng`;
  // curl 'https://dict.youdao.com/suggest?num=5&ver=3.0&doctype=json&cache=false&le=en&q=silhouette' \ -H 'Accept: application/json, text/plain, */*'
  const [str] = await fetchIt(url, { type: 'text' });

  let first = '';

  try {
    first = decodeURIComponent(
      str.match(/form.updateCall\((.+?)\)/)?.[1] || '',
    ).match(/>([^><]+?)<\/td>/)?.[1];
  } catch (error) {
    verbose && debugC(error);
  }

  if (!first) {
    debugC('url=[%s]', url);
    debugC('str=[%s]', str);
  }

  return first ? [first] : [];
}

/** @param {string} word */
export function speak(word) {
  if (!parser.get('speak')) {
    debugC('Not speak because "speak" flag', parser.flags.speak, 'is off.');

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

/**
 *
 * @param {string | 1} val
 * @returns
 */
function shouldShowCollins(val) {
  const isDefaultValue = val === 1;

  if (isDefaultValue) {
    return false;
  }

  if (Number(val) || val.startsWith('a')) {
    return true;
  }

  return true;
}

// @ts-check
import * as vm from 'node:vm';

const BOLD = '\x1b[1m';
const UNDERLINED = '\x1b[4m';
const ITALIC = '\x1b[3m';
const RED = '\x1b[31m';

export const RESET = '\x1b[0m';
// const RESET_BOLD = '\x1b[22m';
// const RESET_UNDERLINED = '\x1b[24m';

export const WHITE = '\x1b[97m';
export const CYAN = '\x1b[36m';
// FIXME: not see how to reset cyan only
// export const RESET_CYAN = '\x1b[29m'

/** @param {string[]} text */
export const h2 = (...text) => bold(`## ${text.join(' ')}`);

/** @param {string} text */
export const red = (text) => `${RED}${text}${RESET}`;

/**
 * @type {(val: any) => val is string}
 */
export const isString = (val) => typeof val === 'string';

/** @param {string} str */
export function italic(str) {
  return `${ITALIC}${str}${RESET}`;
}
/** @param {string} str */
export function white(str) {
  return `${WHITE}${str}${RESET}`;
}

/**
 * @param {string} str
 * @param {{ white?: boolean }} options
 * @returns {string}
 */
export function bold(str, { white = true } = {}) {
  return CYAN + BOLD + UNDERLINED + str + RESET + (white ? WHITE : '');
}

/**
 * @template T
 * @param {T[]} arr
 * @param {number} count
 * @returns {T[][]}
 */
export function chunk(arr, count) {
  const copy = [...arr];
  const result = [];
  let temp;

  // biome-ignore lint/suspicious/noAssignInExpressions: false positive
  while (((temp = copy.splice(0, count)), temp.length)) {
    result.push(temp);
  }

  return result;
}

/**
 *
 * @param  {...any} args
 * @returns
 */
export function debug(...args) {
  const containsError = args.some(
    (arg) => arg instanceof Error || /error|fail/i.test(arg),
  );

  const level = containsError ? 'error' : 'log';
  const DEBUG_ICON = '?';

  // console.log(debugIcon, 'level =', level)
  // 'dd' 'dd' 'dd' 1 'dd'
  // 'dd dd dd' 1 'dd'
  const breakpoint = getBreakpoint(args);

  const first = [DEBUG_ICON, ...args.slice(0, breakpoint + 1)].join(' ');
  const rest = args.slice(breakpoint + 1);

  console[level](first, ...rest);

  return true;
}

/**
 * @param {any[]} args
 * @returns {number} breakpoint
 *
 * @example
 * [1, '%s', 'baz']
 * -1
 * // slice(0, 0) slice(0)
 * ['foo', 's', 'baz', {}]
 * 2
 * ['foo', '%s', 'baz']
 * 1
 * ['foo', '%s', '%d', 'baz']
 * 2
 */
function getBreakpoint(args) {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];

    if (!isString(arg)) {
      return index - 1;
    }

    const isPlaceholder = (item) => /%[fidjsoO]/.test(item);

    if (isPlaceholder(arg) && !isPlaceholder(args[index + 1])) {
      return index;
    }
  }

  return -1;
}

/**
 *
 * @param {string} sentence
 * @param {string[]} words
 * @returns
 */
export function highlight(sentence, words) {
  // console.log('sentence:', sentence);
  const queryWord = words[0];
  const uniqWords = uniq(words);
  // console.log('words:', { uniqWords });

  /** @param {string} w */
  const isEnglish = (w) => /^\w+$/.test(w);
  const pattern = uniqWords
    .map((w) => w.replace(/([()])/g, '\\$1'))
    .map((w) => (isEnglish(w) ? `\\b${genWordVariants(w)}\\b` : w))
    .concat(`<b>${queryWord}</b>`)
    .join('|');

  // console.log('pattern:', pattern);

  return sentence.replace(new RegExp(pattern, 'gi'), (m) =>
    bold(m.replace(`<b>`, '').replace('</b>', '')),
  );
}

/**
 * @param {string} word
 * @returns {string}
 */
function genWordVariants(word) {
  // console.log('word:', word);
  return (
    word.slice(0, word.length - 1) +
    `(?:${word.at(-1)})?` +
    `(?:ed|ing|s|es|ies)?`
  );
}

/**
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
function uniq(arr) {
  return [...new Set(arr)];
}

// todo cache

/**
 * @param {string} html
 * @param {import('../../typings').AllHTMLTags} tag
 * @returns {string[]}
 * @example
 * extractTextInTag('<script>window.__NUXT__=...</script><a href="https://google.com">google</a>', { tag: 'a' }); // 'google'
 */
export function extractTextInTag(html, tag) {
  return Array.from(
    html.matchAll(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'igs')), // s dotAll make dot match newline
    (m) => m[1],
  );
}

/**
 * @param {string} html
 * @returns {string | undefined}
 * @example
 * extractNuxtScript('<script>window.__NUXT__=...</script><a href="https://google.com">google</a>', { tag: 'a' }); // 'window.__NUXT__=...'
 */
function extractNuxtScript(html) {
  const script = extractTextInTag(html, 'script').find((script) => {
    // console.log('script:', script);
    return script.startsWith('window.__NUXT__=');
  });

  return script;
}

/**
 *
 * @param {string} html
 * @returns {import('../../typings').__NUXT__}
 * @example
 * // 见单元测试
 */
export function evaluateNuxtInScriptTag(html) {
  const script = extractNuxtScript(html);
  // console.log('script:', script);

  if (!script) {
    return { data: [] };
  }

  // @ts-expect-error
  globalThis.window = {};

  // Remove "window.__NUXT__="
  // script = script.replace(/^window\.__NUXT__=/, '');
  // console.log('script after replace:', script);

  // biome-ignore lint/security/noGlobalEval: it has to be evaluated no better way
  globalThis.eval(script);

  // @ts-expect-error
  return globalThis.window.__NUXT__;
}

/**
 * This is a more safe version of `evaluateNuxtInScriptTag`.
 * because it uses `vm` to evaluate the script thus the script can't access important global variables such as process and require.
 * but "The node:vm module is not a security mechanism. Do not use it to run untrusted code."
 * is still vulnerable to some attacks such as prototype pollution.
 * @param {string} html
 * @returns {import('../../typings').__NUXT__}
 * @example
 * // 见单元测试
 */
export function evaluateNuxtInScriptTagUseVM(html) {
  const scriptContent = extractNuxtScript(html);
  // console.log('script:', script);

  if (!scriptContent) {
    // console.warn(
    //   'No script content starts with `window.__NUXT__` found in html.',
    //   { scriptContent, html },
    // );
    return { data: [] };
  }

  // 1. 准备一个沙箱环境
  // 重点：Object.create(null) 防止全局变量逃逸
  const sandbox = Object.create(null);
  // 可以预先定义一些你希望脚本访问的属性
  sandbox.window = Object.create(null);
  sandbox.window.__NUXT__ = undefined;

  // const sandbox = {
  //   window: {
  //     // 可以预先定义一些你希望脚本访问的属性
  //     __NUXT__: undefined,
  //   },
  // };

  // 2. 创建沙箱上下文
  vm.createContext(sandbox);

  try {
    // 3. 在沙箱中执行脚本
    // 注意：我们直接执行脚本，而不是用new vm.Script()，因为脚本是动态生成的
    vm.runInContext(scriptContent, sandbox);

    // 4. 从沙箱的window对象上获取 __NUXT__
    const nuxtData = sandbox.window.__NUXT__;

    if (nuxtData) {
      // console.log('成功提取 __NUXT__ 数据:', nuxtData);
      return nuxtData;
      // 接下来你可以使用 nuxtData 了
    } else {
      console.warn('No __NUXT__ find after evaluating script.');
    }
  } catch (error) {
    console.error('Error evaluating script:', error);
  }

  return { data: [] };
}

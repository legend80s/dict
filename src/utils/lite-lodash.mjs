const BOLD = '\x1b[1m';
const UNDERLINED = '\x1b[4m'
const ITALIC = '\x1b[3m'

const RESET = '\x1b[0m'
const RESET_BOLD = '\x1b[22m'
const RESET_UNDERLINED = '\x1b[24m'

export const WHITE = '\x1b[97m'
export const h2 = (...text) => bold('## ' + text.join(' '));

/**
 * @type {(val: any) => val is string}
 */
export const isString = (val) => typeof val === 'string'

export function italic(str) {
  return `${ITALIC}${str}${RESET}`;
}
export function white(str) {
  return `${WHITE}${str}${RESET}`;
}
export function bold(str, underlined = true) {
  return BOLD+UNDERLINED+str+RESET_BOLD+RESET_UNDERLINED;
}

export function chunk(arr, count) {
  const copy = [...arr]
  const result = []
  let temp;

  while (temp = copy.splice(0, count), temp.length) {
    result.push(temp)
  }

  return result;
}

/**
 *
 * @param  {...string} args
 * @returns
 */
export function debug(...args) {
  const containsError = args.some((arg) => arg instanceof Error || /error|fail/i.test(arg));

  const level = containsError ? 'error' : 'log';
  const DEBUG_ICON = '?';

  // console.log(debugIcon, 'level =', level)
  // 'dd' 'dd' 'dd' 1 'dd'
  // 'dd dd dd' 1 'dd'
  const breakpoint = getBreakpoint(args);

  const first = [DEBUG_ICON, ...args.slice(0, breakpoint + 1)].join(' ');
  const rest = args.slice(breakpoint + 1);

  console[level](first, ...rest);

  return true
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
  const uniqWords = uniq(words);
  // console.log('words:', { uniqWords });

  const isEnglish = (w) => /^\w+$/.test(w)

  return sentence.replace(
    new RegExp(uniqWords
      .map(w => w
        .replace(/([()])/g, '\\$1')
      )
      .map(w => isEnglish(w) ? `\\b${genWordVariants(w)}\\b` : w)
      .join('|'), 'gi'),

    (m) => bold(m)
  )
}

/**
 * @param {string} word
 * @returns {string}
 */
function genWordVariants(word) {
  // console.log('word:', word);
  return word.slice(0, word.length - 1)
    + `(?:${word.at(-1)})?`
    + `(?:ed|ing|s|es|ies)?`
  ;
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

const WHITE = '\x1b[97m'

const BOLD = '\x1b[1m';
const UNDERLINED = '\x1b[4m'
const ITALIC = '\x1b[3m'

const RESET = '\x1b[0m'
const RESET_BOLD = '\x1b[22m'
const RESET_UNDERLINED = '\x1b[24m'

exports.white = white;
exports.italic = italic;
exports.bold = bold;
exports.chunk = chunk;
exports.h2 = (...text) => console.log(bold(text.join(' ')));

exports.WHITE = WHITE;
exports.RESET = RESET;

/**
 * @type {(val: any) => val is string}
 */
const isString = (val) => typeof val === 'string'

exports.isString = isString;

function italic(str) {
  return `${ITALIC}${str}${RESET}`;
}
function white(str) {
  return `${WHITE}${str}${RESET}`;
}
function bold(str, underlined = true) {
  return BOLD+UNDERLINED+str+RESET_BOLD+RESET_UNDERLINED;
}

function chunk(arr, count) {
  const copy = [...arr]
  const result = []

  while (temp = copy.splice(0, count), temp.length) {
    result.push(temp)
  }

  return result;
}

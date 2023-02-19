
const BOLD = '\x1b[1m';
const ITALIC = '\x1b[3m'
const RESET = '\x1b[0m'

exports.italic = italic;
exports.bold = bold;
exports.h2 = (...text) => console.log(bold(text.join(' ')));
exports.chunk = chunk;

function italic(str) {
  return `${ITALIC}${str}${RESET}`;
}
function bold(str) {
  return `${BOLD}${str}${RESET}`;
}

function chunk(arr, count) {
  const copy = [...arr]
  const result = []

  while (temp = copy.splice(0, count), temp.length) {
    result.push(temp)
  }

  return result;
}

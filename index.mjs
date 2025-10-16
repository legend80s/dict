#!/usr/bin/env node
// @ts-check
import {
  // debugC as debug,
  // help,
  // parser,
  query,
  speak,
} from './src/core.mjs';
import { translate } from './src/translator/index.mjs';
import {
  debugC as debug,
  help,
  parser,
  showHelp,
} from './src/utils/parser.mjs';

main();

async function main() {
  debug('args:', parser.args);

  if (showHelp()) {
    help();
    return;
  }

  const word = parser.firstArg();

  speak(word);

  const threshold = 50000;
  // const threshold = 5;
  const isEnglishSentence =
    /\w+/.test(word) && word.split(' ').length > threshold;

  if (isEnglishSentence) {
    const verbose = parser.get('verbose');

    translate(word, { verbose });

    return;
  }

  query(word);
}

#!/usr/bin/env node
import {
  query,
  help,
  showHelp,
  parser,
  debugC as debug,
  speak,
} from './src/core.mjs';
import { translate } from './src/translator/index.mjs';

main()

async function main() {
  debug('args:', parser.args);

  if (showHelp()) {
    help();
    return;
  }

  const word = parser.firstArg();

  speak(word);

  const threshold = 50000;
  const isEnglishSentence = /\w+/.test(word) && word.split(' ').length > threshold;

  if (isEnglishSentence) {
    const verbose = parser.get('verbose')

    translate(word, { verbose });

    return;
  }

  query(word);
}

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
import { help, parser, showHelp } from './src/utils/arg-parser.mjs';
import { italic } from './src/utils/lite-lodash.mjs';
import { debugC as debug } from './src/utils/logger.mjs';

main();

async function main() {
  const label = italic('查询耗时 🕑');
  console.time(label);

  try {
    await init();
  } finally {
    console.timeEnd(label);
  }
}

async function init() {
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
  const verbose = parser.get('verbose');

  if (isEnglishSentence) {
    translate(word, { verbose });

    return;
  }

  try {
    await query(word);
  } catch (err) {
    verbose && console.error('query failed', err);
  }
}

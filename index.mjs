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
import { italic, white } from './src/utils/lite-lodash.mjs';

main()

async function main() {
  debug('args:', parser.args);

  if (showHelp()) {
    help();
    return;
  }

  const word = parser.firstArg();

  speak(word);

  const isEnglishSentence = /\w+/.test(word) && word.split(' ').length > 10;

  const verbose = parser.get('verbose')

  if (isEnglishSentence) {
    try {
      console.log(white(await translate(word)));
    } catch (error) {
      console.error('Translated failed:');
      verbose && console.error(error);
    } finally {
      console.log();
      console.log(italic(`Powered by "${white('Yandex Translate')}".`));
      console.log(italic(`See more at https://translate.yandex.com/?source_lang=en&target_lang=zh&text=${encodeURIComponent(word)}`));
    }

    return;
  }

  query(word);
}

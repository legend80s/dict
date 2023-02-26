#!/usr/bin/env node
import { query, help, showHelp, parser, debugC as debug, speak } from './src/core.mjs';

main()

function main() {
  debug('args:', parser.args);

  if (showHelp()) {
    help();
    return;
  }

  const word = parser.firstArg();

  speak(word);
  query(word);
}

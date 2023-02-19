#!/usr/bin/env node
const { query, help, showHelp, parser, debug, speak } = require('./src/core');

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

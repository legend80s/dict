#!/usr/bin/env node
const { query, help, showVersion } = require('./src/core');

main()

function main() {
  if (showVersion()) {
    help();
    return;
  }

  const word = process.argv[2]?.trim();
  // console.log('Word:', `"${word}"`);

  query(word)
}

// @ts-check
import { createRequire } from 'node:module';

import { ArgParser } from '../args.mjs';

const require = createRequire(import.meta.url);

const flags = {
  help: ['-h', '--help'],
  version: ['-v', '--version'],
  verbose: '--verbose',

  speak: ['-s', '--speak', false],
  example: ['-e', '--example', false],
  collins: ['-c', '--collins', 1],
};

export const parser = new ArgParser(flags);

export const verbose = !!parser.get('verbose');

export function showHelp() {
  return parser.get('help', 'version');
}

export function help() {
  // @ts-expect-error
  const { name, description, version } = require('../package.json');

  console.log();
  console.log([name, version].join('@'));
  console.log();
  console.log('>', description);
  console.log();
  console.log('> Example:');
  console.log(`> $ npx dict <word> [${Object.values(flags).flat().join(' ')}]`);
}

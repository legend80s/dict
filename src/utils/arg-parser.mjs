// @ts-check
import { createRequire } from 'node:module'

import { ArgParser } from '../args.mjs'
import { bold, green } from './lite-lodash.mjs'

const require = createRequire(import.meta.url)

/** @type {import('../../typings').IFlags} */
const flags = {
  help: ['-h', '--help'],
  version: ['-v', '--version'],
  verbose: ['--verbose'],

  speak: ['-s', '--speak', false],
  example: ['-e', '--example', false],
  collins: ['-c', '--collins', 0],
}

export const parser = new ArgParser(flags)

/** @type {boolean} */
export const verbose = parser.get('verbose')

// /** @type {boolean} */
// export const example = parser.get('example'); // boolean
// /** @type {number} */
// export const collins = parser.get('collins'); // number

// /** @type {boolean} */
// export const helpInArg = parser.get('help'); // boolean

/** @returns {boolean} */
export function showHelp() {
  return parser.get('help') || parser.get('version')
}

export function help() {
  // @ts-expect-error
  const { name, description, version } = require('../../package.json')

  console.info()
  console.info(' '.repeat(20) + bold([name, version].join('@')))
  console.info()
  console.info('>', description)

  console.info()
  console.info(`> ${bold('Usage')}:`)
  console.info(`> $ ${green('npx ydd <word>')}`)

  console.info()
  console.info(`> ${bold('Options')}:`)
  console.table(flags)
}

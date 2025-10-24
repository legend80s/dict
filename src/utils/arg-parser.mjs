// @ts-check
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'

import { bold, green } from './lite-lodash.mjs'

const require = createRequire(import.meta.url)

/** @type {import('node:util').ParseArgsOptionsConfig} */
const options = {
  help: {
    type: 'boolean',
    short: 'h',
    // @ts-expect-error
    description: '展示帮助信息',
  },
  version: {
    type: 'boolean',
    short: 'v',
    // @ts-expect-error
    description: '展示版本信息',
  },
  verbose: {
    type: 'boolean',
    // @ts-expect-error
    description: '展示详细日志',
  },
  speak: {
    type: 'boolean',
    short: 's',
    // @ts-expect-error
    description: '单词发音（Windows 系统不支持）',
  },
  example: {
    type: 'boolean',
    short: 'e',
    // @ts-expect-error
    description: '展示双语示例',
  },
  collins: {
    type: 'string',
    short: 'c',
    // @ts-expect-error
    description: '展示几条柯林斯英汉双解词典解释：两条：`-c=2`，全部 `-c=all`',
  },
}

export const DEFAULTS = {
  collins: 3,
}

const args = process.argv.slice(2)

const { values, positionals } = parseArgs({
  args,

  strict: true,
  allowNegative: true,
  allowPositionals: true,
  options,
})

export const parsed = {
  args,

  /** @type {string} */
  word: positionals[0] || '',

  help: !!values.help,
  version: !!values.version,
  /** @type {boolean} */
  verbose: !!values.verbose,

  speak: !!values.speak,
  example: !!values.example,
  /** @type {undefined | string} */
  // @ts-expect-error
  collins: values.collins?.replace(/^=/, ''),
}

/** @returns {boolean} */
export function showHelp() {
  return parsed.help || parsed.version
}

/**
 * @param {{ showVersion?: boolean; showDescription?: boolean; showUsage?: boolean; showOptions?: boolean }} param0
 */
export function help({
  showVersion = true,
  showDescription = true,
  showUsage = true,
  showOptions = true,
} = {}) {
  // @ts-expect-error
  const { name, description, version } = require('../../package.json')

  if (showVersion) {
    console.info()
    console.info(' '.repeat(20) + bold([name, version].join('@')))
  }

  if (showDescription) {
    console.info()
    console.info('>', description)
  }

  if (showUsage) {
    console.info()
    console.info(`> ${bold('Usage')}:`)
    console.info(`> $ ${green('npx ydd <word>')}`)
  }

  if (showOptions) {
    console.info()
    console.info(`> ${bold('Options')}:`)
    console.table(options)
  }
}

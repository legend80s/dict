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
  stream: {
    type: 'boolean',
    // @ts-expect-error
    description: '逐字输出结果',
  },
}

export const DEFAULTS = {
  collins: 3,
}

const args = process.argv.slice(2)

/**
 *
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 * @returns
 */
export function parseCLIArgs(args, env) {
  const { values, positionals } = parseArgs({
    args,

    strict: true,
    allowNegative: true,
    allowPositionals: true,
    options,
  })

  const stream = resolveStreamOption(values.stream, env)
  // console.log(`stream:|${stream}|`)

  return {
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
    /** @type {boolean} 默认 true */
    stream,
  }
}

/**
 * 解析流式输出选项。
 *
 * 显式参数（命令行标志） > 环境变量 > 默认值
 * 环境变量 YDD_NO_STREAM=1 禁止流式输出，命令行参数 --stream 或 --no-stream 覆盖环境变量
 * 用户在命令行敲了 --verbose，说明他此刻明确想要调试输出，此时环境变量 LOG_LEVEL=error 就不该覆盖这个意图
 *
 * @param {*} stream
 * @param {NodeJS.ProcessEnv} env
 * @returns
 */
function resolveStreamOption(stream, env) {
  // console.log('stream:', stream, env.YDD_NO_STREAM)

  // 注意不能在 args 里面增加 default true 否则无法区分
  // 用户是否显式传入了 --stream 或 --no-stream，因为 parseArgs 解析后 stream 的值会是 true 或 false，而不是 undefined
  if (stream !== undefined) {
    return !!stream
  }

  if (env.YDD_NO_STREAM === '1') {
    return false
  }

  return true
}

export const parsed = parseCLIArgs(args, process.env)

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

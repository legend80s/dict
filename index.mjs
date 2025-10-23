#!/usr/bin/env node
// @ts-check

import { query, speak } from './src/core.mjs'
import { translate } from './src/translator/index.mjs'
import { help, parser, showHelp } from './src/utils/arg-parser.mjs'
import { italic } from './src/utils/lite-lodash.mjs'
import { debugC as debug } from './src/utils/logger.mjs'

main()

async function main() {
  await init()
}

/**
 *
 * @returns {Promise<boolean>}
 */
async function init() {
  debug('args:', parser.args)

  if (showHelp()) {
    help()
    return false
  }

  const word = parser.firstArg()

  speak(word)

  const threshold = 3
  // const threshold = 5;
  const isEnglishSentence =
    /\w+/.test(word) && word.split(' ').length > threshold
  const verbose = parser.get('verbose')

  if (isEnglishSentence) {
    const label = italic('翻译长句耗时 🕑')

    console.time(label)
    await translate(word, { verbose })
    console.timeEnd(label)

    return true
  }

  const label = italic('查询单词耗时 🕑')
  console.time(label)

  try {
    await query(word)

    console.timeEnd(label)
  } catch (err) {
    verbose && console.error('query failed', err)
  }

  return true
}

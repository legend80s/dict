#!/usr/bin/env node
// @ts-check

import { query, speak } from './src/core.mjs'
import { config } from './src/core/constants.mjs'
import { translate } from './src/translator/index.mjs'
import { help, parsed, showHelp } from './src/utils/arg-parser.mjs'
import { italic } from './src/utils/lite-lodash.mjs'
import { debugC as debug } from './src/utils/logger.mjs'

const verbose = parsed.verbose

main()

async function main() {
  await init()
}

/**
 *
 * @returns {Promise<boolean>}
 */
async function init() {
  debug('args:', parsed.args)

  if (showHelp()) {
    help()
    return false
  }

  const word = parsed.word

  speak(word)

  const threshold = 3
  // const threshold = 5;
  const isEnglishSentence = /\w+/.test(word) && word.split(' ').length > threshold

  if (isEnglishSentence && config.baiduTranslate.enabled) {
    const label = italic('翻译长句耗时 🕑')

    console.time(label)
    await translate(word, { verbose })
    console.timeEnd(label)

    return true
  }

  const label = italic('查询单词耗时 🕑')
  console.time(label)

  try {
    const didQuery = await query(word)

    didQuery && console.timeEnd(label)
  } catch (err) {
    verbose && console.error('query failed', err)
  }

  return true
}

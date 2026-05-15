#!/usr/bin/env node

// @ts-check
import { config } from './src/core/constants.mjs'
import { print, query, speak } from './src/core.mjs'
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

  const label = italic('查询单词耗时 🕑:')
  // console.time(label)
  const start = Date.now()

  try {
    const [didQuery, result] = await query(word)

    if (didQuery) {
      // show query time not print time because print time is affected by stream or not
      const end = Date.now()
      await print(word, result)
      console.log(label, ((end - start) / 1000).toFixed(2), '秒')
    }
  } catch (err) {
    verbose && console.error('query failed', err)
  }

  return true
}

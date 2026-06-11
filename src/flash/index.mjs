// @ts-check
import { getCard, getDueCards, updateReview, getStats, closeDb } from './db.mjs'
import {
  renderFront,
  renderBack,
  renderNoCards,
  renderComplete,
  renderError,
  enterRawMode,
  exitRawMode,
  waitForAnyKey,
  waitForGrade,
  speak,
} from './tui.mjs'
import { debug } from '../utils/lite-lodash.mjs'

/** @import { CardRow } from './db.mjs' */
/** @import { IParsedResult } from '../../typings' */

/**
 * Review a single word: show card front → back → grade → exit.
 * @param {string} word
 * @param {boolean} [flip] skip front, show back directly
 */
export async function startSingleWordReview(word, flip = false) {
  const card = getCard(word)

  if (!card) {
    renderError(`Word "${word}" not found in history.\nQuery it first with: ydd ${word}`)
    exitRawMode()
    return
  }

  enterRawMode()

  try {
    const cardData = /** @type {import('./tui.mjs').CardData} */ ({
      word: card.word,
      ...card.data,
      query_count: card.query_count,
    })

    if (flip) {
      renderBack(cardData, 0, 1)
    } else {
      renderFront(cardData, 0, 1)

      let flipToBack = false
      while (!flipToBack) {
        const action = await waitForAnyKey()

        switch (action.action) {
          case 'quit':
            exitRawMode()
            return

          case 'speak':
            speak(card.word)
            break

          case 'flip':
            flipToBack = true
            break
        }
      }

      renderBack(cardData, 0, 1)
    }

    let graded = false
    while (!graded) {
      const action = await waitForGrade()

      switch (action.action) {
        case 'quit':
          exitRawMode()
          return

        case 'speak':
          speak(card.word)
          break

        case 'grade':
          updateReview(card.word, action.grade)
          graded = true
          break
      }
    }
  } finally {
    exitRawMode()
    closeDb()
  }
}

/**
 * Start the flash card review session.
 */
export async function startFlashReview() {
  enterRawMode()

  try {
    const cards = getDueCards()

    if (cards.length === 0) {
      const stats = getStats()
      if (stats.total === 0) {
        renderNoCards()
      } else {
        renderComplete(stats)
      }
      await waitForExit()
      return
    }

    let index = 0

    while (index < cards.length) {
      const card = cards[index]

      const cardData = /** @type {import('./tui.mjs').CardData} */ ({
        word: card.word,
        ...card.data,
        query_count: card.query_count,
      })

      renderFront(cardData, index, cards.length)

      // Wait for any key on front (space/enter/any flips to back, p=speak, q=quit)
      let flipToBack = false
      while (!flipToBack) {
        debug('flash front waiting for key...')
        const frontAction = await waitForAnyKey()

        switch (frontAction.action) {
          case 'quit':
            debug('flash front quit')
            renderExit(cards.length, index)
            return

          case 'speak':
            debug('flash front speak')
            speak(card.word)
            break

          case 'flip':
            debug('flash front flip to back')
            flipToBack = true
            break
        }
      }

      renderBack(cardData, index, cards.length)

      let graded = false
      while (!graded) {
        const action = await waitForGrade()

        switch (action.action) {
          case 'quit':
            renderExit(cards.length, index)
            return

          case 'speak':
            speak(card.word)
            break

          case 'grade':
            updateReview(card.word, action.grade)
            graded = true
            break
        }
      }

      index++
    }

    const stats = getStats()
    renderComplete(stats)
    await waitForExit()
  } finally {
    exitRawMode()
    closeDb()
  }
}

/**
 * @param {number} total
 * @param {number} current
 */
function renderExit(total, current) {
  exitRawMode()
  console.log(`\n  Review session saved (${current}/${total}). See you next time!\n`)
}

/** @returns {Promise<void>} */
function waitForExit() {
  return new Promise(resolve => {
    const handler = () => {
      process.stdin.removeListener('data', handler)
      resolve()
    }
    process.stdin.on('data', handler)
    setTimeout(() => {
      process.stdin.removeListener('data', handler)
      resolve()
    }, 3000)
  })
}

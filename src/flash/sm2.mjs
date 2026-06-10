// @ts-check

export const MIN_EASE_FACTOR = 1.3
export const INITIAL_EASE_FACTOR = 2.5

/**
 * SM-2 algorithm: compute new scheduling parameters after a review.
 *
 * @param {{ repetitions: number; easeFactor: number; interval: number }} current
 * @param {1 | 2 | 3 | 4} grade — 1=Again 2=Hard 3=Good 4=Easy
 * @returns {{ repetitions: number; easeFactor: number; interval: number; nextReviewAt: Date }}
 */
export function sm2(current, grade) {
  let { repetitions, easeFactor, interval } = current

  switch (grade) {
    case 1: // Again — completely forgotten
      repetitions = 0
      interval = 0
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2)
      break

    case 2: // Hard — recalled with difficulty
      repetitions = 0
      interval = 1
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.15)
      break

    case 3: // Good — recalled correctly
      repetitions += 1
      interval = computeInterval(repetitions, interval, easeFactor)
      break

    case 4: // Easy — recalled effortlessly
      repetitions += 1
      interval = Math.round(computeInterval(repetitions, interval, easeFactor) * 1.3)
      easeFactor = easeFactor + 0.15
      break

    default:
      throw new Error(`Invalid grade: ${grade}. Must be 1, 2, 3, or 4.`)
  }

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + interval)
  nextReviewAt.setHours(0, 0, 0, 0)

  return { repetitions, easeFactor, interval, nextReviewAt }
}

/**
 * @param {number} repetitions
 * @param {number} interval
 * @param {number} easeFactor
 * @returns {number}
 */
function computeInterval(repetitions, interval, easeFactor) {
  if (repetitions === 1) return 1
  if (repetitions === 2) return 6
  return Math.round(interval * easeFactor)
}

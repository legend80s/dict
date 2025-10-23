import fs from 'node:fs'

const fp = './test/asset.txt'

const article = fs.readFileSync(fp).toString('utf8').toLowerCase()
const seg = new Intl.Segmenter('en', { granularity: 'word' })

const words = Array.from(
  new Set(
    Array.from(seg.segment(article))
      .filter(item => item.isWordLike)
      .map(item => item.segment),
  ),
)

// 2279
// 895
console.info('words.length:', words.length)
// 825
// 789 2024-03-22 after use Segmenter

/**
 * @param {number} limit
 * @returns {Set<string>}
 */
export const pickRandomWords = limit => {
  return pickRandoms(words, limit, { predicate: item => !/^\d/.test(item) })
}

/**
 * @template T
 * @param {T[]} arr
 * @param {number} limit
 * @param {{predicate?: (item: T) => boolean}} [options]
 * @returns {Set<T>}
 */
function pickRandoms(arr, limit, { predicate = () => true } = {}) {
  const set = new Set()

  for (let index = 0; index < arr.length; index++) {
    const idx = randomInteger(0, arr.length)

    const item = arr[idx]
    if (!set.has(item) && predicate(item)) {
      set.add(item)

      if (set.size === limit) {
        return set
      }
    }
  }

  return set
}

/**
 *
 * @param {number} min
 * @param {number} max
 * @returns
 */
function randomInteger(min, max) {
  // [0, 1)
  return Math.floor(Math.random() * (max - min) + min) // The maximum is exclusive and the minimum is inclusive
}

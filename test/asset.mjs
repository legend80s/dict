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
  return pickUniqueRandomItems(words, limit, { predicate: item => !/^\d/.test(item) })
}

/**
 * @template T
 * @param {T[]} array
 * @param {number} limit
 * @param {{predicate?: (item: T) => boolean}} [options]
 * @returns {Set<T>}
 */
function pickUniqueRandomItems(array, limit, { predicate = _item => true } = {}) {
  if (limit > array.length) {
    throw new Error('limit 不能大于数组长度')
  }

  // 如果有条件函数，先过滤数组
  const sourceArray = predicate ? array.filter(predicate) : array

  if (limit > sourceArray.length) {
    throw new Error(
      `经过条件过滤后，limit 不能大于剩余数组长度：{ limit: ${limit}, array.length: ${sourceArray.length} }`,
    )
  }

  const set = new Set()

  while (set.size < limit) {
    const randomIdx = randomInteger(0, sourceArray.length)
    const item = sourceArray[randomIdx]

    set.add(item)
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

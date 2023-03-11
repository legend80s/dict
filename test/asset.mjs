import fs from 'node:fs';
const fp = './test/asset.txt';

const words = Array.from(new Set(fs.readFileSync(fp).toString('utf8')
  .toLowerCase()
  .match(/[^-<>"\s,.:+#\/\\()@]+/g)));

// 2279
// 895
// console.log('words.length:', words.length);
// 825

export const pickRandomWords = (limit) => {
  return pickRandoms(words, limit)
}

/**
 * @template T
 * @param {T[]} arr
 * @param {number} limit
 * @returns {T[]}
 */
function pickRandoms(arr, limit) {
  const set = new Set();

  for (let index = 0; index < arr.length; index++) {
    const idx = randomInteger(0, arr.length);

    if (!set.has(arr[idx])) {
      set.add(arr[idx])

      if (set.size === limit) {
        return set;
      }
    }
  }

  return set;
}

function randomInteger(min, max) {
  // [0, 1)
  return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

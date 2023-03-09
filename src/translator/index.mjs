import { createRequire } from 'node:module';

import { rcFilepath, writeFullConfig } from '../config.mjs';
import { italic, white } from '../utils/lite-lodash.mjs';
import { translate as trans } from './translate.mjs';

const require = createRequire(import.meta.url);

export async function translate(text, { verbose = false } = {}) {
  const [lastTime, data] = estimate(verbose);
  console.log(`翻译中……，预计 ${lastTime || 6}s`);

  const start = Date.now();
  let end = 0;

  try {
    console.log(white(await trans(text)));
  } catch (error) {
    console.error('Translated failed');
    verbose && console.error(error);
  } finally {
    console.log();
    console.log(italic(`Powered by "${white('Yandex Translate')}".`));
    console.log(italic(`See more at https://translate.yandex.com/?source_lang=en&target_lang=zh&text=${encodeURIComponent(text)}`));

    end = Date.now()
  }

  saveTime(end - start, data);
}

function saveTime(time, data) {
  const updated = data || {};
  const sec = parseInt(time / 1000);
  // console.log('updated before:', updated);

  if (!updated.translate) {
    updated.translate = {
      lastTimeCostsInSecondsRecord: [sec],
    }
  } else {
    updated.translate.lastTimeCostsInSecondsRecord.push(sec);
  }

  writeFullConfig(updated)
  // console.log('updated after:', updated);
}

function estimate(verbose) {
  try {
    const data = require(rcFilepath);
    const records = data.translate?.lastTimeCostsInSecondsRecord;
    const meanTime = trimMean(records);
    verbose && console.log('rcFilepath:', data);
    verbose && console.log('records:', records);
    verbose && console.log('meanTime:', meanTime);

    return [meanTime, data];
  } catch (error) {
    verbose && console.error('estimate time failed:')
    verbose && console.error(error)

    return [0];
  }
}

/**
 * @param {number[]} arr
 * @returns {number} 1.22s
 */
function trimMean(arr = []) {
  const clone = [...arr]

  const trimmed = mid(clone.sort((a, b) => a - b));
  const points = trimmed.length ? trimmed : arr;

  return points ? mean(points).toFixed(2) : points;
}

/**
 * @param {number[]} arr
 * @returns {number}
 */
function mean(arr) {
  return arr.length ? sum(arr) / arr.length : 0;
}

/**
 * @param {number[]} arr
 * @returns {number}
 */
function sum(arr) {
  return arr.reduce((a, b) => a + b, 0)
}

/**
 * @param {number[]} arr
 * @returns {number[]}
 */
function mid(arr) {
  return arr.slice(1, arr.length - 1)
}

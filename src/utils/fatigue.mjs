import fs from 'node:fs';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

import { debug } from './lite-lodash.mjs';

const require = createRequire(import.meta.url);

// cannot be .mjs because it's generated dynamically so must be `required`.
const rcFilepath = `${homedir()}/ydd-data.js`;
const header = `
// You can delete this file whenever.
// https://www.npmjs.com/package/ydd
`.trim();
const limit = 2;

/** @template {string} K */

export class Fatigue {
  /**
   * @param {boolean} verbose
   */
  constructor(verbose = false) {
    this.verbose = !!verbose;

    if (!fs.existsSync(rcFilepath)) {
      // console.log('not found');

      writeFullConfig('module.exports = {}')
    }
  }

  /**
   *
   * @param {K} key
   * @returns {boolean}
   */
  hit(key) {
    const config = require(rcFilepath);

    const hit = config[key] >= limit;

    this.debugF('hit', config, { key, hit });

    return hit;
  }

  setTired(key) {
    this.increment(key, limit)
  }

  /**
   * @param {K} key
   * @param {number} count
   */
  increment(key, count) {
    const config = require(rcFilepath);
    this.debugF('increment before key="%s", config=%j', key, config);

    const cnt = count ?? (config[key] ?? 0) + 1;
    config[key] = cnt;

    this.debugF('increment after key=%s, config=%j', key, config);

    writeFullConfig(`module.exports = ${JSON.stringify(config, null, 2)}`)
  }

  /**
   * @private
   * @param  {...any} args
   */
  debugF(...args) {
    if (this.verbose) {
      debug('[fatigue]', ...args)
    }
  }
}

/**
* @param {string} content
*/
function writeFullConfig(content) {
  fs.writeFileSync(
    rcFilepath,
    `${header}\n${content}\n`
  )
}

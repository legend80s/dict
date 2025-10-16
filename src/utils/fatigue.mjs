// @ts-check
import fs from 'node:fs';
import { createRequire } from 'node:module';

import { debug } from './lite-lodash.mjs';
import { rcFilepath, writeFullConfig } from '../config.mjs';

const require = createRequire(import.meta.url);

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

      writeFullConfig({});
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

  /**
   * @param {K} key
   */
  setTired(key) {
    this.increment(key, limit);
  }

  /**
   * @param {K} key
   * @param {number} [count]
   */
  increment(key, count) {
    const config = require(rcFilepath);
    this.debugF('increment before key="%s", config=%j', key, config);

    const cnt = count ?? (config[key] ?? 0) + 1;
    config[key] = cnt;

    this.debugF('increment after key=%s, config=%j', key, config);

    writeFullConfig(config);
  }

  /**
   * @private
   * @param  {...any} args
   */
  debugF(...args) {
    if (this.verbose) {
      debug('[fatigue]', ...args);
    }
  }
}

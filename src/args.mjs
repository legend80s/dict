/**
 * @typedef {string | string[] | Array<string|number|boolean>} IFlagItem
 */
/**
 * @template {Record<string, IFlagItem>} Flags
 *
 * @example
 * const parser = new ArgParser({
 *   verbose: ['--verbose', '-v'],
 * });
 *
 * // node cli.js --verbose
 * // node cli.js -v
 * parser.get('verbose'); // true
 *
 * // node cli.js
 * parser.get('verbose'); // false
 */
export class ArgParser {
  /**
   * @param {Flags} flags
   */
  constructor(flags) {
    this.flags = flags;
    this.args = process.argv.slice(2)
  }

  /**
   *
   * @param {Array<keyof Flags>} keys
   * @returns {boolean | number}
   */
  get(...keys) {
    // console.log('keys:', keys);

    const fallback = this.getFallback(keys[0]);

    // console.log('fallback:', fallback);

    /** @type {string[]} */
    const flags = keys.reduce((acc, key) => acc.concat(this.flags[key] || []), []);

    // console.log('this.args:', this.args);
    // console.log('flags:', flags);

    for (const arg of this.args) {
      // flags [-s, --silent]
      // arg --silent=false
      for (const flag of flags) {
        if (arg === flag) {
          return true;
        }

        const value = arg.match(new RegExp(`${flag}=(.+)`))?.[1];

        if (value === `true`) { return true }
        if (value === `false`) { return false }

        if (value) {
          return value;
        }
      }
    }

    return fallback;
  }

  getFallback(key) {
    const DEFAULT_FALLBACK = false;
    const first = this.flags[key];

    if (!Array.isArray(first)) {
      return DEFAULT_FALLBACK;
    }

    const fallback = first.at(-1);

    return ['boolean', 'number'].includes(typeof fallback) ? fallback : DEFAULT_FALLBACK;
  }

  /**
   * @returns {string}
   */
  firstArg(flag = false) {
    if (flag) {
      return this.args[0]?.trim() || '';
    }

    return this.args.find(arg => !arg.startsWith('-')) || ''
  }
}

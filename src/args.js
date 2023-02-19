/**
 * @template {Record<string, string | string[]>} Flags
 *
 * @example
 * const p = new ArgParser({
 *   verbose: ['--verbose', '-v'],
 * });
 *
 * // node cli.js --verbose
 * // node cli.js -v
 * p.isHit('verbose'); // true
 *
 * // node cli.js
 * p.isHit('verbose'); // false
 */
class ArgParser {
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
   * @returns {boolean}
   */
  isHit(...keys) {
    /** @type {string[]} */
    const flags = keys.reduce((acc, key) => acc.concat(this.flags[key] || []), []);

    return this.args.some(flag => flags.some((f) => flag === f));
  }

  /**
   * @returns {string}
   */
  firstArg() {
    return this.args[0]?.trim() || '';
  }
}

function cast2Array(val) {
  return Array.isArray(val) ? val : [val];
}

exports.ArgParser = ArgParser;

/**
 * @typedef {string | string[] | Array<string|number|boolean>} IFlagItem
 */

import { isNumberStr, red } from './utils/lite-lodash.mjs'
import { debugC } from './utils/logger.mjs'

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
    this.flags = flags
    this.args = process.argv.slice(2)
  }

  /**
   * @template {keyof Flags} K
   * @param {K} key
   * @returns {import('../typings').GeneralizedLast<Flags[K]>}
   */
  get(key) {
    // console.log('keys:', keys);

    const fallback = this.getFallback(key)

    const flagsAndDefaultValue = this.flags[key]
    /** @type {string[]} */
    const flags = (
      Array.isArray(flagsAndDefaultValue) ? flagsAndDefaultValue : [flagsAndDefaultValue]
    ).filter(item => String(item).startsWith('-'))

    // console.log('get:', key, { flags, args: this.args, fallback })

    for (const arg of this.args) {
      // flags [-s, --silent]
      // arg --silent=false
      for (const flag of flags) {
        if (arg === flag) {
          // @ts-expect-error
          return true
        }

        const value = arg.match(new RegExp(`${flag}=(.+)`))?.[1]

        if (value === `true`) {
          // @ts-expect-error
          return true
        }
        if (value === `false`) {
          // @ts-expect-error
          return false
        }

        if (value) {
          // @ts-expect-error
          return isNumberStr(value) ? Number(value) : value
        }
      }
    }

    // @ts-expect-error
    return fallback
  }

  /**
   * @param {keyof Flags} key
   */
  getFallback(key) {
    const DEFAULT_FALLBACK = false
    const theFlags = this.flags[key]

    if (!Array.isArray(theFlags)) {
      return DEFAULT_FALLBACK
    }

    const last = theFlags.at(-1)

    if (last === undefined) {
      debugC(red(`"${String(key)}" LAST FLAG SHOULD NOT BE EMPTY`), { theFlags: theFlags, last })
      return DEFAULT_FALLBACK
    }

    return !String(last).startsWith('-') ? last : DEFAULT_FALLBACK
  }

  /**
   * @returns {string}
   */
  firstArg(flag = false) {
    if (flag) {
      return this.args[0]?.trim() || ''
    }

    return this.args.find(arg => !arg.startsWith('-')) || ''
  }
}

import { parsed } from './arg-parser.mjs'
import { debug } from './lite-lodash.mjs'

const verbose = parsed.verbose

/**
 * @param {string} label
 * @returns {(...args: any[]) => void}
 */
const debugFactory = label => {
  return (...args) => {
    if (!verbose) {
      return false
    }

    debug(`[${label}]`, ...args)

    return true
  }
}

const debugCore = debugFactory('core')
export const debugDictionary = debugFactory('dictionary')
export const debugNuxt = debugFactory('dictionary-nuxt')

export const debugC = debugCore

// /**
//  *
//  * @param  {...any} args
//  * @returns
//  */
// export function debugC(...args) {
//   if (!verbose) {
//     return false;
//   }

//   debug('[core]', ...args);

//   return true;
// }

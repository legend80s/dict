import { verbose } from '../utils/arg-parser.mjs';
import { red } from '../utils/lite-lodash.mjs';
import { debugDictionary as debug } from '../utils/logger.mjs';
import { dictionaryByHTML } from './lookup-by-html.mjs';
import { dictionaryByNuxt } from './lookup-by-nuxt-in-html.mjs';

/** @type { 'nuxt' | 'html'} */
let lookupMethod = 'nuxt';

/**
 * 该方法用于查询字典。先从 html 1 的 `__NUXT__` 中查询，如果查询不到，则从 html 2 中查询。
 * @type {import('../../typings').IDictionary}
 */
export const dictionary = {
  makeHTMLUrl: (...args) => (lookupMethod === 'nuxt' ? dictionaryByNuxt : dictionaryByHTML).makeHTMLUrl(...args),

  async lookup(...args) {
    debug('lookup use nuxt with params:', ...args);

    /** @type {import('../../typings').IParsedResult} */
    let result = { errorMsg: 'NO RESULT' };
    let hasError = false;

    try {
      lookupMethod = 'nuxt';
      result = await dictionaryByNuxt.lookup(...args);
    } catch (error) {
      verbose && debug(red('dictionaryByNuxt.lookup FAILED'), error);
      hasError = true;
    }

    if (hasError || 'errorMsg' in result) {
      debug(red('nuxt FAILED! continue to lookup by HTML:'), result);

      lookupMethod = 'html';
      result = await dictionaryByHTML.lookup(...args);
    }

    return result;
  },
};

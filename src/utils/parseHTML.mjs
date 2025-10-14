import { evaluateNuxtInScriptTagUseVM } from './lite-lodash.mjs';

/**
 * cost: 367.983ms
 * @param {string} word
 * @returns {Promise<ErrorResult | { englishExplanation?: ICollinsItem[], explanations: string[]; examples?: string[] } >}
 */
async function parseHtml(word, { example = false, collins = false } = {}) {
  const nuxt = evaluateNuxtInScriptTagUseVM(html);
}

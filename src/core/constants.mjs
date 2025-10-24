// @ts-check
export const config = {
  // listItemIcon: '📖',
  listItemIcon: '🟢',
  // listItemIcon: "⭕️",
  // listItemIcon: "✅",
  // listItemIcon: '💬',

  baiduTranslate: {
    // 不稳定，暂时关闭
    enabled: false,
  },
}

/**
 * @type {import('../../typings').I18n}
 */
export const i18n = {
  'en-US': {
    error: {
      noWord: 'Please input word to query.',
      // englishWordOnly: 'Please input an valid English word.',
      notFound: word => `Word "${word}" Not found in dictionary.`,
    },
  },
  'zh-CN': {
    error: {
      noWord: '请输入需要查询的单词',
      // englishWordOnly: '目前仅支持英文单词查询',
      notFound: word => `抱歉没有找到“${word}”相关的词`,
    },
  },
}

export const text = i18n[getLanguage()]

/**
 * @param {string} word
 * @param {import('../../typings').IErrorType} errorType
 * @returns {import('../../typings').IErrorResult}
 */
export function genErrorResult(word, errorType) {
  const func = text.error[errorType]
  const errorMsg = typeof func === 'function' ? func(word) : func

  return {
    errorMsg: errorMsg,
    error: new Error(errorMsg),
    errorType,
  }
}

/**
 * @returns {import('../../typings').ILang}
 */
function getLanguage() {
  const lang = Intl.DateTimeFormat().resolvedOptions().locale

  // @ts-expect-error
  return lang || 'zh-CN'
}

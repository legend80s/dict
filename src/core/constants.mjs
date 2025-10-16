export const config = {
  // listItemIcon: '📖',
  listItemIcon: '🟢',
  // listItemIcon: "⭕️",
  // listItemIcon: "✅",
  // listItemIcon: '💬',
};

/**
 * @type {import('../typings').I18n}
 */
export const i18n = {
  'en-US': {
    error: {
      noWord: 'Please input word to query.',
      // englishWordOnly: 'Please input an valid English word.',
      notFound: (word) => `Word "${word}" Not found in dictionary.`,
    },
  },
  'zh-CN': {
    error: {
      noWord: '请输入需要查询的单词',
      // englishWordOnly: '目前仅支持英文单词查询',
      notFound: (word) => `抱歉没有找到“${word}”相关的词`,
    },
  },
};

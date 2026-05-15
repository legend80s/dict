# Intl API 深度应用：从分词到智能高亮

> 基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析如何在不引入第三方库的情况下，用原生 JavaScript 国际化和正则实现中文分词与智能高亮。

## 引言

做查词工具，有两个天然需求：

1. **例句中高亮查询词**——让用户一眼看到关键信息
2. **自然语素做流式输出**——按词而非按字逐段打印，读起来舒服

这两个需求恰好对应 JavaScript 两个原生 API 的高级应用：`Intl.Segmenter` 做自然语言分词，正则做形态学匹配。

## 一、Intl.Segmenter：零依赖的中文分词

在流式输出场景中（详见前文「终端流式输出」），我们不能按字符逐个输出——中文词组被切断后阅读体验极差。需要按**词**输出。

JavaScript 在 ECMAScript 2021 中引入了 `Intl.Segmenter`，一个原生、零依赖的文本分割器：

```js
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
const segments = [...segmenter.segment('hello world你好世界')]
```

结果：

```
[
  { segment: 'hello', index: 0, input: '...', isWordLike: true },
  { segment: ' ',     index: 5, input: '...', isWordLike: false },
  { segment: 'world', index: 6, input: '...', isWordLike: true },
  { segment: '你好', index: 11, input: '...', isWordLike: true },
  { segment: '世界', index: 13, input: '...', isWordLike: true },
]
```

`isWordLike` 能区分真正的词和空白/标点——英文单词是 true、空格是 false。

在 stream.mjs 中，我们用 Segmenter 的分词结果做流式输出：

```js
const visibleText = tokens.map(t => t.char).join('')
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
const segments = [...segmenter.segment(visibleText)]

let pos = 0
for (const seg of segments) {
  const chunk = tokens.slice(pos, pos + seg.segment.length)
  const output = chunk.map(t => t.ansi + t.char).join('')
  process.stdout.write(output)
  pos += seg.segment.length
  await new Promise(r => setTimeout(r, delayMs))
}
```

核心洞察：`Intl.Segmenter` 接受的 locale 不仅可以是 `'zh-CN'`，还支持 `'ja-JP'`、`'ko-KR'`、`'en-US'` 等数十种语言。这意味着你可以写出多语言通用的分段逻辑。

## 二、genWordVariants：形态学高亮

有了分词工具，接下来是高亮。

高亮的直观想法是用 `sentence.includes(word)` 或者字符串 replace。但英语有词形变化：

```
look → looks / looked / looking
study → studies / studied / studying
make → makes / making / made
```

用户查 `look`，例句中出现的是 `looking`。如果只匹配精确字符串，大部分例句都高亮不了。

ydd 的解法很轻巧——`genWordVariants` 函数：

```js
function genWordVariants(word) {
  return word.slice(0, word.length - 1)
       + `(?:${word.at(-1)})?`
       + `(?:ed|ing|s|es|ies)?`
}
```

原理：
- 保留词干（去掉最后一个字母）
- 最后一个字母可选出现（如 `mak?e`）
- 追加常见后缀 `ed|ing|s|es|ies`

对 `look` 生成的正则：`loo(?:k)?(?:ed|ing|s|es|ies)?`

这样 `looked`、`looking`、`looks` 全都能匹配。

对 `make` 生成：`mak(?:e)?(?:ed|ing|s|es|ies)?`

匹配 `makes`、`making`、`made` 等。


这个方法当然不完美——`ran`（run 的过去式）不会被 `run` 的变体匹配到。但对于一个 CLI 工具来说，覆盖 80% 的常见形态学变化已经足够好。如果需要全覆盖，就要引入 `natural` 这样的 NLP 库了——但那就违背了零依赖的初衷。

**"覆盖常见场景，罕见边缘用其他方式兜底"——零依赖工具的设计哲学。**

## 三、组合：智能高亮引擎

`genWordVariants` 是基础，`highlight` 函数将其组装为完整的匹配引擎：

```js
export function highlight(sentence, words) {
  const uniqWords = [...new Set(words)]  // 去重

  const isEnglish = w => /^\w+$/.test(w)

  const pattern = uniqWords
    .map(w => w.replace(/([()])/g, '\\$1'))      // 转义正则特殊字符
    .map(w => isEnglish(w)
      ? `\\b${genWordVariants(w)}\\b`             // 英文词：形态学 + 词边界
      : w                                         // 中文词：精确匹配
    )
    .join('|')                                    // 合并为多选模式

  return sentence.replace(new RegExp(pattern, 'gi'), m => bold(m))
}
```

几个设计细节：

### 词边界 `\b`

英文匹配加了 `\b` 防止部分匹配。比如查 `cat`，不让它匹配到 `catalog`。中文不加 `\b`，因为中文没有明确的词边界标记。

### 中文 vs 英文双分支

`isEnglish` 检查区分中英文——英文需要形态学变体和词边界，中文只需要精确匹配。混合文本（如 "look 的意思"）也能正确处理。

### 正则转义

`w.replace(/([()])/g, '\\$1')` 防止单词中的括号等符号破坏正则结构。安全第一。

## 四、集成到输出管线

在核心输出函数中，`highlightWord` 是 `highlight` 的实际使用者（src/core.mjs）：

```js
highlightWord = sentence => {
  // 策略 A：如果页面原生带了 <b> 标签，直接转换
  if (sentence.includes('<b>')) {
    return sentence.replaceAll(/<b>(.+?)<\/b>/g, (_, p1) => bold(p1))
  }

  // 策略 B：自定义高亮规则
  return highlight(sentence, [word, ...explanationWords])
}
```

这里有一个有意思的**双策略设计**：

- **策略 A**：有道页面本身在部分例句中内置了 `<b>` 标签。优先使用页面标记，因为这通常比算法更准确。
- **策略 B**：页面没有标记时，用自定义 `highlight` 函数。

`explanationWords` 的构建也值得一看（src/core.mjs）：

```js
const explanationWords = explanations
  .map(row => row.replace(/（.+?）|<.+?>|\[.+?\]/g, ''))  // 去掉注解
  .reduce((acc, row) => acc.concat(row.split(/[，；\s]/)), [])  // 拆分中文
  .concat(collinsChineseExplanation)                          // 混合柯林斯词
  .filter(w => !!w && w !== '的')                              // 过滤填充词
  .sort((a, b) => b.length - a.length)                         // 长词优先匹配
  .map(w => w.replaceAll('?', '').replace(/([的地])$/, '$1?')) // 可选尾字
```

关键步骤：**长词优先排序**。解决了一个经典的长短词冲突问题：

例句 "set the table" 中，如果 `explanationWords` 既有 `set` 又有 `set the`，必须先匹配 `set the` 再匹配 `set`。按长度降序排列后，正则从左到右匹配，长词优先级自然更高。

## 五、Intl API 生态一览

`Intl.Segmenter` 只是 JavaScript 国际化 API 的冰山一角。同一族系还有：

| API | 功能 | 场景 |
|-----|------|------|
| `Intl.Segmenter` | 文本分词 | 流式输出、按词高亮 |
| `Intl.Collator` | 语言感知排序 | 多语言列表排序 |
| `Intl.DateTimeFormat` | 本地化日期 | 国际化时间展示 |
| `Intl.NumberFormat` | 本地化数字 | 货币/百分比格式化 |
| `Intl.ListFormat` | 列表连接词 | 生成 "A, B, and C" |
| `Intl.PluralRules` | 复数规则 | 多语言复数形式 |

所有这些都不需要额外引入 npm 包，Node.js 14+ 原生支持。

## 六、整条链路回顾

```
用户输入单词
  ↓
有道页面返回 HTML + __NUXT__
  ↓
从 Nuxt 数据提取解释和例句
  ↓
构建 explanationWords（去噪、拆词、过滤、排序）
  ↓
highlightWord(sentence)
  ├─ 有 <b> 标签 → 转换格式
  └─ 无 <b> 标签 → highlight(sentence, words)
                       ├─ 英文 → genWordVariants + \b 边界
                       └─ 中文 → 精确匹配
  ↓
Intl.Segmenter 分词 → 流式输出
```

整个过程用到的技术：

- **Intl.Segmenter**——自然语言分词（流式输出的单元）
- **正则 + 形态学**——`genWordVariants` 生成匹配模式
- **词边界 `\b`**——防误匹配
- **长词优先排序**——解决冲突

## 总结

这个案例展示了 JavaScript 原生能力在实际场景中的威力：

1. **`Intl.Segmenter`** 让零依赖的中文分词成为可能，之前这通常需要引入 `nodejieba` 或 `natural` 库
2. **正则 + 形态学**的组合，用 5 行代码覆盖了 80% 的英语词形变化
3. **双策略高亮**（页面原生 `<b>` vs 自定义正则）展现了务实的设计思维

没有引入任何第三方 NLP 库，仅靠 JavaScript 原生 API + 精巧的正则，就完成了看起来需要自然语言处理的任务。

---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

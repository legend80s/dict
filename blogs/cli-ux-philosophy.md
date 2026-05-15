# 从"能用"到"好用"：CLI 工具的体验设计哲学

> 基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析一个零依赖查词工具在用户体验上的设计取舍。

## 引言

CLI 工具的传统叙事是"功能"——能查词、能翻译、能输出 JSON。但用户记住的从来不是功能列表，而是使用时的**感受**。

查单词时，`npx ydd silhouette` 敲下去，几百毫秒内，带颜色的释义、柯林斯例句、甚至流式逐词输出——这种感受不是偶然的。它是一个个小设计决策的累积结果。

本文从六个维度拆解 ydd 的体验设计：零配置、信息层次、智能错误处理、渐进式引导、设计系统一致性、流式输出。每个维度都不是"锦上添花"，而是从"能用"到"好用"的必经之路。

## 一、零配置，即装即用

### 一键运行的信任感

ydd 最大的体验优势藏在一个你可能注意不到的地方：**你的第一反应是用它，而不是配置它。**

```bash
npx ydd silhouette
pnpx ydd silhouette
bunx ydd silhouette
```

无论哪种方式，结果都一样——几毫秒启动，几百毫秒返回结果。没有 "Downloading 200+ packages..."，没有 "Please set API_KEY"，没有 `init` 命令。

这是因为零依赖的设计直接转化为用户体验：

| 情景 | 有依赖的 CLI | ydd |
|------|-----------|-----|
| 首次 `npx` | 下载数十 MB node_modules | 几乎瞬发 |
| `npx` 缓存过期 | 重新下载 | 不需要缓存 |
| CI 环境无网络 | 跑不了 | 跑不了（都需要网络查词）|
| `--help` 看参数 | 几百毫秒加载 | 即刻显示 |

零依赖在健壮性层面的意义前一篇文章已有详述，但它在体验层面的价值同样直接——**用户不需要等待**。

### 无配置就是最好的配置

ydd 没有配置文件、没有环境变量要求、没有 API Key 申请。所有行为通过命令行参数控制：

```
-e           开启例句
-c=2|all     柯林斯条目数
-s           语音朗读
--stream     逐词流式输出
```

每个参数都是"增强"而非"必需"。默认输出已经是完整可用的，参数只在你想探索更多时才有意义。这与很多 CLI 的设计相反——它们默认输出简短，需要加 `-v` / `--verbose` / `--full` 才看到完整信息。

**ydd 的哲学：默认给最多的信息，让参数做减法而非加法。**

## 二、信息层次与排版系统

终端输出的困境在于：你只有 24 位颜色和等宽字体，却要展示多层级信息——词性、释义、例句来源、例句翻译、柯林斯条目编号。

### 颜色编码规则

ydd 定义了一套简单一致的颜色方案：

```
释义条目         → 🟢 + 白色文字      → explanations
柯林斯条目编号    → 绿色数字           → colorIndex(idx)
柯林斯英文例句    → 红色文字           → red()
柯林斯双语例句    → 默认色             → highlightWord() + white()
例句来源          → 灰色斜体           → italic(via)
查询词高亮       → 青色 + 粗体 + 下划线 → bold(word)
```

这套规则的底层实现在 `lite-lodash.mjs` 中：

```js
const BOLD = '\x1b[1m'
const UNDERLINED = '\x1b[4m'
const ITALIC = '\x1b[3m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const WHITE = '\x1b[97m'
const CYAN = '\x1b[36m'
```

没有 chalk、没有 kleur，就是模板字符串拼接 ANSI 码。每增加一种颜色就是增加一行常量。简单的实现反而增强了可维护性——任何人都能在 30 秒内理解颜色系统。

### 终端里的 Markdown 排版

ydd 用 `h1` / `h2` 函数在终端中模拟 Markdown 章节标题：

```js
export const headerFactory = level => (...text) =>
  bold(`${'#'.repeat(level)} ${text.join(' ')}`)

export const h1 = headerFactory(1)
export const h2 = headerFactory(2)
```

输出效果：

```
## Explanations 💡
🟢  n. （浅色背景衬托出的）暗色轮廓；剪影

## 柯林斯英汉双解大词典 [#2] 📖
1. ADJ A **silhouette** is the solid dark shape...

## Examples ⭐
1. The mountains stood out in **silhouette**.
```

**\#\# 标题 + 图标 + 统一缩进**，在等宽终端里形成清晰的视觉分区。用户扫一眼就能区分"这是例句区域"还是"这是词典释义区域"。

### 耗时的透明化

每个查询结果末尾显示耗时：

```
*查询单词耗时 🕑: 322.812ms*
```

这不是"炫技"。**显示耗时是一种信任机制**——它告诉用户"我没有卡死，我在工作，这是实际用时"。用户等 500ms 觉得慢，但如果显示 500ms，他知道这是网络请求的正常时间，就不会焦虑。

## 三、智能错误处理：不给用户看堆栈

### 错误的层次感

CLI 工具最容易犯的错误是：出问题时直接抛堆栈。

```
TypeError: Cannot read properties of undefined (reading 'basic')
    at byJSON (src/core.mjs:378:22)
    ...
```

用户不关心你的代码在哪里出错，他只想得到帮助。ydd 的错误处理分四个层次：

**第一层：无参数**

```
stderr: 请输入需要查询的单词
stdout: Usage:
        $ npx ydd <word>
        Options:
          -e, --example    Show examples
          ...
```

无参数时在 stderr 输出错误提示，stdout 输出帮助。两路输出配合，用户看到错误也看到解法。

**第二层：查不到词**

```
❌ 抱歉没有找到"dogfood"相关的词
> https://dict.youdao.com/result?word=dogfood&lang=en
```

notFound 错误显示查词链接（用户自己验证），不显示帮助（因为用户知道怎么用，只是词没查到）。

**第三层：其他错误**

其他错误场景显示帮助信息。用户可能在参数格式上出了问题，帮助比错误消息更有用。

**第四层：verbose 模式**

```bash
npx ydd wonderful --verbose
```

只有加 `--verbose` 时，内部调试信息（如 "Word: wonderful"、"Fallback to HTML"、"nuxt FAILED"）才会打印。日常用户永远看不到这些东西。

这种分层的实现：

```js
function exitWithErrorMsg(word, { errorMsg, error, errorType }) {
  if (verbose) {
    error && console.error(error)       // 开发者：看堆栈
  } else {
    console.error(`\n> ❌ ${errorMsg}`) // 用户：看友好提示
  }

  if (errorType === 'notFound') {
    console.info(`> ${dictionary.makeHTMLUrl(word)}`)  // 查词链接
  } else {
    help({ showVersion: false, showDescription: false }) // 帮助
  }
}
```

### 拼写建议

当输入的词查不到结果时，yd 会尝试从 YouDao 的建议接口获取拼写纠正：

```js
async function fetchSuggestions(word) {
  const url = `https://dsuggest.ydstatic.com/suggest.s?query=${word}&...`
  const [str] = await fetchIt(url, { type: 'text' })
  // 从 suggest 接口的 HTML 响应中提取首个建议词
  const first = decodeURIComponent(
    str.match(/form.updateCall\((.+?)\)/)?.[1] || ''
  ).match(/>([^><]+?)<\/td>/)?.[1] || ''
  return first ? [first] : []
}
```

如果用户输入的是 `silhouette` 时少打了字母 `s`，输出提示：

```
你要找的是不是: silhouette
```

这不是新鲜技术——搜索引擎做了几十年了。但在 CLI 中实现它，而且是零依赖、纯原生 fetch 实现，让用户感觉"这个工具挺聪明"。

### i18n 自动适配

错误消息根据用户系统语言自动切换中英文：

```js
const i18n = {
  'en-US': {
    error: {
      noWord: 'Please input word to query.',
      notFound: word => `Word "${word}" Not found in dictionary.`,
    },
  },
  'zh-CN': {
    error: {
      noWord: '请输入需要查询的单词',
      notFound: word => `抱歉没有找到“${word}”相关的词`,
    },
  },
}

const text = i18n[getLanguage()]

function getLanguage() {
  return Intl.DateTimeFormat().resolvedOptions().locale || 'zh-CN'
}
```

没有 i18n 库、没有 JSON 资源文件、没有构建时提取——就是用 `Intl` API 读一下系统语言，然后返回对应的字符串。这是"零依赖"哲学的又一体现：在够用的情况下，原生 API 已经能解决很多问题了。

## 四、渐进式功能引导：Feature Fatigue 模式

### 问题

你的 CLI 有一些进阶用法——`-e` 看例句、`-s` 听发音、`-c=all` 展开柯林斯。你怎么让用户知道它们？

最常见的做法：

1. **README 里写** — 但用户不看 README
2. **`--help` 里列出来** — 但用户不是每次都用 `--help`
3. **每次运行时尾部提示** — 第一次觉得贴心，第十次觉得烦

### 解法：每个提示最多出现 2 次

ydd 的 Fatigue 模式（`src/utils/fatigue.mjs`）核心逻辑不到 50 行：

```js
const limit = 2

export class Fatigue {
  hit(key) {
    const config = require(rcFilepath)
    return config[key] >= limit
  }

  setTired(key) {
    this.increment(key, limit)
  }

  increment(key, count) {
    const config = require(rcFilepath)
    const cnt = count ?? (config[key] ?? 0) + 1
    config[key] = cnt
    writeFullConfig(config)
  }
}
```

**规则**：
- 每个提示（`'example'`、`'speak'`）有一个唯一 key
- 出现一次计数 +1
- 计数 >= 2 后永不再提示
- 用户主动使用该功能 → `setTired` 直接拉到阈值

### 触发逻辑

在 `core.mjs` 中，输出构建完成后，Fatigue 控制提示是否追加：

```js
function buildFeaturesString(word, suggestedWord) {
  const fatigue = new Fatigue(verbose)

  if (!exampleFlagSet && !fatigue.hit('example')) {
    output += white(`Try \`npx ydd ${suggestedWord || word} ${bold('-e -c=2|all')}\``) + '\n'
    fatigue.increment('example')
  } else if (!speakFlagSet && !fatigue.hit('speak')) {
    output += white(`Try \`npx ydd ${suggestedWord || word} ${bold('-s')}\``) + '\n'
    fatigue.increment('speak')
  }
}
```

注意这里的**优先级**：先提示 `-e`（例句）后提示 `-s`（朗读）。因为查词用户最自然的下一步是看例句，不是听发音。每次都只显示一个提示，避免输出过载。

当用户某次主动加了 `-e`：

```js
if (exampleFlagSet) {
  fatigue.setTired('example')  // 直接标记为"已疲倦"
}
```

之后系统就会转向提示 `-s`（如果还没被标记过）。这个"用完一个功能再提示下一个"的设计非常克制。

### 持久化

计数存储在 `~/ydd-data.js`：

```json
{ "example": 1, "speak": 0 }
```

这是一个普通的 JSON 文件，用户可以直接编辑。如果用户说"我知道这些功能了"，他可以手动把计数改成 99。

这个设计的精髓在于：**它把"引导"和"骚扰"之间的边界显式化为一个数字。** 2 次是经验值——1 次可能没注意到，2 次足够记住。再多就是噪音。

更详细的实现解析见：[《Feature Fatigue：如何优雅地引导用户发现 CLI 的高级功能》](./feature-fatigue.md)

## 五、排版一致性：可维护的设计系统

### 一个变量控制全局图标

ydd 所有列表项图标由一个配置值控制：

```js
export const config = {
  listItemIcon: '🟢',
}
```

每一行释义输出都使用同一变量：

```js
output += explanations.map(exp => config.listItemIcon + ' ' + white(exp)).join('\n')
```

想换图标？改一行配置即可。🟢 → 📖 → ✅，全输出自动跟随。这虽然是极简的例子，但体现了设计一致性：**所有列表项共享同一样式，不出现不同层级使用不同图标的情况。**

### 可预测的输出模板

每种输出模式有固定模板：

```
## Explanations 💡
🟢  ...第一行释义
🟢  ...第二行释义

## 柯林斯英汉双解大词典 [#N] 📖
（柯林斯内容...）

## Examples ⭐
（例句内容...）

（功能提示...）

*See more at https://dict.youdao.com/...*
```

用户使用几次后就能形成心理模型："我知道例句在哪里，我知道柯林斯在哪里。"这种可预测性降低了每次阅读的认知开销。

尤其是在不开启 `--example` 时，Explanation 标题不会显示，释义直接打印。这也是设计决策——只有 1-3 行释义时不需要标题，标题占用纵向空间。

### Collins 智能提示

柯林斯词典可能包含多个条目，默认只显示第一个：

```
## 柯林斯英汉双解大词典 [#2] 📖. Add `-c=2` or `-c=all` to show more examples.
```

当 `englishExplanationTotalCount > 1` 且 `parsed.collins` 为默认值时，自动追加提示。用户看到这个提示就知道了有更多内容可展开。

如果用户已经指定 `-c=a`，提示不出现。这一切都在 `buildOutputString` 中由几行代码完成。

## 六、流式输出：小细节创造品牌感

### 为什么流式？

查词结果是即时返回的，为什么要加延迟逐词输出？这不是反效率吗？

从效率角度确实如此。但从**感受**角度：

- 全部输出"啪"一下展示 → 用户扫读，没有焦点
- 逐词流出 → 阅读节奏被引导，眼睛跟随输出位置

这不是效率问题，是**信息摄入方式**的问题。逐词输出引导用户按自然语素逐词阅读，而不是在满屏文字中寻找关键词。**15ms 延迟的总时间不超过 1 秒，但阅读体验的差异是显著的。**

### 技术挑战：ANSI 颜色码

直接对带颜色的字符串做 `split('')` 逐字符输出会切断 ANSI 码。ydd 的 `getVisibleCharTokens` 函数解决了这个问题：

```js
function getVisibleCharTokens(styled) {
  const tokens = []
  let i = 0
  let currentAnsi = ''

  while (i < styled.length) {
    if (styled[i] === '\x1b') {
      const end = styled.indexOf('m', i)
      if (end === -1) break
      currentAnsi += styled.slice(i, end + 1)
      i = end + 1
    } else {
      tokens.push({ char: styled[i], ansi: currentAnsi })
      currentAnsi = ''
      i++
    }
  }

  return { tokens, trailingAnsi: currentAnsi }
}
```

它把带 ANSI 码的字符串解析为 `{ char, ansi }` 的 tokens 数组，每个可见字符都"挂载"了它前面应该发送的颜色码。然后 `Intl.Segmenter` 做中文分词，按词输出：

```js
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
const segments = [...segmenter.segment(visibleText)]

for (const seg of segments) {
  const chunk = tokens.slice(pos, pos + seg.segment.length)
  const output = chunk.map(t => t.ansi + t.char).join('')
  process.stdout.write(output)
  pos += seg.segment.length
  await new Promise(r => setTimeout(r, 15))
}
```

一个"很简单"的体验效果，背后是 ANSI 剥离 + Intl 分词 + 定时器三个技术点的组合。

### 可降级的流式

流式是可选的 (`--no-stream` / `YDD_NO_STREAM=1`)，测试中自动关闭：

```js
function disableStream() {
  before(() => { process.env.YDD_NO_STREAM = '1' })
  after(() => { delete process.env.YDD_NO_STREAM })
}
```

这让 CI 测试不受到 15ms 延迟的影响。**流式是体验增强，不是功能依赖。**

更详细的技术实现解析见：[《终端流式输出的优雅实现：从 ANSI 逃逸到 Intl.Segmenter》](./output-token-by-token-in-terminal-using-node-js.md)

## 总结

读到这里，你会发现 ydd 的"好体验"不是由某个大功能构成的。它是由一系列小细节累积的：

| 体验点 | 代码量 | 技术难度 | 用户感知 |
|--------|--------|---------|---------|
| 零配置 | 0 行 | 无 | 高（第一印象） |
| 颜色编码 | 7 行常量 | 低 | 高（每次使用） |
| 错误分层 | ~20 行 | 低 | 中（出问题时） |
| 疲劳度引导 | ~50 行 | 低 | 中（首次使用） |
| Collins 提示 | ~5 行 | 极低 | 中（特定场景） |
| 流式输出 | ~70 行 | 中 | 高（每次使用） |
| 拼写建议 | ~20 行 | 中 | 低（罕见场景） |

**大部分体验优化不需要复杂的技术，只需要意识到"用户在使用时是什么感受"。**

CLI 领域缺少设计系统。Graphical UI 有 Material Design、有 HIG，但终端界面设计的经验和原则很少被讨论。ydd 的尝试或许能给其他 CLI 开发者一些启发——你的工具不需要大改，可能只是加一个耗时的显示、换一个颜色、在第一次用时给一句友好的提示，就能从"能用"变成"好用"。

**相关文章：**

- [Feature Fatigue：如何优雅地引导用户发现 CLI 的高级功能](./feature-fatigue.md)
- [终端流式输出的优雅实现：从 ANSI 逃逸到 Intl.Segmenter](./output-token-by-token-in-terminal-using-node-js.md)
- [Intl API 深度应用：从分词到智能高亮](./intl-api-segmenter-highlight.md)

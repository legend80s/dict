# 零依赖 CLI 实战：如何用纯 Node.js 构建生产级工具

> 基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析如何在不引入任何第三方包的前提下，用 Node.js 原生 API 打造一个完整的 CLI 工具。

## 引言

2025 年建一个 Node.js CLI，默认动作是什么？

```bash
npm install commander chalk axios cheerio
```

几十 MB 的 `node_modules` 下载下来，只为了解析参数、给文字上色、发 HTTP 请求、解析 HTML。

但你**其实可以不用这些**。

[ydd](https://github.com/legend80s/dict) 是一个查词 CLI，生产依赖数为 **0**。它用纯原生 Node.js API 完成了所有工作：

| 需求 | 常规选择 | ydd 的方案 | 原生 API |
|------|---------|-----------|---------|
| 参数解析 | commander / yargs | `node:util` parseArgs | v18.3+ |
| HTTP 请求 | axios / got | 原生 fetch + https 回退 | v18+ |
| ANSI 着色 | chalk | 模板字符串拼接 `\x1b` 码 | 永远可用 |
| HTML 解析 | cheerio | 正则 + `node:vm` 沙箱 | 永远可用 |
| 测试 | Jest / Mocha | `node:test` + `node:assert` | v20+ |

本文将逐一拆解每个模块的实现。

## 一、参数解析：node:util parseArgs

在 commander 之前，Node 社区用 `process.argv.slice(2)` 手写参数解析，然后正则匹配 `--flag`。粗糙、重复、容易出 bug。

Node.js v18.3 引入了 `parseArgs`，一个内建、稳定、符合 POSIX 惯例的参数解析器。

```js
import { parseArgs } from 'node:util'

const { values, positionals } = parseArgs({
  options: {
    help:     { type: 'boolean', short: 'h' },
    version:  { type: 'boolean', short: 'v' },
    verbose:  { type: 'boolean' },
    speak:    { type: 'boolean', short: 's' },
    example:  { type: 'boolean', short: 'e' },
    collins:  { type: 'string',  short: 'c' },
    stream:   { type: 'boolean' },
  },
  allowPositionals: true,     // 允许无前缀的参数（如单词）
  strict: true,               // 未知参数抛异常
})
```

**能力覆盖：**

- 短选项 `-h` / `-v` / `-e`
- 长选项 `--help` / `--verbose` / `--collins 3`
- 等号语法 `--collins=all` / `-c=a`
- 布尔值 `--stream` / `--no-stream`
- 位置参数（`positionals[0]` 就是单词）
- 未知参数自动报错

**为什么不建议手动解析？** 边界情况太多了：`--foo=bar`、`-abc`（拆成 `-a -b -c`）、`--no-foo`、`--` 终止符。`parseArgs` 一次性处理了所有这些。

**ydd 扩展：**还有一个**优先级链**来解析最终的选项值：

```js
function resolveStreamOption(stream, env) {
  if (stream !== undefined) return !!stream      // CLI 参数最高优
  if (env.YDD_NO_STREAM === '1') return false    // 环境变量次之
  return true                                     // 默认开启
}
```

## 二、HTTP 请求：从 fetch 到 https.request 双保险

Node.js v18 开始内置了 `fetch`（基于 undici），不再需要 `axios` 或 `got`。

但 ydd 做得更进一步——它实现了**自动回退**：

```js
// src/utils/fetch.mjs
import https from 'node:https'

export async function fetchIt(url, options = {}) {
  const parse = options.type === 'json'
    ? resp => resp.json()
    : resp => resp.text()

  // 策略 A：原生 fetch
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 ...',
      },
      signal: AbortSignal.timeout(10000),
    })
    return [await parse(resp), 'fetch']
  } catch (error) {
    // fetch 失败 → 降级
  }

  // 策略 B：https.request（兼容 Node.js <18 或特殊网络环境）
  return new Promise((resolve, reject) => {
    https.get(url, { headers }, resp => {
      let data = ''
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => resolve([parse(data), 'https']))
    })
  })
}
```

**为什么需要双策略？** 因为 `fetch` 在一些企业网络环境或特定 Node.js 版本下不可用。`https.request` 是更低层、更可靠的协议接口。双路回退让工具在各种环境中都能工作。

发出去的请求头：

```js
'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...'
```

有道词典可能会拦截非浏览器的请求，所以伪装成 Chrome 浏览器的 User-Agent。

## 三、HTML 解析：正则 + node:vm 沙箱

这是 ydd 最核心也最有趣的部分——从有道词典页面提取结构化数据。

常规做法是引入 `cheerio`（一个轻量级 jQuery 核心实现）做 DOM 选择和提取。但 ydd 发现了更巧妙的方式。

### 发现 __NUXT__

有道词典使用 Nuxt.js 进行服务端渲染，页面 HTML 中的 `<script>` 标签里嵌着完整的 `__NUXT__` 数据：

```html
<script>window.__NUXT__={"data":[{"wordData":{...}}]}</script>
```

问题是如何提取这段数据？

**JSON.parse？** 不行，Nuxt 序列化的内容可能包含 `undefined` 等 JSON 不支持的格式。

**正则 + eval？** 有原型链污染风险。

最终方案是用 `node:vm` 提供的沙箱上下文来安全执行：

```js
import vm from 'node:vm'

function evaluateNuxtInScriptTagUseVM(html) {
  // 1. 正则提取 <script> 中包含 __NUXT__ 的内容
  const scriptContent = extractNuxtScript(html)

  // 2. 创建空沙箱（无原型链）
  const sandbox = Object.create(null)
  sandbox.window = Object.create(null)
  sandbox.window.__NUXT__ = undefined
  vm.createContext(sandbox)

  // 3. 在沙箱中执行脚本
  vm.runInContext(scriptContent, sandbox)

  return sandbox.window.__NUXT__
}
```

### 降级方案：正则解析 HTML

当 `__NUXT__` 不可用时（页面结构变化），回退到正则提取 `div.trans-container > ul > li`：

```js
const matches = html.match(/<div class="trans-container">\s*<ul>([\s\S]+?)<\/ul>/s)
const lis = matches ? matches[1].trim() : ''
const explanations = lis
  .replace(/\s{2,}/g, ' ')
  .split('<li>')
  .map(x => x.replace('</li>', '').trim())
  .filter(Boolean)
```

没有 cheerio，但一个正则在 95% 的情况下足够了。

## 四、ANSI 着色：纯字符串拼接

这是最简单的一环。ANSI 转义序列就是一串特殊字符，终端识别它们来改变颜色：

```js
const BOLD  = '\x1b[1m'
const RED   = '\x1b[31m'
const GREEN = '\x1b[32m'
const RESET = '\x1b[0m'

const red   = text => `${RED}${text}${RESET}`
const green = text => `${GREEN}${text}${RESET}`
const bold  = text => `${CYAN}${BOLD}${text}${RESET}`
```

工作原理：`\x1b`（ESC）告诉终端「后面的序列是控制指令」，`[1m` 是「设置加粗」，`[0m` 是「重置」。

`chalk` 本质上就是这些字符串的封装。直接拼接可以获得完全一样的效果，而依赖体积从 chalk 的 ~8KB 变成 **0**。

ydd 还在此基础上做了两个扩展：

**高亮函数**——在句子中标记多个目标词：

```js
export function highlight(sentence, words) {
  const pattern = uniqWords
    .map(w => `\\b${genWordVariants(w)}\\b`)
    .join('|')

  return sentence.replace(new RegExp(pattern, 'gi'), m => bold(m))
}
```

**流式输出**——逐词输出并保持 ANSI 码完整：

```js
function getVisibleCharTokens(styled) {
  const tokens = []
  let currentAnsi = ''

  for (let i = 0; i < styled.length; i++) {
    if (styled[i] === '\x1b') {
      const end = styled.indexOf('m', i)
      currentAnsi += styled.slice(i, end + 1)
      i = end
    } else {
      tokens.push({ char: styled[i], ansi: currentAnsi })
      currentAnsi = ''
    }
  }

  return { tokens, trailingAnsi: currentAnsi }
}
```

## 五、测试：node:test + node:assert

测试是零依赖的最后一块拼图。Node.js v20 起，`node:test` 成为稳定模块，`node:assert` 一直可用。

**运行测试：**

```json
{
  "scripts": {
    "test": "node --test",
    "cov": "node --test --experimental-test-coverage"
  }
}
```

**编写测试（不需要任何 import 第三方库）：**

```js
import assert from 'node:assert'
import test from 'node:test'

test('should show help', () => {
  const stdout = execSync('node ./bin.mjs -v').toString()
  assert.match(stdout, /ydd@\d/)
})
```

**随机冒烟测试——从 789 词池中抽样验证：**

```js
test('should not throw error on random word', () => {
  const randomWords = pickRandomWords(5)
  for (const word of randomWords) {
    assert.doesNotThrow(() => {
      execSync(`node ./bin.mjs ${word} -e`)
    })
  }
})
```

789 个单词来自一篇英文技术文章的文章，用 `Intl.Segmenter` 分词生成。每次发布前随机抽 5 个做全链路验证。

## 六、其他零依赖设计

### 性能测量

`console.time` / `console.timeEnd` 原生支持：

```js
export function timeit(label, asyncFunc) {
  return (...args) => {
    console.time(label)
    const result = asyncFunc(...args)
    if (result instanceof Promise) {
      return result.finally(() => console.timeEnd(label))
    }
    console.timeEnd(label)
    return result
  }
}
```

### 配置持久化

存在 `~/ydd-data.js`，用 `require` 加载（JS 文件直接可 `require`，免 `JSON.parse`）：

```js
fs.writeFileSync(rcFilepath,
  `module.exports = ${JSON.stringify(config, null, 2)}`)
```

### 类型检查不依赖 TypeScript

TypeScript 太笨重，需要引入额外的编译过程。

通过 `// @ts-check` + `typings.ts` + `tsc --noEmit` 实现，不引入构建步骤，却一样能做到严格类型检查：

```json
{
  "compilerOptions": {
    "checkJs": true,
    "strict": true
  }
}
```

## 为什么零依赖？

1. **安装快**——`npm install` 瞬间完成，没有几十 MB 的 `node_modules`
2. **体积小**——`npx ydd` 的下载时间可以忽略不计
3. **兼容性好**——不受第三方 API 变更影响，自己的代码自己控制
4. **省心**——没有 Dependabot PR、没有安全漏洞告警、没有 semver 范围纠结

零依赖不是目的，而是手段。当原生 API 已经足够时，引入外部依赖是**负债**而非**资产**。

## 总结

ydd 证明了纯原生 Node.js API 可以构建一个完整的生产级 CLI：

| 原生 API | 替换了什么？ |
|---------|------------|
| `node:util` parseArgs | commander / yargs |
| `fetch` + `https` | axios / got |
| `node:vm` + 正则 | cheerio / jsdom |
| `\x1b` 转义序列 | chalk / kleur |
| `node:test` + `node:assert` | Jest / Mocha |

写一个 CLI 不一定要 `npm install` 三四个包。打开 Node.js 文档，看看内置 API——你可能不需要那些依赖。

---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

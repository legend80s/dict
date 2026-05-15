# 零依赖 + 双路降级：打造一个健壮的生产级 CLI 工具

> 基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析如何用原生 Node.js API 和多重降级策略构建一个能在恶劣环境下稳定工作的命令行工具。

## 引言

评价一个 CLI 工具，用户直观感受是"快不快"、"美不美观"。但作为开发者，我们更关心另一个问题：**用户环境下出问题了，它能自救吗？**

你无法控制用户的运行环境。Node.js 版本从 18 到 24，操作系统横跨 Windows/macOS/Linux，网络可能有代理、有防火墙、有 DNS 劫持。甚至 `fetch` 都可能不存在。

ydd 是一个生产级查词 CLI，零生产依赖。它的健壮性不来自某个"高可用框架"，而来自四个层面的设计：

1. **全链路降级架构** — 每步操作都有 Plan B
2. **零依赖策略** — 减少不可控因素，就是增加健壮性
3. **`node:vm` 沙箱** — 比传统 HTML 解析更抗页面结构变化
4. **多层测试门禁** — fuzz + 端到端 + 门禁卡住发布

每个层面单独看都不复杂，但组合起来，就是一个能在真实互联网环境下稳定运行的工具。

## 一、架构设计：全链路降级与路由

### 入口分流

用户输入一个词，首先面临的选择：这是单词还是句子？

```js
// bin.mjs
const threshold = 3
const isEnglishSentence = /\w+/.test(word) && word.split(' ').length > threshold

if (isEnglishSentence && config.baiduTranslate.enabled) {
  await translate(word) // Baidu 翻译
} else {
  await query(word)     // YouDao 词典
}
```

3 个 token 是经验阈值——"wonderful girl" 查词典，"how are you doing today" 走翻译。

这层分流本身就是健壮性设计：词典引擎擅长单词，翻译引擎擅长句子，各司其职。如果一个挂了，用户至少还有另一个路径可用。

### 词典双路降级

词典查询是核心路径，它的降级设计体现在 `dictionary.mjs` 这个 dispatcher 中：

```js
let lookupMethod = 'nuxt'

let result = { errorMsg: 'NO RESULT' }
let hasError = false

try {
  lookupMethod = 'nuxt'
  result = await dictionaryByNuxt.lookup(args)
} catch (error) {
  hasError = true
}

if (hasError || 'errorMsg' in result) {
  lookupMethod = 'html'
  result = await dictionaryByHTML.lookup(args)
}
```

逻辑极其直白：

1. 先跑主路（Nuxt JSON 提取）
2. 抛异常或返回错误 → 切回退路（正则 HTML 解析）
3. 用 `lookupMethod` 变量追踪胜出方，后续 URL 生成等操作自动对齐

不需要 State Machine、不需要 Circuit Breaker——对于两个数据源的场景，一个 if 就够了。健壮性不意味着复杂的框架。

### 网络层降级

HTTP 请求本身也有回退：

```js
// src/utils/fetch.mjs
async function fetchIt(url, options) {
  try {
    return await fetch(url, options)     // 原生 fetch
  } catch {
    return await httpsRequest(url, options) // https.request 回退
  }
}
```

为什么需要回退？因为 Node.js 的 `fetch` 在 v18 是实验特性，有些用户的容器环境可能 polyfill 不全。`https.request` 从 Node 0.x 就存在，永远不会消失。

### 降级哲学

总结这套架构的理念：**每个外部依赖点都是故障点，每个故障点都需要本地 fallback。**

```
用户输入 → 路由分流 → 词典/翻译
                        ├── 主路: Nuxt JSON (node:vm)
                        │      ├── fetch → https.request 回退
                        │      └── vm.run → 语法错误捕获
                        └── 回退: 正则 HTML
                               ├── fetch → https.request 回退
                               └── 正则匹配 → null 安全处理
```

每一层 fallback 都互相独立，不会因为上层失败导致整条链路不可用。

## 二、零依赖：一种健壮性策略

### 这不是关于"轻量"

很多人提到零依赖，第一反应是"包体积小"、"安装快"。这没错，但健壮性的角度更深刻。

**零依赖 = 零个不受你控制的运行时行为。**

### 无供应链攻击面

CLI 工具依赖几十上百个包是常态。2022 年的 `colors` faker 事件（1.4.1 版本注入无限循环）、`event-stream` 恶意注入（盗取比特币钱包）——这些不是罕见的黑天鹅，而是 npm 生态的结构性风险。

ydd 零依赖意味着：

- 没有 `postinstall` 脚本可能被篡改
- 没有祖先依赖链上的包可能被投毒
- `npm install ydd` 不需要下载 200+ 个文件

这不是偏执——对于运行在用户终端上的工具，你的 `node_modules` 就是用户的信任边界。

### 无上游 breakage

第三方的 breakage 有很多形式：

- **Major 版本破坏性变更** — commander 5→6 改 API、chalk 5 变 ESM-only
- **废弃警告** — request 库被 deprecate、node-fetch 3 要求 ESM
- **间接依赖的 breakage** — 你依赖 A，A 依赖 B，B 发了 breaking change

ydd 的选择：能用原生 API 解决的，绝不引入第三方。

| 需求 | 常规选择 | ydd 方案 | 原生 API 稳定性 |
|------|---------|---------|----------------|
| 参数解析 | commander / yargs | `node:util` parseArgs | 随 Node 发版，向后兼容 |
| HTTP 请求 | axios / got | 原生 fetch + https 回退 | v18 稳定，https.request 永远可用 |
| ANSI 着色 | chalk / kleur | 模板字符串拼接 `\x1b` 码 | 终端标准，永不改变 |
| HTML 解析 | cheerio / jsdom | node:vm 沙箱 + 正则 | 核心模块，永远可用 |
| 测试框架 | Jest / Vitest | node:test + node:assert | v20 稳定 |

这些原生 API 的契约是 **随 Node.js 版本背书** 的——Node.js 不删核心模块，你的 CLI 就不会因为某个依赖作者删库而断掉。

### 无版本冲突地狱

"但我们可以锁版本啊。" —— 在一个小项目里可以。但作为发布到 npm 的工具，你的依赖会与用户的依赖产生交互：

```
用户项目: express@4 → body-parser@1 → qs@6
你的 CLI: 依赖 qs@5 → ERESOLVE 无法解析
```

解决方案？`--legacy-peer-deps`、`--force`，或者用户放弃使用你的工具。

零依赖把这个层面的问题直接消灭了。

### 降级路径可控

这是最容易被忽视的一点。使用 `fetch` 包时，如果它挂了，你无法无缝替换成 `https.request`——因为你不拥有 `fetch` 函数的实现。

但 ydd 的降级逻辑：

```js
if (typeof fetch === 'function') {
  return fetch(url)
}
return new Promise((resolve, reject) => {
  const req = https.request(url, res => { /* ... */ })
})
```

这个 fallback 是可写、可测试、可审计的。不出 bug 最好；出 bug，你有能力现场修。

### 最小故障面

零依赖带来一个数学事实：**你的代码 = 全部故障面。** 不需要在几十个间接依赖中二分查找 bug、不需要等待上游发 patch、不需要 fork + override resolution。

这不是反对使用依赖。有些场景（加密、协议实现、复杂数据结构）用成熟库更健壮。但 CLI 的基础设施（参数解析、HTTP、着色、解析）是 Node.js 已经原生提供的能力。额外引入依赖，并没有带来健壮性的边际收益。

## 三、node:vm 沙箱：主路策略的技术细节

### 问题

要从 YouDao 网页获取结构化数据，最直接的方法是请求页面然后用 cheerio 解析 DOM。但这要求我们引入 cheerio——以及它背后的 `htmlparser2`、`domutils`、`css-select` 等一串依赖链。

有没有不用 cheerio 也能从 HTML 中提取数据的方法？

### 发现 __NUXT__

Nuxt.js SSR 渲染页面时，会在 HTML 中嵌入一段 `<script>`：

```html
<script>window.__NUXT__={"data":[{"wordData":{...}}]}</script>
```

这相当于页面把完整的结构化数据直接放在了 HTML 里——渲染用，但也是数据提取的金矿。

### 方案 A：正则

最简单的思路：正则提取 `<script>` 标签内容，然后 `JSON.parse`。

问题是：`__NUXT__` 的内容不是 JSON——它是 JavaScript 对象字面量。可能包含函数调用、`undefined`、模板字符串等非法 JSON 内容。`JSON.parse` 会直接抛错。

### 方案 B：node:vm 沙箱（主路策略）

`node:vm` 可以创建一个独立的 V8 上下文，执行任意 JavaScript 代码并返回值。这正是我们需要的——既然它是一个合法的 JS 表达式，那就用 JS 引擎去执行它。

```js
// lookup-by-nuxt-in-html.mjs（简化）
import vm from 'node:vm'

const SCRIPT_TEMPLATE = regex => {
  const script = new vm.Script(`
    const window = this
    ${regex.exec(html)?.[1] || ''}
    JSON.stringify(window.__NUXT__)
  `)
  return script
}

export const dictionaryByNuxt = {
  async lookup(word) {
    const html = await fetchIt(url)
    const script = SCRIPT_TEMPLATE(NUXT_REGEX)
    const result = script.runInNewContext({})
    return JSON.parse(result)
  }
}
```

**安全性**：`runInNewContext` 创建的是一个干净的 V8 上下文，没有 `require`、没有 `process`、没有 `fs`。即使页面脚本被恶意篡改，也无法访问宿主系统的任何资源。

### 为什么比 cheerio 更健壮？

这听起来反直觉——cheerio 是专门做 HTML 解析的，一个 `vm` 沙箱怎么可能更健壮？

答案是：**Nuxt 页面结构可能变，但 `__NUXT__` 的数据格式极少变。**

- 页面 HTML 结构变化（CSS class 改名、DOM 层级调整）→ cheerio 选择器失效
- Nuxt 版本升级 → `__NUXT__` 的 key 可能变 → vm 也得跟着改

但两者的变更频率不是一个量级。YouDao 改版页面 UI 可能每季度一次，而 Nuxt 数据格式变更可能每年都不到一次。

所以 ydd 的默认策略是"先试 `__NUXT__`，失败了再走正则"。正则虽然更脆弱，但作为回退路径，它的覆盖范围更广——任何 HTML 页面都可以尝试正则解析。

### 双路互补

| 策略 | 优点 | 弱点 |
|------|------|------|
| Nuxt + vm | 数据结构稳定，提取精确，不受 DOM 变化影响 | 需要页面有 `__NUXT__` |
| 正则 HTML | 通用，任何 HTML 页面都能解析 | 依赖 DOM 结构，易被前端改动破坏 |

两条路互为后备，一条挂了就切另一条。这是整篇文章"降级哲学"的最具体体现。

更详细的技术实现解析见：[《node:vm 沙箱提取 __NUXT__ 数据》](./nuxt-vm-sandbox.md)

## 四、测试策略：fuzz + 门禁 + 多级验证

### 三层测试体系

```
单元测试           → 工具函数逻辑正确性
端到端测试（断言）  → CLI 完整流程，包括 ANSI 输出
随机全链路测试     → 789 词池随机抽检，覆盖真实场景
```

所有测试只用 Node.js 内置模块——`node:test` + `node:assert` + `node:child_process`。零测试依赖。

### 单元测试

工具函数级别的测试，例如 arg-parser 的流式开关逻辑：

```js
test('default stream is true', () => {
  assert.strictEqual(parseCLIArgs(['hello'], {}).stream, true)
})

test('YDD_NO_STREAM=1 disables streaming', () => {
  assert.strictEqual(parseCLIArgs(['hello'], { YDD_NO_STREAM: '1' }).stream, false)
})

test('--stream overrides YDD_NO_STREAM', () => {
  assert.strictEqual(parseCLIArgs(['hello', '--stream'], { YDD_NO_STREAM: '1' }).stream, true)
})
```

优先级顺序也在测试中明确了：**命令行参数 > 环境变量 > 默认值**。这是隐式的设计文档。

### 端到端测试

调用真实的 CLI 进程，断言 stdout/stderr：

```js
test('Should show explanations and examples and collins', () => {
  const stdout = execSync(`node ./bin.mjs wonderful --example --collins 1`).toString('utf-8')

  assert.match(stdout, /Explanations/)
  assert.match(stdout, /柯林斯英汉双解大词典/)
  assert.match(stdout, /See more at/)
})
```

注意这些测试不 mock 网络——它们真的去请求 YouDao。这意味着：

- 测试覆盖了完整的数据提取链路
- YouDao 改版或断服会直接反映在测试结果上
- 但也意味着测试依赖外部服务可用性

这是一个有意识的取舍。对于 CLI 工具来说，外部服务不可用本身就是一个需要知道的问题——更好的通知是测试失败，而不是用户报告。

### 流式开关管理

流式输出使用 `Intl.Segmenter` 分词，每段间隔 15ms。如果测试时也开流式，13 个测试文件累积等待会超过 10 秒。

解决方案是 `disableStream()`：

```js
// 每个测试文件开头
import { disableStream } from './global-setup-teardown.mjs'
disableStream()
```

```js
function disableStream() {
  before(() => { process.env.YDD_NO_STREAM = '1' })
  after(() => { delete process.env.YDD_NO_STREAM })
}
```

环境变量在测试文件作用域内生效，互不干扰。也可以通过 `YDD_NO_STREAM=1 node --test` 全局关闭。

### 随机全链路测试

这是最有意思的测试模式。从 789 个词的固定池中随机抽取 5 个，执行完整的查询流程：

```js
test('should not throw error on random word', () => {
  const limit = 5
  const randomWords = pickRandomWords(limit)

  for (const word of randomWords) {
    assert.doesNotThrow(() => {
      const stdout = execSync(`node ./bin.mjs ${word} -e`).toString('utf-8')
      assert.match(stdout, /See more at/)
    })
  }
})
```

这有什么用？

- 发现边界情况：某个冷门词可能触发未覆盖的分支
- 抵抗过度拟合：如果你的代码只跑"wonderful"和"hello"，你会不自觉地去适配这些词
- 每次发布前随机抽取，长期来看 789 个词大概率被覆盖多轮

这是"测试驱动开发"的补充——它不验证预期行为，而是发现未知问题。

### Preversion 门禁

所有测试都在 `preversion` 钩子中自动执行：

```json
{
  "preversion": "npm test && npm run lint",
  "postversion": "npm publish && git push && git push --tags"
}
```

`npm version patch` → 测试 → lint → publish → push。任何一步失败，发布终止。

关于 lint 有个小坑：`npm run lint` 在 `package.json` 里的定义是 `echo not lint yet`（空操作）。实际 lint 配置（biome.json、oxlintrc）需要手动调用 `npx biome check`。这一点 AGENTS.md 有记录。

### 类型检查

JSDoc + `tsc --noEmit` 提供编译期层面的安全保障：

```json
// tsconfig.json
{
  "compilerOptions": {
    "checkJs": true,
    "strict": true,
    "module": "ES2022"
  }
}
```

它不需要构建步骤——`tsc --noEmit` 只检查类型不生成文件。类型定义在 `typings.ts` 中集中管理，JSDoc 注解引用这些类型。这样 JavaScript 代码获得了接近 TypeScript 的类型安全，但没有引入 tsc 构建管道。

```js
// @ts-check
/** @param {string} word */
export async function print(word, result) { /* ... */ }
```

编辑器中实时报错，CI 中 `npx tsc --noEmit` 卡住类型错误。零构建成本的类型安全。

更详细的测试体系解析见：[《Battle-Tested CLI》](./battle-tested-cli.md)

## 总结

回到开头的问题：一个生产级 CLI 的健壮性来自哪里？

不来自某个"高可用框架"或"容错中间件"。它来自一组简单的原则：

1. **每个外部交互都是故障点** — 网络会断、HTML 会变、API 会改。为每步操作准备 Plan B
2. **依赖越少，不可控因素越少** — 原生 API 的契约随 Node.js 版本背书，不会因为上游删库而中断
3. **降级逻辑必须可测试** — 如果 fallback 路径从来没走过，它一定会在你需要的时候坏掉
4. **用随机覆盖未知** — 预设的测试用例验证预期行为，随机测试发现意料之外的边界

这些原则不复杂，但需要贯穿整个设计和实现过程才能见效。ydd 用不到 2000 行零依赖代码，通过四层降级设计（路由分流 → 双路数据源 → 网络回退 → 沙箱降级），加上三层测试体系（单元 → 端到端 → fuzz），把这个思路完整实践了一遍。

**相关文章：**

- [零依赖 CLI 实战](./zero-dependency-cli.md) — 原生 API 实现细节
- [node:vm 沙箱提取 __NUXT__ 数据](./nuxt-vm-sandbox.md) — 主路策略深度解析
- [Battle-Tested CLI](./battle-tested-cli.md) — 三层测试体系详解
- [Feature Fatigue：防止骚扰的累感设计](./feature-fatigue.md) — 用户体验细节

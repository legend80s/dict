# 逆向工程有道词典：node:vm 沙箱提取 __NUXT__ 数据

> 基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析如何在零依赖下从 SSR 页面中安全提取结构化数据。

## 故事线

接手一个查词工具，首先面临的问题：数据从哪里来？

有道词典有公开的 OpenAPI，但文档早已失效、密钥不可控、还有频率限制。唯一的可靠来源就是它的网页版——`https://dict.youdao.com/result?word=hello`。

但抓 HTML 不难，难的是**从 HTML 中提取结构化数据**。正则匹配 DOM 是刀耕火种，用 cheerio 又引入依赖。

直到发现了 Nuxt 的 `__NUXT__`。

## 发现 __NUXT__

Nuxt.js 服务端渲染页面时，会在 `<script>` 标签中嵌入一个序列化的 JSON：

```html
<script>window.__NUXT__={"data":[{"wordData":{...}}]}</script>
```

这相当于页面把**完整的结构化数据**直接放在了 HTML 里——渲染用，但也恰好是爬虫的金矿。

所以问题变成：**如何提取并安全地解析这段 JavaScript 表达式？**

## 方案一：字符串操作

正则提取 `<script>` 内容：

```js
function extractNuxtScript(html) {
  const scripts = Array.from(
    html.matchAll(/<script[^>]*>(.*?)<\/script>/gis),
    m => m[1],
  )
  return scripts.find(s => s.startsWith('window.__NUXT__='))
}
```

现在拿到 `window.__NUXT__={"data":[...]}`，怎么变成 JavaScript 对象？

最直接的：`JSON.parse`。但问题是——Nuxt 序列化的内容有时包含 `undefined`、函数引用等 JSON 不支持的格式。`JSON.parse` 会直接报错。

那就只能用 `eval` 了。

## 方案二：globalThis.eval（不安全的快）

```js
export function evaluateNuxtInScriptTag(html) {
  const script = extractNuxtScript(html)
  globalThis.window = {}                // 提供 window 对象
  globalThis.eval(script)               // 执行赋值
  return globalThis.window.__NUXT__     // 读取结果
}
```

可以工作，但有三个问题：

1. **全局污染**——脚本执行后 `window` 挂到了 `globalThis` 上，可能影响后续代码
2. **安全风险**——脚本可以访问 `process`、`require`，极端情况下恶意脚本可以直接控制系统
3. **ESLint 警告**——`eval` 被 lint 工具一致标记为危险操作

**"运行一个来自网络的字符串"本身就是危险的。**

## 方案三：node:vm 沙箱（安全的妙）

Node.js 内置了 `node:vm` 模块，可以在一个隔离的 V8 上下文中执行代码：

```js
import vm from 'node:vm'

export function evaluateNuxtInScriptTagUseVM(html) {
  const scriptContent = extractNuxtScript(html)
  if (!scriptContent) return { data: [] }

  // 1. 准备一个空沙箱
  const sandbox = Object.create(null)
  sandbox.window = Object.create(null)
  sandbox.window.__NUXT__ = undefined

  // 2. 创建独立 V8 上下文
  vm.createContext(sandbox)

  try {
    // 3. 在沙箱中执行脚本
    vm.runInContext(scriptContent, sandbox)

    // 4. 从沙箱读取结果
    const nuxtData = sandbox.window.__NUXT__
    if (nuxtData) return nuxtData

    console.warn('No __NUXT__ found after evaluating script.')
  } catch (error) {
    console.error('Error evaluating script:', error)
  }

  return { data: [] }
}
```

### 沙箱为什么安全？

核心在 `Object.create(null)`——创建一个**没有原型链**的对象：

```js
const sandbox = Object.create(null)
```

这意味着：
- `sandbox.toString` → `undefined`（没有从 `Object.prototype` 继承）
- `sandbox.constructor` → `undefined`
- 脚本里写 `constructor.constructor('return process')()` → 原型链攻击路径被切断

当 `vm.runInContext(scriptContent, sandbox)` 执行时，脚本中的 `window.__NUXT__ = {...}` 只会修改沙箱内的 `window` 对象。脚本无法访问到外层的 `globalThis`、`process`、`require`。

### 那 node:vm 到底多安全？

文档说得很坦率：

> **"The node:vm module is not a security mechanism. Do not use it to run untrusted code."**

它并非牢不可破——原型污染、DoS 等攻击仍然可能。但对有道词典页面这种**半可信来源**（它本身是一个静态页面，脚本内容由 Nuxt 生成而非用户输入）来说，已经足够。

## 双路降级：没有 __NUXT__ 怎么办？

问题想得更远一点：如果页面结构变了，`__NUXT__` 消失了怎么办？

ydd 的架构是**双路查询**（src/core/dictionary.mjs）：

```js
export const dictionary = {
  async lookup(...args) {
    let result = { errorMsg: 'NO RESULT' }

    try {
      lookupMethod = 'nuxt'
      result = await dictionaryByNuxt.lookup(...args)  // 方案 A：__NUXT__
    } catch (error) {
      hasError = true
    }

    if (hasError || 'errorMsg' in result) {
      lookupMethod = 'html'
      result = await dictionaryByHTML.lookup(...args)   // 方案 B：正则解析 HTML
    }

    return result
  },
}
```

- **主路**：Nuxt 沙箱提取，一次解析拿到完整 JSON，高效可靠
- **降级**：正则解析 `div.trans-container > ul > li`，兼容老旧页面

两个策略共享同一个接口签名，调用方零感知。

## 数据映射：从裸 JSON 到业务模型

`__NUXT__` 返回的裸 JSON 结构复杂，包含大量渲染元数据。提取后需要映射为业务字段：

```js
// 解释（词义）
const explanations =
  data.wordData.ec?.word.trs.map(item =>
    [item.pos, item.tran].filter(Boolean).join(' ')
  ) || (data.wordData.fanyi?.tran
    ? [data.wordData.fanyi?.tran]
    : [])

// 例句
data.wordData.blng_sents_part?.['sentence-pair'].map(item => ({
  eng: item['sentence-eng'],
  chn: item['sentence-translation'],
  source: item.source || '',
}))

// 柯林斯词典
data.wordData.collins?.collins_entries[0].entries.entry
  .filter(item => item.tran_entry[0].tran)
  .map(item => { /* 解析词性、英文释义、双语例句 */ })
```

这里大量使用了**可选链 `?.`** 和 **空值合并 `||`**——因为 Nuxt 返回的数据结构虽然丰富，但并非所有字段都保证存在。防御性编程是数据提取层的基本素养。

## 另一种方案：为什么不用 cheerio？

如果你熟悉 Node.js 生态，可能会问：为什么不用 `cheerio` + `JSON.parse`？

| 方案 | 依赖 | 安全性 | 数据完整性 |
|------|------|--------|-----------|
| cheerio + 选择器 | cheerio（~1MB） | 安全（文本解析） | 高（HTML 解析） |
| URL 参数 + 正则匹配 | 无 | 安全 | 低（HTML 结构脆弱） |
| **eval/VM 提取 `__NUXT__`** | **无** | **沙箱隔离** | **高（直接获取 JSON）** |

cheerio 在技术上可行，但：
1. ydd 的宗旨是**零生产依赖**
2. cheerio 引入的 AST 解析对当前场景是过度抽象
3. `__NUXT__` 本身就是完整的 JSON，HTML DOM 反而只是它的一个视图

## 总结

从 `__NUXT__` 提取数据的整个链路：

```
HTML 页面
  ↓ 正则提取 <script> 内容
window.__NUXT__ = {...}
  ↓ vm.createContext + vm.runInContext
沙箱中的 JavaScript 对象
  ↓ 解构 + 可选链
业务数据（解释、例句、柯林斯）
  ↓ 双路降级
正则匹配 HTML（备用方案）
```

全程零依赖，通过 `node:vm` 沙箱安全执行外部脚本，并通过双路架构保证高可用。这才是「零依赖不牺牲能力」的正确姿势。

---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

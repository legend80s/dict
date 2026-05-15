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

项目中实际使用的是通用的 `extractTextInTag` 函数（`test/lite-lodash.test.ts` 中有测试）：

```js
// extractTextInTag(html, 'a') 提取 <a> 标签内容
assert.deepEqual(extractTextInTag(
  '<a href="https://google.com">google</a>', 'a'
), ['google'])

// extractTextInTag(html, 'script') 提取所有 <script> 内容
assert.deepEqual(extractTextInTag(html, 'script'), [
  'const b = 1;',
  'window.__NUXT__=(function (a,b) { return { a, b } }(1, 2))',
])
```

然后从中筛选以 `window.__NUXT__=` 开头的脚本内容。

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

### 测试验证：eval 的安全漏洞

测试文件 `test/lite-lodash.test.ts` 中，有几个测试生动地揭示了 `eval` 的风险。

**用例 1：脚本可以访问 Node.js 进程信息**

```js
// 攻击脚本中嵌入 process.versions.node
const html = `<script>window.__NUXT__=(function (a,b) {
  return { a, b }
}(1, 2));console.log(process.versions.node);</script>`

const result = evaluateNuxtInScriptTag(html)
// 输出: 22.18.0  ← process 完全暴露！
assert.deepEqual(result, { a: 1, b: 2 }) // 数据提取正常
```

`process.versions.node` 被成功打印——脚本执行环境与主进程共享同一个全局对象。虽然在这个场景中只是打印了版本号，但如果脚本包含恶意代码，它可以读取环境变量、文件系统、甚至执行系统命令。

**用例 2：原型链污染（最危险）**

```js
const html = `<script>window.__NUXT__=(function (a,b) {
  return { a, b }
}(1, 2));Object.prototype.isAdmin1 = true;</script>`

const result = evaluateNuxtInScriptTag(html)
assert.deepEqual(result, { a: 1, b: 2 })

// 所有对象的原型链都被污染了！
const permission = {}
assert.deepEqual(permission.isAdmin1, true) // 一个空对象居然有 isAdmin1！
```

这段代码在脚本中注入了 `Object.prototype.isAdmin1 = true`。执行后，**进程中所有对象的原型链都被污染了**——新创建的空对象 `permission` 居然有 `isAdmin1` 属性。在真实场景中，这可能导致权限绕过、逻辑漏洞等严重后果。

**"运行一个来自网络的字符串"本身就是危险的。** `eval` 不是方案，是入口。幸运的是，Node.js 内置了更安全的选择。

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

### 测试验证：vm 沙箱如何阻断攻击

同样的攻击，用 `evaluateNuxtInScriptTagUseVM` 测试看看：

**用例 1：阻断 `process` 访问**

```js
// 脚本试图访问 process.versions
const html = `<script>window.__NUXT__=(console.log(process.versions),
function (a,b) { return { a, b } }(1, 2))</script>`

const result = evaluateNuxtInScriptTagUseVM(html)
// process 不存在 → console.log 抛异常 → catch 捕获
// 安全返回默认值
assert.deepEqual(result, { data: [] })
```

`process` 在沙箱上下文中不存在，脚本抛异常后被 `try/catch` 捕获，函数返回安全的空值 `{ data: [] }`。

**用例 2：阻断原型链污染（关键测试）**

```js
// 脚本尝试通过 this.constructor.constructor 逃逸沙箱
const html = `<script>window.__NUXT__=(function (a,b) { return { a, b } }(11, 22));

// 试图逃逸沙箱
const escapedGlobalThis = this.constructor.constructor('return globalThis')();
escapedGlobalThis.globalVar = 456;
escapedGlobalThis.Object.prototype.isAdmin2 = true;
Object.prototype.isAdmin3 = true;
</script>`

const result = evaluateNuxtInScriptTagUseVM(html)
assert.deepEqual(result, { a: 11, b: 22 }) // 数据正常提取

assert.equal(globalThis.globalVar, undefined)     // 全局变量未被修改

const permission = {}
assert.equal(permission.isAdmin2, undefined)      // 原型链未被污染！
assert.equal(permission.isAdmin3, undefined)
```

为什么 `this.constructor.constructor('return globalThis')()` 这条经典逃逸路径在沙箱中失效了？

回顾沙箱的创建方式：

```js
const sandbox = Object.create(null)
```

`Object.create(null)` 创建一个**没有原型链的对象**，因此 `sandbox.constructor` 是 `undefined`。脚本中的 `this.constructor` 就是 `undefined`，无法继续链式调用 `constructor('return globalThis')()`，逃逸路径被彻底切断。

### 性能对比：eval vs vm

测试文件中也记录了两种方案的耗时：

```
evaluateNuxtInScriptTag:     0.665ms    （eval 版本）
evaluateNuxtInScriptTagUseVM: 0.518ms   （vm 版本）
```

vm 不仅更安全，性能甚至略优于 `eval`。这是因为 `vm.createContext` 创建的是**预编译的 V8 上下文**，而 `eval` 的全局作用域解析有额外的开销。安全性提升的同时性能没有妥协，这在工程实践中很难得。

### 那 node:vm 到底多安全？

文档说得很坦率：

> **"The node:vm module is not a security mechanism. Do not use it to run untrusted code."**

它并非牢不可破——更大的攻击面仍然存在。但对有道词典页面这种**半可信来源**（它本身是一个静态页面，脚本内容由 Nuxt 生成而非用户输入）来说，配合 `Object.create(null)` 已经足够实用。

可以用一句话总结：**`eval` 是档案室大门敞开，`vm` 是加了把挂锁——不完美，但足以防君子。**

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

# 如何使用 Node.js 原生测试框架

> 从 Node.js v20.0.0 起，`node:test` 已成为稳定可用的原生测试框架。本文基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实实践，带你从头了解这个内置测试框架的使用姿势。

## 引言

在过去，Node.js 生态测试通常需要引入第三方库：Jest、Mocha、AVA、Vitest……但在 v18 的实验性引入、v20 正式稳定之后，Node.js 自带了足够的测试能力。

这意味着一个 2025 年的新项目，**在测试上可以是零依赖的**。

本文会覆盖以下内容：

- 测试运行器 `node --test`
- 断言库 `node:assert`
- `test` / `describe` / `it` 组织测试
- 钩子函数 `before` / `after` / `beforeEach` / `afterEach`
- 测试过滤 `test.skip` / `test.only`
- 覆盖率 `--experimental-test-coverage`
- Global setup and teardown（为什么这个项目没用它）

## 运行测试

项目中最简单直接的配置：

```json
{
  "scripts": {
    "test": "node --test",
    "cov": "node --test --experimental-test-coverage"
  }
}
```

两条命令，零配置文件。`node --test` 会自动递归搜索 `test/**/*.{mjs,ts}` 并执行所有测试用例。`--experimental-test-coverage` 输出覆盖率报告。

运行效果：

```
▶ node --test
▶ core.test.mjs
  ✔ Should show help (52.8843ms)
  ✔ Should show explanations and without examples by default (613.034ms)
  ✔ Should show explanations and examples and collins (643.086ms)
  ✔ Should show 2 collins (489.759ms)
  ✔ Should show word on verbose (476.342ms)
  ✔ Should show Explanations only (394.088ms)
  # ...
▶ lite-lodash.test.ts
  # highlight
    ✔ should match word wholely (1.341ms)
  # extractTextInTag
    ✔ #extractTextInTag should extract text in tag (0.581ms)
    ✔ #evaluateNuxtInScriptTagUseVM 1 should extract matched text... (0.904ms)
    ✔ #evaluateNuxtInScriptTagUseVM 2 should throw error because... (1.048ms)
    ✔ #evaluateNuxtInScriptTagUseVM should NOT vulnerable to... (0.599ms)

▶ core.test.random.mjs
  ✔ should not throw error on random word (10252.563ms)
```

注意测试文件同时支持 `.mjs` 和 `.ts`——没错，TypeScript 文件可以直接被 `node --test` 执行，不需要编译步骤。

## 编写测试

### 基本结构

`node:test` 提供了两种测试注册方式：顶层 `test()` 与 BDD 风格的 `describe`/`it`。

**顶层 test（适合简单测试文件）：**

```js
import assert from 'node:assert'
import test from 'node:test'

test('should translate en to zh', async () => {
  const result = await translate('hello world')
  assert.equal(result.includes('你好'), true)
})
```

**describe/it（适合分组测试）：**

```js
import assert from 'node:assert'
import { describe, it } from 'node:test'

describe('extractTextInTag', () => {
  it('should extract text in tag', () => {
    const html = '<a href="https://example.com">click</a>'
    assert.deepEqual(extractTextInTag(html, 'a'), ['click'])
  })

  it('should extract multiple tags', () => {
    const html = '<div>a</div><div>b</div>'
    assert.deepEqual(extractTextInTag(html, 'div'), ['a', 'b'])
  })
})
```

### 断言

`node:assert` 是内置断言库，覆盖了大多数日常需求：

```js
import assert from 'node:assert'

// 严格相等
assert.equal(actual, expected)
assert.notEqual(actual, expected)

// 深度相等（对象、数组）
assert.deepEqual(result, { data: [] })

// 正则匹配
assert.match(stdout, /See more at/)
assert.doesNotMatch(stdout, /ERROR/)

// 不抛异常
assert.doesNotThrow(() => execSync('node ./bin.mjs hello'))

// 布尔断言
assert.ok(stdout.includes('hello'))
```

相比 Jest 的 `expect` 链式调用，`node:assert` 的函数式风格初始看起来不那么流畅，但胜在**直接、简单、不需要学习 DSL**。

## 测试过滤

### test.skip：跳过特定测试

当某个功能已知不可用时，用 `skip` 跳过而非删除：

```js
// fanyi.youdao.com/openapi.do 已下线
test.skip('Should show suggested word when no explanations found', () => {
  const stdout = execSync(`node ./bin.mjs dogfood`).toString('utf-8')
  assert.match(stdout, /你要找的是不是/)
})
```

当 `skip` 被移除后，这个测试马上可以恢复。如果当初直接删除了测试，你可能根本不会记得这里曾经有过什么。

### test.only：只跑单个测试

调试单个测试用例时非常有用：

```js
test.only('this test will be the only one that runs', () => {
  // ...
})
```

然后通过 `--test-only` 标志触发：

```bash
node --test-only test/core.test.mjs
```

这比注释掉其他所有 `test()` 调用要优雅得多。

## 钩子函数

`node:test` 支持四个生命周期钩子：`before`、`after`、`beforeEach`、`afterEach`。

在 ydd 中，每个测试文件都需要禁用流式输出以避免测试过慢：

```js
// test/global-setup-teardown.mjs
import { after, before } from 'node:test'

export function disableStream() {
  before(() => {
    process.env.YDD_NO_STREAM = '1'     // 每个测试文件开始前设置
  })

  after(() => {
    delete process.env.YDD_NO_STREAM    // 结束后清理
  })
}
```

每个 E2E 测试文件开头调用一次：

```js
// test/core.test.mjs
import { disableStream } from './global-setup-teardown.mjs'
disableStream()
```

这里的 `before` 和 `after` 是**文件级钩子**，作用于当前文件中的所有测试。它们只会在当前文件的所有测试前后触发一次，不影响其他测试文件。

## 测试文件发现与组织

`node --test` 按以下规则自动发现测试文件：

1. 递归搜索 `test/**` 目录
2. 匹配 `*.{js,mjs,cjs,ts,mts,cts}`
3. 排除 `node_modules/`

ydd 在此规则上按职责拆分：

```
test/
├── lite-lodash.test.ts      # 单元测试 — 工具函数
├── core.test.mjs             # E2E测试 — 完整 CLI 输出断言
├── core.test.translate.mjs   # E2E测试 — 翻译引擎
├── core.test.random.mjs      # 随机测试 — 789词池冒烟
├── asset.mjs                 # 辅助模块 — 词池与随机抽样
├── asset.txt                 # 数据源 — 技术文章原文
└── global-setup-teardown.mjs # 共享钩子 — 禁用流式输出
```

`asset.mjs` 和 `global-setup-teardown.mjs` 不包含测试用例，不会被 `node --test` 执行，但它们可以被测试文件 import 使用。

## Global Setup and Teardown（为什么没用它）

Node.js v24.0.0 引入了一个全局钩子机制：在测试运行器启动和结束时执行代码。

```js
// setup.mjs（需要命令行注册）
// v24 起可用
before(() => { /* 在所有测试文件之前执行 */ })
after(() => { /* 在所有测试文件之后执行 */ })
```

既然是全局级别的生命周期，为什么 ydd 没有使用它？

看 `global-setup-teardown.mjs` 中的注释：

```
// v24 才支持 Global setup and teardown 故还是重复导入吧
// https://nodejs.org/docs/latest/api/test.html#global-setup-and-teardown
```

**答案很直接：项目需要兼容更早的 Node.js 版本。**

`node --test` 在 v20.0.0 稳定，运行测试的最低门槛是 v20。但 Global setup and teardown 直到 v24 才被引入——这意味着这是一个**只能在 v24+ 上使用的功能**。如果使用了它，就不能在 v20/v22 上跑测试了。

另一个原因是**维护成本**。全局钩子需要引入新的约定（文件名、注册方式），而 ydd 的做法简单得多——每个测试文件导入共享的 `disableStream()` 函数。虽然有一个重复的导入语句，但它直接、没有黑魔法、不依赖 Node.js 版本：

```js
// 每个文件显式导入，不依赖任何版本特性
import { disableStream } from './global-setup-teardown.mjs'
disableStream()
```

多写一行 import，换来的是对所有 Node.js v20+ 的兼容。对于追求**零依赖、高兼容**的 CLI 工具来说，这是一个务实的选择。

### 什么时候应该用 Global setup and teardown？

如果你满足以下条件：

- 项目最低运行环境确定为 Node.js v24+
- 需要在所有测试前后执行一些全局操作（如启动/关闭数据库、设置/清理环境变量）
- 不希望在每个测试文件重复导入

那么 Global setup and teardown 是更好选择，它通过 `--test:setup` 参数注册：

```
node --test --test:setup=./test/setup.mjs
```

但要注意，一旦注册了全局钩子，所有测试文件的 `before`/`after` 执行顺序是：

```
全局 before   ← setup.mjs 中定义的钩子
  文件 A before
    文件 A 测试...
  文件 A after
  文件 B before
    文件 B 测试...
  文件 B after
全局 after    ← setup.mjs 中定义的钩子
```

## 异步测试

`node:test` 原生支持 `async/await` 和回调风格：

```js
// async/await
test('should translate en to zh', async () => {
  const result = await translate(text)
  assert.equal(result.includes('闭包'), true)
})

// 回调 done
test('async callback', (t, done) => {
  setTimeout(() => {
    assert.ok(true)
    done()
  }, 100)
})
```

两者等价，推荐 `async/await` 风格。

## 实践建议

### 1. 测试禁用流式输出

E2E 测试中，流式输出的 15ms/词的间隔会大幅拖慢测试。在全局或文件级禁用：

```js
process.env.YDD_NO_STREAM = '1'
// 测试结束后清理
delete process.env.YDD_NO_STREAM
```

### 2. E2E 测试不 mock

ydd 的 E2E 测试直接调用 `execSync('node ./bin.mjs ...')` 启动子进程，真正访问外部 API。这比 mock HTTP 请求更可靠——mock 会掩盖接口变化。

### 3. 精确匹配 vs 模式匹配

根据测试类型选择不同的断言策略：

```js
// 单元测试：精确值匹配
assert.deepEqual(extractTextInTag(html, 'a'), ['google'])

// E2E 测试：模式匹配（ANSI 转义码、不确定的翻译结果）
assert.match(stdout, /See more at/)
assert.match(stdout, /\x1B\[36m\x1B\[1m\x1B\[4mwonderful\x1b\[0m/)
```

### 4. 随机测试用简单断言

随机抽词的输出不可预测，只断言最关键的模式：

```js
assert.doesNotThrow(() => execSync(cmd))
assert.match(stdout, /See more at/)
```

### 5. 利用 test.skip 记录已知问题

当 API 下线或功能不可用时，用 `skip` 而非删除测试：

```js
test.skip('Should show suggested word when no explanations found', () => {
  // 此测试对应功能因上游 API 下线暂时不可用
})
```

## 对比 Jest / Mocha

| 特性 | node:test | Jest | Mocha |
|------|-----------|------|-------|
| 版本 | 内置 | 第三方 | 第三方 |
| 依赖 | 零 | jest（~50MB） | mocha + chai |
| TypeScript | 直接支持 `.ts` | 需配置 | 需配置 |
| 断言 | node:assert | 内置 expect | 需 chai |
| Mock | 无（需自建） | 完整 mock | 需 sinon |
| 覆盖率 | --experimental-test-coverage | 内置 | 需 istanbul |
| 性能 | 好 | 中 | 好 |

`node:test` 最大的优势是**零安装、零配置、零依赖**。代价是缺少 mock/stub 工具——但如果你做的是不依赖 mock 的 E2E 测试（就像 ydd 一样），这根本不是问题。

## 总结

Node.js 原生测试框架从 v20.0.0 起已经足够用于生产项目。ydd 用以下实践证明了这一点：

- **`node --test`** 自动发现测试文件，零配置
- **`node:assert`** 提供完整的断言能力
- **`test.skip` / `test.only`** 灵活控制测试执行
- **`before` / `after`** 文件级生命周期
- 没有使用 Global setup and teardown，因为项目需要兼容 v20/v22，且不想引入新的约定成本

如果问「X 项目应该用什么测试框架？」——答案可以是：**Node.js 自带的可能已经够了。**

开始只需要三行：

```json
{
  "scripts": {
    "test": "node --test"
  }
}
```

以及一个测试文件：

```js
import assert from 'node:assert'
import test from 'node:test'

test('it works', () => {
  assert.equal(1 + 1, 2)
})
```

---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

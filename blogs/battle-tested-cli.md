# Battle-Tested CLI：单元测试、端到端测试与随机全链路验证

> 基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析一个零依赖查词工具如何在每次发布前用三层测试体系确保万无一失。

## 引言

CLI 工具有一个独特的挑战：**你无法控制用户的运行环境。**

Node.js 版本从 18 到 24，操作系统横跨 Windows/macOS/Linux，终端模拟器千奇百怪。你的 ANSI 转义码在一个环境工作，在另一个环境可能就乱码了。

ydd 用了一套三层测试体系来应对：

```
单元测试          → 验证工具函数逻辑正确
端到端测试        → 验证完整 CLI 流程，包括 ANSI 输出断言
随机全链路测试    → 从 789 词池中随机抽词，覆盖真实场景
```

这三层加在一起，在 `npm version patch` 触发发布前自动执行。任何一层失败，发布流程终止。

## 测试基础设施

所有测试只用 Node.js 内置模块——`node:test` + `node:assert` + `node:child_process`。零测试依赖。

```json
{
  "scripts": {
    "test": "node --test",
    "cov": "node --test --experimental-test-coverage",
    "preversion": "npm test && npm run lint"
  }
}
```

- `node --test`：Node.js 18+ 内置的测试运行器，自动发现 `test/**/*.{mjs,ts}` 文件
- `--experimental-test-coverage`：内置覆盖率报告
- `preversion`：在 `npm version` 提交前自动触发，**发布前最后一道关卡**

## 第一层：单元测试

**目标**：验证工具函数在隔离环境中的正确性。

测试位于 `test/lite-lodash.test.ts`，覆盖三个核心函数：

### highlight：高亮匹配的边界控制

```js
describe('highlight', () => {
  it('should match word wholely', () => {
    const sentence = 'The businessman, Jee Ick-joo, was picked up by police...'
    const word = 'ick'
    const result = highlight(sentence, [word])

    // "Ick"（大写 I）应该被高亮
    assert.match(result, /Jee \x1B\[36m\x1B\[1m\x1B\[4mIck/）

    // "picked" 中的 "ick" 不应该被高亮
    assert.doesNotMatch(result, /was p\x1B\[36m\x1B\[1m\x1B\[4mick/)
  })
})
```

这个测试验证了 `\b` 词边界的正确性——`ick` 应该匹配句子中的 `Ick`，但不匹配 `picked` 中的 `ick`。测试同时断言了**ANSI 转义码的正确包裹格式**：`\x1b[36m\x1b[1m\x1b[4m...\x1b[0m\x1b[97m`。

### extractTextInTag：正则提取的健壮性

```js
it('should extract text in tag', () => {
  const html =
    '<script>const b = 1;</script>' +
    '<script>window.__NUXT__=(function (a,b) { return { a, b } }(1, 2))</script>'

  assert.deepEqual(extractTextInTag(html, 'script'), [
    'const b = 1;',
    'window.__NUXT__=(function (a,b) { return { a, b } }(1, 2))',
  ])
})
```

这个测试验证了多项内容：
- 多标签提取：页面有多个 `<script>` 标签时全部返回
- 跨行匹配：标签内容可能包含换行
- 提取顺序：与页面出现顺序一致

### evaluateNuxtInScriptTagUseVM：沙箱安全性

```js
it('should NOT vulnerable to PROTOTYPE POLLUTION', () => {
  const html = `<script>window.__NUXT__=(function (a,b) { return { a, b } }(11, 22));

// 尝试经典的沙箱逃逸路径
const escapedGlobalThis = this.constructor.constructor('return globalThis')();
escapedGlobalThis.globalVar = 456;
escapedGlobalThis.Object.prototype.isAdmin2 = true;
Object.prototype.isAdmin3 = true;
</script>`

  const result = evaluateNuxtInScriptTagUseVM(html)
  assert.deepEqual(result, { a: 11, b: 22 })

  assert.equal(globalThis.globalVar, undefined)           // 全局变量未逃逸
  assert.equal(permission.isAdmin2, undefined)             // 原型链未被污染
  assert.equal(permission.isAdmin3, undefined)
})
```

这组测试验证了 `node:vm` 沙箱在面对**原型链污染攻击**时的防御能力。堪称整库中最硬核的测试——它真的模拟了一次沙箱逃逸攻击。

## 第二层：端到端测试

**目标**：从 `bin.mjs` 入口启动完整 CLI 进程，断言最终的终端输出。

测试位于 `test/core.test.mjs`，使用 `execSync` 启动子进程模拟用户在终端的操作。这是**真正的 E2E 测试**——不是 mock HTTP 响应，而是真的访问有道词典。

### 核心输出断言

```js
test('Should show explanations and examples and collins', () => {
  const stdout = execSync(
    `node ./bin.mjs wonderful --example --collins 1`
  ).toString('utf-8')

  // 不显示调试信息
  assert.doesNotMatch(stdout, /Word: "wonderful"/)

  // 有词义解释
  assert.match(stdout, /🟢 adj. 绝妙的，令人惊叹的，极好的/)

  // 有柯林斯词典
  assert.match(stdout, /柯林斯英汉双解大词典/)
  assert.match(stdout, /1\..+ADJ/)

  // 有例句，且查询词被高亮（ANSI 转义码）
  assert.match(stdout, /\x1B\[36m\x1B\[1m\x1B\[4mwonderful\x1b\[0m/)

  // 有来源标注
  assert.match(stdout, /《牛津词典》/)

  // 有底部链接
  assert.match(stdout, /See more at https:\/\/dict.youdao.com.+wonderful/)
})
```

这个测试覆盖了所有核心输出要素：词义（带 emoji 图标）、柯林斯词典（编号 + 词性）、例句（ANSI 高亮验证）、来源标注、页面链接。全部基于**真实 HTTP 请求**。

### 边界测试用例

**无匹配词**：

```js
test('Should show suggested word when no explanations found', () => {
  const stdout = execSync(`node ./bin.mjs dogfood`).toString('utf-8')

  assert.match(stdout, /你要找的是不是/)
  assert.match(stdout, /dogfooding/)
})
```

**短语查询（>3 词触发翻译）**：

```js
test('Should show Explanations only', () => {
  const stdout = execSync(`node ./bin.mjs "wonderful girl"`).toString('utf-8')

  assert.doesNotMatch(stdout, /Word: "wonderful girl"/)     // 没有调试信息
  assert.doesNotMatch(stdout, /Explanations/)                 // 没有词典标头
  assert.match(stdout, /美妙的女孩/)                            // 有翻译结果
})
```

**特定词的缺失柯林斯**：

```js
test('Should not show collins for word "sulfate"', () => {
  const stdout = execSync(`node ./bin.mjs sulfate -e`).toString('utf-8')

  assert.match(stdout, /Explanations/)
  assert.doesNotMatch(stdout, /柯林斯英汉双解大词典/)            // sulfate 没有柯林斯词条
})
```

「硫酸盐」没有柯林斯词条——这个测试覆盖了**数据缺失场景**，确保页面结构变化时 CLI 不崩。

### 多词长句翻译测试

`test/core.test.translate.mjs` 测试翻译引擎，包含含代码关键词的技术文本翻译：

```js
test('should translate en to zh', async () => {
  const text = 'In reality, there are also implicit implementations of FnMut and FnOnce for Closure...'

  const actual = await translate(text)

  assert.equal(
    !actual ||
      ['FnMut', 'FnOnce', 'Fn', '闭包'].every(eng => actual.includes(eng)),
    true,
  )
})
```

翻译结果带有不确定性（不同时间可能不同），所以断言策略不是精确匹配，而是**关键词存在性检查**——只要结果包含所有技术术语就算通过。

### 测试夹具（Fixture）：全局流式禁用

每个测试文件头部都有 `disableStream()`：

```js
// test/global-setup-teardown.mjs
export function disableStream() {
  before(() => { process.env.YDD_NO_STREAM = '1' })
  after(() => { delete process.env.YDD_NO_STREAM })
}
```

流式输出有 15ms 的单词间隔延迟，E2E 测试中开启流式会使测试时间增加一倍（以 `wonderful` 为例，输出 20+ 个 segment 就是 300ms+ 的额外等待）。全局禁用确保测试速度。

## 第三层：随机全链路测试

**目标**：用真实单词覆盖词典 API 的各类响应，发现边界问题。

这是最精彩的一层。测试文件 `test/core.test.random.mjs`：

```js
test('should not throw error on random word', () => {
  const limit = 5
  const randomWords = pickRandomWords(limit)

  assert.equal(randomWords.size, limit)

  for (const word of randomWords) {
    assert.doesNotThrow(() => {
      const cmd = `node ./bin.mjs ${word} -e`
      const stdout = execSync(cmd).toString('utf-8')

      assert.match(stdout, /See more at/)
    })
  }
})
```

### 789 词池的生成

`test/asset.txt` 是一个真实的技术文章文本（来自 Dioxus Labs 博客）。通过 `asset.mjs` 从中提取所有英文单词：

```js
const article = fs.readFileSync(fp).toString('utf8').toLowerCase()
const seg = new Intl.Segmenter('en', { granularity: 'word' })

const words = Array.from(
  new Set(
    Array.from(seg.segment(article))
      .filter(item => item.isWordLike)
      .map(item => item.segment),
  ),
)
// 最终得到 789 个唯一英文单词
```

用 `Intl.Segmenter` 做分词提取，`new Set` 去重，`isWordLike` 筛掉标点和空格。整个过程零依赖。

### 随机抽样算法

```js
export const pickRandomWords = limit => {
  return pickUniqueRandomItems(words, limit, {
    predicate: item =>
      !/^\d/.test(item) ||     // 排除纯数字
      !item.includes('.'),     // 排除含点单词（如 "React.createElement"）
  })
}
```

有两个过滤条件：
- 纯数字开头的不是真单词
- 含 `.` 的是代码片段中的成员访问（如 `React.createElement`），不是自然语言单词

### 为什么是随机测试？

固定测试用例的局限：你永远**只测你知道要测的单词**。而真实用户可能查任何词——生僻词、缩写词、拼写错误的词。

随机测试从 789 个真实技术文章中提取的单词中随机抽样，覆盖了各种词性、词形和复杂度的单词。每次发布前跑 5 个随机词，随着版本迭代，累计覆盖会越来越广。

### 断言为什么这么简单？

随机测试只做两个断言：**不抛异常** + **输出包含 See more at**（表示查询完成）。

为什么要做得「简单」？因为随机词的输出内容是**不可预测**的，你不知道它会返回什么解释、有没有例句、有没有柯林斯。我们能断言的就两点：
1. 程序不崩溃
2. 查询链路走通

这就是**冒烟测试（Smoke Test）**的核心思想——用最小的断言成本验证系统核心功能正常。

## 第四层（隐式）：发布流水线

三层测试通过 CI/CD 流水线串联，形成自动化的发布屏障：

```
npm run pub:patch
  ↓
npm version patch
  ↓
preversion  →  npm test && npm run lint
  |               ↓
  |           node --test
  |               ↓
  |           ├── 单元测试（lite-lodash.test.ts）
  |           ├── 端到端测试（core.test.mjs）
  |           ├── 翻译测试（core.test.translate.mjs）
  |           └── 随机测试（core.test.random.mjs）← 每次不同单词
  |
  ├── 失败 → 终止发布
  └── 成功
      ↓
postversion →  npm publish && git push && git push --tags
```

关键节点是 `preversion`——这是 `npm version` 的内置钩子，在版本号变更并提交之前执行。如果测试失败，**版本号不会提交，tag 不会打，包不会发布**。

## 整体架构

回顾整个测试体系的设计：

| 层级 | 覆盖范围 | 断言风格 | 运行频率 |
|------|---------|---------|---------|
| 单元测试 | 工具函数 | 精确值匹配 | 每次提交 |
| 端到端测试 | 完整 CLI + 真实 API | 输出模式匹配（含 ANSI） | 每次提交 |
| 翻译测试 | 翻译引擎 | 关键词存在性 | 每次提交 |
| 随机测试 | 789 词池 × 5 随机词 | 不抛异常 + 输出模式 | 每次发布 |

设计原则：

1. **测试与代码同源**——都只用 Node.js 内置模块，零测试依赖
2. **E2E 测试不 mock**——真的去访问有道词典 API，因为 mock 会掩盖请求失败、接口变化等问题
3. **随机测试补盲区**——固定测试覆盖已知边界，随机测试发现未知边界
4. **流水线自动化**——`preversion` 钩子是最后一道防线

## 总结

ydd 用三层测试体系加上 `preversion` 发布屏障，实现了一个零依赖 CLI 工具的**级联验证**：

- 单元测试确保工具函数正确
- E2E 测试确保完整链路通畅，ANSI 输出格式正确
- 随机测试从 789 词池中抽词，发现固定用例覆盖不到的边界
- `preversion` 把所有测试串联成发布前的自动关卡

没有 CI/CD 平台，没有 mock 框架，没有测试基础设施——只有 `node:test` + `node:assert` + `execSync`，加上一个 789 单词的文本文件。但足够把「发布后翻车」的概率降到最低。

这，就是 **battle-tested CLI** 的含金量。

---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

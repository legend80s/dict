# JSDoc 类型体操：在 JavaScript 中获得 TypeScript 级别的类型安全

> 如果哪一天 Node.js 支持发布纯 ts 包，`mjs + jsdoc + tsconfig.json` 这套模式就可正式退位了。虽然 Node.js v22.18 起无需任何 flag 支持运行 TS 文件，但是对 node_modules 内文件仍然不支持直接运行。导致才有本文。


## 引言

「用 TypeScript」还是「用 JavaScript」往往是一个两难选择：

- TypeScript 提供类型安全，但需要构建步骤、`tsconfig.json` 配置、`dist/` 输出目录
- JavaScript 启动快、零配置、直接 `node file.mjs` 就能跑

但有没有**既要又要**的方案？——用 JavaScript 写代码，用 TypeScript 做类型检查，零构建步骤，但类型安全一应俱全。

答案是 **JSDoc 类型注解 + tsc 无输出检查**。


本文灵感来自 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析如何在不引入构建步骤的前提下，用 JSDoc 注解 + 声明文件实现完整的类型检查。


## 整体架构

ydd 的类型系统由三层组成：

```
typings.ts       ← 集中式类型定义（接口、类型别名、工具类型）
     ↕  import 类型（仅类型，不产生运行时依赖）
src/**/*.mjs     ← JSDoc 注解（@param, @returns, @type, @import, @template）
     ↕  tsc --noEmit 检查
tsconfig.json    ← 配置 checkJs: true，只检查不输出
```

**所有 .mjs 文件头部都有一行 `// @ts-check`**，开启 TypeScript 对当前文件的检查。

## 第一层：typings.ts——类型定义的中心化

所有共享类型集中在 `typings.ts` 中。这里是接口枢纽：

```ts
// 联合类型 + 类型守卫
export type IErrorResult = { errorMsg: string; error?: Error; errorType?: IErrorType }
export type ICollinsItem =
  | { partOfSpeech?: string; english: string; eng_sent?: string; chn_sent?: string }
  | [english: string, eng_and_chn_sent?: string]

// 联合类型——结果可能是成功或失败
export type IParsedResult =
  | IErrorResult
  | { explanations: string[]; englishExplanation?: ICollinsItem[]; ... }
```

`IParsedResult` 是一个**标签联合**（Discriminated Union）——虽然没有显式的 `type` 字段，但通过 `'errorMsg' in result` 来区分成功和失败分支：

```js
// @ts-check
if ('errorMsg' in result) {
  // 这里 TypeScript 自动缩窄为 IErrorResult
  console.error(result.errorMsg)
  return false
}
// 这里 TypeScript 自动缩窄为成功类型
```

同时也**导出给消费方**，因为 npm 包的 `index.mjs` 重新导出了这些类型：

```js
// index.mjs
export { dictionary } from './src/core.mjs'
```

外部使用者可以通过 `import type { IParsedResult } from 'ydd'` 获得类型。**JS 包 + TS 类型文件，两全其美。**

## 第二层：@import——在 JS 中引用 TS 类型

在 .mjs 文件中通过 `@import` 标签导入类型定义：

```js
// src/core.mjs
// @ts-check
/** @import { IParsedResult, IErrorResult } from '../typings' */
```

这个导入**只影响类型检查，不影响运行时**。不需要 `import` 语句，没有循环依赖风险。

在函数中使用：

```js
/**
 * @param {string} word
 * @param {IParsedResult} result
 */
export async function print(word, result) {
  if ('errorMsg' in result) {
    // result 被自动缩窄为 IErrorResult
    exitWithErrorMsg(word, result)
    return false
  }
  // result 被自动缩窄为成功的类型
  const { explanations, examples } = result
  // ...
}
```

来看一个更复杂的 `@import` 用法：

```js
// src/core/lookup-by-nuxt-in-html.mjs
/** @import { ICollinsItem } from '../../typings' */

/** @returns {[ICollinsItem[]?, number?]} */
function extractCollins(data) {
  // data 参数的类型由上一级传入，返回值是元组
  const collinsInData = data.wordData.collins
  // ...
  const collins = list.slice(0, size).map(item => {
    const entry = item.tran_entry[0]
    /** @type {ICollinsItem} */
    const parsed = {
      partOfSpeech: [entry.pos_entry?.pos, entry.pos_entry?.pos_tips].filter(Boolean).join(' '),
      english: entry.tran,
      eng_sent: entry.exam_sents?.sent[0].eng_sent,
      chn_sent: entry.exam_sents?.sent[0].chn_sent,
    }
    return parsed
  })
}
```

`/** @type {ICollinsItem} */` 注解一个局部变量，确保对象结构符合接口定义——**多余的字段报错、缺失的字段报错、类型不匹配报错**。

### @import vs @typedef 的选择

项目中还有一个可选方案——本地 `@typedef`：

```js
// src/core/lookup-by-html.mjs
/** @typedef {'en-US' | 'zh-CN'} ILang */
/** @typedef {[english: string, chinese?: string]} ICollinsItem */
```

**什么时候用 `@import`，什么时候用 `@typedef`？**

- `@import`：从 `typings.ts` 导入的**共享全局类型**，多个文件复用
- `@typedef`：**文件内的局部类型**，标记元组或简单别名，不污染全局空间

## 第三层：泛型与工具类型

### @template 泛型

`lite-lodash.mjs` 中有一个 `timeit` 高阶函数，需要完整保留原函数的类型签名：

```js
/**
 * @template {(...args: any[]) => any} T
 * @param {string} label
 * @param {T} asyncFunc
 * @returns {(...args: Parameters<T>) => ReturnType<T>}
 */
export function timeit(label, asyncFunc) {
  return (...args) => { /* ... */ }
}
```

`@template` 声明了泛型参数 `T`，其约束是函数类型。`Parameters<T>` 提取原函数的参数类型，`ReturnType<T>` 提取返回值类型。

效果：`timeit('fetch', lookupByNuxtInHTML)` 返回的函数，参数和返回值类型与 `lookupByNuxtInHTML` 完全一致。在 IDE 中调用时能获得完整的类型提示和参数校验。

### chunk 泛型

```js
/**
 * @template T
 * @param {T[]} arr
 * @param {number} count
 * @returns {T[][]}
 */
export function chunk(arr, count) {
  // ...
}
```

### 类型谓词（Type Predicate）

```js
/** @type {(val: any) => val is string} */
export const isString = val => typeof val === 'string'
```

`val is string` 是一个类型谓词，TypeScript 会在条件分支中自动缩窄类型：

```js
if (isString(arg)) {
  // 这里 arg 被自动推断为 string
  arg.trim()
}
```

## 第四层：typings.ts 中的类型体操

typings.ts 中有一段有趣的类型体操：

```ts
type GetLast<T extends any[]> = T extends [...any, infer Last] ? Last : never

type GeneralizedLast<T> = T extends any[]
  ? GetLast<T> extends infer Last
    ? Last extends `-${string}`
      ? boolean             // 选项名 → boolean
      : Last extends boolean
        ? boolean           // boolean → boolean
        : Last extends number
          ? number          // number → number
          : string          // 其他 → string
    : never
  : boolean                 // 非数组也 → boolean
```

这是为了从 CLI 参数定义中推导出选项的值的类型：

```ts
type IFlags = {
  help: ['-h', '--help']                     // → boolean
  version: ['-v', '--version']               // → boolean
  verbose: ['--verbose']                     // → boolean
  speak: ['-s', '--speak', false]            // → boolean
  example: ['-e', '--example', false]        // → boolean
  collins: ['-c', '--collins', number]       // → number
}
```

`GeneralizedLast` 取出元组最后一个元素：
- 如果是 `-s` 这样的字符串（选项名），返回 `boolean`
- 如果是 `false` 字面量，返回 `boolean`
- 如果是 `number` 字面量，返回 `number`
- 如果是非数组（`--verbose` 直接是字符串），也返回 `boolean`

这段代码诠释了「type 类型信息，不是给代码运行时用的，而是给开发者用的」。它解决了 `parseArgs` 解析结果的类型推导问题，让 **IDE 能精确知道每个选项的值类型**。

## 第五层：tsconfig.json——检查不输出

```json
{
  "compilerOptions": {
    "module": "ES2022",
    "lib": ["ES2022", "DOM"],
    "target": "ES2022",
    "checkJs": true,
    "types": ["node"],
    "strict": true
  }
}
```

关键配置：
- `checkJs: true`——对 .mjs 文件执行类型检查
- `strict: true`——启用所有严格检查（`strictNullChecks`、`noImplicitAny` 等）
- `noEmit`（命令行中传入）——只检查不输出 JS 文件
- `lib: ["ES2022", "DOM"]`——支持 `Intl.Segmenter`、`fetch`、`AbortController` 等 API

通过 `npx tsc --noEmit` 运行，几秒内完成全项目类型检查。

## 收益与取舍

在这个时间点对比一下各方案的权衡：

| 方案 | 构建步骤 | 类型安全 | 可直接运行 | IDE 体验 |
|------|---------|---------|-----------|---------|
| 纯 JS | 无 | 无 | 是 | 基础 |
| TS 源码 + 编译 | 有 | 完整 | 否 | 优秀 |
| **JS + JSDoc + tsc 检查** | **无** | **完整** | **是** | **优秀** |
| JS + 部分 JSDoc | 无 | 部分 | 是 | 中等 |

**最大的收益是「即改即运行」。** 不需要等 `tsc` 编译，不需要处理 `dist/` 和 `src/` 的映射关系。改了 `core.mjs`，直接 `node bin.mjs hello` 就能测试。

**最大的成本是写注解的手工工作。** 尤其是 `typings.ts` 中 200+ 行的 `__NUXT__` 数据结构定义，几乎是手动逆向 Nuxt 页面产出的——这是「高密度工作」的典型代表。

## 实用建议

如果你也想在 JS 项目中引入类型检查，可以从这几个步骤开始：

1. **加 `tsconfig.json`**——`checkJs: true` + `strict: true`，`npx tsc --noEmit` 先跑一遍看有多少错误
2. **所有文件头部加 `// @ts-check`**——从核心文件开始，逐步推广
3. **建立 `typings.ts`**——把跨文件共享的接口收拢到一起
4. **使用 `@import` 引用类型**——`/** @import { MyType } from '../typings' */`
5. **关键函数加 `@param` + `@returns`**——尤其是公共 API 和高阶函数

## 总结

ydd 用 14 行 `tsconfig.json` + 200 行 `typings.ts` + 散落在 .mjs 文件中的 JSDoc 注解，在**零构建步骤**的前提下，获得了完整的 TypeScript 类型检查。

它不是 TypeScript vs JavaScript 的二选一，而是**渐进式类型安全**——在 JavaScript 的灵活性和 TypeScript 的安全性之间，找到了一个务实的平衡点。

当然如果哪一天 Node.js 支持发布纯 ts 包，`mjs + jsdoc + tsconfig.json` 这套模式就可正式退位了。


---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

# timeit 高阶函数：零侵入的函数性能测量

> 基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析一个 20 行的装饰器如何优雅地解决「临时调试 → 永久保留」的难题。

## 场景：性能测量的两难

开发 CLI 工具时，你经常需要知道「这次请求花了多久」。最快的方案是：

```js
console.time('fetch')
const data = await fetch(url)
console.timeEnd('fetch')
```

但问题来了：这只是调试用，上线前要删掉。下次想查性能又得加回来。周而复始。

这个「加上→去掉→再加上」的循环，本质是**临时代码和永久代码的边界模糊**。

ydd 用 `timeit` 高阶函数解决了这个问题。

## 核心：装饰器模式，20 行

src/utils/lite-lodash.mjs 中：

```js
export function timeit(label, asyncFunc) {
  return (...args) => {
    console.time(label)
    let isPromise = false

    try {
      const result = asyncFunc(...args)

      if (result instanceof Promise) {
        isPromise = true
        return result.finally(() => {
          console.timeEnd(label)
        })
      } else {
        return result
      }
    } finally {
      !isPromise && console.timeEnd(label)
    }
  }
}
```

它的本质是一个**高阶函数**（Higher-Order Function）：接收一个函数，返回一个行为相同但增加了计时行为的新函数。

设计亮点：

### 1. 透明代理

返回的函数签名与原始函数完全一致——`(...args) => ...`，参数类型和返回值类型被完美保留。调用方完全感知不到装饰层的存在。

### 2. 同步/异步双模式

关键判断 `result instanceof Promise` 来处理两种路径：
- **异步函数**：返回值是一个 Promise，在 `.finally()` 中结束计时，确保无论 resolve 还是 reject 都能正确记录
- **同步函数**：在 `finally` 块中结束计时，同样保证异常路径不遗漏

### 3. finally 防泄漏

`console.time` 和 `console.timeEnd` 必须成对出现，否则 Node.js 会输出警告。代码用了两重保护：
- `finally` 块兜底（无论是否异常都会执行）
- `isPromise` 标志位避免异步函数在 `try` 和 `.finally()` 中**重复**调用 `console.timeEnd`

## 使用：一行代码，按需开启

真正的优雅在于使用方式。以 Nuxt 查找模块为例（src/core/lookup-by-nuxt-in-html.mjs）：

```js
const lookup = verbose
  ? timeit('? by nuxt fetch', lookupByNuxtInHTML)
  : lookupByNuxtInHTML
```

**`verbose` 是一个由 CLI 参数 `--verbose` 控制的标志位**。这意味着：

- **默认生产环境**：`verbose` 为 `false`，`lookup` 就是原始函数，零开销
- **调试时**：加 `--verbose`，`lookup` 自动被 `timeit` 包裹，每次调用输出耗时

同样的模式用在 HTML 回退引擎（src/core/lookup-by-html.mjs）：

```js
lookup: verbose
  ? timeit('? [lookup-by-html] fetch', lookUpByMatchHtml)
  : lookUpByMatchHtml,
```

### 效果

```
$ npx ydd hello --verbose
? by nuxt fetch: 367.983ms
```

输出清晰，标签明确，多个计时共存也不会混淆。

## 对比传统方案

| 方案 | 生产环境开销 | 调试时操作 | 代码侵入性 |
|------|-------------|-----------|-----------|
| 手写 `console.time/timeEnd` | 需手动删除 | 每次加一遍 | 高，散落各处 |
| 条件编译 `if (debug)` | 无 | 改环境变量重启 | 中，污染函数体 |
| **`timeit` 装饰器** | **零** | **加 `--verbose`** | **无，一行包裹** |

`timeit` 胜在三个字：**零侵入**。

原始函数 `lookupByNuxtInHTML` 不需要知道计时的存在，不需要导入任何工具函数，不需要包裹自己的内部逻辑。计时是一个独立的关注点，通过组合的方式附加上去。

## 进一步：JSDoc 类型安全

值得留意的是 `timeit` 完整的 JSDoc 类型标注：

```js
/**
 * @template T
 * @param {string} label
 * @param {T} asyncFunc
 * @returns {(...args: Parameters<T>) => ReturnType<T>}
 */
```

利用了 TypeScript 的条件类型：
- `Parameters<T>`：提取原函数的参数类型元组
- `ReturnType<T>`：提取原函数的返回值类型

这意味着被 `timeit` 包裹后的函数，在 IDE 中依然有完整的类型推断。装饰没有丢失任何类型信息。

## 可扩展的设计

`timeit` 是最小可用版本。从这个模式出发，可以轻松扩展：

```js
// 带条件开关
function timeitIf(condition, label, fn) {
  return condition ? timeit(label, fn) : fn
}

// 带计数
function timeitAndCount(label, fn) {
  let count = 0
  return (...args) => {
    count++
    console.time(label + `(#${count})`)
    // ...
  }
}

// 带慢查询告警
function timeitWithWarning(label, fn, threshold = 1000) {
  return (...args) => {
    console.time(label)
    const result = fn(...args)
    // 异步同理...
    console.timeEnd(label)
    // 如果超过阈值自动告警
    return result
  }
}
```

## 总结

`timeit` 之所以优雅，是因为它严格遵守了**单一职责**和**组合优于继承**的原则：

1. **函数的职责只有一个**——`lookupByNuxtInHTML` 只负责查词逻辑
2. **计时是横切关注点**——通过 `timeit` 装饰器组合进去
3. **开关在调用处控制**——`verbose ? timeit(...) : rawFn` 一行决策
4. **类型安全**——JSDoc 泛型确保包裹后不丢失类型

用 20 行代码加一个三目运算符，彻底消灭了「加计时→删计时」的重复劳动。

---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

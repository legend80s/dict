
# 终端流式输出的优雅实现：从 ANSI 逃逸到 Intl.Segmenter

> 本文基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析如何在终端中实现**带样式的逐词流式输出**。

## 缘起

今天试用了一下 `ydd` 逐字跳出的交互提示让人印象深刻。这种"流式输出"不仅在体验很酷，在 CLI 工具中同样能大幅提升感知体验，甚至能打造独属品牌感。

[ydd](https://github.com/legend80s/dict) 是一个零依赖的查词 CLI，它有一个 `--stream` 模式：查询结果不是「啪」一下全部打印，而是逐词流出，模拟大模型 token 逐字生成的即视感。

但实现起来有一个核心难题——**ANSI 转义码**。

## 问题：ANSI 逃逸码与字符流的冲突

要给终端文字加颜色/加粗，需要嵌入 ANSI 转义序列，例如 `\x1b[32m绿色\x1b[0m`。

如果直接对字符串做 `split('')` 然后逐字符输出：

```
\x1b[32m绿 → 颜色序列被拦腰截断
```

终端会显示乱码。颜色码必须完整发出。

所以第一个任务：**把 ANSI 码和可见字符分开，确保颜色码以完整序列发送。**

## 解法一：ANSI 感知的字符标记化

核心函数 `getVisibleCharTokens` 逐个扫描字符串，遇见 `\x1b` 就吞掉整段 ANSI 序列，将其「挂载」到后续可见字符上：

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

每个可见字符都带着它前面的 ANSI 前缀。比如 `\x1b[32m绿\x1b[33m色` 会被解析为：

```
[{ char: '绿', ansi: '\x1b[32m' }, { char: '色', ansi: '\x1b[33m' }]
```

最后的 `trailingAnsi` 捕获那些在尾部无处依附的 RESET 码，在流结束前发送，确保终端状态恢复。

## 解法二：Intl.Segmenter——单词边界检测

标记化解决了 ANSI 安全问题，但如果简单按 `n` 个字符一组去发，会出现中文词组被切断、英文单词中间停顿的尴尬。

ydd 使用了现代 JavaScript 的 `Intl.Segmenter` API——原生、零依赖的国际化文本分割器：

```js
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
const segments = [...segmenter.segment(visibleText)]
```

- `granularity: 'word'`：按单词边界分割，完美处理中英文混排
- `locale: 'zh-CN'`：指定中文分词规则

比如「hello world你好世界」会被分成：`['hello', ' ', 'world', '你好', '世界']`。每个 segment 都是一个自然语素，以此为单位输出，阅读节奏最舒适。

## 组合：streamToStdout

现在把两部分组合起来：

```js
export async function streamToStdout(styledString, delayMs = 15) {
  if (!styledString) return

  // 1. ANSI 字符标记化
  const { tokens, trailingAnsi } = getVisibleCharTokens(styledString)
  if (tokens.length === 0) {
    process.stdout.write(styledString + trailingAnsi)
    return
  }

  // 2. 提取纯文本，用 Intl.Segmenter 切分
  const visibleText = tokens.map(t => t.char).join('')
  const segments = [...new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(visibleText)]

  // 3. 逐段输出，贴合 ANSI
  let pos = 0
  for (const seg of segments) {
    const chunk = tokens.slice(pos, pos + seg.segment.length)
    const output = chunk.map(t => t.ansi + t.char).join('')
    process.stdout.write(output)
    pos += seg.segment.length

    if (pos < tokens.length) {
      await new Promise(r => setTimeout(r, delayMs))  // 15ms 间隔
    }
  }

  if (trailingAnsi) process.stdout.write(trailingAnsi)
  process.stdout.write('\n')
}
```

关键细节：

1. **`process.stdout.write` 而非 `console.log`**：前者是底层写入，不带额外换行，可以精确控制每次输出的内容。
2. **`delayMs` 参数**：默认 15ms 间隔在流畅和自然之间取了平衡。最后一组不延迟，避免结尾卡顿。
3. **尾部 ANSI 修复**：末尾的 RESET 码在最后补发，防止终端残留颜色。
4. **边界情况**：空字符串、纯 ANSI 字符串（无可见字符）都能正确处理。

## 集成到 CLI：配置优先级

ydd 的 `--stream` 选项遵循经典的优先级链：

```
命令行显式参数 > 环境变量 > 默认值
```

实现如下（src/utils/arg-parser.mjs）：

```js
function resolveStreamOption(stream, env) {
  if (stream !== undefined) return !!stream       // --stream / --no-stream 最高优
  if (env.YDD_NO_STREAM === '1') return false     // 环境变量禁用
  return true                                      // 默认开启
}
```

用户可以通过 `--stream` 启用、`--no-stream` 禁用，或在 CI 环境中设 `YDD_NO_STREAM=1` 彻底关闭。

在 `core.mjs` 的 `print()` 函数中，根据标志位做二选一：

```js
if (parsed.stream) {
  await streamToStdout(output)   // 流式
} else {
  console.log(output)            // 瞬间输出
}
```

## 性能考量

流式输出本质上是"用交互相应换时间"——对于查词这种毫秒级操作，15ms × 20 个 segment ≈ 300ms 的总延迟，对用户来说几乎无感，但视觉上获得了"正在生成"的即时反馈。

`Intl.Segmenter` 在 V8 中有高度优化的 C++ 实现，分割一段几百字符的文本耗时 < 0.1ms，可以忽略不计。

## 适用场景

这个模式不只是炫技，它适合任何需要：
- 让用户感知"正在工作"的 CLI 工具
- 展示逐步推理/生成结果的过程
- 在长文本输出中提供阅读节奏感

## 总结

从 ANSI 逃逸码的 token 化，到 Intl.Segmenter 的自然语言分割，再到 process.stdout.write 的精细控制——实现终端流式输出的核心并不复杂，但需要警惕边界情况。ydd 的实现在**零依赖**的前提下完成了这一切，核心代码不到 80 行。

相信你也能在自己的 CLI 工具中轻松复现这个模式。

---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

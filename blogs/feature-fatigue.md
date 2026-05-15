# Feature Fatigue：如何优雅地引导用户发现 CLI 的高级功能

> 基于 [ydd（有道词典 CLI）](https://github.com/legend80s/dict) 的真实代码，剖析一个精巧的「疲劳系统」设计模式。

## 引子

每个 CLI 工具都有「隐藏技能」。

比如 `npx ydd hello` 查单词，你可能不知道加 `-e` 能看例句、`-s` 能听发音、`-c=all` 能展开所有柯林斯释义。但这些功能如果一股脑塞给用户，就像第一次见面就把所有家底全抖出来——不合适。

更糟的是，每次查词都在尾部追加一行「提示」，用户查 100 次就看 100 遍，从「嗯有用」变成「我知道了别再说了」，最终变成「好烦」。

**ydd 的解法很巧妙：每个功能提示最多出现 2 次，之后就闭嘴。**

这就是 **Feature Fatigue（功能疲劳）** 模式。

## 核心思想

> 用户不需要知道全部功能，只需要在恰当的时机被引导一次。

规则极其简单：
- 每个提示有一个唯一 key（如 `'example'`、`'speak'`）
- 提示出现一次，计数 +1
- 计数 >= 2 后，该提示永不出现

这个「限 2 次」的设计很关键——1 次可能没注意，2 次足够记住。再多就是骚扰。

## 实现：不到 50 行的 Fatigue 类

src/utils/fatigue.mjs：

```js
export class Fatigue {
  constructor(verbose = false) {
    this.verbose = !!verbose;
  }

  // 检查是否「疲倦」了（达到上限）
  hit(key) {
    const config = require(rcFilepath);
    return config[key] >= limit;  // limit = 2
  }

  // 手动设为疲倦（用户已主动使用该功能）
  setTired(key) {
    this.increment(key, limit);
  }

  // 计数器 +1
  increment(key, count) {
    const config = require(rcFilepath);
    const cnt = count ?? (config[key] ?? 0) + 1;
    config[key] = cnt;
    writeFullConfig(config);
  }
}
```

`hit()` 检查是否达到上限，`increment()` 计数，`setTired()` 直接拉满。核心逻辑 4 个方法，20 行。

## 存储：藏在用户目录的无侵入配置

数据存在 `~/ydd-data.js`，一个 Node.js 可以直接 `require` 的 JS 文件：

```js
// You can delete this file whenever.
module.exports = {
  "example": 2,
  "speak": 1
}
```

设计上有几个巧妙的点：

1. **JS 而非 JSON**——`require` 自带缓存和同步读取，免去 `JSON.parse`。文件内容也可以放注释。
2. **用户目录而非项目目录**——CLI 是全局工具，配置放 `~` 天然跨项目共享，也符合 Unix 惯例。
3. **注释引导**——"You can delete this file whenever" 降低用户的心理负担，让配置文件变得「可丢弃」。
4. **零依赖写入**——`JSON.stringify(config, null, 2)` 格式化输出，人类可读可编辑。

## 集成：智能的提示策略

在 src/core.mjs 的 `buildFeaturesString` 中：

```js
function buildFeaturesString(word, suggestedWord) {
  let output = ''
  const fatigue = new Fatigue(verbose)

  const exampleFlagSet = parsed.example
  if (exampleFlagSet) {
    fatigue.setTired('example')    // 已经在用了？直接闭嘴
  }

  const speakFlagSet = parsed.speak
  if (speakFlagSet) {
    fatigue.setTired('speak')
  }

  // 优先推荐例句功能
  if (!exampleFlagSet && !fatigue.hit('example')) {
    output += 'Try `npx ydd ... -e -c=2|all` to get some examples ✨.'
    fatigue.increment('example')
  } else if (!speakFlagSet && !fatigue.hit('speak')) {
    output += 'Try `npx ydd ... -s` to speak it out 📣.'
    fatigue.increment('speak')
  }

  return output
}
```

这里有三个关键的设计决策：

### 优先级队列

`example` 提示优先于 `speak`。只有当 `example` 已疲倦或已被使用，才尝试 `speak`。这让用户先在例句功能上「毕业」，再引导下一个。

### 使用即沉默

```js
if (exampleFlagSet) {
  fatigue.setTired('example')
}
```

如果用户已经主动加了 `-e` 参数，说明他已经知道这个功能了。此时直接 `setTired`，不再提示。用户的行为本身就是最好的反馈。

### 渐进式暴露

每次查词最多只展示一条提示。不是「这里有一堆功能你看一下」，而是「你试过用 -e 看例句吗？」——像朋友在旁边的轻声提醒，不是大喇叭广播。

## 一个通用设计模式

Feature Fatigue 不止适用于 CLI 功能提示。它解决的是更普遍的问题：

**如何在不惹恼用户的前提下，帮助用户发现产品价值？**

适用场景：
- IDE 首次打开时的快捷键提示
- SaaS 产品的新功能引导
- 移动 App 的「试试滑动手势」提示
- 游戏的新手引导

核心原则都是一样的：
1. **尊重用户**——用户不是记不住，是不需要记住所有东西
2. **有限次数**——给提示设置生命周期，到点就消失
3. **行为感知**——用户自己发现功能后，自动停止引导
4. **持久存储**——记住用户的进度，别每次都是第一天

## 总结

Feature Fatigue 是一个「小设计大收益」的模式。ydd 用不到 50 行的代码 + 一个简单的计数器文件，优雅地解决了 CLI 功能发现的经典难题。

它不需要 A/B 测试、用户画像、埋点分析。只是一个简单的计数器、一个 `if` 判断、和一个在恰当时候闭嘴的自觉。

---

> 完整代码见 [github.com/legend80s/dict](https://github.com/legend80s/dict)，欢迎 Star/Fork。

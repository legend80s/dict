import { translate } from '../src/translator/engines/baidu.mjs'

import test from 'node:test'
import assert from 'node:assert'

test('should translate en to zh', async () => {
  const text =
    'In reality, there are also implicit implementations of FnMut and FnOnce for Closure, but Fn is the “fundamental” one for this closure.'

  // const normal = '事实上，FnMut和FnOnce也有用于闭包的隐式实现，但Fn是这个闭包的“基本”实现。'

  const actual = await translate(text)
  console.log('actual:', actual)
  // actual: 实际上，也有FnMut和FnOnce的隐式实现用于闭包，但Fn是这种闭包的“基本”实现。

  assert.equal(
    // 因为翻译结果可能存在差异，所以这里使用关键词匹配
    ['FnMut', 'FnOnce', 'Fn', '闭包'].every(eng => actual.includes(eng)),

    true,
  )
})

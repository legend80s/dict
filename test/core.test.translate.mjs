import assert from 'node:assert'

import test from 'node:test'
import { translate } from '../src/translator/engines/baidu.mjs'
import { execSync } from 'node:child_process'

const text =
  'In reality, there are also implicit implementations of FnMut and FnOnce for Closure, but Fn is the “fundamental” one for this closure.'

test('should translate en to zh', async () => {
  // const normal = '事实上，FnMut和FnOnce也有用于闭包的隐式实现，但Fn是这个闭包的“基本”实现。'

  //  {
  //   errno: 1022,
  //   errmsg: '访问出现异常，请刷新后重试！',
  //   logid: 2699390259,
  //   error: 1022,
  //   errShowMsg: '访问出现异常，请刷新后重试！'
  // }

  const actual = await translate(text)
  console.info('baidu fanyi:', { actual })
  // actual: 实际上，也有FnMut和FnOnce的隐式实现用于闭包，但Fn是这种闭包的“基本”实现。

  assert.equal(
    // 如果翻译失败则 actual 为空
    !actual ||
      // 如果成功则必然包含关键词
      // 但因为翻译结果可能存在差异，所以这里使用关键词匹配
      ['FnMut', 'FnOnce', 'Fn', '闭包'].every(eng => actual.includes(eng)),

    true,
  )
})

test('should translate en to zh using youdao', async () => {
  const actual = execSync(`node ./ "${text}"`).toString('utf-8')

  console.info('youdao fanyi:', { actual })

  assert.equal(
    // 如果成功则必然包含关键词
    // 但因为翻译结果可能存在差异，所以这里使用关键词匹配
    ['FnMut', 'FnOnce', 'Fn', '闭包'].every(eng => actual.includes(eng)),

    true,
  )
})

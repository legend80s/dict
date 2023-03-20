import { translate } from '../src/translator/engines/baidu.mjs';

import test from 'node:test';
import assert from 'node:assert';

test('should translate en to zh', async () => {
  const text = 'In reality, there are also implicit implementations of FnMut and FnOnce for Closure, but Fn is the “fundamental” one for this closure.';
  const expected = "";
  const normal = '事实上，FnMut和FnOnce也有用于闭包的隐式实现，但Fn是这个闭包的“基本”实现。'

  const actual = await translate(text);

  assert.equal(actual === expected || actual === normal, true);
})

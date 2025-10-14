// @ts-check
import assert from 'node:assert';
import { describe, it } from 'node:test';

import {
  evaluateNuxtInScriptTag,
  evaluateNuxtInScriptTagUseVM,
  extractTextInTag,
  highlight,
} from '../src/utils/lite-lodash.mjs';

describe('highlight', () => {
  it('should match word wholely', () => {
    const sentence =
      'The businessman, Jee Ick-joo, was picked up by police and quickly killed, according to news reports in the Philippines.';
    const word = 'ick';
    const result = highlight(sentence, [word]);
    const expected = /Jee \x1B\[36m\x1B\[1m\x1B\[4mIck\x1b\[0m-joo/;

    assert.match(result, expected);
    assert.doesNotMatch(
      result,
      /was p\x1B\[36m\x1B\[1m\x1B\[4mick\x1b\[0med up by/,
    );
  });
});

// `vm` test passed in Node.js v22.18.0 从测试我们发现几个点
// 1. `vm` 不能访问 `process` 和 `require` 只能访问我们预设的全局变量
// 2. `vm` 不能修改全局变量
// 3. `vm` 不能污染原型链
describe('extractTextInTag', () => {
  it('#extractTextInTag should extract text in tag', () => {
    const html =
      '<script>const b = 1;</script><script>window.__NUXT__=(function (a,b) { return { a, b } }(1, 2))</script><a href="https://google.com">google</a>';

    assert.deepEqual(extractTextInTag(html, 'a'), ['google']);
    assert.deepEqual(extractTextInTag(html, 'script'), [
      'const b = 1;',
      'window.__NUXT__=(function (a,b) { return { a, b } }(1, 2))',
    ]);
  });

  it('#evaluateNuxtInScriptTag should extract matched text in script tag and evaluate it', () => {
    const html =
      '<script>const b = 1;</script><script>window.__NUXT__=(function (a,b) { return { a, b } }(1, 2))</script><a href="https://google.com">google</a>';

    console.time('evaluateNuxtInScriptTag'); // 0.665ms
    const result = evaluateNuxtInScriptTag(html);
    console.timeEnd('evaluateNuxtInScriptTag');
    const expected = { a: 1, b: 2 };

    assert.deepEqual(result, expected);
  });

  it('#evaluateNuxtInScriptTag is harm full because any node.js modules can be EXPLOITED!', () => {
    const html =
      '<script>const b = 1;</script><script>window.__NUXT__=(function (a,b) { return { a, b } }(1, 2));console.log(process.versions.node);</script><a href="https://google.com">google</a>';

    console.time('evaluateNuxtInScriptTag'); // 0.665ms
    const result = evaluateNuxtInScriptTag(html);
    console.timeEnd('evaluateNuxtInScriptTag');
    const expected = { a: 1, b: 2 };

    assert.deepEqual(result, expected);
  });

  it('#evaluateNuxtInScriptTag is vulnerable to PROTOTYPE POLLUTION', () => {
    const html = `<script>const b = 1;</script><script>window.__NUXT__=(function (a,b) { return { a, b } }(1, 2));Object.prototype.isAdmin1 = true;</script><a href="https://google.com">google</a>`;

    console.time('evaluateNuxtInScriptTag'); // 0.665ms
    const result = evaluateNuxtInScriptTag(html);
    // console.log('result:', result);
    console.timeEnd('evaluateNuxtInScriptTag');
    const expected = { a: 1, b: 2 };

    assert.deepEqual(result, expected);

    const permission = {};
    // @ts-expect-error
    assert.deepEqual(permission.isAdmin1, true);
  });

  it('#evaluateNuxtInScriptTagUseVM 1 should extract matched text in script tag and evaluate it use `vm`', () => {
    const html =
      '<script>const b = 1;</script><script>window.__NUXT__=(function (a,b) { return { a, b } }(1, 2))</script><a href="https://google.com">google</a>';

    console.time('evaluateNuxtInScriptTagUseVM'); // 0.518ms
    const result = evaluateNuxtInScriptTagUseVM(html);
    console.timeEnd('evaluateNuxtInScriptTagUseVM');
    const expected = { a: 1, b: 2 };

    assert.deepEqual(result, expected);
  });

  it('#evaluateNuxtInScriptTagUseVM 2 should throw error because it access `process`', () => {
    const html =
      '<script>const b = 1;</script><script>window.__NUXT__=(console.log(process.versions),function (a,b) { return { a, b } }(1, 2))</script><a href="https://google.com">google</a>';

    console.time('evaluateNuxtInScriptTagUseVM');
    const result = evaluateNuxtInScriptTagUseVM(html);
    console.timeEnd('evaluateNuxtInScriptTagUseVM');

    const expected = { data: [] };
    assert.deepEqual(result, expected);
  });

  it('#evaluateNuxtInScriptTagUseVM should NOT vulnerable to PROTOTYPE POLLUTION!', () => {
    const html = `<script>const b = 1;</script><script>window.__NUXT__=(function (a,b) { return { a, b } }(11, 22));

    // 下面的代码试图污染全局变量和原型链
    const escapedGlobalThis = this.constructor.constructor('return globalThis')();
    escapedGlobalThis.globalVar = 456;
    escapedGlobalThis.Object.prototype.isAdmin2 = true;
    Object.prototype.isAdmin3 = true;
    </script>
    <a href="https://google.com">google</a>`;

    console.time('evaluateNuxtInScriptTagUseVM');
    const result = evaluateNuxtInScriptTagUseVM(html);
    console.timeEnd('evaluateNuxtInScriptTagUseVM');
    const expected = { a: 11, b: 22 };
    // console.log('globalVar:', globalThis.globalVar);

    assert.equal(globalThis.globalVar, undefined);
    assert.deepEqual(result, expected);

    const permission = {};
    // console.log('permission:', permission);
    // console.log('permission.isAdmin2:', permission.isAdmin2);
    // @ts-expect-error
    assert.equal(permission.isAdmin2, undefined);
    assert.equal(permission.isAdmin3, undefined);
  });
});

// import { translate } from '../src/translator/index.mjs';

// import test from 'node:test';
// import assert from 'node:assert';

// test('should translate en to zh', async () => {
//   const text = 'In reality, there are also implicit implementations of FnMut and FnOnce for Closure, but Fn is the “fundamental” one for this closure.';
//   const expected = "实际上，对于闭包也有fnmut和FnOnce的隐式实现，但Fn是这个闭包的\"基础\"。";

//   let actual = '';
//   console.time('translate')

//   try {
//     actual = await translate(text);
//   } finally {
//     console.timeEnd('translate')
//   }

//   assert.equal(actual, expected);
// })
import { highlight } from '../src/utils/lite-lodash.mjs';

// highlight(sentence, words)
import test from 'node:test';
import assert from 'node:assert';

test('should match word wholely', () => {
  const sentence = 'The businessman, Jee Ick-joo, was picked up by police and quickly killed, according to news reports in the Philippines.';
  const word = 'ick';
  const result = highlight(sentence, [word])
  const expected = /Jee \x1B\[1m\x1B\[4mIck\x1B\[22m\x1B\[24m-joo/;

  assert.match(result, expected)
  assert.doesNotMatch(result, /was p\x1B\[1m\x1B\[4mick\x1B\[22m\x1B\[24med up by/)
})

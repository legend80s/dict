import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { pickRandomWords } from './asset.mjs';

test('should not throw error on random word', () => {
  const limit = 5;
  const randomWords = pickRandomWords(limit)

  console.log('randomWords:', randomWords);
  assert.equal(randomWords.size, limit)

  for (const word of randomWords) {
    assert.doesNotThrow(() => {
      const p = word.includes(`'`) ? '"' : "'";

      const stdout = execSync(`node ./ ${p}${word}${p} -e`).toString('utf-8');
      console.log('word:', `"${word}"`);

      assert.match(stdout, /💬 \x1B\[97m/);
      assert.match(stdout, /See more at/);
    })
  }
})

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
      const stdout = execSync(`node ./ '${word}' -e`).toString('utf-8');

      assert.equal(stdout.includes(word), true);
      assert.match(stdout, /See more at/);
    })
  }
})

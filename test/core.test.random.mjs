import assert from 'node:assert'
import { execSync } from 'node:child_process'
import test from 'node:test'
import { pickRandomWords } from './asset.mjs'
import { disableStream } from './global-setup-teardown.mjs'

disableStream()

test('should not throw error on random word', () => {
  const limit = 2
  const notFondWord = 'createelement'
  const randomWords = pickRandomWords(limit).add(notFondWord)

  console.info('randomWords:', randomWords)
  assert.equal(randomWords.size, limit + 1)

  for (const word of randomWords) {
    console.info('word:', `[${word}]`)

    assert.doesNotThrow(() => {
      const cmd = `node ./bin.mjs ${word} -e 2>&1`
      // console.log('cmd:', { cmd })
      const stdout = execSync(cmd).toString('utf-8')

      // console.log(`stdout:|${stdout}|`)

      try {
        assert.match(stdout, /See more at/)
      } catch {
        assert.match(stdout, /抱歉没有找到“\w+”相关的词/)
      }
    })
  }
})

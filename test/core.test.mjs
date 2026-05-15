import assert from 'node:assert'
import { execSync, spawnSync } from 'node:child_process'
import test from 'node:test'
import { stripVTControlCharacters } from 'node:util'
import { disableStream } from './global-setup-teardown.mjs'

disableStream()

test('Should show help', () => {
  const stdout = stripVTControlCharacters(execSync(`node ./bin.mjs -v`).toString('utf-8'))

  assert.match(stdout, /ydd@\d/)
  assert.match(stdout, /> Explain English word in Chinese. 查询英文单词的中文释义。/)
  assert.match(stdout, /> Usage:/)
  assert.match(stdout, /\$ npx ydd <word>/)
  ;['h', 'help', 'v', 'version', 'verbose', 's', 'speak', 'e', 'example', 'c', 'collins'].forEach(
    flag => {
      assert.equal(stdout.includes(flag), true)
    },
  )
})

test('Should show explanations and without examples by default', () => {
  const stdout = execSync(`node ./bin.mjs wonderful`).toString('utf-8')

  assert.doesNotMatch(stdout, /Word: "wonderful"/)
  assert.doesNotMatch(stdout, /Explanations/)
  assert.match(stdout, /🟢 \x1B\[97madj. 绝妙的，令人惊叹的，极好的\x1B\[0m/)
  assert.doesNotMatch(stdout, /Examples/)
})

test('Should show explanations and examples and collins', () => {
  const stdout = execSync(`node ./bin.mjs wonderful --example --collins 1`).toString('utf-8')

  assert.doesNotMatch(stdout, /Word: "wonderful"/)
  assert.match(stdout, /Explanations/)
  assert.match(stdout, /🟢 \x1B\[97madj. 绝妙的，令人惊叹的，极好的\x1B\[0m/)

  assert.match(stdout, /柯林斯英汉双解大词典/)
  assert.match(stdout, /1\..+ADJ/)
  assert.doesNotMatch(stdout, /2\..+ADV/)

  assert.match(stdout, /Examples/)
  // bold and underlined expected
  assert.match(stdout, /\x1B\[36m\x1B\[1m\x1B\[4mwonderful\x1b\[0m/)
  assert.match(stdout, /《牛津词典》/)
  assert.match(stdout, /See more at https:\/\/dict.youdao.com.+wonderful/)
})

test('Should show 2 collins', () => {
  const stdout = stripVTControlCharacters(
    execSync(`node ./bin.mjs wonderful -c=2 --example`).toString('utf-8'),
  )

  assert.match(stdout, /柯林斯英汉双解大词典/)
  assert.match(stdout, /1\..+ADJ/)
  assert.match(stdout, /2\..+ADV/)
})

test('Should show word on verbose', () => {
  const stdout = execSync(`node ./bin.mjs wonderful --verbose`).toString('utf-8')

  assert.match(stdout, /Word: "wonderful"/)
})

test('Should show Explanations only', () => {
  const stdout = execSync(`node ./bin.mjs "wonderful girl"`).toString('utf-8')

  assert.doesNotMatch(stdout, /Word: "wonderful girl"/)
  assert.doesNotMatch(stdout, /Explanations/)
  assert.match(stdout, /美妙的女孩/)
  assert.match(
    stdout,
    // biome-ignore lint/complexity/useRegexLiterals: String.raw is used for escape thus more readable
    new RegExp(String.raw`See more at https://dict.youdao.com.+wonderful%20girl`),
  )
})

// skip because fanyi.youdao.com/openapi.do is down
test.skip('Should show suggested word when no explanations found', () => {
  const stdout = execSync(`node ./bin.mjs dogfood`).toString('utf-8')

  assert.match(stdout, /你要找的是不是/)
  assert.match(stdout, /dogfooding/)
})

test('Should show Examples and collins', () => {
  const stdout = stripVTControlCharacters(
    execSync(`node ./bin.mjs router -e -c=1`).toString('utf-8'),
  )

  assert.match(stdout, /Explanations/)
  assert.match(stdout, /柯林斯英汉双解大词典/)
  assert.match(stdout, /1\. /)
  assert.match(stdout, /Examples/)
  assert.match(stdout, /See more at/)
})

test('Should show Examples without collins', () => {
  const stdout = execSync(`node ./bin.mjs router -e`).toString('utf-8')

  assert.match(stdout, /Explanations/)
  assert.doesNotMatch(stdout, /柯林斯英汉双解大词典/)
  assert.doesNotMatch(stdout, /1\. /)
  assert.match(stdout, /Examples/)
  assert.match(stdout, /See more at/)
})

test('Should not show collins for word "sulfate"', () => {
  const stdout = execSync(`node ./bin.mjs sulfate -e`).toString('utf-8')

  assert.match(stdout, /Explanations/)
  assert.doesNotMatch(stdout, /柯林斯英汉双解大词典/)
  assert.match(stdout, /Examples/)
  assert.match(stdout, /See more at/)
})

test('Should match as longer as possible', () => {
  const stdout = stripVTControlCharacters(execSync(`node ./bin.mjs exclusive -e`).toString('utf-8'))

  assert.match(stdout, /n. 独家新闻，独家报道/)
  assert.match(stdout, /Examples/)
  assert.match(stdout, /一些报社以为他们有一条独家报道。/)

  assert.doesNotMatch(stdout, /柯林斯英汉双解大词典 \[#\d\]/)
})

test('Should show all collins when -c=a is specified', () => {
  const stdout = execSync(`node ./bin.mjs than -c=a`).toString('utf-8')

  assert.match(stdout, /柯林斯英汉双解大词典 \[#\d\]/)
  assert.doesNotMatch(stdout, /\.\.\./)
})

test('Should show Usage when no word given', () => {
  const { stdout, stderr } = spawnSync(`node`, ['./bin.mjs'], { encoding: 'utf-8' })
  // console.log(' stdout, stderr :', { stdout, stderr })

  assert.match(stderr, /请输入需要查询的单词|Please input word to query/)
  assert.match(stdout, /Usage/)
  assert.match(stdout, /Options/)
})

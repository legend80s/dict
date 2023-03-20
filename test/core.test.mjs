import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';

test('Should show help', () => {
  const stdout = execSync(`node ./ -v`).toString('utf-8');

  assert.match(stdout, /ydd@\d/);
  assert.match(stdout, /> Explain English word in Chinese. 查询英文单词的中文释义。/);
  assert.match(stdout, /> Example:/);
  assert.match(stdout, /> \$ npx dict <word> \[-h --help -v --version --verbose -s --speak false -e --example false -c --collins 1\]/);
});

test('Should show explanations and without examples by default', () => {
  const stdout = execSync(`node ./ wonderful`).toString('utf-8');

  assert.doesNotMatch(stdout, /Word: "wonderful"/);
  assert.doesNotMatch(stdout, /Explanations/);
  assert.match(stdout, /💬 \x1B\[97madj. 绝妙的，令人惊叹的，极好的\x1B\[0m/);
  assert.doesNotMatch(stdout, /Examples/);
});

test('Should show explanations and examples and collins', () => {
  const stdout = execSync(`node ./ wonderful --example --collins`).toString('utf-8');

  assert.doesNotMatch(stdout, /Word: "wonderful"/);
  assert.match(stdout, /Explanations/);
  assert.match(stdout, /💬 \x1B\[97madj. 绝妙的，令人惊叹的，极好的\x1B\[0m/);

  assert.match(stdout, /柯林斯英汉双解大词典/);
  assert.match(stdout, /1\. ADJ/);
  assert.doesNotMatch(stdout, /2\. /);

  assert.match(stdout, /Examples/);
  // bold and underlined expected
  assert.match(stdout, /\x1B\[1m\x1B\[4mwonderful\x1B\[22m\x1B\[24m/);
  assert.match(stdout, /《牛津词典》/);
  assert.match(stdout, /See more at https:\/\/dict.youdao.com\/w\/wonderful\/#keyfrom=dict2.top/);
});

test('Should show 2 collins', () => {
  const stdout = execSync(`node ./ wonderful -c=2 --example`).toString('utf-8');

  assert.match(stdout, /柯林斯英汉双解大词典/);
  assert.match(stdout, /1\. ADJ/);
  assert.match(stdout, /2\./);
});

test('Should show word on verbose', () => {
  const stdout = execSync(`node ./ wonderful --verbose`).toString('utf-8');

  assert.match(stdout, /Word: "wonderful"/);
});

test('Should show Explanations only', () => {
  const stdout = execSync(`node ./ "wonderful girl"`).toString('utf-8');

  assert.doesNotMatch(stdout, /Word: "wonderful girl"/);
  assert.doesNotMatch(stdout, /Explanations/);
  assert.match(stdout, /美好的女孩/);
  assert.match(stdout, /See more at https:\/\/dict.youdao.com\/w\/wonderful%20girl\/#keyfrom=dict2.top/);
});

test('Should show suggested word when no explanations found', () => {
  const stdout = execSync(`node ./ dogfood`).toString('utf-8');

  assert.match(stdout, /你要找的是不是/);
  assert.match(stdout, /dogfooding/);
});

test('Should show Examples and collins', () => {
  const stdout = execSync(`node ./ router -e -c`).toString('utf-8');

  assert.match(stdout, /Explanations/);
  assert.match(stdout, /柯林斯英汉双解大词典/);
  assert.match(stdout, /1\. /);
  assert.match(stdout, /Examples/);
  assert.match(stdout, /See more at/);
});

test('Should show Examples without collins', () => {
  const stdout = execSync(`node ./ router -e`).toString('utf-8');

  assert.match(stdout, /Explanations/);
  assert.doesNotMatch(stdout, /柯林斯英汉双解大词典/);
  assert.doesNotMatch(stdout, /1\. /);
  assert.match(stdout, /Examples/);
  assert.match(stdout, /See more at/);
});

test('Should not show collins for word "sulfate"', () => {
  const stdout = execSync(`node ./ sulfate -e`).toString('utf-8');

  assert.match(stdout, /Explanations/);
  assert.doesNotMatch(stdout, /柯林斯英汉双解大词典/);
  assert.match(stdout, /Examples/);
  assert.match(stdout, /See more at/);
});

test('Should match as longer as possible', () => {
  const stdout = execSync(`node ./ exclusive -e`).toString('utf-8');

  assert.match(stdout, /n. 独家新闻，独家报道/);
  assert.match(stdout, /Examples/);
  assert.match(stdout, /一些报社以为他们有一条\x1B\[1m\x1B\[4m独家报道\x1B\[22m\x1B\[24m。/);

  assert.doesNotMatch(stdout, /柯林斯英汉双解大词典 \[#\d\]/);
});

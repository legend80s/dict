import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';

test('Should show explanations and without examples by default', (t) => {
  const stdout = execSync(`node ./ wonderful`).toString('utf-8');

  assert.doesNotMatch(stdout, /Word: "wonderful"/);
  assert.doesNotMatch(stdout, /Explanations:/);
  assert.match(stdout, /💬 \x1B\[97madj. 绝妙的，令人惊叹的，极好的\x1B\[0m/);
  assert.doesNotMatch(stdout, /Examples:/);
});

test('Should show explanations and examples', (t) => {
  const stdout = execSync(`node ./ wonderful --example`).toString('utf-8');

  assert.doesNotMatch(stdout, /Word: "wonderful"/);
  assert.match(stdout, /Explanations:/);
  assert.match(stdout, /💬 \x1B\[97madj. 绝妙的，令人惊叹的，极好的\x1B\[0m/);
  assert.match(stdout, /Examples:/);
  // bold and underlined expected
  assert.match(stdout, /\x1B\[1m\x1B\[4mwonderful\x1B\[22m\x1B\[24m/);
  assert.match(stdout, /《牛津词典》/);
  assert.match(stdout, /See more at https:\/\/dict.youdao.com\/w\/wonderful\/#keyfrom=dict2.top/);
});

test('Should show word on verbose', (t) => {
  const stdout = execSync(`node ./ wonderful --verbose`).toString('utf-8');

  assert.match(stdout, /Word: "wonderful"/);
});

test('Should show Explanations only', (t) => {
  const stdout = execSync(`node ./ "wonderful girl"`).toString('utf-8');

  assert.doesNotMatch(stdout, /Word: "wonderful girl"/);
  assert.doesNotMatch(stdout, /Explanations:/);
  assert.match(stdout, /美好的女孩/);
  assert.match(stdout, /See more at https:\/\/dict.youdao.com\/w\/wonderful%20girl\/#keyfrom=dict2.top/);
});

test('Should show suggested word when no explanations found', (t) => {
  const stdout = execSync(`node ./ dogfood`).toString('utf-8');

  assert.match(stdout, /你要找的是不是:/);
  assert.match(stdout, /dogfooding/);
});

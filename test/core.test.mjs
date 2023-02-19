import test from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';

test('show explanations and examples', (t) => {
  const stdout = execSync(`(node ./ wonderful)`).toString('utf-8');
  const expected = ``;

  assert.match(stdout, /Word: "wonderful"/);
  assert.match(stdout, /Explanations:/);
  assert.match(stdout, /💬 adj. 绝妙的，令人惊叹的，极好的/);
  assert.match(stdout, /Examples:/);
  assert.match(stdout, /Ben's a \x1B\[1mwonderful\x1B\[0m father\./);
  assert.match(stdout, /本是个极好的父亲。/);
  assert.match(stdout, /《牛津词典》/);
  assert.match(stdout, /The view is simply \x1B\[1mwonderful\x1B\[0m!/);
  assert.match(stdout, /景色美极了！/);
  assert.match(stdout, /'How \x1B\[1mwonderful\x1B\[0m!' she trilled\./);
  assert.match(stdout, /“太妙了！”她高兴地喊道。/);
  assert.match(stdout, /See more at https:\/\/dict.youdao.com\/w\/wonderful\/#keyfrom=dict2.top/);
});

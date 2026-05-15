import assert from 'node:assert'
import test from 'node:test'
import { parseCLIArgs } from '../src/utils/arg-parser.mjs'

test('default stream is true', () => {
  assert.strictEqual(parseCLIArgs(['hello'], {}).stream, true)
})

test('YDD_NO_STREAM=1 disables streaming', () => {
  assert.strictEqual(parseCLIArgs(['hello'], { YDD_NO_STREAM: '1' }).stream, false)
})

// 显式参数（命令行标志） > 环境变量 > 默认值
test('--stream overrides YDD_NO_STREAM', () => {
  assert.strictEqual(parseCLIArgs(['hello', '--stream'], { YDD_NO_STREAM: '1' }).stream, true)
})

test('--no-stream overrides empty env', () => {
  assert.strictEqual(parseCLIArgs(['hello', '--no-stream'], {}).stream, false)
})

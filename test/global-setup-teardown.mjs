import { after, before } from 'node:test'

// 测试禁止流式，否则时间会增加一倍
export function disableStream() {
  // v24 才支持 Global setup and teardown 故还是重复导入吧
  // https://nodejs.org/docs/latest/api/test.html#global-setup-and-teardown
  before(() => {
    console.log('before')
    process.env.YDD_NO_STREAM = '1'
  })

  after(() => {
    console.log('end')
    delete process.env.YDD_NO_STREAM
  })
}

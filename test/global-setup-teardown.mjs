import { after, before } from 'node:test'

// 测试禁止流式，否则时间会增加一倍
export function disableStream() {
  before(() => {
    console.log('before')
    process.env.YDD_NO_STREAM = '1'
  })

  after(() => {
    console.log('end')
    delete process.env.YDD_NO_STREAM
  })
}

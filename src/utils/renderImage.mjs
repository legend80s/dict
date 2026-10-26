import path from 'node:path'
import terminalImage from 'terminal-image'

const TIMEOUT = 1 * 1000

/**
 *
 * @param {string[]} pics
 * @returns {Promise<void>}
 */
export async function renderTheBestImage(pics) {
  // console.log('pics:', pics)
  if (!pics.length) {
    return console.error('<NO_PICS>')
  }
  // 第一种类型图片失败则尝试第二种类型图片 通过 extension 判断
  // const kinds = pics.length && console.log(`\n${await fetchRendererImage(pics[0])}`)

  const picsWithExt = pics.map(pic => ({ url: pic, ext: path.extname(pic.replace(/\?$/, '')) }))
  // console.log('picsWithExt:', picsWithExt)

  const { url: url1, ext: ext1 } = picsWithExt[0]

  const rendered1 = await fetchRendererImage(url1)

  // the first try is success
  if (rendered1.result !== null) {
    // console.debug('the first try is success')
    return printImage(rendered1.result)
  }

  // console.debug(
  //   'The first pic rendered failed. Try to render the second pic with different extension -',
  //   rendered1.error,
  // )
  if (!picsWithExt[1]) {
    return renderPicError(rendered1.error.message)
  }

  let pic2 = picsWithExt.find(pic => pic.ext !== ext1)

  if (pic2) {
    // console.debug('find a different extension pic')
  } else {
    pic2 = picsWithExt[1]
    // console.debug('no different extension pic, use the second pic')
  }

  const rendered2 = await fetchRendererImage(pic2.url)
  if (rendered2.result !== null) {
    printImage(rendered2.result)
  } else {
    return renderPicError(rendered2.error.message)
  }
}

/**
 * @param {string} message
 */
function renderPicError(message) {
  return console.error(`<PIC_ERR: ${message.split(' ').slice(0, 10).join(' ')}>`)
}

/**
 *
 * @param {String} imageStr
 */
function printImage(imageStr) {
  console.log(`\n${imageStr}`)
  // console.log('start')
  // console.log(`\n|${imageStr}|`)
  // console.log('end')
}

/**
 * @param {Parameters<typeof fetchRendererImageCore>[0]} url
 * @param {Parameters<typeof fetchRendererImageCore>[1]} options
 * @returns {Promise<{ result: string, error: null } | { result: null, error: Error }>}
 */
async function fetchRendererImage(url, options = { width: '50%' }) {
  try {
    return { result: await fetchRendererImageCore(url, options), error: null }
  } catch (err) {
    // Keep silent
    // console.error(error)
    const error = /** @type {Error} */ (err)
    return { result: null, error }
  }
}

/**
 *
 * @param {string} url
 * @param {Parameters<typeof terminalImage.buffer>[1]} [options]
 * @returns {Promise<string>}
 */
async function fetchRendererImageCore(url, options = { width: '50%' }) {
  // console.time(`fetch ${url}`)
  const body = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) }).then(resp => {
    // console.log("resp.status:", resp.status);
    // console.log("resp.status:", resp.headers);
    return resp.bytes()
  })
  // console.timeEnd(`fetch ${url}`)

  const renderedMosaic = await terminalImage.buffer(body, options)

  return renderedMosaic
}

if (import.meta.main) {
  const pics = [
    // 'https://ydlunacommon.nosdn.127.net/d6000199d1077ade98b628700fc0e448_NOT_FOUND.jpg?',
    'https://ydlunacommon.nosdn.127.net/d6000199d1077ade98b628700fc0e448.jpg?',
    'https://ydlunacommon-cdn.nosdn.127.net/19f5ad760de45f2cceb3e730e86116e5.jpg?',
    'https://ydlunacommon.nosdn.127.net/58f23c78f2cdaeec6f77832d8eedbda4.png?',
  ]

  renderTheBestImage(pics)
}

if (import.meta.main1) {
  const url =
    process.argv[2] || 'https://ydlunacommon.nosdn.127.net/feb81b1007ccf187cebfef2c82558ea0.png?'

  const renderedMosaic = await fetchRendererImage(url, {
    width: '20%',
  })

  // console.log(`--- DEBUG ---`)
  // console.log(!!renderedMosaic)
  // console.log(renderedMosaic.length, { renderedMosaic })
  // console.log(`|${renderedMosaic}|`)
  // console.log(`--- DEBUG ---`)

  console.log(renderedMosaic)
}

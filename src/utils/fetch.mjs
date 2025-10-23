/**
 * @typedef {Record<string, any>} IJSON
 */

/**
 * @template {'json' | 'text' | undefined} T
 * @param {string} url
 * @param {{ type?: T, method?: 'POST' | 'GET', body?: string | Record<string, any>, headers?: Record<string, string> }} [settings]
 * @returns {Promise<[T extends 'json' | undefined ? IJSON : string, method: 'fetch' | 'https']>}
 */
export async function fetchIt(
  url,
  { type = 'json', method = 'GET', body, headers = {} } = {},
) {
  const defaultHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  }
  headers = { ...defaultHeaders, ...headers }

  const asJSON = type === 'json'

  if (typeof fetch === 'function') {
    // html 391.83ms
    // json 175.426ms
    /** @param {Response} resp */
    const parse = resp => (asJSON ? resp.json() : resp.text())

    const init =
      method === 'GET'
        ? { headers }
        : { method, headers, body: transformRequestBody(body) }

    return [await fetch(url, init).then(parse), 'fetch']
  }

  /** @type {string | undefined} */
  let postData = ''

  if (body) {
    postData = transformRequestBody(body)
  }

  if (postData && !headers['Content-Length']) {
    headers['Content-Length'] = String(Buffer.byteLength(postData))
  }

  // 异步加载提高性能
  const https = await import('node:https')

  return new Promise((resolve, reject) => {
    const req = https
      .request(
        url,
        {
          method,
          headers,
        },
        res => {
          res.setEncoding('utf-8')
          let result = ''

          res.on('data', data => {
            result += data
          })

          res.on('end', () => {
            const parsed = asJSON ? JSON.parse(result) : result

            // console.log('parsed:', parsed);

            try {
              resolve([parsed, 'https'])
            } catch (error) {
              reject(error)
            }
          })
        },
      )
      .on('error', error => {
        reject(error)
      })

    if (postData) {
      req.write(postData)
    }

    req.end()
  })
}

/**
 * @param {undefined | string | Record<string, any>} body
 * @returns {undefined | string}
 */
function transformRequestBody(body) {
  if (!body) {
    return undefined
  }

  return typeof body === 'string' ? body : JSON.stringify(body)
}

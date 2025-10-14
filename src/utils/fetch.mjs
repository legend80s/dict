import https from 'node:https';

/**
 * @typedef {Record<string, any>} IJSON
 */

/**
 * @template {'json' | 'text' | undefined} T
 * @param {string} url
 * @param {{ type: T, method?: 'POST' | 'GET' }} [settings]
 * @returns {Promise<[T extends 'json' | undefined ? IJSON : string, method: string]>}
 */
export async function fetchIt(
  url,
  { type = 'json', method = 'GET', body, headers = {} } = {},
) {
  const asJSON = type === 'json';

  if (typeof fetch === 'function') {
    // html 391.83ms
    // json 175.426ms
    const parse = (resp) => (asJSON ? resp.json() : resp.text());

    return [await fetch(url, { method, headers, body }).then(parse), 'fetch'];
  }

  let postData = '';

  if (body) {
    postData = typeof body === 'string' ? body : JSON.stringify(body);
  }

  if (body && !headers['Content-Length']) {
    headers['Content-Length'] = Buffer.byteLength(postData);
  }

  return new Promise(function (resolve, reject) {
    const req = https
      .request(
        url,
        {
          method,
          headers,
        },
        function (res) {
          res.setEncoding('utf-8');
          let result = '';

          res.on('data', function (data) {
            result += data;
          });

          res.on('end', () => {
            const parsed = asJSON ? JSON.parse(result) : result;

            // console.log('parsed:', parsed);

            try {
              resolve([parsed, 'https']);
            } catch (error) {
              reject(error);
            }
          });
        },
      )
      .on('error', function (error) {
        reject(error);
      });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

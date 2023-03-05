import https from "node:https";

/**
 * @typedef {Record<string, any>} IJSON
 */

/**
 * @template {'json' | 'text' | undefined} T
 * @param {string} url
 * @param {{ type: T, method: 'POST' | 'GET' }} [settings]
 * @returns {Promise<[T extends 'json' | undefined ? IJSON : string, method: string]>}
 */
export async function fetchIt(url, {
  type = 'json',
  method = 'GET',
} = {}) {
  const asJSON = type === 'json';

  if (typeof fetch === 'function') {
    // html 391.83ms
    // json 175.426ms
    const parse = (resp) => asJSON ? resp.json() : resp.text();

    return [await fetch(url, { method }).then(parse), 'fetch']
  }

  return new Promise(function (resolve, reject) {
    (https[method] || https.get)(url, function (res) {
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
    }).on('error', function (error) {
      reject(error);
    });
  });
}

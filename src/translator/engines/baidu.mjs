import { fetchIt } from '../../utils/fetch.mjs';

/**
 * @param {string} query
 * @returns {Promise<string>}
 */
export function translate(query) {
  return fetchIt("https://fanyi.baidu.com/v2transapi?from=en&to=zh", {
    type: 'json',
    "headers": {
      "content-type": "application/x-www-form-urlencoded;",
      "cookie": "BAIDUID=203FABAEBC0ED8BC125002543A739551:FG=1",
    },
    "body": `from=en&to=zh&query=${decodeURIComponent(query)}&transtype=realtime&simple_means_flag=3&sign=${sign(query)}&token=919f77e781dc705c7861ccf34a9a52b8&domain=common`,
    "method": "POST"
  })
  .then(([resp, method]) => {

    if (resp.trans_result) {
      return resp.trans_result.data[0].dst;
    } else {
      console.error('translate failed with method', method, 'and error resp is', resp);

      return '';
    }
  })
  .catch(err => {
    console.log('err:', err);

    return '';
  });
}

// [test]
// translate('In reality, there are also implicit implementations of FnMut and FnOnce for Closure, but Fn is the “fundamental” one for this closure.').then((txt) => {
  // console.log('txt:', txt);
// });

// 54706.276099
// console.log(sign('hello'))

function sign(t) {
  // window.gtk
  const r = '320305.131321201'

  var o, i = t.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g);
  if (null === i) {
    var a = t.length;
    a > 30 && (t = "".concat(t.substr(0, 10)).concat(t.substr(Math.floor(a / 2) - 5, 10)).concat(t.substr(-10, 10)))
  }
  for (var d = "".concat(String.fromCharCode(103)).concat(String.fromCharCode(116)).concat(String.fromCharCode(107)), h = (null !== r ? r : (r = window[d] || "") || "").split("."), f = Number(h[0]) || 0, m = Number(h[1]) || 0, g = [], y = 0, v = 0; v < t.length; v++) {
    var _ = t.charCodeAt(v);
    _ < 128 ? g[y++] = _ : (_ < 2048 ? g[y++] = _ >> 6 | 192 : (55296 == (64512 & _) && v + 1 < t.length && 56320 == (64512 & t.charCodeAt(v + 1)) ? (_ = 65536 + ((1023 & _) << 10) + (1023 & t.charCodeAt(++v)),
    g[y++] = _ >> 18 | 240,
    g[y++] = _ >> 12 & 63 | 128) : g[y++] = _ >> 12 | 224,
    g[y++] = _ >> 6 & 63 | 128),
    g[y++] = 63 & _ | 128)
  }
  for (var b = f, w = "".concat(String.fromCharCode(43)).concat(String.fromCharCode(45)).concat(String.fromCharCode(97)) + "".concat(String.fromCharCode(94)).concat(String.fromCharCode(43)).concat(String.fromCharCode(54)), k = "".concat(String.fromCharCode(43)).concat(String.fromCharCode(45)).concat(String.fromCharCode(51)) + "".concat(String.fromCharCode(94)).concat(String.fromCharCode(43)).concat(String.fromCharCode(98)) + "".concat(String.fromCharCode(43)).concat(String.fromCharCode(45)).concat(String.fromCharCode(102)), x = 0; x < g.length; x++)
    b = n(b += g[x], w);
  return b = n(b, k),
  (b ^= m) < 0 && (b = 2147483648 + (2147483647 & b)),
  "".concat((b %= 1e6).toString(), ".").concat(b ^ f)
}

function n(t, e) {
  for (var n = 0; n < e.length - 2; n += 3) {
    var r = e.charAt(n + 2);
    r = "a" <= r ? r.charCodeAt(0) - 87 : Number(r),
    r = "+" === e.charAt(n + 1) ? t >>> r : t << r,
    t = "+" === e.charAt(n) ? t + r & 4294967295 : t ^ r
  }
  return t
}

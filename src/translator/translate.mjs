import {
  fetchIt
} from '../utils/fetch.mjs';
import {
  yandex
} from './engines/yandex.mjs';

export async function translate(text, {
  from = 'en',
  to = 'zh'
} = {}) {
  const keys = [
    'trnsl.1.1.20190525T222610Z.47a7d82b340b189e.59764ef074ae84f21bed0836d101d4743a754577',
    'trnsl.1.1.20151210T064521Z.49d5923fafda863b.54ad0755601ec5ffa1cf1d7fcd535070e8bf364b',
    'trnsl.1.1.20151210T064711Z.f1be63ab4d5c4b14.e853df997a4fe98cfd66a4802580e13826d37092',
    'trnsl.1.1.20151210T064838Z.d1f8d4197ddfb345.b2a66b108909e04a69cd3f6e50915009cb842291',
    'trnsl.1.1.20151210T064945Z.77ef80ce8a106ab1.daf8c79ae1dfec0475cb5e4c838931ab576101d8',
    'trnsl.1.1.20151210T065049Z.af1feee9785f377c.62d0f0fba442efabf213fd919ec03067234dc938',
    'trnsl.1.1.20151210T065153Z.eeb34f7bdd62a67d.b9e5c14e97836e69c16f12dda2dc7172f1f31e95',
  ];

  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];

    const {
      endpoint,
      options
    } = yandex.fetch({
      key,
      from,
      to,
      text,
    });

    // console.time('translate ' + index)

    // console.log(index);

    try {
      return await fetchIt(endpoint, options).then(yandex.parse)
    } catch (error) {
      if (index === keys.length - 1) {
        // console.error('max times retried', keys.length);
        throw error;
      }
    } finally {
      // console.timeEnd('translate ' + index)
    }
  }
}

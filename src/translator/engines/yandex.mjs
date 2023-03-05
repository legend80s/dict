export const yandex = {
  needKey: true,
  fetch: ({ key, from, to, text }) => ({
    endpoint: `https://translate.yandex.net/api/v1.5/tr.json/translate?key=${key}&lang=${from}-${to}&text=${encodeURIComponent(
      text
    )}`,
    options: { method: "POST", body: "", type: 'json' }
  }),
  parse: (result) => {
    const [body] = result;
    // console.log('result:', result);

    if (body.code !== 200) {
      throw new Error(body.message, { cause: body });
    }

    return body.text[0];
  }
};

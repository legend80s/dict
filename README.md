# ydd

![ydd-snapshot](assets/ydd-snapshot.png)

> `Y`ou`D`ao `D`ictionary

Explain English word in Chinese. 查询英文单词的中文释义。

A **Beautiful and Elegant** Dictionary for Programmers Who Prefer Terminals. 有道词典，致喜欢在终端工作的程序员。

## Usage

Query the meaning of "silhouette":

```shell
# Fast 🚀
pnpx ydd silhouette

# Super fast 🚀
bunx ydd silhouette
```

Or show more details with bilingual `e`xamples and `s`peak it out:

```shell
pnpx ydd vite -e -s
```

## Features

- **Light weight**: Zero dependencies.
- **Built with speed in mind**:
  - It's a CLI but not use commander or inquirer or yargs and chalk! Just native Node.js [`parseArgs`](https://nodejs.org/docs/latest/api/util.html#utilparseargsconfig).
  - No cheerio, node-html-parser or request library. Use Node.js `fetch` to request. And [vm](https://nodejs.org/docs/latest/api/vm.html) to evaluate script and use Robust regular expressions as fallback to parse when failed.
  - Instead of heavy renderer charmbracelet/glow, we use our own lightweight markdown render—yet the output still looks gorgeous.
- **Robust**: Use double source: script, HTML or openapi. Downgrade to `https.request` when `fetch` not supported.
- Speak 👄: `pnpx ydd vite --speak` (Macos only).

## TODO

- [x] Translate long sentence.

## Show your support ❤️

如果给你带来小小便捷不妨[一键三连 🍻！](https://github.com/legend80s/dict)

Give [a ⭐️](https://github.com/legend80s/dict) if this project helped you!

## Development

```shell
pnpm i
node index.mjs "word"
```

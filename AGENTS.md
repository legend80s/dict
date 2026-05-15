# AGENTS.md — ydd (YouDao Dictionary)

## Commands

```shell
pnpm i
node --test                          # all tests (Node built-in runner)
node --test --experimental-test-coverage
node --test test/core.test.translate.mjs       # single file
# single case: change `test(` to `test.only(`, then:
node --test-only test/core.test.translate.mjs
npx tsc --noEmit                     # type-check (JSDoc + tsconfig)
node ./bin.mjs -e -c=a "word"        # dev run
```

**Important**: `npm run lint` is a noop (`echo not lint yet`). Actual lint configs (`biome.json`, `.oxlintrc.json`) exist but must be invoked manually via `npx biome check` / `npx oxlint`. Preversion hook runs `npm test && npm run lint` (lint is silent).

## Test quirks

- All tests import `disableStream()` from `test/global-setup-teardown.mjs` — streaming adds 15ms/segment delay.
- Streaming can also be disabled via env var `YDD_NO_STREAM=1`.
- Random fuzz test (`core.test.random.mjs`) picks 5 words from a 789-word pool and runs `-e` against each.

## Architecture

```
bin.mjs           — CLI entry (shebang, routing)
index.mjs         — programmatic entry (re-exports dictionary)
typings.ts        — TS type definitions for the whole project
src/
  core.mjs        — query + ANSI-print orchestration
  config.mjs      — user config ~/ydd-data.js
  core/
    dictionary.mjs        — dispatcher: nuxt → html fallback
    lookup-by-nuxt-in-html.mjs  — primary: __NUXT__ JSON via node:vm
    lookup-by-html.mjs          — fallback: regex HTML parsing
    constants.mjs               — error msgs, i18n, defaults
  utils/
    arg-parser.mjs    — native parseArgs; shared `parsed` singleton
    fetch.mjs         — fetch() → https.request fallback
    lite-lodash.mjs   — ANSI styling, highlight, vm sandbox
    stream.mjs        — Intl.Segmenter word-by-word stream (15ms delay)
    fatigue.mjs, logger.mjs
  translator/
    index.mjs         — sentence translation (>3 words)
    engines/baidu.mjs — Baidu Translate with reverse-engineered sign()
```

## Routing logic

- `bin.mjs` → if word has >3 space-separated tokens → `translate()` (Baidu)
- Otherwise → `query()` (YouDao dictionary, dual lookup)

## Key facts

- **Zero prod dependencies** — ESM-only (type: module), `.mjs` files. Native `parseArgs`, `fetch`, `node:vm`.
- **Dual lookup**: nuxt (`__NUXT__` via sandboxed `node:vm`) → html (regex). `lookupMethod` var tracks which won.
- **Streaming**: on by default. Uses `Intl.Segmenter('zh-CN', { granularity: 'word' })` + 15ms delay.
- **`--speak`** only works on macOS (`say` command).
- **Release**: `npm version patch|minor|major` → preversion (test+lint) → postversion (publish+git push+tags).
- **Style**: space indent, 2 spaces, single quotes, no semicolons (biome.json). Arrow parens as-needed.

## User config

`~/ydd-data.js` — persists feature suggestion fatigue tracking (prevents over-prompting for `-e` / `-s` flags).

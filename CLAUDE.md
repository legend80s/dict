# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ydd (YouDao Dictionary) is a zero-dependency CLI tool that looks up English words in Chinese via the YouDao dictionary. It's published as `npx ydd <word>`.

## Commands

```shell
# Run all tests
node --test

# Run tests with coverage
node --test --experimental-test-coverage

# Run a single test file
node --test test/core.test.translate.mjs

# Run a single test case (add `test.only(...)` then:)
node --test-only test/core.test.translate.mjs

# Type-check all JS files (uses tsconfig.json)
npx tsc --noEmit

# Run locally during development
node ./bin.mjs -e -c=a "word"

# Release (auto-runs tests + lint via preversion)
npm run pub:patch  # or pub:minor, pub:major
```

## Architecture

```
bin.mjs               — CLI entry point (shebang, arg parsing, routing)
index.mjs             — Programmatic entry point (re-exports dictionary object)
typings.ts            — TypeScript type definitions for the whole project
src/
  core.mjs            — Query orchestrator: lookup + ANSI-styled terminal printing
  config.mjs          — User config (~/ydd-data.js) for fatigue/feature tracking
  core/
    dictionary.mjs    — Dispatcher: tries Nuxt-based lookup first, falls back to HTML regex
    lookup-by-nuxt-in-html.mjs  — Primary: fetches YouDao page, extracts __NUXT__ JSON via node:vm
    lookup-by-html.mjs           — Fallback: regex-based HTML parsing
    constants.mjs     — Error messages, i18n, config defaults
  utils/
    arg-parser.mjs    — CLI args via native node:util parseArgs
    fetch.mjs         — HTTP client: prefers fetch(), falls back to https.request
    lite-lodash.mjs   — ANSI styling (bold/green/red/etc), chunk, highlight, vm sandbox, timeit
    fatigue.mjs       — Feature suggestion with persistence to avoid over-prompting
    logger.mjs        — Debug logger factory (enabled by VERBOSE env var)
  translator/
    index.mjs         — Translation orchestrator for sentences (>3 words)
    engines/
      baidu.mjs       — Baidu Translate API engine with reverse-engineered sign()
test/
  core.test.mjs       — 11 integration tests (CLI output assertions)
  core.test.random.mjs — Random-word fuzz testing from 789-word pool
  core.test.translate.mjs — Translation tests
  lite-lodash.test.ts — Unit tests for utility functions
```

## Key Design Decisions

- **Zero production dependencies** — CLI uses native `parseArgs`, no commander/yargs. HTTP uses native `fetch`/`https.request`. No cheerio — data is extracted via `node:vm` sandbox or regex.
- **Dual lookup strategy** — Primary: extract `__NUXT__` JSON from the YouDao page HTML using `node:vm` in a sandbox. Fallback: regex-based HTML parsing. This ensures high availability.
- **Type-checked JS** — JSDoc type annotations (`// @ts-check`) with TypeScript checked via `tsconfig.json`. Type definitions live in `typings.ts` and are exported for consumers.
- **Release flow** — `npm version` triggers `preversion` (test + lint), then `postversion` (publish + git push + tags).

## Routing Logic

- Arguments parsed in `bin.mjs:parseArgv()`
- If word is >3 space-separated tokens → `translate()` (Baidu Translate API)
- Otherwise → `query()` (YouDao dictionary lookup)
- Query result is printed via ANSI-styled output in `core.mjs:print()`

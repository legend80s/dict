# ADR 0001: node:sqlite for flash card history storage

## Status

Accepted

## Context

The flash card feature needs persistent storage for:
- Query history (word, result data, query count, timestamps)
- Spaced repetition scheduling (SM-2 parameters per card)

The project has a strict **zero production dependencies** policy. The existing persistence mechanism (`~/ydd-data.js` via `module.exports` + `require()`) is a flat key-value store unsuitable for structured querying.

## Considered options

| Option | Runtime requirement | Dependencies | Notes |
|---|---|---|---|
| `node:sqlite` | Node 22.11+ with `--experimental-sqlite` | None | Built-in; experimental but API-stable |
| `better-sqlite3` | Node 18+ | 1 prod dep (native) | Mature, synchronous, widely used |
| JSON append-log (`~/.ydd/history.json`) | Any | None | Simple but no querying, no indexing, poor perf at scale |
| SQLite via `sql.js` | Any | 1 prod dep (pure JS) | Large bundle (~2MB), WASM overhead |

## Decision

Use `node:sqlite` (`--experimental-sqlite`).

## Rationale

- **Zero new dependencies** — aligns with the project's core constraint.
- **SQL querying** — enables sorting by `next_review_at`, counting due cards, filtering, etc.
- **Single-file database** — easy to back up, inspect, or delete.
- **SM-2 data integrity** — two related tables (cards + reviews) with foreign key constraint.
- **Experimental but stable enough** — `node:sqlite` has been available since Node 22.11 (Nov 2024) and the underlying SQLite API hasn't changed. The flag may become unnecessary in a future Node release.

## Consequences

- Users must run with `NODE_OPTIONS="--experimental-sqlite"` or upgrade to a Node version where the flag is unnecessary.
- If `node:sqlite` is unavailable, the CLI prints an actionable error message and exits.
- The `recordQueryToHistory` call in `core.mjs` is fire-and-forget — DB write failures are logged only in verbose mode and never block the query result.
- Future Node versions may drop the flag, making this invisible to users.

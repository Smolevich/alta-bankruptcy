# Coding standards

Applies to the site (`src/`, `scripts/`: Astro, TypeScript, plain JS) and the service (`backend/`:
Python 3.13). Ruff (`E F I UP B`, line 110) and `astro/tsconfigs/strict` catch the rest.

## Code

- Comments explain **why**, never what the next line does. No history in code: no dates, incident
  notes, PR numbers or "used to be X". That belongs in the commit message.
- Comments, docstrings, identifiers and log messages are in English. User-facing text lives in the
  i18n tables (`src/i18n.ts`, the `ru/en/sr` dicts in backend modules), not inline.
- Short functions that do one thing; keep logic pure and push I/O (database, network, files) to the
  edges, so the logic is testable without mocks.
- Names say what a thing is: `visit_date`, `branchHours`, not `d`, `data2`, `tmp`. No leading
  underscores in Python.
- Python: annotate arguments and return values; `X | None`, `list[str]`, `dict[str, int]`, `type
  Alias = …`; no `Optional`, `List`, or `from __future__ import annotations`.
- TypeScript: type exported functions and props of `.astro` components (`interface Props`); no `any`
  where a real type is known. Plain `.mjs` scripts stay untyped.
- Imports at the top of the file. An inline import only for a real cycle or a heavy optional
  module, with a comment saying which.
- No dead code, commented-out blocks or unused exports. Delete; git keeps it.
- Reuse what exists before writing a helper: `scrub_pii`, `richtext.sanitize`, `hash_ip`,
  `store.Store`, `src/i18n.ts`, `src/lib/*`. Two copies of one rule drift apart.
- Errors are not swallowed: no bare `except:`/`except Exception: pass`, no empty `catch {}`. Catch
  what you can handle, otherwise let it fail. A fallback (e.g. a missing AOD original) is deliberate
  and logged.
- No personal data in code, tests, fixtures or examples: invented values only
  (`Ivan Testov`, `test@example.com`).

## Tests

Tests follow the described behaviour. Every feature has a description of how it must work, in
`docs/`, `AGENTS.md` or the task; the test proves that it works exactly so: behaviour plus business
rules. Checking implementation is allowed when needed, but it is not the base.

- **One requirement line → one test that confirms it.** The test name states the rule:
  `test_branch_hidden_until_two_reports`, `'pages with robots noindex are left out of the sitemap'`.
- **User and API behaviour → end-to-end and functional tests** through real entry points:
  - backend: the app through Starlette's `TestClient` on a temporary `DATA_DIR`: a form accepts
    valid input and rejects bad input with the right status, rate limit and honeypot hold, public
    JSON matches its contract and never leaks `contact`/`ip_hash`, admin routes refuse without a
    token;
  - site: the build itself (`npm run check`), plus the CI checks on `dist/` (pages exist in three
    languages, sitemap, `llms.txt`, anchors, trusted domains, page size).
- **Complex logic → targeted unit tests, one per rule**: calculations (payout, stats, hours,
  distance), validation (`scrub_pii`, form parsing), i18n rules (`check-i18n`, heading ids). No
  duplicates: a unit test that repeats what an end-to-end test already proves is not added.
- **Mocks only at external boundaries**: network (bank sites, AOD, NBS, R2), clock, Cloudflare
  Access keys. Never mock our own functions; if a test needs that, extract a pure function.
- **Every bug gets a regression test** named after the rule it broke, written to fail before the
  fix.
- Before calling work done, run the whole suite, not only the new tests.

## Commands (same as CI)

```bash
npm ci
npm run check:i18n && npm run check:sources && npm run build
npm run check:sources -- --dist
node scripts/check-anchors.mjs dist
npm run test:scripts                    # node --test scripts/*.test.mjs

cd backend
uv sync --frozen
uv run --frozen ruff check src tests
uv run --frozen pytest -q
node --test tests/js/filters.test.js
```

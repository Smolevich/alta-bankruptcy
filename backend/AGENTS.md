# backend (alta-feedback) — notes for agents

`CLAUDE.md` is a symlink to this file: one source for Claude Code and Codex.

The service that serves alta.smolevich.com: the site built from the repository root plus the
forms below. It came from `Smolevich/alta-feedback` with its history; run every command
below from `backend/`.

Feedback forms for a public write-up about the Serbian bank ALTA: corrections to the
write-up (`/`) and anonymous "where did you open an account" reports (`/account`, stats at
`/account/stats`, JSON at `/api/accounts/public`). The repository is public. The forms
and pages are in Russian; issues and PRs may be in English, Serbian or Russian.

- Stack: Python 3.13, Starlette + Jinja, SQLite. Own scripts live in
  `src/alta_feedback/static/` — no libraries, no bundler. The one exception is the proposal text
  editor `static/richtext.js`: Tiptap (MIT) bundled from `editor/` (`cd editor && npm ci && npm run
  build`, pinned versions, output committed); its source is `editor/src/richtext.js`.
- Code: `main.py` routes and middleware, `accounts.py` account-report parsing and
  `scrub_pii`, `validate.py` correction form and IP hashing, `store.py` SQLite,
  `pow.py` ALTCHA-style proof-of-work, `stats.py` public stats, `branches.py` the bank
  branch directory (`data/branches.json`, rebuilt by `uv run scripts/build_branches.py`), `nbs.py`
  official National Bank of Serbia figures per bank in one collapsed block below the answers on the
  stats page, reported banks first (`data/nbs_banks.json`,
  quarter 2026Q2, computed from each bank's NBS balance sheet and income statement; a figure
  without an https `source_url` is not rendered); `aod_archive.py` our copy of the AOD PDFs the
  write-up links to (`data/aod_archive.json`, served at `/docs/aod/<name>`, checked daily);
  `proposals.py` material proposals from the working group at `/predlozheniya/` (ru/en/sr,
  noindex, public list without the author's contact; the text is formatted HTML from the editor,
  cleaned by `richtext.sanitize` on the way in and again on output) and their admin page
  `/predlozheniya/admin/` (`static/proposals-admin.js`; sign-in through Cloudflare Access, the
  service re-checks the Access JWT in `cf_access.py`, Bearer still works); `bank_forms.py` blank account-opening forms per bank and what the bank asks, a block below the
  answers on the stats page (`data/bank_forms.json`; the PDFs are the site's `public/docs/banks`,
  metadata stripped; an official form needs an https `source_url`).
  `casebook.py` the case catalogue («Мой кейс» tab of `/predlozheniya/`, admin under
  `/admin/proposals/cases`, public feed `/api/cases/public` for the site page `/kejsy/`) and
  `uploads.py` its photos/PDFs (type by magic bytes, Pillow re-encode without EXIF, HEIC → JPEG,
  `data/case-files/`, private until the admin publishes the case and its files; see `docs/ops.md`).
  `queues.py` visitors' queue marks for the Poštanska branch map on `/vyplata/` (`POST /api/queue`
  `{branch_id, state: none|few|full|outside, comment?}`, no personal data; one mark per branch per voter
  (`device_id` hash, otherwise IP hash) per 15 min and 60 per IP hash per hour; accepted from 1 h before opening until 1 h after closing (`PRE_OPEN`/`POST_CLOSE`, mirrored by `PRE_OPEN_MIN`/`POST_CLOSE_MIN` in `src/lib/branch-hours.mjs`), Belgrade time, per branch hours in
  `data/postanska_branch_hours.json` (otherwise 403 `{"error": "closed", "reports_from", "days_ahead", "weekday"}`).
  Anti-stuffing: the body may carry `device_id` (random, from the browser's localStorage; stored only as a
  salted hash in `voter`, otherwise `voter` is the IP hash) and `lat`/`lng` (sent only when the browser
  already has location permission). The server turns coordinates into `near` (≤ `NEAR_M` = 500 m from
  the branch, coordinates in `data/postanska_branch_coords.json`, a copy of
  `src/data/postanska-branches-extra.json` checked by a test) and never stores or logs them.
  `GET /api/queue` `{state, count, minutes_ago, sure}` per branch over the last 2 hours: people, not
  marks — only each voter's latest mark counts; if any voter was near, the state comes from near voters,
  otherwise from everyone; `sure` only when ≥ 2 different voters chose the shown state and at least one
  of them was near (the site shows «не точно» otherwise). The optional comment is scrubbed, kept for
  moderation and never published. `/admin/queue`: JSON with `source` (voter hash) and `near` for the
  monitors and the terminal; a browser (Accept: text/html, no token) gets a page (`static/queue-admin.js`,
  token in sessionStorage) with the last 2 hours grouped by source and «снять все отметки этого
  источника» → `POST /admin/queue/source/{source}/hide` (all its marks to `spam`). `voter` is wiped with
  `ip_hash` after 30 days).
  `cases.py` the «Что просили в вашем случае» block on the stats page: filter by account
  (personal / ИП / both at once — «both» counts in both) and residence permit; documents per bank
  counted in distinct people (IP hash, never rendered), opened-vs-refused split, official rules and
  collapsed chat criteria without numbers from `data/bank_criteria.json` (official rules need https).

```bash
uv sync
uv run pytest -q
uv run ruff check src tests
IP_SALT=dev ADMIN_TOKEN=dev uv run uvicorn --factory alta_feedback.main:create_app --port 8101
```

The database goes to `$DATA_DIR/feedback.db` (default `data/`).

## Rules

- **No personal data is stored.** No logins, raw IPs or contacts in account reports.
  Every free-text value of an account report (comment, custom bank/city/status/document/branch)
  goes through `accounts.scrub_pii` before it is written — a new text field without it is
  not accepted. Corrections (`/`) are not scrubbed: their optional `contact` is private
  and never published.
- **IP is only a salted hash.** It and the short User-Agent are wiped after 30 days
  (`TRACE_TTL`); the wipe runs lazily on the next submission of either form.
- **Public output is `accepted` reports only**, answer fields only
  (`PUBLIC_ACCOUNT_COLUMNS`) — no `ip_hash`, User-Agent or `created_at`. Corrections are
  never public.
- **No third-party scripts, fonts or trackers.** CSP is `default-src 'none'`; only
  `/account` adds `script-src 'self'` and `connect-src 'self'` (fresh PoW challenge), and
  `/account/stats` adds only `script-src 'self'` (`static/filters.js`: search lists and date fields;
  without JS the filters stay plain `<select>`/`<input type=date>`; `static/pdfview.js`: the PDF
  viewer) and `object-src`/`frame-src 'self'` for the bank forms in that viewer; `/predlozheniya/`
  adds `script-src 'self'` for the text editor. The pure search logic of `filters.js` is tested
  with `node --test tests/js/filters.test.js`.
- **Formatted text only through `richtext.sanitize`.** Allowed: p, br, strong, em, h2, h3, ul, ol,
  li, blockquote, a (http/https `href` only, our `rel`). Stored text is already cleaned and is cleaned
  again before rendering; never mark proposal text safe any other way.
- **A test for every behaviour and a regression test for every bug**; pytest tests
  behaviour, not implementation.
- **Deploy only through CI** (push to `main`), no manual changes on the server. No secrets
  or server addresses in the repository — they live in GitHub secrets and variables.
- Light theme always; page texts in plain Russian. Code comments and UI strings stay in
  Russian.

What is stored and why — `README.md`; moderation and deploy — `docs/ops.md`; decisions —
`docs/decisions.md`.

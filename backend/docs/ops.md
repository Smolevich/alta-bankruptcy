# Operations

## Links for the buttons on the write-up page

```
https://alta.smolevich.com/?s=<section id>&t=<section title, urlencoded>
https://alta.smolevich.com/account
https://alta.smolevich.com/account/stats
```

`s` is the id from `<h2 id="…">` (letters, digits, `_`, `-`, up to 40 characters;
anything else is dropped), `t` prefills the "Section" field, which the person can edit.
Links open in a new tab (`target="_blank" rel="noopener"`): the write-up lives in an
iframe and cannot send requests here itself.

## Moderation

Everything under `/admin/` requires the `ADMIN_TOKEN` (header
`Authorization: Bearer …`); `/admin/proposals` and the proposals admin page are also behind
Cloudflare Access (see «Admin page» below), so from the terminal only `/admin/suggestions` and
`/admin/accounts` are reachable with the token alone — the monitors use exactly those. Keep the token out of argv — curl reads the header from stdin:

```bash
# corrections; since — ISO in UTC, strictly after; status=new — not yet reviewed
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | curl -fsS -H @- \
  'https://alta.smolevich.com/admin/suggestions?since=2026-10-31T00:00:00Z&status=new' | jq

# account reports
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | curl -fsS -H @- \
  'https://alta.smolevich.com/admin/accounts?status=new' | jq

# change status: new, accepted, rejected, test, spam
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | curl -fsS -H @- \
  -H 'Content-Type: application/json' -d '{"status":"accepted"}' \
  https://alta.smolevich.com/admin/accounts/7/status
```

A list response is `{"count": N, "items": [...]}`, ascending by `id`, up to 500 at a time.

- Correction: `{id, created_at, section_id, section_title, text, source, contact, ip_hash,
  user_agent_short, status}`. `contact` is never published — the form promises that.
- Report: `{id, created_at, bank, city, account_type, result, visit_date, residency,
  documents, comment, ip_hash, user_agent_short, status, branch}`. `account_type` is `personal`, `entrepreneur`
  or `both` (applied for both in one visit; the stats count it as personal and as ИП). `branch` is `null` for
  reports sent before the field existed and when the person left it empty or chose
  «Не помню / не важно».

Only reports with status `accepted` make it into the stats and the public JSON.

## Material proposals (`/predlozheniya/`)

The working group suggests texts for the site and the `@altabank_closed` channel at
`https://alta.smolevich.com/predlozheniya/` (also `/en/predlozheniya/`, `/sr/predlozheniya/`). The
page is not in the menu or the sitemap and is sent with `noindex, nofollow` (meta and
`X-Robots-Tag`). It shows every proposal except `spam`: title, date, target, status, the editor's
links and comment; the text, document link and sources are collapsed. The author's name/contact
is never shown there — only in the admin API and the admin page.

**Formatted text.** The text field is a Tiptap editor (bold, italic, H2/H3, lists, quote, links);
without JavaScript it stays a plain textarea and the text becomes paragraphs. The server keeps only
p, br, strong, em, h2, h3, ul, ol, li, blockquote and a with an http(s) link (`richtext.py`, stdlib
`html.parser`: nh3 would change `pyproject.toml`/`uv.lock`, which need a CODEOWNERS review), and
counts the 50 000 limit in visible characters. Older proposals keep plain text (`text_format` empty).
Rebuilding the editor bundle: `cd backend/editor && npm ci && npm run build` (writes
`src/alta_feedback/static/richtext.js`; commit it).

**Admin page:** `https://alta.smolevich.com/predlozheniya/admin/` — sign in through Cloudflare
Access (the Access login page, one-time code to the admin's email; the session lasts 24 hours).
There is no token field. Filter by status, new count, and per proposal: status, review link,
publication link, editor comment, "Сохранить"; below, "Текст для публикации" — "Править текст" opens
the same editor over the editor's copy (`edited_text`), "Вернуть текст автора" clears it. The public
page shows `edited_text` when it is set; the author's text stays unchanged in `text`. «Выйти» ends the Access session.

How the sign-in works:

- The Access application `alta-admin` (Zero Trust → Access → Applications) covers only
  `alta.smolevich.com/predlozheniya/admin` and `alta.smolevich.com/admin/proposals` (with
  everything below them). The rest of the site, the forms and `/admin/suggestions`,
  `/admin/accounts` stay outside Access — the cloudflared ingress does not use Access for this host.
- Behind Access the service checks the `Cf-Access-Jwt-Assertion` header itself (`cf_access.py`):
  RS256 signature against the team keys (`https://<team>/cdn-cgi/access/certs`, cached for an hour,
  re-read on a new key id), `aud` of `alta-admin`, issuer, expiry, and the email in its own admin
  list. Settings: `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ADMIN_EMAILS` (comma-separated) —
  defaults in `cf_access.DEFAULTS` (not secrets), an environment variable in `.env` overrides one.
  An empty value turns the Access path off: only the Bearer token works and the admin page shows
  the token field again.
- The Bearer token keeps working for `/admin/proposals` when a request gets past Access.

**Add an admin** — two places, both needed:

1. Email into the `allow-owner` policy of the `alta-admin` Access application (dashboard, or API
   with the `cloudflare-family-cli` token: `PUT /accounts/<acc>/access/apps/<id>` with the whole
   application body — `PATCH` is not supported).
2. The same email into `ADMIN_EMAILS` in `cf_access.DEFAULTS` (comma-separated), PR → `main` →
   the backend deploy picks it up.

Removing an admin is the reverse; removing them from the Access policy alone already locks them
out.

**From the terminal** — the token from Vault (`secret/alta-feedback/admin_token`, field `token`),
never printed. Vault listens only on the server, so it is read over ssh with the Vault token on
stdin (the way `docs/secrets.md` of pet-projects describes). Since `/admin/proposals` is behind
Access, from outside these calls go to the service directly on the server
(`ssh bot-server` and `http://127.0.0.1:8102`), or through the admin page:

```bash
RT=$(security find-generic-password -s vault-hetzner-root-token -w)
ADMIN_TOKEN=$(printf '%s' "$RT" | ssh -o ClearAllForwardings=yes bot-server '
  IFS= read -r VAULT_TOKEN; export VAULT_TOKEN VAULT_ADDR=http://127.0.0.1:8200
  vault kv get -field=token secret/alta-feedback/admin_token'); unset RT

# new proposals (status: new, in_review, needs_changes, approved, published, rejected, spam)
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | ssh -o ClearAllForwardings=yes bot-server \
  'curl -fsS -H @- "http://127.0.0.1:8102/admin/proposals?status=new"' | jq

# change status, links and comment — any subset of the fields; "" clears a link or the comment
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | ssh -o ClearAllForwardings=yes bot-server \
  'curl -fsS -H @- -H "Content-Type: application/json" \
     -d "{\"status\":\"needs_changes\",\"comment\":\"Нужна ссылка на закон\"}" \
     http://127.0.0.1:8102/admin/proposals/12'

# remove for good (test entries); "spam" hides it from the list instead
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | ssh -o ClearAllForwardings=yes bot-server \
  'curl -fsS -H @- -X DELETE http://127.0.0.1:8102/admin/proposals/12'
```

An item: `{id, created_at, title, text, doc_url, sources: [...], target: site|channel|both,
contact, ip_hash, user_agent_short, status, review_url, published_url, comment, updated_at,
text_format, edited_text, text_html}` (`text_html` — the author's text as cleaned HTML). The POST also
takes `edited_text` (HTML, cleaned; `""` returns to the author's text).
`since` works as for the other lists. The form needs only a text up to 50 000 characters
or a document link (`https://` is added if missing). The title is optional (the start of the text is
used), the target defaults to `both`, sources are optional free text up to 20 000 characters in
total (split into lines/links only for display); the same rate limit
(5 an hour per IP hash) and honeypot as the correction form.

## Cases ("Картотека кейсов")

The proposals page has two tabs: «Материал» (`/predlozheniya/`) and «Мой кейс»
(`/predlozheniya/?type=case`, also `/en/…`, `/sr/…`). The case form posts multipart to
`/predlozheniya/case` and is protected like `/account`: honeypot, the proof-of-work checkbox
(`static/pow.js`, captions on the page language), 5 cases an hour per IP hash, plus a separate limit
of 30 files an hour per IP hash. Sources are optional for a case (required for a material). A
request without `Content-Length` gets 411, a body over 42 MB gets 413.

Files: up to 10 per case, each up to 10 MB, 40 MB together; JPG, PNG, HEIC or PDF by their first
bytes. Images are decoded and saved again with Pillow (EXIF and tails dropped, HEIC → JPEG, long
side ≤ 2560 px, ≤ 60 Mpx); a PDF is kept as is (it needs `%PDF-` and `%%EOF`) and is only ever served
as a download. They are written to `$DATA_DIR/case-files/<24 hex>.<ext>`; uploads stop when the disk
has less than 3 GB free or the folder reaches 5 GB (the form asks to send the case without files).

Visibility: `status` is `new`, `accepted`, `rejected`, `test` or `spam`; `published` puts an accepted
case into the feed; `files_published` additionally shows its photos/PDFs there. Until both apply a
file is served only by the admin route, which is behind Access like the rest of `/admin/proposals`.
`/api/cases/files/<name>` answers 404 otherwise and sends `Cache-Control: no-cache`, so Cloudflare
does not keep an unpublished file.

The admin page `/predlozheniya/admin/?type=case` (or the «Тип» switch) shows category, texts,
contact, previews of the files (fetched with the same sign-in), status, both flags, the author's
link (clear it to hide it) and a private comment; «Удалить» removes the case with its files.

```bash
# list (statuses as above), then mark a test entry
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | ssh -o ClearAllForwardings=yes bot-server \
  'curl -fsS -H @- "http://127.0.0.1:8102/admin/proposals/cases?status=new"' | jq
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | ssh -o ClearAllForwardings=yes bot-server \
  'curl -fsS -H @- -H "Content-Type: application/json" -d "{\"status\":\"test\"}" \
     http://127.0.0.1:8102/admin/proposals/cases/1'
```

An item: `{id, created_at, category, summary, filed, result, event_date, sources, own_url, contact,
ip_hash, user_agent_short, status, published, files_published, comment, updated_at,
files: [{case_id, name, kind, bytes}]}`. The POST takes any subset of `status`, `published`,
`files_published` (booleans), `own_url`, `comment`.

Public feed: `GET /api/cases/public` — accepted and published only, newest event first, up to 500:
`{count, items: [{id, category, summary, filed, result, date, source_url, own_url,
files: [{url, kind}]}], labels: {category: {ru, en, sr}}}`. The site page `/kejsy/` (ru/en/sr)
reads it in the browser and shows «Подтверждено источником» when `source_url` is set, otherwise
«Личный опыт».

Backup: `feedback.db` is in the nightly bot backup; the files are not, so `alta-aod-check.service`
runs `python -m alta_feedback.uploads` after the AOD check and writes
`/var/backups/bots/alta-cases/<date>.tar.gz` when the folder changed (adding or deleting a file
changes it), refreshing the previous tar otherwise. A deleted file stays in older tars until they
are rotated.

## Public JSON

`GET /api/accounts/public` — no token, `accepted` only, most recent visits first, up to
2000. Optional `limit` (1–2000) and `cursor` page through the rest: with either of them the
response also has `next_cursor` (`<visit_date>_<id>` of the last item, `null` on the last page),
passed back as `cursor`. A broken cursor starts from the top. Without them the response is the
same as before:

```json
{"count": 1,
 "items": [{"id": 7, "visit_date": "2026-10-31", "bank": "OTP banka", "city": "Нови-Сад",
            "account_type": "entrepreneur", "result": "refused", "residency": "boravak",
            "documents": ["passport", "apr", "Справка из налоговой"], "comment": "…"}],
 "labels": {"account_type": {…}, "result": {…}, "residency": {…}, "documents": {…}}}
```

`branch` is shown only if at least two accepted reports name that branch of that bank (counted
over all accepted reports, not the page), otherwise it is `null` (the same rule as the stats page). `bank` and `city` are display names; `account_type`, `result`, `residency`, `documents`
are codes with captions in `labels`. `residency` and `documents` may also hold the
person's own text if they entered a value outside the list.

## Branch directory

`src/alta_feedback/data/branches.json` — branches of every bank in the form, taken only from
the banks' own sites (branch-locator JSON, page or PDF; never Google Maps). Each bank has
`source`, `collected_at`, `status` and `branches: [{city, name, address}]`. Rebuild:

```bash
uv run scripts/build_branches.py            # all banks
uv run scripts/build_branches.py otp erste  # only these
```

If a bank's site fails, the bank keeps its previous list and date; a bank with no list gets
`status: "unavailable"` and the form offers only free text for it. The form asks
`/account/branches?bank=…&city=…` for hints of that bank in that city. The file lives in the
package, not in `data/`: `data/` is the database directory and the deploy copies only `src/`.

## AOD PDF archive

The write-up shows PDFs from www.aod.rs (quarterly bankruptcy reports, the AOD monograph, legal
framework) from our own copy, so they stay readable if AOD takes them down. The list is
`src/alta_feedback/data/aod_archive.json` (`name`, original `url`, `public`, `sha256`, `bytes`,
`fetched`); the site build (`src/data/pdfs.ts` at the repository root) reads the same file.

- On the server: `/opt/alta-feedback/data/aod/` — `public/` is served at `/docs/aod/<name>` (ETag,
  Range, one day of cache); `private/` holds documents with lists of private creditors (AOD's
  distribution notices, the 2014 Official Gazette page) and is never served — the site links to AOD
  for those; `versions/<name>-<date>.pdf` keeps an original that changed after our copy.
- `alta-aod-check.timer` (03:20 UTC) runs `python -m alta_feedback.aod_archive`: downloads missing
  copies, compares every original with what we have, saves a changed one beside it, appends a line to
  `data/aod/check.log` and prints a summary to the journal
  (`journalctl -u alta-aod-check --since today`). An unavailable original is not a failure: the site
  keeps serving our copy. There is no alert yet — the log is the report.
- While a public copy is missing (before the first run), `/docs/aod/<name>` redirects to the original.
- Backup: each run writes `/var/backups/bots/alta-aod/<date>.tar.gz` when the archive changed and
  refreshes the previous one otherwise; the nightly `hetzner-offsite-backup` copies it to R2
  (encrypted), and the weekly backup check verifies it.
- The site keeps showing the copy from the manifest. To switch to a newer version, replace the file
  in the manifest (new `sha256`/`bytes`/`fetched`).

## Deploy

`.github/workflows/deploy-backend.yml` at the repository root, on push to `main` that touches
`backend/` (and manually): tests and lint → copy to the server over Tailscale → `uv sync` → restart
`alta-bankruptcy.service` (`127.0.0.1:8102`) → check `/healthz` and the pages. The deploy reads
`ADMIN_TOKEN` and `IP_SALT` from Vault (AppRole; paths in the repository variables `VAULT_*`) and
writes them to `.env` next to the app; if the read fails, the previous values are kept. The Access
settings have defaults in the code (`cf_access.DEFAULTS`).
The move from `Smolevich/alta-feedback`, the traffic switch and the rollback are in `docs/deploy.md`
at the repository root.

- **Do not change the salt without a reason:** every IP hash changes with it and the rate
  limit resets.

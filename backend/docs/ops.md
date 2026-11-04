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
`Authorization: Bearer …`). Keep the token out of argv — curl reads the header from stdin:

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

**Admin page:** `https://alta.smolevich.com/predlozheniya/admin/` — paste the admin token; it stays
in that tab's `sessionStorage` and goes only into the `Authorization` header. Filter by status,
new count, and per proposal: status, review link, publication link, editor comment, "Сохранить".

**From the terminal** — the token from Vault (`secret/alta-feedback/admin_token`, field `token`),
never printed. Vault listens only on the server, so it is read over ssh with the Vault token on
stdin (the way `docs/secrets.md` of pet-projects describes):

```bash
RT=$(security find-generic-password -s vault-hetzner-root-token -w)
ADMIN_TOKEN=$(printf '%s' "$RT" | ssh -o ClearAllForwardings=yes bot-server '
  IFS= read -r VAULT_TOKEN; export VAULT_TOKEN VAULT_ADDR=http://127.0.0.1:8200
  vault kv get -field=token secret/alta-feedback/admin_token'); unset RT

# new proposals (status: new, in_review, needs_changes, approved, published, rejected, spam)
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | curl -fsS -H @- \
  'https://alta.smolevich.com/admin/proposals?status=new' | jq

# change status, links and comment — any subset of the fields; "" clears a link or the comment
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | curl -fsS -H @- \
  -H 'Content-Type: application/json' \
  -d '{"status":"needs_changes","review_url":"https://docs.google.com/document/d/…","comment":"Нужна ссылка на закон"}' \
  https://alta.smolevich.com/admin/proposals/12

# remove for good (test entries); "spam" hides it from the list instead
printf 'Authorization: Bearer %s\n' "$ADMIN_TOKEN" | curl -fsS -H @- -X DELETE \
  https://alta.smolevich.com/admin/proposals/12
```

An item: `{id, created_at, title, text, doc_url, sources: [...], target: site|channel|both,
contact, ip_hash, user_agent_short, status, review_url, published_url, comment, updated_at}`.
`since` works as for the other lists. The form takes a title, a text up to 20 000 characters
and/or a document link, at least one source (one per line) and the target; the same rate limit
(5 an hour per IP hash) and honeypot as the correction form.

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
writes them to `.env` next to the app; if the read fails, the previous values are kept.
The move from `Smolevich/alta-feedback`, the traffic switch and the rollback are in `docs/deploy.md`
at the repository root.

- **Do not change the salt without a reason:** every IP hash changes with it and the rate
  limit resets.

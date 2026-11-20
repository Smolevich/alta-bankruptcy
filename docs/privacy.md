# Data the site collects

Principle: the site does not collect personal data. It needs no account, sets no cookies of its own
and shows no ads. What it cannot avoid for spam protection is listed below. Every statement here
follows the code; when the code changes, this file changes in the same PR.

Code: `backend/src/alta_feedback/` (`store.py` holds the schema, `main.py` the handlers).

## Forms

All forms are served by the backend and write to one SQLite database, `feedback.db`.

| Form | Where | Stored | Public |
|---|---|---|---|
| Correction | `/?s=…` (button «Предложить правку») | section, text, source, optional `contact` | nothing; read by moderators |
| Account report | `/account` | bank, city, branch, account type, result, visit date, residency, documents, comment | accepted reports on `/account/stats` and `/api/accounts/public`; a branch only from two reports up |
| Material proposal | `/predlozheniya/` | title, text, document link, sources, target, optional `contact` | everything except `contact`, on the unindexed `/predlozheniya/` page |
| Case | `/predlozheniya/?type=case` | category, summary, what was filed, result, date, sources, own link, optional `contact`, up to 10 files (JPG/PNG/HEIC/PDF) | accepted and published cases in `/api/cases/public`; files only when the moderator also publishes them |
| Queue mark | Poštanska branch map (`/api/queue`) | branch, one of four states, comment, «near the branch» yes/no | aggregated counts per branch |

Free-text fields of account reports, queue marks and cases pass through `scrub_pii`
(`accounts.py`): anything that looks like an email, phone, JMBG, account or passport number is
replaced with «[скрыто]» before it is saved. Correction and proposal texts are stored as typed.

`contact` is an optional free-text field («name or handle for contact»). It is never published and
is shown only to moderators.

Case files: images are decoded and re-encoded (EXIF and trailing data dropped, HEIC → JPEG); PDFs are
kept as they are. Files live in `$DATA_DIR/case-files/` and are served publicly only after the
moderator sets both `published` and `files_published`.

Queue marks: if the person allows geolocation, the browser sends coordinates; the server only
computes whether they are within 500 m of the branch (`queues.near_branch`) and stores that yes/no,
never the coordinates.

## Technical traces

Every submission also stores:

- `ip_hash`: the first 32 hex characters of `sha256("<IP_SALT>:<IP>")`. The IP comes from
  Cloudflare's `CF-Connecting-IP`. `IP_SALT` is a secret from Vault; the IP itself is not stored.
  Purpose: rate limit (5 submissions an hour per form, 60 queue marks and 30 case files an hour) and counting people
  rather than submissions in the stats.
- `user_agent_short`: the first 120 characters of the `User-Agent` header. Purpose: sorting out a
  spam wave.
- queue marks only, `voter`: a salted hash of a random `device_id` the page keeps in the browser's
  `localStorage` (or the IP hash without one), so one person counts once.

Retention: `ip_hash`, `user_agent_short` and `voter` are wiped from rows older than 30 days
(`TRACE_TTL`, `Store.forget_old_traces`). The wipe runs on the next submission of any form, not on a
timer.

Logs: uvicorn runs with `--no-access-log`, so the service writes no request lines with IPs.

Proof-of-work check («I'm not a robot»): the challenge is embedded in the page and signed by the
server; no cookies or third-party requests. Used challenges are kept until they expire, to stop
reuse.

## Analytics

Every page loads Cloudflare Web Analytics (`static.cloudflareinsights.com/beacon.min.js`, token in
`astro.config.mjs` and `templates/base.html`). It sets no cookies and reports page views and
performance to Cloudflare. There is no Google Analytics or other counter.

Cloudflare proxies all traffic and therefore sees visitors' IP addresses under its own terms; the
site does not receive those logs.

## Browser-only features

The payout calculator, the document editor and the checklists keep their data in the browser
(`localStorage`) and send nothing. Voice input uses the browser's Web Speech API: the audio goes to
the browser vendor's recogniser (Google for Chrome, Apple for Safari), which the form states under
the button.

## Who has access

- Moderators: the admin API with `ADMIN_TOKEN` (corrections, account reports, queue marks) and the
  admin pages behind Cloudflare Access for addresses in `ADMIN_EMAILS` (proposals, cases). They see
  `contact`, `ip_hash` and `user_agent_short`.
- Server administrators: the database on the server and its backups. `feedback.db` is in the nightly
  bot backup to R2; case files and the AOD archive have their own tar backups
  (`/var/backups/bots/alta-cases`, `/var/backups/bots/alta-aod`). Backups keep the rows as they were
  on the backup date, including traces not yet wiped; their rotation is set in the `infra` repo.

## Serbian law and GDPR

The site falls under the Serbian Law on Personal Data Protection (Zakon o zaštiti podataka o
ličnosti, modelled on GDPR) and, for visitors from the EU, GDPR. In plain terms:

- Most forms ask for no personal data; the optional `contact` and case files are given voluntarily,
  for the stated purpose.
- The IP hash is pseudonymous data, not anonymous: with the salt it can be matched to a known IP.
  It is kept only for spam protection and counting people, and wiped after 30 days.
- A person can ask for their submission to be deleted; moderators can delete proposals and cases
  through the admin API, and set any entry to `spam` or `rejected`.

This file describes what the code does. It is not a legal opinion, and the site makes no promises
beyond it.

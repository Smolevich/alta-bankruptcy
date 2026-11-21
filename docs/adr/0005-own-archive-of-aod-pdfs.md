# 5. Keep our own copy of AOD PDFs and check the originals daily

- Status: Accepted
- Date: 2026-11-03

## Context

The site cites documents from the AOD site. The module docstring of `aod_archive.py` gives the reason:
documents should not vanish with the AOD site.

## Decision

- AOD PDFs are shown from our own address `/docs/aod/<name>`; the on-site viewer opens every PDF
  source (#34, #35).
- The timer `alta-aod-check` (daily, 03:20 UTC) compares the copy with the original, downloads what
  is missing, stores a changed original as a dated version and keeps serving the first copy
  (`backend/deploy/`, #43).
- Documents listing private-person creditors are stored privately and never served.
- The archive is included in the nightly bot backups (`backend/deploy/alta-aod-check.service`).

## Consequences

- Sources stay readable if the original changes or disappears; changes are kept as versions.
- The check uses plain HTTP downloads of a fixed manifest (`aod_archive.json`); it does not scrape
  news.

## Links

- #34, #35, #43; `backend/src/alta_feedback/aod_archive.py`.

# 7. CI fails when `/vyplata/` reaches 420,000 bytes

- Status: Accepted
- Date: 2026-11-11

## Context

The payout page `/vyplata/` served 650-700 KB of HTML, mostly 42 per-branch busyness charts rendered as
inline SVG twice (#176).

## Decision

- The charts are drawn in the browser from data attributes; without JS the list keeps a text line (#176).
- CI checks that `dist/vyplata/index.html` in ru, en and sr is smaller than a fixed limit. The
  limit was 389,120 bytes and was raised to 420,000 in #215 because content growth left no room for
  text edits (ru was 33 bytes below the old limit).
- The limit is a regression guard against the inline SVG coming back, not a performance budget (#215).

## Consequences

- A larger page needs a deliberate change of the number in `ci.yml`.
- Shrinking the page itself (branch list and map JSON are about 196 KB) is left as a follow-up (#215).

## Links

- #176, #215; `.github/workflows/ci.yml`.

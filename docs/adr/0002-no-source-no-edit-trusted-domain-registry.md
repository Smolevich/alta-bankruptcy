# 2. No source, no edit: source levels and a trusted-domain registry checked in CI

- Status: Accepted
- Date: 2026-11-01

## Context

Depositors act on the figures and deadlines on the site. In #120 the stated risk is a look-alike
domain slipped into a PR (for example a Cyrillic "a" in `aod.rs`) that would send depositors to a scam
page; a reviewer cannot be expected to spot one wrong letter by eye.

## Decision

- Every page and news item carries `sources` (title, url, kind, date) and `checked` in its frontmatter;
  the build fails without them. Kinds: `official`, `reference`, `own`, `reliable_media`, `unverified`.
  A claim without an official source appears only with a visible mark; guesses never.
- External links may only go to domains listed in `src/data/trusted-domains.yaml`, each with `name`
  and `proof`; https only (one court site without https is listed as an exception), no shorteners,
  punycode, ports or `user@`. CI checks sources and the built
  `dist` (`npm run check:sources`, with `--dist`).
- Source kind is limited by domain category: `official` only for government bodies, courts, banks;
  `reference` and `reliable_media` only on matching categories (#128).
- The registry is under CODEOWNERS, so a new domain is reviewed separately from the link to it.
- Every external source gets a backup copy (PDF in `public/docs/` or an archive snapshot).

## Consequences

- Adding a new source domain is a two-step change with owner review.
- Legitimate new sources (for example `nbrm.mk`, #223) need a registry entry first.

## Links

- Initial commit d25c7b6 (schema); #120, #128, #223; `CONTRIBUTING.md`, `AGENTS.md`.

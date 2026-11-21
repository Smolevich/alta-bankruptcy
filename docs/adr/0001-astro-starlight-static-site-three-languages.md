# 1. Static Astro + Starlight site in three languages with a translation check

- Status: Proposed (reason for choosing Astro/Starlight is not recorded)
- Date: 2026-11-01

## Context

The site is a reference for depositors of ALTA banka, written in Russian (default), English and
Serbian (Latin). Content is edited by maintainers and outside contributors, partly through the GitHub
web editor (`CONTRIBUTING.md`).

## Decision

The site is built with Astro and Starlight from Markdown files in `src/content/` (ru at the root,
`en/`, `sr/`). Frontmatter is validated by a schema (`src/content.config.ts`). CI runs
`npm run check:i18n`, which fails when a page or news item is missing in one language or when
`sources` and external links differ between languages. Anchors are short ASCII and identical across
languages (see `src/heading-ids.mjs`); the build fails if heading counts differ.

## Consequences

- Contributors edit plain Markdown; a PR is checked without running the server.
- The check catches missing pages and diverging sources, not translation quality: a fact changed in one
  language must be changed in the other two in the same PR, or the PR says "translation lags".
- Serbian terms follow official texts (`CONTRIBUTING.md`).

## Links

- Initial commit d25c7b6 (before PR numbering); #129 (ASCII anchors), #162 (language root links).

# alta-bankruptcy

Open reference site for depositors of the Serbian bank ALTA (licence revoked 30.10.2026), main
focus on amounts above EUR 50,000. Astro + Starlight, three languages: ru (root, default),
en (`/en/`), sr (`/sr/`, Latin). `CLAUDE.md` is a symlink to this file.

```bash
npm ci
npm run dev          # http://localhost:4321
npm run check        # translations check + build (schema, internal links)
```

## Rules

- **No source, no edit.** Every page and news item has `sources` (title, url, kind, date) and
  `checked` in the frontmatter; the build fails without them (`src/content.config.ts`).
  `kind`: `official` (state bodies, courts, banks, the regulator only) | `reference` (legal databases,
  publishers, bar chambers, associations) | `own` (this site) | `reliable_media` | `unverified`.
  Unverified claims are not published.
- **External links only to trusted domains.** Every URL (sources, text, components, built `dist/`)
  must be on a domain listed in `src/data/trusted-domains.yaml` (with `name` and `proof`), https only,
  no shorteners; short `archive.ph/<id>` only as `copy` of a verified source.
  `npm run check:sources [-- --dist]` checks it; the registry is under CODEOWNERS.
- **Three languages move together.** A fact changed in one language is changed in the other
  two in the same PR (or the PR says "translation lags"). `scripts/check-i18n.mjs` checks that
  all three versions exist and that their `sources` and external links are identical.
  Serbian uses the terms of the official texts: stečaj, poverilac, prijava potraživanja,
  isplatni red, Agencija za osiguranje depozita, Narodna banka Srbije, Privredni sud u Beogradu.
- **Figures, dates and links are identical across languages.**
- **Sole traders (ИП):** no separate section for now; short notes only through the
  `ForIp` component (`grep -rn ForIp src` finds all of them).
- **Not on the site:** whether the failure could have been predicted, the bank's financial
  figures, who owns media outlets, chats, depositor verification, Telegram forms, media
  accusations against people. The bank page uses registries only.
  Owner's exception (04.11.2026): on `/account/stats` a collapsed «Со слов вкладчиков в чатах»
  block per bank lists account-opening criteria from open depositor chats — no counts, quotes,
  names or chat titles (`backend/src/alta_feedback/data/bank_criteria.json`).
  Owner's exception (05.11.2026): финансовые цифры банка публикуются только с официальным
  источником (отчётность APR/банка/NBS/AOD), с номером страницы и копией документа в
  `public/docs/`; без оценок и догадок (решение владельца 05.11.2026). Used on
  `/imushchestvo-banka/`; what the documents do not disclose is written as «в документах не
  раскрыто: …», never as a guess. No claims about payout ranks.
- **Every claim has an official source or an explicit mark.** Каждое утверждение — с официальным источником (копия в public/docs + ссылка на оригинал). Если источника нет (опыт вкладчика, кейс из формы, бланк, присланный вкладчиком, наше наблюдение) — публикуется только с явной видимой пометкой «со слов вкладчика / источника нет»; догадки и оценки без такой пометки не публикуются. Источник ищем всегда в первую очередь (решение владельца 06.11.2026).
- **Every external source has a backup.** A PDF goes to `public/docs/` (and `src/data/pdfs.ts`);
  a web page (NBS, AOD, press, city notices) is saved to web.archive.org (or archive.ph) and the
  snapshot goes into the source's `copy` field next to the original URL. Press is kept only as
  a direct fact from the article, attributed «по данным <издание>, <дата>», `reliable_media`;
  if an official primary source exists (city plan, Službeni list, NBS, AOD), cite it instead.
- **PDFs open in the on-site viewer from our own copy** (`src/data/pdfs.ts`; the build fails on a
  PDF without one): small files in `public/docs`, AOD documents in the backend archive
  (`/docs/aod/<name>`, one list for the site and the server:
  `backend/src/alta_feedback/data/aod_archive.json`). A document naming private persons is
  `public: false` and stays an external link. The link text still points to the original.
- **No personal data in the repository, history included.** No names, emails, phones, JMBG,
  account numbers or Telegram handles of depositors, chat members or form authors; no screenshots
  of letters, chats or bank cabinets that show them (black out before committing); no filled-in
  forms. The repository is public and history is forever: a leak means rotating and reporting,
  not "deleting the file". Official contacts of organisations (AOD, NBS, banks) are fine.
- **Documents come only from the official source or from our backup.** A document on the site is
  either loaded straight from its official publisher or opened from our own copy (`public/docs`,
  AOD archive) that sits next to a link to the original; web pages go to the web archive. A file
  with no official original (for example sent by a depositor) is not published as a document.
  No guesses: a figure, date or requirement we cannot point to a source for does not go in
  (decision of 05.11.2026).
- Light theme only; no third-party scripts, fonts or trackers (the server sends a strict CSP).
- Instagram link of the depositors' group: `INSTAGRAM_URL` in `src/site.mjs` (empty = hidden).
- News: one file per item and language in `src/content/news/<lang>/`.
- Deploy only through CI (`docs/deploy.md`); no secrets or server addresses in the repository.
- `backend/` is the Python service that serves the whole site (forms, stats, admin, AOD archive,
  CSP); it has its own `backend/AGENTS.md`. Tests: `cd backend && uv run pytest -q`.

## Backend and release

- Code: `backend/` (Starlette + SQLite, details in `backend/AGENTS.md`). `deploy-backend.yml` runs
  tests, copies to `/opt/alta-bankruptcy` and restarts `alta-bankruptcy.service` on
  `127.0.0.1:8102`; the site is built by `deploy.yml`. Live data (database, AOD archive) is in
  `/opt/alta-feedback/data`; never edit the server by hand.
- Moderation: reports and corrections through `/admin/accounts` and `/admin/suggestions`
  (Bearer `ADMIN_TOKEN`), proposals and cases under `/admin/proposals` behind Cloudflare Access;
  statuses `new|accepted|rejected|test|spam`. Commands and the Access setup: `backend/docs/ops.md`.
  Moderation touches statuses only; never publish an unreviewed form text.
- Review: `.github/CODEOWNERS` requires an owner for `.github/`, `scripts/`, `package*.json`,
  `astro.config.mjs`, `backend/deploy/`, `backend/pyproject.toml` and `backend/uv.lock`. Merge
  with `--admin` only after CI is green. Commits and PRs in English.

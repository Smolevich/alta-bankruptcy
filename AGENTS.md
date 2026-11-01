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
  `kind`: `official` | `reliable_media` | `unverified`. Unverified claims are not published.
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
- Light theme only; no third-party scripts, fonts or trackers (the server sends a strict CSP).
- Instagram link of the depositors' group: `INSTAGRAM_URL` in `src/site.mjs` (empty = hidden).
- News: one file per item and language in `src/content/news/<lang>/`.
- Deploy only through CI (`docs/deploy.md`); no secrets or server addresses in the repository.

# alta-bankruptcy

[Русская версия](README.ru.md)

An open reference site for depositors of ALTA banka (Serbia), whose licence was revoked on
30.10.2026. It focuses on people with more than EUR 50,000: up to EUR 50,000 is repaid by AOD, the
rest is claimed in the bank's bankruptcy. It shows the current stage, deadlines, the claim procedure,
past cases (Univerzal banka 2014), official news and the laws. Every figure has a source; the site
is in Russian (default), English and Serbian. Live at https://alta.smolevich.com.

```bash
npm ci
npm run dev      # local site
npm run check    # translations check + build (schema and internal links)
```

| What | Where |
|---|---|
| Pages | `src/content/docs/` (ru at the root, `en/`, `sr/`) |
| News | `src/content/news/<lang>/<date>-<slug>.md` |
| Current stage on the home page | `src/data/status.json` |
| Source schema | `src/content.config.ts` |
| Translation check | `scripts/check-i18n.mjs` |
| Service (forms, stats, admin) | `backend/` |
| Deploy | `docs/deploy.md` |
| Data the site collects | `docs/privacy.md` |
| Code rules and tests | `docs/coding-standards.md` |

Texts and code: MIT (`LICENSE`). How to contribute: `CONTRIBUTING.md`. Not legal advice.

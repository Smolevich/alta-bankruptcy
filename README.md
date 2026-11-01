# alta-bankruptcy

**EN.** An open reference site for depositors of ALTA banka (Serbia), whose licence was revoked on
30.10.2026. It focuses on people with more than EUR 50,000: up to EUR 50,000 is repaid by AOD, the
rest is claimed in the bank's bankruptcy. It shows the current stage, deadlines, the claim procedure,
past cases (Univerzal banka 2014), official news and the laws. Every figure has a source; the site
is in Russian (default), English and Serbian. Live at https://alta.smolevich.com.

```bash
npm ci
npm run dev      # local site
npm run check    # translations check + build (schema and internal links)
```

Texts: CC BY 4.0 (`LICENSE-CONTENT.md`), code: MIT (`LICENSE`). Rules for edits: `CONTRIBUTING.md`.
Not legal advice.

---

**RU.** Открытый справочник для вкладчиков банка ALTA (Сербия), у которого 30.10.2026 отозвана
лицензия. Главный фокус: вкладчики с суммой больше 50 000 €. До 50 000 € вернёт AOD, остальное
заявляется в банкротстве банка. На сайте: текущая стадия, сроки, подача требования, прошлые случаи
(Univerzal banka, 2014), официальные новости и законы. У каждой цифры есть источник. Языки: русский
(основной), английский, сербский. Сайт: https://alta.smolevich.com.

Тексты: CC BY 4.0, код: MIT. Как править — в [CONTRIBUTING.md](CONTRIBUTING.md). Это не юридическая
консультация.

## Как устроено

| Что | Где |
|---|---|
| Страницы | `src/content/docs/` (ru в корне, `en/`, `sr/`) |
| Новости | `src/content/news/<язык>/<дата>-<имя>.md` |
| Текущая стадия на главной | `src/data/status.json` |
| Схема источников | `src/content.config.ts` |
| Проверка переводов | `scripts/check-i18n.mjs` |
| Деплой | `docs/deploy.md` |

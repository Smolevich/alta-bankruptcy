# backend

Starlette + Jinja + SQLite service (Python 3.13, uv) that serves alta.smolevich.com: the Astro build
from the repo root plus the forms, stats, admin API and the AOD PDF archive. Run everything from
`backend/`.

```bash
uv sync
uv run pytest -q
uv run ruff check src tests
node --test tests/js/filters.test.js
IP_SALT=dev ADMIN_TOKEN=dev uv run uvicorn --factory alta_feedback.main:create_app --port 8101
```

- Routes: `main.py` (`create_app`). Schema: `store.py` (`SCHEMA`; new columns only nullable, via
  `ADDED_COLUMNS`). Database: `$DATA_DIR/feedback.db` (default `data/`); package data such as
  `branches.json` and `aod_archive.json` lives in `src/alta_feedback/data/`, because the deploy
  copies only `src/`.
- Forms: corrections `POST /`, account reports `/account` (stats `/account/stats`, JSON
  `/api/accounts/public`), proposals and cases `/predlozheniya/`, queue marks `/api/queue`. What each
  stores: `docs/privacy.md` at the repo root. Moderation API and Access setup: `docs/ops.md`.
- Free text of account reports, queue marks and cases goes through `accounts.scrub_pii` (keep it on
  any new field there); formatted text only through
  `richtext.sanitize`. Public output never includes `contact`, `ip_hash`, `user_agent_short` or
  `created_at`.
- CSP is per route in `site.py`/`main.py`; scripts are our own files in
  `src/alta_feedback/static/`. `static/richtext.js` is built from `editor/`
  (`cd editor && npm ci && npm run build`, output committed).
- Form and API behaviour is tested through the app (`TestClient`); rules in `docs/coding-standards.md`.
- Deploy: `deploy-backend.yml` on push to `main` (`docs/deploy.md`). Secrets come from Vault; never
  change `IP_SALT` without a reason, it resets every IP hash and the rate limit.

# backend

The service behind https://alta.smolevich.com: it serves the site built from the repository root
and handles the forms (corrections, «Where did you open an account» reports, material proposals,
cases, queue marks on the Poštanska branch map), the public stats and JSON, the moderation API and
the AOD PDF archive.

The code is open so anyone can check what it stores: see [`docs/privacy.md`](../docs/privacy.md).

## Running locally

Python 3.13+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync
IP_SALT=dev ADMIN_TOKEN=dev uv run uvicorn --factory alta_feedback.main:create_app --port 8101
uv run ruff check src tests
uv run pytest -q
```

The account form is at <http://127.0.0.1:8101/account>, the database at `data/feedback.db`.

Moderation, public JSON and admin sign-in: [`docs/ops.md`](docs/ops.md). Design decisions:
[`docs/decisions.md`](docs/decisions.md). Deploy: [`../docs/deploy.md`](../docs/deploy.md).

Bugs and ideas: [issues](https://github.com/Smolevich/alta-bankruptcy/issues).

## License

[MIT](../LICENSE).

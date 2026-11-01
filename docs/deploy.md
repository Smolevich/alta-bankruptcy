# Деплой

Сайт отдаёт сервис [alta-feedback](https://github.com/Smolevich/alta-feedback) (тот же
`alta.smolevich.com`, туннель Cloudflare уже ведёт весь хост в него). Здесь собирается статика, там
она раздаётся с «/»: формы `/account`, `/account/stats`, `/api`, `/admin` не затрагиваются.

```
push в main → GitHub Actions: check:i18n + build → tailscale → scp dist → ssh:
  /var/www/alta-bankruptcy.new → подмена папки /var/www/alta-bankruptcy → проверка через 127.0.0.1:8101
```

- Сервис не перезапускается: он читает папку при каждом запросе.
- Проверка после подмены: `/` и `/en/`, `/sr/` отдают справочник, `/account` и `/account/stats` живы.
  Не прошла — прежняя папка возвращается, деплой красный.
- Порядок первого выката: сначала PR в alta-feedback (раздача «/»), потом деплой этого репо.
  Если сделать наоборот, проверка не пройдёт, а сайт останется как был.

## Секреты и переменные

Секреты репозитория (значения — по `docs/hetzner-ci-deploy-standard.md`, те же, что у alta-feedback):
`TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `VDS_HOST`, `VDS_PORT`, `VDS_USER`, `VDS_SSH_KEY`,
`VDS_SSH_PASSPHRASE`. Секретов приложения нет.

## Откат

Запустить workflow «Deploy to Hetzner» вручную на предыдущем коммите (`workflow_dispatch`) или
сделать revert в main.

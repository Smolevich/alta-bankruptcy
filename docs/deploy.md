# Деплой

`alta.smolevich.com` целиком отдаёт сервис из `backend/` (Starlette): собранный здесь справочник
на «/» со строгим CSP, формы `/` (правки) и `/account`, `/account/stats`, `/api`, `/admin`,
архив PDF AOD на `/docs/aod/<name>`. Трафик приходит через туннель Cloudflare `telegram-bot`
(ingress в репо `infra`, `fleet/hardening/cloudflared/config.yml`) на `127.0.0.1:<порт>`.

Два воркфлоу, оба только из `main`, секреты — в environment `production`:

| Воркфлоу | Что | Когда |
|---|---|---|
| `deploy.yml` | `check:i18n` + сборка Astro → подмена папки `/var/www/alta-bankruptcy` → проверка через сервис | `src/`, `public/`, конфиг сборки, манифест AOD |
| `deploy-backend.yml` | тесты бэкенда → `/opt/alta-bankruptcy` → `uv sync` → `.env` из Vault → рестарт `alta-bankruptcy.service` (`127.0.0.1:8102`) и таймера `alta-aod-check` → проверка | `backend/` |

- Справочник сервис читает с диска на каждый запрос: деплой сайта бэкенд не перезапускает.
- Секреты приложения (`ADMIN_TOKEN`, `IP_SALT`) деплой читает из Vault по AppRole; пути — в
  переменных репозитория `VAULT_*`. Секреты деплоя — `TS_OAUTH_*`, `VDS_*` (значения — по
  `docs/hetzner-ci-deploy-standard.md` в pet-projects).
- Бэкап базы: `feedback.db` входит в ночной бэкап ботов (`infra`, `bots_backup.py`, 04:15 UTC → R2).

## Переезд из alta-feedback (ноябрь 2026)

Раньше бэкенд жил в репо `Smolevich/alta-feedback` и выкатывался им как `alta-feedback.service`
на `127.0.0.1:8101` из `/opt/alta-feedback`. Его код перенесён сюда с историей (тег
`alta-feedback-history`). Переезд идёт по шагам, чтобы сайт ни разу не лёг:

1. Новый сервис `alta-bankruptcy.service` на `8102` рядом со старым. `DATA_MODE: preview` в
   `deploy-backend.yml`: каждый деплой снимает копию живой базы в `/opt/alta-bankruptcy/preview-data`
   (архив AOD — ссылкой), и писать сервис может только туда — живую базу ему закрывает systemd
   (`ReadWritePaths` из drop-in `data.conf`). Два процесса в одну базу не пишут.
2. Переключение (сделано 03.11.2026): свежий бэкап базы → `DATA_MODE: live` (сервис на `/opt/alta-feedback/data`) →
   ingress туннеля `alta.smolevich.com` с `8101` на `8102`. Старый сервис остаётся запущенным на
   той же базе без трафика: всё, что запишет новый, видно и ему.
3. Через сутки, после подтверждения Стаса, — финальный шаг ниже.

Таймер проверки архива `alta-aod-check` (03:20 UTC) выкатывает этот репо: код и venv из
`/opt/alta-bankruptcy`, архив — в живой базе `/opt/alta-feedback/data/aod`. Репо `alta-feedback`
заархивирован 03.11.2026 и больше ничего на сервер не катит.

## Откат

Пока старый сервис запущен, откат трафика — вернуть ingress на `8101` и перезапустить туннель
(одна команда с мака, конфиг берётся из `infra` на коммите до переключения):

```bash
git -C ~/pet-projects/infra fetch -q origin && \
git -C ~/pet-projects/infra show ea66818:fleet/hardening/cloudflared/config.yml \
  | ssh -o ClearAllForwardings=yes bot-server 'cat > /etc/cloudflared/config.yml && systemctl restart cloudflared'
```

`ea66818` — последний коммит `infra` до переключения (Smolevich/infra#82, 03.11.2026 07:59 UTC).
После отката — revert Smolevich/infra#82,
чтобы эталон снова совпал с сервером. Данные не теряются: оба сервиса работают с одной базой.

Откат кода сайта или бэкенда — revert в `main` (или ручной запуск воркфлоу на нужном коммите).

## Финальный шаг: выключить старый и заархивировать

Только после подтверждения Стаса, когда новый сервис отработал сутки:

1. ~~Перенести таймер проверки архива сюда~~ — сделано 03.11.2026.
2. `systemctl disable --now alta-feedback.service` на сервере (скриптом из воркфлоу, не руками),
   удалить его юнит; `/opt/alta-feedback/data` не трогать — там живая база и архив AOD
   (переезд данных в `/opt/alta-bankruptcy/data` — отдельным шагом с бэкапом).
3. Убрать порт `8101` из проверки в `deploy.yml`, обновить `infra` (`docs/server-facts.md`,
   `fleet/hardening/cloudflared.md`).
4. ~~Заархивировать `Smolevich/alta-feedback`~~ — сделано 03.11.2026; его environment `production`
   и переменные `VAULT_*` ничего не делают (Actions у архива не запускаются).

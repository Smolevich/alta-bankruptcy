# Deploy

`alta.smolevich.com` is served entirely by the service in `backend/` (Starlette): the reference site
built here at `/` with a strict CSP, the forms at `/` (corrections) and `/account`, `/account/stats`,
`/api`, `/admin`, and the AOD PDF archive at `/docs/aod/<name>`. Traffic comes through the Cloudflare
tunnel `telegram-bot` (ingress in the `infra` repo, `fleet/hardening/cloudflared/config.yml`) to
`127.0.0.1:8102`.

Two workflows, both from `main` only, secrets in the `production` environment:

| Workflow | What | When |
|---|---|---|
| `deploy.yml` | `check:i18n` + Astro build → swap `/var/www/alta-bankruptcy` → check through the service | `src/`, `public/`, build config, AOD manifest |
| `deploy-backend.yml` | backend tests → `/opt/alta-bankruptcy` → `uv sync` → `.env` from Vault → restart `alta-bankruptcy.service` (`127.0.0.1:8102`) and the `alta-aod-check` timer → check | `backend/` |

- The service reads the site from disk on every request, so a site deploy does not restart the backend.
- App secrets (`ADMIN_TOKEN`, `IP_SALT`) are read by the deploy from Vault via AppRole; the paths are
  in the repository variables `VAULT_*`. Deploy secrets are `TS_OAUTH_*` and `VDS_*` (values per
  `docs/hetzner-ci-deploy-standard.md` in pet-projects).
- The database and the AOD archive live in `/opt/alta-feedback/data` (`DATA_MODE: live` in
  `deploy-backend.yml`); the `alta-aod-check` timer (03:20 UTC) runs code and venv from
  `/opt/alta-bankruptcy` against that directory.
- Backup: `feedback.db` is part of the nightly bot backup (`infra`, `bots_backup.py`, 04:15 UTC → R2).

## Rollback

Code of the site or the backend: revert in `main`, or run the workflow manually on the right commit.

Traffic: the previous service `alta-feedback.service` (`backend/deploy/alta-feedback.service`) still
runs on `127.0.0.1:8101` over the same database, without traffic. To switch back, point the tunnel
ingress to `8101` and restart cloudflared, using the `infra` config from before the switch:

```bash
git -C ~/pet-projects/infra fetch -q origin && \
git -C ~/pet-projects/infra show ea66818:fleet/hardening/cloudflared/config.yml \
  | ssh -o ClearAllForwardings=yes bot-server 'cat > /etc/cloudflared/config.yml && systemctl restart cloudflared'
```

`ea66818` is the last `infra` commit before the switch. Afterwards revert Smolevich/infra#82 so the
reference config matches the server again. No data is lost: both services use one database.

## Retiring the old service

Once the old service is no longer needed as a fallback, with the repository owner's approval:

1. `systemctl disable --now alta-feedback.service` on the server (from a workflow script, not by
   hand) and remove its unit and `backend/deploy/alta-feedback.service`. Do not touch
   `/opt/alta-feedback/data`: it holds the live database and the AOD archive; moving it to
   `/opt/alta-bankruptcy/data` is a separate step with a backup.
2. Drop port `8101` from the check in `deploy.yml`, update `infra` (`docs/server-facts.md`,
   `fleet/hardening/cloudflared.md`) and remove the rollback section above.

## Map tiles (R2)

The service serves `/map/serbia.pmtiles` (50 MB) from the R2 bucket `alta-map` over the S3 API,
passing Range through (`backend/src/alta_feedback/map_tiles.py`); the file is not in git. The bucket
keys (a token for this bucket only, Object Read & Write) are in Vault `secret/alta-feedback/r2_map`;
the backend deploy writes them to `.env` as `R2_MAP_*` (path in the repository variable
`VAULT_R2_MAP_PATH`). Without the keys the route answers 503. Cloudflare does not cache `.pmtiles` by
extension, so the zone needs a cache rule for this path (Eligible for cache, Edge TTL from origin
headers). After replacing the file in the bucket, purge the cache for that URL.

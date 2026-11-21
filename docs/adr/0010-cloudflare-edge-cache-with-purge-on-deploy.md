# 10. Cache built pages at the Cloudflare edge and purge the host on every deploy

- Status: Accepted
- Date: 2026-11-21

## Context

Pages were served `DYNAMIC`: every visit went through the tunnel to the server (#243).

## Decision

- The backend adds `Cloudflare-CDN-Cache-Control: max-age=86400` to every `200` of the built site;
  browsers still get `no-cache`. Forms, `/account*`, `/predlozheniya/`, `/api/`, `/admin/` and 404s are
  never cached.
- Both deploy workflows purge only the host `alta.smolevich.com`, never everything.
- `deploy.yml` checks through Cloudflare that `/`, `/en/`, `/sr/` carry the deployed commit
  (`<meta name="alta-build">`) and are `HIT`, and that form pages are not; a stale page fails the job.
- The cache rule lives in the `infra` repository; turning it off is disabling that rule.

## Consequences

- Deploys need the secret `CF_CACHE_PURGE_TOKEN` and the variable `CF_ZONE_ID`.
- Pages can be up to a day stale only if a purge fails, which fails the deploy.

## Links

- #243; `docs/deploy.md` (Edge cache section).

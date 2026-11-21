# 4. One Python service in `backend/` serves the built site and the forms

- Status: Accepted
- Date: 2026-11-03

## Context

Before 03.11.2026 the forms backend lived in a separate repository (`alta-feedback`) and ran as
`alta-feedback.service` on port 8101. The PR descriptions for the move do not state a reason.

## Rationale (owner, 21.11.2026)

- The form backend was merged into this repository because the owner does not want to keep one project split across several repositories.
- The site is served by its own service on the Hetzner server because every service there is published through a Cloudflare Tunnel; this keeps one uniform way to run and expose services.

## Decision

- The backend history was moved into `backend/` of this repository (#36).
- It was deployed as a new service `alta-bankruptcy.service` on `127.0.0.1:8102`, first without
  traffic (#40), then pointed at the live database (#41), then the Cloudflare tunnel ingress was
  switched (#42, `docs/deploy.md`).
- The service serves the built site from disk on every request (with a strict CSP), the forms,
  `/account/stats`, `/api`, `/admin` and the AOD PDF archive. A site deploy swaps the folder and does
  not restart the service.
- The old `alta-feedback.service` on 8101 stays running without traffic for rollback.

## Consequences

- Site and service ship from one repo with separate workflows and path filters.
- Page headers (CSP, caching) are set by the service, not by a static host.

## Links

- #36, #40, #41, #42; `backend/docs/decisions.md` (earlier decisions for the service).

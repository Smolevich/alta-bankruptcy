# 6. Forms collect no personal data; public data is moderated and aggregated

- Status: Accepted
- Date: 2026-11-03

## Context

Depositors report where a bank opened an account, propose materials, describe cases and mark queues at
payout branches. The repository and the site are public. Reasons are given in `docs/privacy.md` and
`backend/docs/decisions.md`.

## Decision

- No accounts, no own cookies, no ads (`docs/privacy.md`). The optional `contact` field is never
  published.
- Free text passes through `scrub_pii` (email, phone, JMBG, account and passport numbers replaced).
- Account reports, proposals and cases are published only after moderator acceptance; a branch appears
  in public output only from two reports (one answer from a small branch could identify the person).
- `/account/stats` shows aggregated counts and a «not a rating, not bank rules» disclaimer.
- Rate limit and spam protection without third-party services: salted `ip_hash` and short
  `user_agent_short`, wiped after 30 days; own proof-of-work check ("I'm not a robot" box) instead of
  Cloudflare Turnstile, which was rejected as a third-party script (`decisions.md`).
- Queue marks store only a yes/no "near the branch", never coordinates; the per-branch limit is keyed
  by device, not IP (#138).
- The repository holds no personal data, history included (`AGENTS.md`).

## Consequences

- Public statistics are less detailed than raw reports.
- Moderation is manual, through the token-protected admin (signed in via Cloudflare Access, #71).

## Links

- #36, #44, #60, #67, #71, #82, #121, #126, #137, #138, #156; `docs/privacy.md`.

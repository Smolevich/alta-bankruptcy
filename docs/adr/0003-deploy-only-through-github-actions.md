# 3. Deploy only through GitHub Actions, with build and deploy separated

- Status: Accepted
- Date: 2026-11-01

## Context

The repository is public and was about to get outside maintainers. Repository code (npm scripts,
`astro.config.mjs`, page frontmatter) runs during a build, so it must not see deploy secrets (#19).

## Decision

- Production is changed only by `deploy.yml` (site) and `deploy-backend.yml` (service), from `main`
  only. Nobody edits the server by hand (`AGENTS.md`).
- Repository code runs only in the `build` job without secrets; `deploy` receives the built `dist`
  as an artifact (#19).
- Deploy secrets live in the GitHub environment `production`, restricted to `main` (#22).
- Actions are pinned to commit SHAs; SSH uses `StrictHostKeyChecking yes` with the host key from a
  secret (#19).
- Every deploy purges the host's Cloudflare cache (see ADR 0010).
- Rollback is a revert in `main`, a manual workflow run on a commit, or switching the tunnel ingress
  back (`docs/deploy.md`).

## Consequences

- A change reaches production only after review and CI; there is no quick local push.
- Changes to `.github/` need a code owner (ADR 0008).

## Links

- #19, #22, #42, #243; `docs/deploy.md`.

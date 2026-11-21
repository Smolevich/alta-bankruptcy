# 8. Public MIT repository; code owners review deploy and build paths

- Status: Accepted
- Date: 2026-11-01

## Context

The site is open and anyone may propose an edit (`CONTRIBUTING.md`). Changes to deploy and build can
reach the production server, so they need more review than content (#19, #31).

## Decision

- The repository is public; texts and code share one MIT licence (#18, replacing a separate content
  licence).
- `.github/CODEOWNERS` requires owner review for `.github/`, `package*.json`, `astro.config.mjs`,
  `scripts/`, `src/data/trusted-domains.yaml`, `backend/deploy/`, `backend/pyproject.toml`,
  `backend/uv.lock`. Content in `src/` is run by the maintainers themselves.
- A second code owner was added so the maintainers can review each other's changes (#31).
- Every change to `main` goes through a PR; required checks are `build`, `backend`, `pr-description`;
  merge is squash. PR descriptions need What / Why / Checks (#203).

## Consequences

- Contributors without owner rights can change content but not the pipeline.
- Whether the maintainers come from the depositors' working group is not recorded in the evidence.

## Links

- Initial commit d25c7b6 (CODEOWNERS); #18, #19, #31, #203; `AGENTS.md`.

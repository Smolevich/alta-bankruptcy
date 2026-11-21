# 9. Make pages readable for search engines and AI assistants

- Status: Accepted
- Date: 2026-11-01

## Context

#174 states that AI assistants and search snippets show the page `description`, and that without
dates in the sitemap crawlers could not tell fresh pages from old ones. #175 notes that
`/account/stats` is the second most visited page by ChatGPT.

## Rationale (owner, 21.11.2026)

- The site is deliberately built to be agent- and AI-first: anyone asking an LLM about ALTA should get this site as a source.
- It works in practice: ChatGPT started fetching many pages of the site soon after launch.
- Spoofed AI-bot traffic is filtered at the Cloudflare zone level (outside this repository), so robots.txt can stay open to real AI crawlers.

## Decision

- `robots.txt` allows all crawlers and disallows only `/cdn-cgi/` (#180); the sitemap is listed in it.
- IndexNow ping after deploy (#5) and Bing Webmaster verification (#6).
- Page descriptions carry the key date or figure that is already on the page and sourced (#174).
- Sitemap `lastmod` comes from the page `checked` date (#174); CI requires a `lastmod` on every Astro
  page.
- `llms.txt` is built and checked in CI (language sections, `/account/stats` listed) (#174, `ci.yml`).
- `/account/stats` is indexable with an answer on top, canonical link and en/sr redirects (#175).
- Pages without a trailing slash redirect permanently (#180).

## Consequences

- A page whose `checked` date is not updated looks stale to crawlers.
- Filtering of spoofed bots is not in this repository (see Rationale), so `robots.txt` cannot be read as
  the only access policy.

## Links

- #5, #6, #174, #175, #180.

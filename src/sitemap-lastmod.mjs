// Date of the page's last verification for <lastmod> in the sitemap. The Astro config is read before
// collections load, so `checked` is taken straight from the files' frontmatter.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LANG_DIRS = ['en', 'sr'];

/** 'en/vyplata.mdx' → '/en/vyplata/', 'index.mdx' → '/'. */
export function pagePath(file) {
	const slug = file.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
	return slug ? `/${slug}/` : '/';
}

/** A date value from frontmatter ('YYYY-MM-DD') or undefined. */
export function frontmatterDate(src, key) {
	const head = src.match(/^---\n([\s\S]*?)\n---/);
	const m = head?.[1].match(new RegExp(`^${key}:\\s*["']?(\\d{4}-\\d{2}-\\d{2})`, 'm'));
	return m?.[1];
}

function latest(dates) {
	return dates.filter(Boolean).sort().at(-1);
}

function readDir(dir) {
	return readdirSync(dir, { recursive: true })
		.map(String)
		.filter((f) => /\.mdx?$/.test(f))
		.map((f) => ({ file: f.split('\\').join('/'), src: readFileSync(join(dir, f), 'utf8') }));
}

/**
 * Page path -> date for <lastmod>. The news feed (/novosti/) is updated with every
 * news item, so it gets the latest of `checked` and the news dates of its language.
 */
export function lastmodByPath(docsDir, newsDir) {
	const newsByLang = new Map();
	for (const { file, src } of readDir(newsDir)) {
		const lang = file.split('/')[0];
		newsByLang.set(lang, latest([newsByLang.get(lang), frontmatterDate(src, 'date')]));
	}
	const result = new Map();
	for (const { file, src } of readDir(docsDir)) {
		const path = pagePath(file);
		const lang = LANG_DIRS.find((l) => file.startsWith(`${l}/`)) ?? 'ru';
		const checked = frontmatterDate(src, 'checked');
		const isNews = path.replace(/^\/(en|sr)\//, '/') === '/novosti/';
		result.set(path, isNews ? latest([checked, newsByLang.get(lang)]) : checked);
	}
	return result;
}

/** Whether the page is closed from the index via `head` in frontmatter (robots noindex). */
export function isNoindex(src) {
	const head = src.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
	return /name:\s*["']?robots["']?[^\n]*noindex/.test(head);
}

/**
 * Paths of noindex pages: they do not belong in the sitemap. The source of truth is frontmatter,
 * so that putting a page back in the index takes one edit: removing its `head`.
 */
export function noindexPaths(docsDir) {
	return new Set(readDir(docsDir).filter(({ src }) => isNoindex(src)).map(({ file }) => pagePath(file)));
}

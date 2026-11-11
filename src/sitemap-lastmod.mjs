// Дата последней сверки страницы для <lastmod> в карте сайта. Конфиг Astro читается до
// загрузки коллекций, поэтому `checked` берём прямо из frontmatter файлов.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LANG_DIRS = ['en', 'sr'];

/** 'en/vyplata.mdx' → '/en/vyplata/', 'index.mdx' → '/'. */
export function pagePath(file) {
	const slug = file.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
	return slug ? `/${slug}/` : '/';
}

/** Значение даты из frontmatter ('YYYY-MM-DD') или undefined. */
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
 * Путь страницы → дата для <lastmod>. Лента новостей (/novosti/) обновляется каждой
 * новостью, поэтому у неё — самая поздняя из `checked` и дат новостей своего языка.
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

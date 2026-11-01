import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { LANGS, type Lang } from '../i18n';

const HEADINGS: Record<Lang, [string, string]> = {
	ru: ['Русский', 'Официальные новости (новые сверху)'],
	en: ['English', 'Official news (newest first)'],
	sr: ['Srpski', 'Zvanične vesti (najnovije prve)'],
};

// Собирается из контента при каждой сборке, поэтому не отстаёт от страниц.
export const GET: APIRoute = async ({ site }) => {
	const base = site!.origin;
	const docs = await getCollection('docs');
	const news = await getCollection('news');
	const lines = [
		"# Вкладчики ALTA: что дальше / ALTA depositors: what's next / Štediše ALTA banke: šta dalje",
		'',
		'> Open reference for depositors of ALTA bank (Serbia), especially those with more than EUR 50,000: up to EUR 50,000 is repaid by AOD, the rest goes through the bank bankruptcy. Every figure has a source. Languages: ru (default), en, sr (Latin).',
	];
	for (const lang of LANGS) {
		const prefix = lang === 'ru' ? '' : `${lang}/`;
		const pages = docs
			.filter((d) => (lang === 'ru' ? !/^(en|sr)\//.test(d.id) : d.id.startsWith(prefix)))
			.sort((a, b) => a.id.localeCompare(b.id));
		const items = news
			.filter((n) => n.id.startsWith(`${lang}/`))
			.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
		lines.push('', `## ${HEADINGS[lang][0]}`);
		for (const d of pages) {
			const slug = d.id.replace(/^(en|sr)\//, '').replace(/^index$/, '');
			const path = `${prefix}${slug ? slug + '/' : ''}`;
			lines.push(`- [${d.data.title}](${base}/${path}): ${d.data.description ?? ''}`);
		}
		lines.push('', `### ${HEADINGS[lang][1]}`);
		for (const n of items) {
			lines.push(`- ${n.data.date.toISOString().slice(0, 10)} [${n.data.title}](${n.data.sources[0].url})`);
		}
	}
	lines.push('', '## Source code', '- https://github.com/Smolevich/alta-bankruptcy', '');
	return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

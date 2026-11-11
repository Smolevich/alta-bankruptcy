import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { LANGS, type Lang } from '../i18n';

// Страница статистики открытия счетов отдаётся backend, в коллекции docs её нет.
const ACCOUNT_STATS: Partial<Record<Lang, string>> = {
	ru: '- [Опыт вкладчиков: где открывают счета](%s/account/stats): в каких банках Сербии вкладчикам ALTA открыли или не открыли счёт и что просили. Ответы самих вкладчиков, проверенные модератором; это не рейтинг и не правила банков. Обновляется с каждым ответом.',
};

const HEADINGS: Record<Lang, [string, string]> = {
	ru: ['Русский', 'Официальные новости (новые сверху)'],
	en: ['English', 'Official news (newest first)'],
	sr: ['Srpski', 'Zvanične vesti (najnovije prve)'],
};

const LANG_ID = /^(en|sr)(\/|$)/;

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
			// Главные en и sr имеют id 'en' и 'sr', без слеша.
			.filter((d) => (lang === 'ru' ? !LANG_ID.test(d.id) : d.id === lang || d.id.startsWith(prefix)))
			.sort((a, b) => a.id.localeCompare(b.id));
		const items = news
			.filter((n) => n.id.startsWith(`${lang}/`))
			.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
		lines.push('', `## ${HEADINGS[lang][0]}`);
		for (const d of pages) {
			const slug = d.id.replace(LANG_ID, '').replace(/^index$/, '');
			const path = `${prefix}${slug ? slug + '/' : ''}`;
			lines.push(`- [${d.data.title}](${base}/${path}): ${d.data.description ?? ''}`);
		}
		if (ACCOUNT_STATS[lang]) lines.push(ACCOUNT_STATS[lang]!.replace('%s', base));
		lines.push('', `### ${HEADINGS[lang][1]}`);
		for (const n of items) {
			lines.push(`- ${n.data.date.toISOString().slice(0, 10)} [${n.data.title}](${n.data.sources[0].url})`);
		}
	}
	lines.push('', '## Source code', '- https://github.com/Smolevich/alta-bankruptcy', '');
	return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

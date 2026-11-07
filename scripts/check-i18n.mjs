// Проверка переводов: у каждой страницы и новости есть ru/en/sr, а источники и ссылки в версиях совпадают.
// Запуск: npm run check:i18n (в CI — отдельным шагом до сборки).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';

const DOCS = 'src/content/docs';
const NEWS = 'src/content/news';
const LANGS = ['ru', 'en', 'sr'];
const errors = [];

const walk = (dir) =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
	);

function read(path) {
	const [, fm, body] = readFileSync(path, 'utf8').split(/^---\s*$/m);
	return { data: parse(fm), body };
}

const urls = (text) => [...new Set(text.match(/https?:\/\/[^\s)"'<>\]}]+/g) ?? [])].sort();
const norm = (v) => JSON.stringify(v);

function sourcesKey(data) {
	const date = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
	return norm((data.sources ?? []).map((s) => [s.url, s.kind, date(s.date), s.copy ?? null]));
}

function compare(group, files) {
	const missing = LANGS.filter((l) => !files[l]);
	if (missing.length) {
		errors.push(`${group}: нет версии ${missing.join(', ')}`);
		return;
	}
	const pages = Object.fromEntries(LANGS.map((l) => [l, read(files[l])]));
	for (const l of ['en', 'sr']) {
		if (sourcesKey(pages[l].data) !== sourcesKey(pages.ru.data)) {
			errors.push(`${group}: источники (url, kind, date) в ${l} не совпадают с ru`);
		}
		if (norm(pages[l].data.checked) !== norm(pages.ru.data.checked)) {
			errors.push(`${group}: дата сверки checked в ${l} не совпадает с ru`);
		}
		const a = urls(pages.ru.body).join('\n');
		const b = urls(pages[l].body).join('\n');
		if (a !== b) errors.push(`${group}: набор внешних ссылок в тексте ${l} не совпадает с ru`);
	}
}

// Страницы: ru лежит в корне, en/ и sr/ — в подпапках.
const docs = {};
for (const file of walk(DOCS)) {
	const rel = relative(DOCS, file);
	const m = rel.match(/^(en|sr)\/(.+)$/);
	const [lang, slug] = m ? [m[1], m[2]] : ['ru', rel];
	(docs[slug] ??= {})[lang] = file;
}
for (const [slug, files] of Object.entries(docs)) compare(`docs/${slug}`, files);

// Новости: src/content/news/<lang>/<файл>.
const news = {};
for (const lang of LANGS) {
	if (!existsSync(join(NEWS, lang))) continue;
	for (const f of readdirSync(join(NEWS, lang))) (news[f] ??= {})[lang] = join(NEWS, lang, f);
}
for (const [name, files] of Object.entries(news)) compare(`news/${name}`, files);

// Перевода интерфейса Starlight для sr-Latn нет в комплекте: без своего файла /sr/ показывает меню по-русски.
if (!existsSync('src/content/i18n/sr-Latn.json')) errors.push('нет src/content/i18n/sr-Latn.json: интерфейс /sr/ будет по-русски');

if (errors.length) {
	console.error(errors.map((e) => `✗ ${e}`).join('\n'));
	process.exit(1);
}
console.log(`i18n ok: ${Object.keys(docs).length} страниц, ${Object.keys(news).length} новостей × ${LANGS.length} языка`);

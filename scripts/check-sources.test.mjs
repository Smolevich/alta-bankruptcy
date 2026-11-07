// Тесты проверки ссылок: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { domainToASCII } from 'node:url';
import {
	classifyUrl, checkSource, validateRegistry, loadRegistry, checkSourceTree, checkDist, extractHtmlUrls, extractUrls,
} from './check-sources.mjs';

const REG = [
	{ domain: 'aod.rs', name: 'Agencija za osiguranje depozita — АСВ', category: 'official-rs-gov', proof: 'whois', hosts: ['aod.rs', 'www.aod.rs'] },
	{ domain: 'nbs.rs', name: 'Narodna banka Srbije — НБС', category: 'regulator', proof: 'whois', hosts: ['*'] },
	{ domain: 'posted.co.rs', name: 'Poštanska štedionica — банк', category: 'bank', proof: 'whois', hosts: ['www.posted.co.rs'] },
	{ domain: 'altabanka.rs', name: 'ALTA banka — банк', category: 'bank', proof: 'whois', hosts: ['*'] },
	{ domain: 'sud.rs', name: 'Portal sudova — суды', category: 'court', proof: 'whois', hosts: ['*'], http_ok: ['www.bg.pr.sud.rs'] },
	{ domain: 'paragraf.rs', name: 'Paragraf — правовая база', category: 'reference', proof: 'whois', hosts: ['www.paragraf.rs'] },
	{ domain: 'aks.org.rs', name: 'Advokatska komora Srbije — палата', category: 'reference', proof: 'whois', hosts: ['aks.org.rs'] },
	{ domain: 'akv.org.rs', name: 'Advokatska komora Vojvodine — палата', category: 'reference', proof: 'whois', hosts: ['akv.org.rs'] },
	{ domain: 'danas.rs', name: 'Danas — газета', category: 'press', proof: 'whois', hosts: ['www.danas.rs'] },
	{ domain: 'smolevich.com', name: 'этот сайт', category: 'own', proof: 'config', hosts: ['alta.smolevich.com'] },
	{ domain: 't.me', name: 'Telegram', category: 'social', proof: 'известный', hosts: ['t.me'], paths: ['/Altadef50k'] },
	{ domain: 'web.archive.org', name: 'Wayback', category: 'archive', proof: 'известный', hosts: ['web.archive.org'], archive: 'wayback' },
	{ domain: 'archive.ph', name: 'archive.today', category: 'archive', proof: 'известный', hosts: ['archive.ph'], archive: 'archive-ph' },
];

const ok = (url, opts) => {
	const r = classifyUrl(url, REG, opts);
	assert.equal(r.ok, true, `${url}: ${r.message}`);
};
const bad = (url, code, opts) => {
	const r = classifyUrl(url, REG, opts);
	assert.equal(r.ok, false, `${url} должен падать`);
	if (code) assert.equal(r.code, code, `${url}: ${r.message}`);
	return r;
};

test('настоящие ссылки проходят', () => {
	ok('https://www.aod.rs/clan/vest/sve_vesti');
	ok('https://aod.rs/');
	ok('https://www.nbs.rs/sr/');
	ok('https://webappcenter.nbs.rs/WebApp/x');
	ok('https://www.posted.co.rs/media/novosti.html');
	ok('https://t.me/Altadef50k/123');
});

test('гомоглифы: кириллица и греческий в хосте → idn с подсказкой', () => {
	for (const [url, like] of [
		['https://www.аod.rs/', 'www.aod.rs'], // кириллическая «а»
		['https://www.aоd.rs/', 'www.aod.rs'], // кириллическая «о»
		['https://аоd.rs/', 'aod.rs'],
		['https://www.nbs.rѕ/', 'nbs.rs'],
		['https://www.роsted.co.rs/', 'www.posted.co.rs'], // кириллические «р», «о»
		['https://www.posted.сo.rs/', 'www.posted.co.rs'], // кириллическая «с»
		['https://www.nbѕ.rs/', 'nbs.rs'],
		['https://www.aοd.rs/', 'www.aod.rs'], // греческая омикрон
	]) {
		const r = bad(url, 'idn');
		assert.match(r.message, /похоже на/, url);
		assert.ok(r.like.replace(/^www\./, '') === like.replace(/^www\./, ''), `${url}: ${r.like}`);
	}
});

test('punycode xn-- вне реестра падает, в том числе настоящий punycode кириллического aod.rs', () => {
	const puny = domainToASCII('аоd.rs');
	assert.match(puny, /^xn--/);
	const r = bad(`https://${puny}/`, 'idn');
	assert.match(r.message, /похоже на aod\.rs/);
	bad('https://xn--80ak6aa92e.com/', 'idn');
	bad('https://www.xn--od-6kc.rs/', 'idn');
});

test('xn-- хост, явно внесённый в реестр, проходит', () => {
	const reg = [...REG, { domain: 'xn--80ak6aa92e.com', name: 'тест', category: 'tech', proof: 'тест', hosts: ['xn--80ak6aa92e.com'] }];
	assert.equal(classifyUrl('https://xn--80ak6aa92e.com/', reg).ok, true);
});

test('опечатки и комбосквоттинг → lookalike «похоже на aod.rs, но это другой домен»', () => {
	for (const host of ['a0d.rs', 'aodd.rs', 'aod.co', 'aod-rs.com', 'aod.rs.evil.com', 'aod.co.rs', 'www.aods.rs']) {
		const r = bad(`https://${host}/`, 'lookalike');
		assert.match(r.message, /похоже на aod\.rs .*но это другой домен/, host);
	}
	assert.match(bad('https://altabanka-isplata.com/', 'lookalike').message, /altabanka\.rs/);
	assert.match(bad('https://nbs-rs.info/', 'lookalike').message, /nbs\.rs/);
	assert.match(bad('https://posted.co.rs.login.net/', 'lookalike').message, /posted\.co\.rs/);
});

test('чужой хост с брендом в пути не проходит', () => {
	bad('https://evil.com/aod.rs', 'unknown-host');
	bad('https://evil.com/?u=https://www.aod.rs/', 'unknown-host');
});

test('логин@хост, порт, точка в конце', () => {
	bad('https://user@aod.rs@evil.com/', 'userinfo');
	bad('https://www.aod.rs@evil.com/', 'userinfo');
	bad('https://aod.rs:8080/', 'port');
	bad('https://aod.rs:443/', 'port');
	bad('https://aod.rs./', 'trailing-dot');
	bad('https://www.aod.rs./clan', 'trailing-dot');
});

test('http вместо https падает; исключение суда — только для своего хоста', () => {
	bad('http://www.aod.rs/', 'http');
	ok('http://www.bg.pr.sud.rs/sr/x');
	ok('https://www.vrh.sud.rs/');
	bad('http://www.vrh.sud.rs/', 'http');
	bad('http://bg.pr.sud.rs/', 'http');
});

test('сокращатели скрывают цель', () => {
	bad('https://maps.app.goo.gl/krKnvr2Qv7YLFV2b7', 'shortener');
	bad('https://bit.ly/abc', 'shortener');
});

test('заглавные буквы в хосте нормализуются, гомоглиф в верхнем регистре ловится', () => {
	ok('https://WWW.AOD.RS/clan');
	ok('https://Www.Nbs.Rs/sr/');
	bad('https://WWW.АOD.RS/', 'idn');
});

test('поддомены: * разрешает любые поддомены, явный список — только перечисленные', () => {
	ok('https://online.altabanka.rs/');
	ok('https://tpson.portal.sud.rs/tpprvs');
	bad('https://online.aod.rs/');
	bad('https://posted.co.rs/');
	bad('https://e.posted.co.rs/');
});

test('UGC-платформа: разрешены только пути из реестра', () => {
	ok('https://t.me/altadef50k');
	bad('https://t.me/scam', 'path');
	bad('https://t.me/Altadef50k_fake', 'path');
});

test('веб-архив проверяет вложенный адрес', () => {
	ok('https://web.archive.org/web/20261106024031/https://www.nbs.rs/sr/');
	ok('https://web.archive.org/web/20120530183826/http://www.nbs.rs:80/internet/x');
	const r = bad('https://web.archive.org/web/2024/https://evil.com/', 'archive-inner');
	assert.match(r.message, /evil\.com/);
	bad('https://web.archive.org/web/2024/https://www.аod.rs/', 'archive-inner');
	bad('https://web.archive.org/web/2024/https://www.nbs.rs:8080/', 'archive-inner');
	bad('http://web.archive.org/web/2024/https://www.nbs.rs/', 'http');
	bad('https://web.archive.org/https://www.nbs.rs/', 'archive-format');
});

test('короткий archive.ph: только как copy источника с проверенным url', () => {
	bad('https://archive.ph/oRzzn', 'archive-short');
	ok('https://archive.ph/oRzzn', { copyOf: 'https://www.nbs.rs/sr/' });
	bad('https://archive.ph/oRzzn', 'archive-short', { copyOf: 'https://evil.com/' });
	assert.deepEqual(checkSource({ url: 'https://www.nbs.rs/sr/', kind: 'official', copy: 'https://archive.ph/oRzzn' }, REG), []);
	assert.equal(checkSource({ url: 'https://evil.com/', kind: 'unverified', copy: 'https://archive.ph/oRzzn' }, REG).length, 1);
});

test('copy на другой домен — ошибка, тот же домен с www и без — ok', () => {
	const errs = checkSource({ url: 'https://www.aod.rs/x', kind: 'official', copy: 'https://web.archive.org/web/2026/https://www.nbs.rs/x' }, REG);
	assert.match(errs.join(), /копия другого сайта/);
	assert.deepEqual(checkSource({ url: 'https://www.aod.rs/x', kind: 'official', copy: 'https://web.archive.org/web/2026/https://aod.rs/x' }, REG), []);
	assert.deepEqual(checkSource({ url: 'https://www.aod.rs/x', kind: 'official', copy: '/docs/x.pdf' }, REG), []);
});

test('kind: official только у госорганов, судов, банков и регулятора', () => {
	assert.match(checkSource({ url: 'https://www.paragraf.rs/propisi/x.html', kind: 'official' }, REG).join(), /kind: official/);
	assert.match(checkSource({ url: 'https://aks.org.rs/', kind: 'official' }, REG).join(), /kind: official/);
	assert.match(checkSource({ url: 'https://www.danas.rs/x', kind: 'official' }, REG).join(), /kind: official/);
	assert.match(checkSource({ url: 'https://web.archive.org/web/2025/https://www.paragraf.rs/x', kind: 'official' }, REG).join(), /kind: official/);
	assert.match(checkSource({ url: 'https://alta.smolevich.com/img/x.png', kind: 'official' }, REG).join(), /kind: official/);
	assert.deepEqual(checkSource({ url: 'https://www.paragraf.rs/x', kind: 'reference' }, REG), []);
	assert.deepEqual(checkSource({ url: 'https://alta.smolevich.com/img/x.png', kind: 'own' }, REG), []);
	assert.match(checkSource({ url: 'https://www.paragraf.rs/x', kind: 'own' }, REG).join(), /kind: own/);
	for (const u of ['https://www.aod.rs/', 'https://www.nbs.rs/', 'https://altabanka.rs/', 'https://www.vrh.sud.rs/']) {
		assert.deepEqual(checkSource({ url: u, kind: 'official' }, REG), [], u);
	}
});

test('похожие легитимные домены из реестра не путаются между собой', () => {
	ok('https://aks.org.rs/');
	ok('https://akv.org.rs/');
});

test('запись реестра без name или proof не принимается', () => {
	const base = { domain: 'x.rs', name: 'X — организация', category: 'press', proof: 'whois', hosts: ['x.rs'] };
	assert.deepEqual(validateRegistry([base]), []);
	assert.match(validateRegistry([{ ...base, name: undefined }]).join(), /нет поля name/);
	assert.match(validateRegistry([{ ...base, proof: '  ' }]).join(), /нет поля proof/);
	assert.match(validateRegistry([{ ...base, category: 'friends' }]).join(), /неизвестная категория/);
	assert.match(validateRegistry([{ ...base, hosts: ['x.rs.evil.com'] }]).join(), /не относится/);
	assert.match(validateRegistry([{ ...base, http_ok: ['y.rs'] }]).join(), /http_ok/);
});

test('реальный реестр валиден: у каждого домена есть name и proof', () => {
	assert.deepEqual(validateRegistry(loadRegistry()), []);
});

test('извлечение ссылок: текст и html', () => {
	assert.deepEqual(extractUrls('см. https://www.aod.rs/x. и (https://nbs.rs/y)').map((u) => u.url), ['https://www.aod.rs/x', 'https://nbs.rs/y']);
	assert.deepEqual(extractUrls('/http:\\/\\//i.test(url)'), []);
	const html = '<a href="http://www.aod.rs">www.aod.rs</a><img src="//evil.com/x.png"><a href="/en/">x</a>';
	assert.deepEqual(extractHtmlUrls(html).map((u) => u.url), ['http://www.aod.rs', 'protocol-relative://evil.com/x.png']);
	assert.equal(classifyUrl('http://www.aod.rs', REG).code, 'http');
});

test('ложных срабатываний нет: весь текущий контент и dist проходят', () => {
	const reg = loadRegistry();
	const src = checkSourceTree(reg);
	assert.deepEqual(src.errors, []);
	assert.ok(src.count > 800);
	const dist = checkDist(reg, src.verifiedCopies);
	if (dist.files) assert.deepEqual(dist.errors, []);
});

// Мутации: 20 реальных ссылок сайта, каждая испорчена — все должны падать.
const MUTATORS = [
	(h) => h.replace(/[ao]/, (c) => (c === 'a' ? 'а' : 'о')), // кириллическая а/о
	(h) => h.replace(/[ao](?=[^ao]*$)/, (c) => (c === 'a' ? 'α' : 'ο')), // греческие альфа/омикрон
	(h) => `${h}.evil.com`,
	(h) => h.replace(/\.([a-z]+)$/, '-$1.com'),
	(h) => h.replace(/([a-z])\./, '$1$1.'), // двойная буква
	(h) => h.replace(/[ao]/, (c) => (c === 'a' ? '4' : '0')),
	(h) => `${h}.`,
	(h) => h.replace(/\.rs$/, '.co'),
];

test('мутационная проверка: 20 испорченных реальных ссылок падают', () => {
	const reg = loadRegistry();
	const { verifiedCopies } = checkSourceTree(reg);
	const seen = new Map();
	for (const u of new Set(collectAll())) {
		const host = new URL(u).hostname;
		if (!seen.has(host) && /[ao]/.test(host) && !['web.archive.org', 'archive.ph'].includes(host)) seen.set(host, u);
	}
	const sample = [...seen.values()].slice(0, 20);
	assert.equal(sample.length, 20);
	sample.forEach((u, i) => {
		const url = new URL(u);
		const m = MUTATORS[i % MUTATORS.length];
		const mutated = u.replace(url.hostname, m(url.hostname));
		assert.notEqual(mutated, u, `мутация не изменила ${u}`);
		const r = classifyUrl(mutated, reg);
		assert.equal(r.ok, false, `испорченная ${mutated} прошла`);
	});
	assert.ok(verifiedCopies.size > 0);
});

function collectAll() {
	const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
	return walk('src/content').flatMap((f) => extractUrls(readFileSync(f, 'utf8')).map((x) => x.url));
}

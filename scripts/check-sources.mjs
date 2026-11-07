// --dist also scans the built HTML: GFM autolinks (a bare "www.aod.rs") exist only there.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { domainToUnicode } from 'node:url';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const OFFICIAL_CATEGORIES = new Set(['official-rs-gov', 'court', 'bank', 'regulator']);
const CATEGORIES = new Set([...OFFICIAL_CATEGORIES, 'reference', 'press', 'archive', 'social', 'own', 'tech']);
const REQUIRED = ['domain', 'name', 'category', 'proof', 'hosts'];
const SHORTENERS = new Set([
	'goo.gl', 'maps.app.goo.gl', 'bit.ly', 't.co', 'tinyurl.com', 'is.gd', 'cutt.ly', 'ow.ly', 'rb.gy',
	'shorturl.at', 'tiny.cc', 'buff.ly', 'rebrand.ly', 'clck.ru', 'vk.cc',
]);
// A source may be cited at its domain's trust level or below, never above it.
const KIND_CATEGORIES = {
	official: OFFICIAL_CATEGORIES,
	reference: new Set([...OFFICIAL_CATEGORIES, 'reference']),
	reliable_media: new Set([...OFFICIAL_CATEGORIES, 'reference', 'press']),
	own: new Set(['own']),
};

// A small subset of Unicode TR39 confusables: only the substitutions commonly used to spoof Latin domains.
const CONFUSABLES = {
	а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
	ѕ: 's', і: 'i', ї: 'i', ј: 'j', һ: 'h', ԁ: 'd', ԛ: 'q', ԝ: 'w', ӏ: 'l', ь: 'b', г: 'r', п: 'n', з: '3',
	α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't', υ: 'u', χ: 'x', ω: 'w',
	γ: 'y', μ: 'u', ς: 'c', σ: 'o',
	'0': 'o', '1': 'l', '|': 'l', i: 'l',
};

export function skeleton(host) {
	let s = host.normalize('NFKC').toLowerCase();
	s = [...s].map((c) => CONFUSABLES[c] ?? c).join('');
	return s.replaceAll('rn', 'm').replaceAll('vv', 'w');
}

export function levenshtein(a, b) {
	let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
		}
		prev = cur;
	}
	return prev[b.length];
}

export function validateRegistry(entries) {
	const errors = [];
	if (!Array.isArray(entries)) return ['реестр должен быть списком записей'];
	entries.forEach((e, i) => {
		const id = e?.domain ?? `#${i + 1}`;
		for (const f of REQUIRED) {
			const v = e?.[f];
			if (v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) {
				errors.push(`реестр: у ${id} нет поля ${f}`);
			}
		}
		if (e?.category && !CATEGORIES.has(e.category)) errors.push(`реестр: у ${id} неизвестная категория ${e.category}`);
		for (const h of e?.hosts ?? []) {
			if (h !== '*' && h !== e.domain && !String(h).endsWith(`.${e.domain}`)) {
				errors.push(`реестр: хост ${h} не относится к домену ${id}`);
			}
		}
		for (const h of e?.http_ok ?? []) {
			if (!hostInEntry(h, e)) errors.push(`реестр: http_ok ${h} не входит в hosts домена ${id}`);
		}
	});
	return errors;
}

function hostInEntry(host, entry) {
	return (entry.hosts ?? []).some((h) =>
		h === '*' ? host === entry.domain || host.endsWith(`.${entry.domain}`) : h === host,
	);
}

export function findEntry(host, registry) {
	return registry.find((e) => hostInEntry(host, e));
}

function pathAllowed(pathname, entry) {
	if (!entry.paths) return true;
	const p = pathname.toLowerCase();
	return entry.paths.some((prefix) => {
		const q = prefix.toLowerCase();
		return p === q || p.startsWith(q.endsWith('/') ? q : `${q}/`) || (q.endsWith('/') && p === q.slice(0, -1));
	});
}

const strip = (h) => h.replace(/^www\./, '');
const brand = (domain) => domain.split('.')[0];

// Only shapes the error message: an unregistered host fails either way.
export function lookalike(host, registry) {
	const unicode = domainToUnicode(host) || host;
	const sk = skeleton(strip(unicode));
	const tokens = host.split(/[.-]/);
	for (const e of registry) {
		const known = [...(e.hosts ?? []).filter((h) => h !== '*'), e.domain];
		for (const k of known) {
			if (skeleton(strip(k)) === sk) return { like: k, entry: e, why: 'skeleton' };
		}
		const d = levenshtein(strip(host), strip(e.domain));
		if (d > 0 && d <= (brand(e.domain).length <= 4 ? 1 : 2)) return { like: e.domain, entry: e, why: 'typo' };
		const b = brand(e.domain);
		if (b.length >= 3 && (tokens.includes(b) || host.includes(e.domain) || tokens.some((t) => t.startsWith(b) && b.length >= 6))) {
			return { like: e.domain, entry: e, why: 'combo' };
		}
	}
	return null;
}

const fail = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

// Read before URL normalizes it, otherwise non-ASCII hosts and trailing dots are invisible.
function rawAuthority(raw) {
	const m = raw.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i);
	return m ? m[1] : '';
}

function parseWayback(url) {
	const m = url.pathname.match(/^\/web\/\d+[a-z_]*\/(.+)$/);
	if (!m) return null;
	return m[1] + url.search + url.hash;
}

// opts.inner: URL inside a web archive, where old snapshots legitimately carry http and :80/:443.
// opts.copyOf: the source URL this link archives; short archive.ph links are trusted only through it.
export function classifyUrl(raw, registry, opts = {}) {
	const authority = rawAuthority(raw);
	if (!authority) return fail('scheme', `не абсолютная ссылка с протоколом: ${raw}`);
	if (authority.includes('@')) return fail('userinfo', `в адресе есть «логин@»: настоящий хост — после @ (${raw})`);
	let url;
	try {
		url = new URL(raw);
	} catch {
		return fail('parse', `ссылка не разбирается: ${raw}`);
	}
	const host = url.hostname.toLowerCase();
	const rawHost = authority.replace(/:\d*$/, '');
	if (!['http:', 'https:'].includes(url.protocol)) return fail('scheme', `протокол ${url.protocol} не разрешён`);
	if (url.username || url.password) return fail('userinfo', `в адресе есть «логин@» (${raw})`);
	if (host.endsWith('.') || rawHost.endsWith('.')) return fail('trailing-dot', `точка в конце хоста: ${rawHost}`);
	const allowedPorts = opts.inner ? ['', '80', '443'] : [''];
	if (!allowedPorts.includes(url.port) || /:\d+$/.test(authority) && !opts.inner) {
		return fail('port', `нестандартный порт в адресе: ${authority}`);
	}

	const entry = findEntry(host, registry);
	const nonAscii = /[^\x00-\x7f]/.test(rawHost);
	if ((nonAscii || host.split('.').some((l) => l.startsWith('xn--'))) && !(entry && entry.hosts.includes(host))) {
		const like = lookalike(host, registry);
		const shown = domainToUnicode(host) || host;
		return fail('idn', `хост ${shown} (${host}) с не-латинскими символами` + (like ? ` — похоже на ${like.like}, но это другой домен` : ''), { like: like?.like });
	}
	if (SHORTENERS.has(host)) return fail('shortener', `сокращатель ${host}: цель ссылки скрыта, нужна полная ссылка`);
	if (!entry) {
		const like = lookalike(host, registry);
		return fail(
			like ? 'lookalike' : 'unknown-host',
			like ? `${host} — похоже на ${like.like} (${like.entry.name.split(' — ')[0]}), но это другой домен` : `домена ${host} нет в реестре src/data/trusted-domains.yaml`,
			{ like: like?.like },
		);
	}
	if (url.protocol === 'http:' && !opts.inner && !(entry.http_ok ?? []).includes(host)) {
		return fail('http', `http вместо https: ${raw}`);
	}
	if (!pathAllowed(url.pathname, entry)) {
		return fail('path', `на ${host} разрешены только ${entry.paths.join(', ')}; ${url.pathname} нет в реестре`);
	}

	if (entry.archive === 'wayback') {
		if (opts.inner) return fail('archive-nested', `архив внутри архива: ${raw}`);
		const innerRaw = parseWayback(url);
		if (!innerRaw) return fail('archive-format', `ссылка веб-архива не в формате /web/<время>/<адрес>: ${raw}`);
		const inner = classifyUrl(innerRaw, registry, { inner: true });
		if (!inner.ok) return fail('archive-inner', `в архиве: ${inner.message}`, { inner });
		return { ok: true, host, entry: inner.entry, archive: entry, innerHost: inner.host };
	}
	if (entry.archive === 'archive-ph') {
		if (opts.inner) return fail('archive-nested', `архив внутри архива: ${raw}`);
		if (!opts.copyOf) {
			return fail('archive-short', `короткая ссылка archive.ph не показывает, что сохранено; допустима только как copy проверенного источника: ${raw}`);
		}
		const orig = classifyUrl(opts.copyOf, registry);
		if (!orig.ok) return fail('archive-short', `archive.ph — копия непроверенного источника: ${orig.message}`);
		return { ok: true, host, entry: orig.entry, archive: entry, innerHost: orig.innerHost ?? orig.host };
	}
	return { ok: true, host, entry };
}

export function checkSource(src, registry) {
	const errors = [];
	const res = classifyUrl(src.url, registry);
	if (!res.ok) {
		errors.push(res.message);
		return errors;
	}
	const allowed = KIND_CATEGORIES[src.kind];
	if (allowed && !allowed.has(res.entry.category)) {
		errors.push(`kind: ${src.kind} у ${res.innerHost ?? res.host} (категория ${res.entry.category}) не допускается; разрешены категории: ${[...allowed].join(', ')}`);
	}
	if (src.copy && /^https?:/i.test(src.copy)) {
		const copy = classifyUrl(src.copy, registry, { copyOf: src.url });
		if (!copy.ok) errors.push(`copy: ${copy.message}`);
		else if (copy.entry.domain !== res.entry.domain) {
			errors.push(`copy ведёт на ${copy.innerHost ?? copy.host}, а оригинал на ${res.innerHost ?? res.host}: копия другого сайта`);
		}
	}
	return errors;
}

const URL_RE = /(?<![\w/])https?:\/\/[^\s)"'<>\]}`\\]+/gi;
const SRC_EXT = /\.(md|mdx|astro|ts|json|mjs)$/;

const walk = (dir) =>
	existsSync(dir)
		? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
		: [];

const lineOf = (text, index) => text.slice(0, index).split('\n').length;
const trimTail = (u) => u.replace(/[.,;:!?]+$/, '').replace(/&amp;/g, '&');

export function extractUrls(text) {
	return [...text.matchAll(URL_RE)].map((m) => ({ url: trimTail(m[0]), line: lineOf(text, m.index) }));
}

export function extractHtmlUrls(html) {
	const out = [];
	for (const m of html.matchAll(/\s(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
		let u = m[1].replace(/&amp;/g, '&').trim();
		if (u.startsWith('//')) u = `protocol-relative:${u}`;
		if (/^(https?:|protocol-relative:)/i.test(u)) out.push({ url: u, line: lineOf(html, m.index) });
	}
	return out;
}

function frontmatterSources(text) {
	const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*$/m);
	if (!m) return [];
	try {
		return parse(m[1])?.sources ?? [];
	} catch {
		return [];
	}
}

export function loadRegistry(path = 'src/data/trusted-domains.yaml') {
	return parse(readFileSync(path, 'utf8'));
}

function collectSources(files) {
	const out = [];
	for (const f of files) {
		const text = readFileSync(f, 'utf8');
		const list = f.endsWith('.json') ? jsonSources(text) : /\.mdx?$/.test(f) ? frontmatterSources(text) : [];
		for (const s of list) {
			const i = text.indexOf(s.url);
			out.push({ file: f, line: i < 0 ? 1 : lineOf(text, i), src: s });
		}
	}
	return out;
}

function jsonSources(text) {
	const found = [];
	const visit = (v) => {
		if (Array.isArray(v)) v.forEach(visit);
		else if (v && typeof v === 'object') {
			if (Array.isArray(v.sources)) found.push(...v.sources.filter((s) => s?.url));
			Object.values(v).forEach(visit);
		}
	};
	try {
		visit(JSON.parse(text));
	} catch {}
	return found;
}

export function checkSourceTree(registry, root = '.') {
	const files = [...walk(join(root, 'src')).filter((f) => SRC_EXT.test(f)), join(root, 'astro.config.mjs')].filter(existsSync);
	const errors = [];
	const sources = collectSources(files);
	const verifiedCopies = new Map();
	for (const { file, line, src } of sources) {
		const errs = checkSource(src, registry);
		for (const e of errs) errors.push(`${relative(root, file)}:${line} ${e}`);
		if (!errs.length && src.copy) verifiedCopies.set(src.copy, src.url);
	}
	for (const f of files) {
		const text = readFileSync(f, 'utf8');
		for (const { url, line } of extractUrls(text)) {
			const res = classifyUrl(url, registry, { copyOf: verifiedCopies.get(url) });
			if (!res.ok) errors.push(`${relative(root, f)}:${line} ${res.message}`);
		}
	}
	return { errors, verifiedCopies, count: sources.length };
}

export function checkDist(registry, verifiedCopies, dir = 'dist') {
	const errors = [];
	const files = walk(dir).filter((f) => f.endsWith('.html') && !f.includes(`${join(dir, '_astro')}`));
	if (!files.length) return { errors: [`${dir}: нет html, сначала npm run build`], files: 0 };
	for (const f of files) {
		const html = readFileSync(f, 'utf8');
		for (const { url, line } of extractHtmlUrls(html)) {
			if (url.startsWith('protocol-relative:')) {
				errors.push(`${f}:${line} ссылка без протокола: ${url.slice('protocol-relative:'.length)}`);
				continue;
			}
			const res = classifyUrl(url, registry, { copyOf: verifiedCopies.get(url) });
			if (!res.ok) errors.push(`${f}:${line} ${res.message}`);
		}
	}
	return { errors, files: files.length };
}

function main() {
	const registry = loadRegistry();
	const regErrors = validateRegistry(registry);
	if (regErrors.length) {
		console.error(regErrors.join('\n'));
		process.exit(1);
	}
	const src = checkSourceTree(registry);
	let errors = src.errors;
	let what = `${src.count} источников и ссылки в src/`;
	if (process.argv.includes('--dist')) {
		const dist = checkDist(registry, src.verifiedCopies);
		errors = dist.errors;
		what = `${dist.files} html-файлов в dist/`;
	}
	if (errors.length) {
		console.error(`Ссылки не прошли проверку по реестру доменов (${errors.length}):\n` + errors.join('\n'));
		process.exit(1);
	}
	console.log(`check-sources: ok — ${what}, реестр ${registry.length} доменов`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();

// Built-site check: element ids are ASCII only, and the old anchors from public/anchor-redirects.json
// lead to ids that exist on the page. A Cyrillic id in a link becomes %D0%…, and such a
// link is awkward to share; a broken map entry silently breaks an already sent link.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function elementIds(html) {
	return [...html.matchAll(/\sid="([^"]*)"/g)].map((m) => m[1]);
}

export function nonAsciiIds(html) {
	return elementIds(html).filter((id) => /[^\x21-\x7e]/.test(id));
}

export function missingTargets(redirects, idsByPage) {
	const missing = [];
	for (const [page, map] of Object.entries(redirects)) {
		const ids = idsByPage.get(page) ?? new Set();
		for (const [from, to] of Object.entries(map)) if (!ids.has(to)) missing.push(`${page}#${from} → #${to}`);
	}
	return missing;
}

function htmlFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
	);
}

function pagePath(dist, file) {
	return `/${relative(dist, file).split(sep).join('/')}`.replace(/index\.html$/, '');
}

function main(dist) {
	const problems = [];
	const idsByPage = new Map();
	for (const file of htmlFiles(dist)) {
		const html = readFileSync(file, 'utf8');
		idsByPage.set(pagePath(dist, file), new Set(elementIds(html)));
		for (const id of nonAsciiIds(html)) problems.push(`${relative(dist, file)}: id="${id}" не ASCII`);
	}
	const redirects = JSON.parse(readFileSync(join(dist, 'anchor-redirects.json'), 'utf8'));
	for (const m of missingTargets(redirects, idsByPage)) problems.push(`anchor-redirects.json: ${m} — такого id нет`);
	if (problems.length) {
		console.error(problems.join('\n'));
		process.exit(1);
	}
	console.log(`Якоря в порядке: ${idsByPage.size} страниц.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv[2] ?? 'dist');

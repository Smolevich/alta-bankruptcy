import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regression: on /sr/bank/ at 1280 px a line started with "%": the component text
// (Ownership.astro) bypasses the rehype plugin, and "100 %" with a regular space wrapped.
// We check the built pages: this catches any component, not only the one that broke.
const DIST = new URL('../dist/', import.meta.url).pathname;

function htmlFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
	);
}

const SKIP = new Set(['script', 'style', 'code', 'pre']);

// Page text without tags and without the contents of script/style/code/pre: split by tags rather than
// cut out by replacement: this is reading built HTML, not sanitizing input.
function visibleText(html) {
	const parts = html.split('</head>').pop().split(/(<[^>]*>)/);
	let skipping = null;
	const out = [];
	for (const part of parts) {
		const tag = /^<(\/?)([a-z0-9]+)/i.exec(part);
		if (tag) {
			const name = tag[2].toLowerCase();
			if (!skipping && !tag[1] && SKIP.has(name)) skipping = name;
			else if (skipping === name && tag[1]) skipping = null;
			out.push(' ');
		} else if (!skipping) out.push(part);
	}
	return out.join('');
}

export function breakablePercents(html) {
	return [...visibleText(html).matchAll(/.{0,30}\d[ \t]+%/g)].map((m) => m[0].trim());
}

test('breakablePercents finds an ordinary space before % and ignores a non-breaking one', () => {
	assert.deepEqual(breakablePercents('<head><meta content="100 %"></head><p>ALTA GROUP, 100 %</p>'), ['ALTA GROUP, 100 %']);
	assert.deepEqual(breakablePercents('<p>100 %</p><script>a = 1 %</script>'), []);
});

test('built pages keep % on the same line as its number', { skip: !existsSync(DIST) && 'dist/ not built' }, () => {
	const hits = htmlFiles(DIST).flatMap((f) => breakablePercents(readFileSync(f, 'utf8')).map((h) => `${f.slice(DIST.length)}: ${h}`));
	assert.deepEqual(hits, []);
});

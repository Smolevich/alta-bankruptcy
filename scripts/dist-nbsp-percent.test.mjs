import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Регрессия 19.11.2026: на /sr/bank/ при 1280 px строка начиналась с «%» — текст компонента
// (Ownership.astro) идёт мимо rehype-плагина, и «100 %» с обычным пробелом переносился.
// Проверяем готовые страницы: так ловится любой компонент, а не только тот, что сломался.
const DIST = new URL('../dist/', import.meta.url).pathname;

function htmlFiles(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : [],
	);
}

export function breakablePercents(html) {
	const body = html.split('</head>').pop();
	const text = body.replace(/<(script|style|code|pre)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ');
	return [...text.matchAll(/.{0,30}\d[ \t]+%/g)].map((m) => m[0].trim());
}

test('breakablePercents finds an ordinary space before % and ignores a non-breaking one', () => {
	assert.deepEqual(breakablePercents('<head><meta content="100 %"></head><p>ALTA GROUP, 100 %</p>'), ['ALTA GROUP, 100 %']);
	assert.deepEqual(breakablePercents('<p>100 %</p><script>a = 1 %</script>'), []);
});

test('built pages keep % on the same line as its number', { skip: !existsSync(DIST) && 'dist/ not built' }, () => {
	const hits = htmlFiles(DIST).flatMap((f) => breakablePercents(readFileSync(f, 'utf8')).map((h) => `${f.slice(DIST.length)}: ${h}`));
	assert.deepEqual(hits, []);
});

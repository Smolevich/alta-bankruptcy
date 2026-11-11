import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { frontmatterDate, lastmodByPath, pagePath } from '../src/sitemap-lastmod.mjs';

test('home pages of every language map to their root path', () => {
	assert.deepEqual(['index.mdx', 'en/index.mdx', 'sr/vyplata.mdx'].map(pagePath), ['/', '/en/', '/sr/vyplata/']);
});

test('date is read from frontmatter only, not from the body', () => {
	const src = '---\ntitle: "x"\nchecked: 2026-11-10\n---\n\nchecked: 2026-12-31\n';
	assert.equal(frontmatterDate(src, 'checked'), '2026-11-10');
});

test('news page takes the newest news date of its own language', () => {
	const root = mkdtempSync(join(tmpdir(), 'lastmod-'));
	const docs = join(root, 'docs');
	const news = join(root, 'news');
	for (const d of [docs, join(docs, 'en'), join(news, 'ru'), join(news, 'en')]) mkdirSync(d, { recursive: true });
	writeFileSync(join(docs, 'novosti.mdx'), '---\nchecked: 2026-11-01\n---\n');
	writeFileSync(join(docs, 'en', 'novosti.mdx'), '---\nchecked: 2026-11-01\n---\n');
	writeFileSync(join(news, 'ru', 'a.md'), '---\ndate: 2026-11-09\n---\n');
	writeFileSync(join(news, 'en', 'a.md'), '---\ndate: 2026-11-05\n---\n');
	const map = lastmodByPath(docs, news);
	assert.deepEqual([map.get('/novosti/'), map.get('/en/novosti/')], ['2026-11-09', '2026-11-05']);
});

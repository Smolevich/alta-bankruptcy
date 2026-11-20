import { test } from 'node:test';
import assert from 'node:assert/strict';
import rehypeNbspPercent, { bindFileExt, bindPercent } from '../src/rehype-nbsp-percent.mjs';

// Regression: on /vyplata/ at 390 px the link "бланк .docx" broke before ".docx".
test('space before a file extension in link text becomes non-breaking', () => {
	assert.equal(bindFileExt('бланк .docx'), 'бланк\u00a0.docx');
	assert.equal(bindFileExt('complaint form .docx, items'), 'complaint form\u00a0.docx, items');
	assert.equal(bindFileExt('obrazac .DOC i PDF .pdf'), 'obrazac\u00a0.DOC i PDF\u00a0.pdf');
});

test('a dot followed by a longer word is not treated as an extension', () => {
	assert.equal(bindFileExt('см .docsend и .pdfs'), 'см .docsend и .pdfs');
});

test('extension inside a link element is bound by the plugin', () => {
	const tree = {
		type: 'root',
		children: [{ type: 'element', tagName: 'a', children: [{ type: 'text', value: 'бланк .docx' }] }],
	};
	rehypeNbspPercent()(tree);
	assert.equal(tree.children[0].children[0].value, 'бланк\u00a0.docx');
});

test('space between a number and % becomes non-breaking', () => {
	assert.equal(bindPercent('в кассе — 0,5 % (мин. 300)'), 'в кассе — 0,5 % (мин. 300)');
});

test('every occurrence in a line is bound', () => {
	assert.equal(bindPercent('по 100 %, 40 % и 10 %'), 'по 100 %, 40 % и 10 %');
});

test('text without a number before % stays as is', () => {
	assert.equal(bindPercent('100% — пик; ставка %'), '100% — пик; ставка %');
});

test('code is left untouched', () => {
	const tree = {
		type: 'root',
		children: [
			{ type: 'element', tagName: 'p', children: [{ type: 'text', value: '50 %' }] },
			{ type: 'element', tagName: 'code', children: [{ type: 'text', value: '50 %' }] },
		],
	};
	rehypeNbspPercent()(tree);
	assert.equal(tree.children[0].children[0].value, '50 %');
	assert.equal(tree.children[1].children[0].value, '50 %');
});

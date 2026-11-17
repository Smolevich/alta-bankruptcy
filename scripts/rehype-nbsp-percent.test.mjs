import { test } from 'node:test';
import assert from 'node:assert/strict';
import rehypeNbspPercent, { bindPercent } from '../src/rehype-nbsp-percent.mjs';

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

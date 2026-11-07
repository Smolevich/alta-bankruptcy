import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nonAsciiIds, missingTargets } from './check-anchors.mjs';

// Регрессия: слаг из русского заголовка давал id="отделения-poštanska-для-выплаты" и ссылку с %D0%….
test('cyrillic and latin-diacritic heading ids are reported', () => {
	const html = '<h2 id="отделения-poštanska">x</h2><h2 id="postanska-branches">y</h2><h2 id="šta-poneti">z</h2>';
	assert.deepEqual(nonAsciiIds(html), ['отделения-poštanska', 'šta-poneti']);
});

test('ascii ids pass', () => {
	assert.deepEqual(nonAsciiIds('<div id="starlight__search"></div><h2 id="what-to-bring"></h2>'), []);
});

test('redirect pointing to an id the page lacks is reported', () => {
	const ids = new Map([['/vyplata/', new Set(['what-to-bring'])]]);
	const redirects = { '/vyplata/': { 'chto-vzyat': 'what-to-bring', otdeleniya: 'postanska-branches' } };
	assert.deepEqual(missingTargets(redirects, ids), ['/vyplata/#otdeleniya → #postanska-branches']);
});

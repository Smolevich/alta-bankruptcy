import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { applyEdits, emptyEdits, hasEdits, parseEdits, blockText } from '../src/lib/doc-editor/blocks.mjs';

const blocks = [
	{ id: 'a', runs: [{ t: 'Первый абзац' }] },
	{ id: 'b', list: ['один', 'два'] },
	{ id: 'c', runs: [{ t: 'Третий' }] },
];

test('without edits the template comes back unchanged', () => {
	assert.deepEqual(applyEdits(blocks, emptyEdits()), blocks);
});

test('an edited paragraph replaces the template text as is', () => {
	const e = { ...emptyEdits(), edited: { a: 'Мой текст' } };
	assert.equal(blockText(applyEdits(blocks, e)[0]), 'Мой текст');
});

test('an edited list turns lines into items', () => {
	const e = { ...emptyEdits(), edited: { b: 'x\n\ny' } };
	assert.deepEqual(applyEdits(blocks, e)[1].list, ['x', 'y']);
});

test('removed blocks are skipped, an added paragraph follows its block', () => {
	const e = { ...emptyEdits(), removed: ['a'], extra: [{ id: 'x1', after: 'b', text: 'Свой абзац' }] };
	assert.deepEqual(applyEdits(blocks, e).map((b) => b.id), ['b', 'x1', 'c']);
});

test('reset is dropping the key: the template text returns', () => {
	const e = { ...emptyEdits(), edited: { a: 'Мой текст' } };
	delete e.edited.a;
	assert.equal(hasEdits(e), false);
	assert.equal(blockText(applyEdits(blocks, e)[0]), 'Первый абзац');
});

test('old or broken saved data opens as no edits', () => {
	for (const raw of [null, '', 'not json', '[]', '{"edited":5,"removed":"x"}', undefined]) {
		assert.equal(hasEdits(parseEdits(raw)), false);
	}
});

test('an empty added paragraph does not count as an edit', () => {
	assert.equal(hasEdits({ ...emptyEdits(), extra: [{ id: 'x', after: 'a', text: '  ' }] }), false);
});

const base = {
	caseNo: '275/2026', name: 'ИМЕ ПРЕЗИМЕ', address: ['Београд, Тест 1'], jmbg: '0101990710000', passport: '', phone: '', email: '',
	account: ['265-0000'], bank: ['Банка'], bankSeat: 'Београд', debtor: 'ALTA', debtorSeat: 'Београда', debtorRep: 'АОД', debtorMb: '1', debtorPib: '2',
	decisionDate: '03.11.2026.', gazetteNo: '109', gazetteDate: '06.11.2026.', days: '90',
	amount: ['45.000,00 евра', '120.000,00 динара'], basis: [], contracts: [], funds: [], received: [], remaining: [], rate: '117,5698',
	deliveryAddress: '', deliveryEmail: '', evidence: ['Преглед'], place: 'Београду', date: '23.11.2026.',
};

const pdfText = (data) =>
	execFileSync('node', ['--no-warnings', '--experimental-transform-types', 'scripts/pdf-text-helper.mts'], { input: JSON.stringify(data), encoding: 'utf8' }).replace(/\s+/g, ' ');

test('PDF: amount lines appear as separate bullets, old one-line string still builds', () => {
	const t = pdfText(base);
	assert.match(t, /\* 45\.000,00 евра/);
	assert.match(t, /\* 120\.000,00 динара/);
	assert.match(pdfText({ ...base, amount: '23.450,00 EUR' }), /23\.450,00 EUR/);
});

test('PDF: an edited block is printed as written, a removed one disappears', () => {
	const e = { edited: { deadline: 'МОЈ СОПСТВЕНИ АБЗАЦ О РОКУ' }, removed: ['basisLead'], extra: [{ id: 'x', after: 'deadline', text: 'ДОДАТНИ АБЗАЦ' }] };
	const t = pdfText({ ...base, _edits: JSON.stringify(e) });
	assert.match(t, /МОЈ СОПСТВЕНИ АБЗАЦ О РОКУ/);
	assert.match(t, /ДОДАТНИ АБЗАЦ/);
	assert.doesNotMatch(t, /Огласом су позвани/);
	assert.doesNotMatch(t, /заснивају се на чињеницама/);
});

test('PDF: empty optional blocks are left out, filled ones appear', () => {
	assert.doesNotMatch(pdfText(base), /закључио следеће уговоре/);
	assert.match(pdfText({ ...base, contracts: ['Уговор о рачуну од 15.04.2024'] }), /закључио следеће уговоре/);
});

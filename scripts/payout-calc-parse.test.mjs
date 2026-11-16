import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, payout } from '../src/lib/payout-calc.mjs';

const cases = [
	['60.000', 60000],
	['60,000', 60000],
	['7.000.000', 7000000],
	['1,234,567', 1234567],
	['50.000,50', 50000.5],
	['60000.5', 60000.5],
	['1,5', 1.5],
	['60 000', 60000],
	['60 000', 60000],
	['30000', 30000],
];

for (const [input, expected] of cases) {
	test(`"${input}" parses as ${expected}`, () => {
		assert.equal(parseAmount(input), expected);
	});
}

for (const input of ['abc', '', '   ', '1.2345', '12abc', '-5']) {
	test(`"${input}" is rejected, not read as zero`, () => {
		assert.equal(parseAmount(input), null);
	});
}

test('regression: 60.000 € requires a court claim', () => {
	const r = payout({ eur: parseAmount('60.000') });
	assert.equal(r.overLimit, true);
	assert.equal(r.claimEur, 10000);
});

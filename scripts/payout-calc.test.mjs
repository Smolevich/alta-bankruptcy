import { test } from 'node:test';
import assert from 'node:assert/strict';
import { payout } from '../src/lib/payout-calc.mjs';

test('example from the spreadsheet matches to the cent', () => {
	const r = payout({ eur: 30000, rsd: 23000000 });
	assert.deepEqual(
		[r.payEur, r.payRsd, r.claimEur, r.claimRsd, r.aodEur, r.aodRsd],
		[6648.1, 5096874.54, 23351.9, 17903125.46, 6648.1, 5096874.21],
	);
});

test('dinars only below the limit are paid in full in dinars', () => {
	const r = payout({ rsd: 1000000 });
	assert.deepEqual([r.payEur, r.payRsd, r.claimEur, r.claimRsd], [0, 1000000, 0, 0]);
});

test('euros only above the limit pay 50 000 and claim the rest', () => {
	const r = payout({ eur: 80000 });
	assert.deepEqual([r.payEur, r.payRsd, r.claimEur, r.claimRsd], [50000, 0, 30000, 0]);
});

test('other currencies converted to euros count as euros', () => {
	assert.deepEqual(payout({ eur: 10000, other: 20000, rsd: 23000000 }), payout({ eur: 30000, rsd: 23000000 }));
});

test('empty input pays nothing', () => {
	const r = payout({});
	assert.deepEqual([r.payEur, r.payRsd, r.claimEur, r.claimRsd], [0, 0, 0, 0]);
});

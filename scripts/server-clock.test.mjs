import { test } from 'node:test';
import assert from 'node:assert/strict';
import { belgradeParts, clockOffset } from '../src/lib/server-clock.mjs';

// Среда 11.11.2026, 10:00 по Белграду.
const SERVER = Date.parse('2026-11-11T09:00:00Z');

test('phone clock three hours ahead still gives Belgrade time from the server', () => {
	const device = SERVER + 3 * 3600_000;
	const offset = clockOffset('2026-11-11T09:00:00+00:00', 0, device);
	assert.deepEqual(belgradeParts(device + offset), { day: 3, min: 600 });
});

test('cached server time is moved forward by its age', () => {
	assert.equal(clockOffset('2026-11-11T09:00:00+00:00', 30, SERVER + 30_000), 0);
});

test('without server time the device clock is used', () => {
	assert.equal(clockOffset(undefined, 0, SERVER), 0);
});

test('Belgrade summer time before the switch on 25.10.2026', () => {
	assert.deepEqual(belgradeParts(Date.parse('2026-10-25T00:30:00Z')), { day: 0, min: 150 });
});

test('Belgrade winter time after the switch on 25.10.2026', () => {
	assert.deepEqual(belgradeParts(Date.parse('2026-10-25T01:30:00Z')), { day: 0, min: 150 });
});

test('winter time one hour behind summer time at the same UTC hour', () => {
	assert.equal(belgradeParts(Date.parse('2026-10-26T09:00:00Z')).min, 600);
});

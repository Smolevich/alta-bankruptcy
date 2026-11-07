import { test } from 'node:test';
import assert from 'node:assert/strict';
import { branchStatus, parseRange } from '../src/lib/branch-hours.mjs';
import { queueLevel, shortRange, statusTone, weekTiles } from '../src/lib/branch-card.mjs';

const WD = parseRange('08:00-17:00');
const SAT = parseRange('8.00h - 13.00h');
const at = (h, m = 0) => h * 60 + m;
const status = (day, min) => branchStatus(WD, SAT, day, min);

test('open with hours left is green, last hour is amber', () => {
	assert.deepEqual(statusTone(status(3, at(12))), { tone: 'open', icon: 'check' });
	assert.deepEqual(statusTone(status(3, at(16, 20))), { tone: 'soon', icon: 'clock' });
});

test('before opening is amber with sun, after closing is red with lock', () => {
	assert.deepEqual(statusTone(status(3, at(7, 30))), { tone: 'soon', icon: 'sun' });
	assert.deepEqual(statusTone(status(6, at(15, 20))), { tone: 'closed', icon: 'lock' });
	assert.deepEqual(statusTone(status(0, at(12))), { tone: 'closed', icon: 'lock' });
});

test('queue scale fills one segment per state, empty without marks', () => {
	assert.deepEqual(['none', 'few', 'full', 'outside', undefined].map(queueLevel), [1, 2, 3, 4, 0]);
});

test('tile hours drop zero minutes but keep real ones', () => {
	assert.equal(shortRange(WD), '8–17');
	assert.equal(shortRange(parseRange('07:30-15:00')), '7:30–15');
});

test('week starts on monday, sunday is a day off, today is marked', () => {
	const week = weekTiles(WD, SAT, 6);
	assert.deepEqual(week.map((d) => d.day), [1, 2, 3, 4, 5, 6, 0]);
	assert.deepEqual(week[5], { day: 6, hours: '8–13', today: true });
	assert.deepEqual(week[6], { day: 0, hours: null, today: false });
});

test('branch without saturday hours shows saturday as a day off', () => {
	assert.equal(weekTiles(WD, null, 3)[5].hours, null);
});

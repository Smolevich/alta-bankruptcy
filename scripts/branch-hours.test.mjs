import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { branchStatus, parseRange } from '../src/lib/branch-hours.mjs';

const WD = parseRange('08:00-19:00');
const SAT = parseRange('8.00h - 13.00h');
const at = (h, m = 0) => h * 60 + m;

test('weekday before opening opens later today', () => {
	assert.deepEqual(branchStatus(WD, SAT, 3, at(7, 30)), { state: 'later', opensAt: at(8) });
});

test('weekday within hours is open until closing', () => {
	assert.deepEqual(branchStatus(WD, SAT, 3, at(18, 30)), { state: 'open', closesAt: at(19), left: 30 });
});

test('weekday after closing opens tomorrow', () => {
	assert.deepEqual(branchStatus(WD, SAT, 3, at(19)), { state: 'closed', closedAt: at(19), nextDay: 4, opensAt: at(8), tomorrow: true });
});

test('friday evening opens on saturday morning', () => {
	assert.equal(branchStatus(WD, SAT, 5, at(20)).nextDay, 6);
});

// Регрессия 07.11: в сб 15:20 карточка писала «Сегодня, сб: 8:00–13:00» рядом с «Закрыто».
test('saturday after 13:00 is closed for the day and opens on monday', () => {
	assert.deepEqual(branchStatus(WD, SAT, 6, at(15, 20)), { state: 'closed', closedAt: at(13), nextDay: 1, opensAt: at(8), tomorrow: false });
});

test('sunday has no hours and opens tomorrow', () => {
	assert.deepEqual(branchStatus(WD, SAT, 0, at(12)), { state: 'closed', closedAt: null, nextDay: 1, opensAt: at(8), tomorrow: true });
});

test('branch closed on saturdays opens on monday after friday', () => {
	assert.equal(branchStatus(WD, null, 5, at(20)).nextDay, 1);
});

test('reports are allowed while open and in the hour before opening only', async () => {
	const { canReport, reportsFrom } = await import('../src/lib/branch-hours.mjs');
	const status = (day, min) => branchStatus(WD, SAT, day, min);
	assert.equal(canReport(status(3, at(12)), at(12)), true);
	assert.equal(canReport(status(3, at(7)), at(7)), true);
	assert.equal(canReport(status(3, at(6, 59)), at(6, 59)), false);
	assert.equal(canReport(status(3, at(21)), at(21)), false);
	assert.equal(reportsFrom(at(8)), at(7));
});

test('Saturday after closing and Sunday: no reports, next opening is Monday', async () => {
	const { canReport } = await import('../src/lib/branch-hours.mjs');
	const sat = branchStatus(WD, SAT, 6, at(16, 15));
	assert.equal(canReport(sat, at(16, 15)), false);
	assert.deepEqual(sat, { state: 'closed', closedAt: at(13), nextDay: 1, opensAt: at(8), tomorrow: false });
	assert.equal(canReport(branchStatus(WD, SAT, 0, at(10)), at(10)), false);
});

test('reports stay open for an hour after closing, then stop', async () => {
	const { canReport } = await import('../src/lib/branch-hours.mjs');
	const status = (day, min) => branchStatus(WD, SAT, day, min);
	assert.equal(canReport(status(3, at(19, 1)), at(19, 1)), true);
	assert.equal(canReport(status(3, at(19, 59)), at(19, 59)), true);
	assert.equal(canReport(status(3, at(20)), at(20)), false);
	assert.equal(canReport(status(6, at(13, 59)), at(13, 59)), true);
	assert.equal(canReport(status(6, at(14)), at(14)), false);
	assert.equal(canReport(status(0, at(8)), at(8)), false);
});

test('site and server use the same report window', async () => {
	const { PRE_OPEN_MIN, POST_CLOSE_MIN } = await import('../src/lib/branch-hours.mjs');
	const py = readFileSync(new URL('../backend/src/alta_feedback/queues.py', import.meta.url), 'utf8');
	assert.equal(Number(py.match(/^PRE_OPEN = (\d+)/m)[1]), PRE_OPEN_MIN);
	assert.equal(Number(py.match(/^POST_CLOSE = (\d+)/m)[1]), POST_CLOSE_MIN);
});

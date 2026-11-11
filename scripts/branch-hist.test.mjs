import { test } from 'node:test';
import assert from 'node:assert/strict';
import { histHtml, histValues } from '../src/lib/branch-hist.mjs';

const TEXT = { chartWd: 'будни', chartSat: 'суббота', chartLabel: 'Загрузка' };

test('hours without data in the attribute draw as zero bars', () => {
	assert.deepEqual(histValues('0,12,,40'), [0, 12, 0, 40]);
});

test('weekday chart has one bar per hour 8-20 and no Saturday row without data', () => {
	const html = histHtml(histValues('10,20,30,40,50,60,70,80,90,100,50,20,0'), [], TEXT);
	assert.deepEqual([html.match(/<rect /g).length, html.includes('суббота')], [13, false]);
});

test('bar height is the share of the branch peak on a 28-unit scale', () => {
	const height = Number(histHtml([100], [], TEXT).match(/<rect [^>]*height="([\d.]+)"/)[1]);
	assert.equal(Math.round(height), 28);
});

test('branch without weekday data gets no chart', () => {
	assert.equal(histHtml([], [5], TEXT), '');
});

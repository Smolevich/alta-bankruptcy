import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocksEnter } from '../src/lib/doc-editor/enter.mjs';

const key = (k, tagName) => ({ key: k, target: { tagName } });

test('Enter in a one-line input is blocked', () => {
	assert.equal(blocksEnter(key('Enter', 'INPUT')), true);
});

test('Enter in a textarea keeps its line break', () => {
	assert.equal(blocksEnter(key('Enter', 'TEXTAREA')), false);
});

test('Enter on a button still works', () => {
	assert.equal(blocksEnter(key('Enter', 'BUTTON')), false);
});

test('other keys in an input are not blocked', () => {
	assert.equal(blocksEnter(key('a', 'INPUT')), false);
});

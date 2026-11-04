// Unit tests for the pure strategy logic. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const S = require('../strategies.js');

const NOW = 1_000_000_000;
const MIN = 60 * 1000;
// Tabs A B [C closed] D E -> after close: A0 B1 D2 E3, C had index 2
const after = [{ id: 'A', index: 0 }, { id: 'B', index: 1 }, { id: 'D', index: 2 }, { id: 'E', index: 3 }];

test('proximity: left and right neighbour tie, more recently used wins', () => {
  assert.equal(S.proximity(after, 2, { B: NOW - 1 * MIN, D: NOW - 2 * MIN }).id, 'B');
  assert.equal(S.proximity(after, 2, { B: NOW - 2 * MIN, D: NOW - 1 * MIN }).id, 'D');
});

test('proximity: closing the last tab focuses its left neighbour', () => {
  const tabs = [{ id: 'A', index: 0 }, { id: 'B', index: 1 }];
  assert.equal(S.proximity(tabs, 2, {}).id, 'B');
});

test('proximity: closing the first tab focuses the new first tab', () => {
  const tabs = [{ id: 'B', index: 0 }, { id: 'C', index: 1 }];
  assert.equal(S.proximity(tabs, 0, {}).id, 'B');
});

test('lru: most recently used tab wins regardless of position', () => {
  assert.equal(S.lru(after, { A: NOW - 1 * MIN, B: NOW - 3 * MIN, E: NOW - 2 * MIN }).id, 'A');
});

test('hybrid: fresh neighbour is used', () => {
  assert.equal(S.hybrid(after, 2, { A: NOW - 1 * MIN, D: NOW - 2 * MIN }, NOW).id, 'D');
});

test('hybrid: stale neighbours (>5 min) fall back to the most recently used tab', () => {
  const lru = { A: NOW - 1 * MIN, B: NOW - 10 * MIN, D: NOW - 20 * MIN };
  assert.equal(S.hybrid(after, 2, lru, NOW).id, 'A');
});

test('hybrid: unknown closed index falls back to LRU', () => {
  assert.equal(S.hybrid(after, undefined, { E: NOW }, NOW).id, 'E');
});

test('pickTab dispatches by strategy name and defaults to hybrid', () => {
  const lru = { A: NOW - 1 * MIN, B: NOW - 10 * MIN, D: NOW - 20 * MIN };
  assert.equal(S.pickTab('lru', after, 2, lru, NOW).id, 'A');
  assert.equal(S.pickTab('proximity', after, 2, lru, NOW).id, 'B');
  assert.equal(S.pickTab('anything-else', after, 2, lru, NOW).id, 'A');
});

test('empty window returns null', () => {
  for (const s of ['proximity', 'lru', 'hybrid']) assert.equal(S.pickTab(s, [], 0, {}, NOW), null);
});

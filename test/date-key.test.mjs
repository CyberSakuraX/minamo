// minamo-core.dayKey — JST 日付境界と形式のテスト
// UTC 14:59 → 当日 / UTC 15:00 → 翌日 / -1オフセット / 年跨ぎ / YYYY-MM-DD 形式ガード

import { test } from 'node:test';
import assert from 'node:assert/strict';
import core from '../public/js/minamo-core.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

test('UTC 14:59 は当日(JST 23:59)', () => {
  const t = Date.parse('2026-07-12T14:59:00Z');
  assert.equal(core.dayKey(0, t), '2026-07-12');
});

test('UTC 15:00 は翌日(JST 00:00)', () => {
  const t = Date.parse('2026-07-12T15:00:00Z');
  assert.equal(core.dayKey(0, t), '2026-07-13');
});

test('dayKey(-1) は前日を返す', () => {
  const t = Date.parse('2026-07-12T05:00:00Z'); // JST 14:00
  assert.equal(core.dayKey(0, t), '2026-07-12');
  assert.equal(core.dayKey(-1, t), '2026-07-11');
});

test('年跨ぎ(UTC 2026-12-31 15:00 → JST 2027-01-01)', () => {
  const t = Date.parse('2026-12-31T15:00:00Z');
  assert.equal(core.dayKey(0, t), '2027-01-01');
  assert.equal(core.dayKey(-1, t), '2026-12-31');
});

test('形式ガード: 常に YYYY-MM-DD を返す', () => {
  const samples = [
    Date.parse('2026-01-01T00:00:00Z'),
    Date.parse('2026-07-12T14:59:59Z'),
    Date.parse('2026-12-31T23:59:59Z'),
  ];
  for (const t of samples) {
    assert.match(core.dayKey(0, t), DATE_RE);
    assert.match(core.dayKey(-1, t), DATE_RE);
  }
});

test('nowMs 省略時は現在時刻を使う(呼べること)', () => {
  const k = core.dayKey(0);
  assert.match(k, DATE_RE);
});

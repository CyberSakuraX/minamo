// 会釈受信の端末側保持: carryAnon / bowQueryTargets / shouldAdoptBow

import { test } from 'node:test';
import assert from 'node:assert/strict';
import core from '../public/js/minamo-core.js';

const T = '2026-07-13';
const Y = '2026-07-12';

test('carryAnon: きのうの anon のみ退避対象として返す', () => {
  assert.deepEqual(
    core.carryAnon({ date: Y, id: 'abcdefghijkl' }, Y),
    { date: Y, id: 'abcdefghijkl' }
  );
});

test('carryAnon: 今日/一昨日/未来/null は退避しない', () => {
  assert.equal(core.carryAnon({ date: T, id: 'abcdefghijkl' }, Y), null);
  assert.equal(core.carryAnon({ date: '2026-07-10', id: 'abcdefghijkl' }, Y), null);
  assert.equal(core.carryAnon(null, Y), null);
});

test('bowQueryTargets: 今日/きのう分のみ照会対象に含める', () => {
  const today = { date: T, id: '111111111111' };
  const yest = { date: Y, id: '222222222222' };
  const targets = core.bowQueryTargets(today, yest, T, Y);
  assert.equal(targets.length, 2);
  assert.equal(targets[0].id, '111111111111');
  assert.equal(targets[1].id, '222222222222');
});

test('bowQueryTargets: 一昨日以前の anonPrev は含めない', () => {
  const today = { date: T, id: '111111111111' };
  const old = { date: '2026-07-10', id: '333333333333' };
  const targets = core.bowQueryTargets(today, old, T, Y);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].id, '111111111111');
});

test('bowQueryTargets: id 欠落は除外', () => {
  const targets = core.bowQueryTargets({ date: T }, null, T, Y);
  assert.equal(targets.length, 0);
});

test('shouldAdoptBow: 現在バナー無しなら採用する', () => {
  assert.equal(core.shouldAdoptBow(null, T, T), true);
  assert.equal(core.shouldAdoptBow(null, Y, T), true);
});

test('shouldAdoptBow: 今日は昨日より優先(y → t で採用)', () => {
  assert.equal(core.shouldAdoptBow(Y, T, T), true);
});

test('shouldAdoptBow: 逆方向(t → y)は上書き不可', () => {
  assert.equal(core.shouldAdoptBow(T, Y, T), false);
});

test('shouldAdoptBow: 同じ日を再採用しない(t → t)', () => {
  assert.equal(core.shouldAdoptBow(T, T, T), false);
});

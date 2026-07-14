// minamo-core の状態遷移: applyStamp / applyNote / createStore

import { test } from 'node:test';
import assert from 'node:assert/strict';
import core from '../public/js/minamo-core.js';

test('applyStamp: 初回押印で total=1・last=t', () => {
  const r = core.applyStamp({}, '2026-07-12');
  assert.deepEqual(r, { total: 1, last: '2026-07-12' });
});

test('applyStamp: 同日の重複は null(加算されない)', () => {
  const r = core.applyStamp({ total: 5, last: '2026-07-12' }, '2026-07-12');
  assert.equal(r, null);
});

test('applyStamp: 翌日は +1', () => {
  const r = core.applyStamp({ total: 5, last: '2026-07-12' }, '2026-07-13');
  assert.deepEqual(r, { total: 6, last: '2026-07-13' });
});

test('applyNote: 両値ゼロは null(保存しない)', () => {
  assert.equal(core.applyNote({}, '2026-07-12', 0, 0), null);
  assert.equal(core.applyNote({}, '2026-07-12', NaN, undefined), null);
});

test('applyNote: 初回 5km で sumKm=5', () => {
  const r = core.applyNote({ sumKm: 0 }, '2026-07-12', 5, 30);
  assert.equal(r.sumKm, 5);
  assert.deepEqual(r.note, { date: '2026-07-12', km: 5, min: 30 });
});

test('applyNote: 5km → 3km 書き直しで sumKm は +3 になる(+8 にならない)', () => {
  const first = core.applyNote({ sumKm: 0 }, '2026-07-12', 5.2, 30);
  const state = { sumKm: first.sumKm, note: first.note };
  const second = core.applyNote(state, '2026-07-12', 3, 20);
  assert.equal(second.sumKm, 3);
  assert.equal(second.note.km, 3);
});

test('applyNote: 距離だけ / 時間だけの片方入力', () => {
  const kmOnly = core.applyNote({ sumKm: 0 }, '2026-07-12', 4, 0);
  assert.equal(kmOnly.sumKm, 4);
  assert.equal(kmOnly.note.min, null);

  const minOnly = core.applyNote({ sumKm: 0 }, '2026-07-12', 0, 25);
  assert.equal(minOnly.sumKm, 0);
  assert.equal(minOnly.note.km, null);
  assert.equal(minOnly.note.min, 25);
});

test('createStore: プレフィックス "minamo." が付与される', () => {
  const bag = {};
  const backend = {
    getItem: (k) => (k in bag ? bag[k] : null),
    setItem: (k, v) => { bag[k] = String(v); },
    removeItem: (k) => { delete bag[k]; },
  };
  const s = core.createStore(backend);
  s.set('total', 3);
  assert.equal(bag['minamo.total'], '3');
  assert.equal(s.get('total', ''), '3');
});

test('createStore.remove("anonPrev") は実キー "minamo.anonPrev" を消す(バグ修正の固定)', () => {
  const bag = { 'minamo.anonPrev': '{"date":"2026-07-11","id":"abcdefghijkl"}' };
  const backend = {
    getItem: (k) => (k in bag ? bag[k] : null),
    setItem: (k, v) => { bag[k] = String(v); },
    removeItem: (k) => { delete bag[k]; },
  };
  const s = core.createStore(backend);
  s.remove('anonPrev');
  assert.equal('minamo.anonPrev' in bag, false);
});

test('createStore: setItem が throw する backend はメモリにフォールバック', () => {
  const backend = {
    getItem: () => null,
    setItem: () => { throw new Error('quota'); },
    removeItem: () => {},
  };
  const s = core.createStore(backend);
  s.set('total', 7);
  assert.equal(s.get('total', ''), '7'); // メモリから返る
});

test('createStore: backend が null でもメモリで動く', () => {
  const s = core.createStore(null);
  s.set('total', 2);
  assert.equal(s.get('total', ''), '2');
  s.remove('total');
  assert.equal(s.get('total', 'x'), 'x');
});

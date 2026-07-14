// バックアップの往復・型検証: makeBackup / parseBackup

import { test } from 'node:test';
import assert from 'node:assert/strict';
import core from '../public/js/minamo-core.js';

test('makeBackup: 基本形(note なし)', () => {
  const b = core.makeBackup({ total: 12, last: '2026-07-12', sumKm: 45.6 }, '2026-07-14T00:00:00Z');
  assert.deepEqual(b, {
    app: 'minamo.run',
    version: 1,
    exportedAt: '2026-07-14T00:00:00Z',
    total: 12,
    last: '2026-07-12',
    sumKm: 45.6,
  });
});

test('makeBackup: note を含める(sumKm 二重加算防止のため必須)', () => {
  const b = core.makeBackup({
    total: 3, last: '2026-07-12', sumKm: 5.2,
    note: { date: '2026-07-12', km: 5.2, min: 30 },
  }, 'ts');
  assert.deepEqual(b.note, { date: '2026-07-12', km: 5.2, min: 30 });
});

test('makeBackup: 空/未定義 state は total=0・last=""', () => {
  const b = core.makeBackup({}, 'ts');
  assert.equal(b.total, 0);
  assert.equal(b.last, '');
  assert.equal(b.sumKm, 0);
  assert.equal('note' in b, false);
});

test('parseBackup: 正常JSON往復', () => {
  const src = { total: 12, last: '2026-07-12', sumKm: 45.6, note: { date: '2026-07-12', km: 5.2, min: 30 } };
  const b = core.makeBackup(src, 'ts');
  const p = core.parseBackup(JSON.stringify(b));
  assert.deepEqual(p, {
    total: 12,
    last: '2026-07-12',
    sumKm: 45.6,
    note: { date: '2026-07-12', km: 5.2, min: 30 },
  });
});

test('parseBackup: note 欠落は許容(未押印での復元も可)', () => {
  const p = core.parseBackup(JSON.stringify({
    app: 'minamo.run', version: 1, total: 0, last: '', sumKm: 0,
  }));
  assert.deepEqual(p, { total: 0, last: '', sumKm: 0 });
});

test('parseBackup: version 不一致は拒否', () => {
  const p = core.parseBackup(JSON.stringify({
    app: 'minamo.run', version: 2, total: 1, last: '2026-07-12', sumKm: 0,
  }));
  assert.equal(p, null);
});

test('parseBackup: app 不一致は拒否', () => {
  const p = core.parseBackup(JSON.stringify({
    app: 'other', version: 1, total: 1, last: '2026-07-12', sumKm: 0,
  }));
  assert.equal(p, null);
});

test('parseBackup: 型不正(total が文字列 / last が不正形式)は拒否', () => {
  assert.equal(core.parseBackup(JSON.stringify({
    app: 'minamo.run', version: 1, total: '3', last: '2026-07-12', sumKm: 0,
  })), null);
  assert.equal(core.parseBackup(JSON.stringify({
    app: 'minamo.run', version: 1, total: 3, last: '2026/07/12', sumKm: 0,
  })), null);
});

test('parseBackup: 負の total / 負の sumKm は sumKm=0 にフォールバックまたは拒否', () => {
  // 負のtotal → 拒否
  assert.equal(core.parseBackup(JSON.stringify({
    app: 'minamo.run', version: 1, total: -1, last: '', sumKm: 0,
  })), null);
  // 負のsumKm → 0にフォールバック
  const p = core.parseBackup(JSON.stringify({
    app: 'minamo.run', version: 1, total: 3, last: '2026-07-12', sumKm: -5,
  }));
  assert.equal(p.sumKm, 0);
});

test('parseBackup: 空文字/非JSON/巨大文字列は null', () => {
  assert.equal(core.parseBackup(''), null);
  assert.equal(core.parseBackup('not json'), null);
  assert.equal(core.parseBackup('x'.repeat(70000)), null);
});

test('parseBackup: note.km が負値は null に整える(拒否しない)', () => {
  const p = core.parseBackup(JSON.stringify({
    app: 'minamo.run', version: 1, total: 1, last: '2026-07-12', sumKm: 0,
    note: { date: '2026-07-12', km: -3, min: 30 },
  }));
  assert.equal(p.note.km, null);
  assert.equal(p.note.min, 30);
});

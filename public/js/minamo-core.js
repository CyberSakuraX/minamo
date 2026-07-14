/* minamo-core — 層1の純ロジック(DOM・fetch・タイマー無依存)。
   index.html から classic script として読まれ、node:test からは require で呼ばれる。
   憲章7条(複製自由)のため、クライアント側の TIME_ZONE はここに置く。
   worker/src/index.js の TIME_ZONE と同じ値にすること(ズレると層1と層2/3で
   日の変わる瞬間が分かれる。データ喪失はなく、TTLで消える範囲の静かなズレ)。 */
(function () {
  'use strict';

  var TIME_ZONE = 'Asia/Tokyo';

  // JST日付キー(YYYY-MM-DD)。nowMs はテスト注入用(省略時 Date.now())
  function dayKey(offsetDays, nowMs) {
    var base = (typeof nowMs === 'number') ? nowMs : Date.now();
    var d = new Date(base + (offsetDays || 0) * 86400000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d);
  }

  // localStorage風の backend を包む薄いストア。'minamo.' プレフィックスはここでだけ付ける
  // (既存データ互換のため)。backend が null / throw のときはメモリにフォールバックする
  function createStore(backend) {
    var mem = {};
    function pfx(k) { return 'minamo.' + k; }
    return {
      get: function (k, d) {
        try {
          if (backend) {
            var v = backend.getItem(pfx(k));
            if (v != null) return v;
          }
        } catch (e) {}
        return (k in mem) ? mem[k] : d;
      },
      set: function (k, v) {
        mem[k] = String(v);
        try { if (backend) backend.setItem(pfx(k), String(v)); } catch (e) {}
      },
      remove: function (k) {
        delete mem[k];
        try { if (backend) backend.removeItem(pfx(k)); } catch (e) {}
      },
    };
  }

  // 押印の状態遷移。state = { total, last }。同日ならnull(加算しない)
  function applyStamp(state, t) {
    var s = state || {};
    if (s.last === t) return null;
    var total = (parseInt(s.total, 10) || 0) + 1;
    return { total: total, last: t };
  }

  // 添え書き。同日の前回分を引いてから加算(sumKm再計算)。両値無効ならnull
  function applyNote(state, t, km, min) {
    var validKm = (typeof km === 'number' && isFinite(km) && km > 0);
    var validMin = (typeof min === 'number' && isFinite(min) && min > 0);
    if (!validKm && !validMin) return null;
    var prev = state && state.note;
    var sum = (state && typeof state.sumKm === 'number' && isFinite(state.sumKm)) ? state.sumKm : 0;
    if (prev && prev.date === t && typeof prev.km === 'number' && isFinite(prev.km)) sum -= prev.km;
    if (validKm) sum += km;
    sum = Math.round(sum * 10) / 10;
    return {
      sumKm: sum,
      note: { date: t, km: validKm ? km : null, min: validMin ? min : null },
    };
  }

  // 「きのう」のanonのみ退避対象として返す(それ以外はnull)
  function carryAnon(prevAnon, yesterdayKey) {
    if (!prevAnon || prevAnon.date !== yesterdayKey) return null;
    return prevAnon;
  }

  // 会釈照会の対象を、今日/きのう分の anon に絞って返す
  function bowQueryTargets(anon, anonPrev, t, y) {
    var out = [];
    var arr = [anon, anonPrev];
    for (var i = 0; i < arr.length; i++) {
      var a = arr[i];
      if (a && a.id && (a.date === t || a.date === y)) out.push(a);
    }
    return out;
  }

  // バナー採用判定。「今日」の会釈は「きのう」より優先。逆方向の上書きは拒否
  function shouldAdoptBow(currentDate, incomingDate, t) {
    if (!currentDate) return true;
    if (incomingDate === t && currentDate !== t) return true;
    return false;
  }

  // バックアップのシリアライズ。noteを含めないと同日移行→添え書き再入力で
  // sumKm 二重加算が起きるため、note は必ず含める。anon/anonPrev/bowed は
  // 「翌日に消える」思想のため含めない
  function makeBackup(state, exportedAt) {
    var s = state || {};
    var out = {
      app: 'minamo.run',
      version: 1,
      exportedAt: exportedAt,
      total: (parseInt(s.total, 10) || 0),
      last: (typeof s.last === 'string') ? s.last : '',
      sumKm: (typeof s.sumKm === 'number' && isFinite(s.sumKm)) ? s.sumKm : 0,
    };
    if (s.note && typeof s.note === 'object' && typeof s.note.date === 'string') {
      out.note = {
        date: s.note.date,
        km: (typeof s.note.km === 'number' && isFinite(s.note.km)) ? s.note.km : null,
        min: (typeof s.note.min === 'number' && isFinite(s.note.min)) ? s.note.min : null,
      };
    }
    return out;
  }

  // バックアップのパース。app / version / total / last の型を厳密に見て、
  // 一つでも合わなければ null(呼び側で「読み取れませんでした」を出す)
  function parseBackup(text) {
    if (typeof text !== 'string' || text.length === 0 || text.length > 65536) return null;
    var obj;
    try { obj = JSON.parse(text); } catch (e) { return null; }
    if (!obj || typeof obj !== 'object') return null;
    if (obj.app !== 'minamo.run') return null;
    if (obj.version !== 1) return null;
    if (typeof obj.total !== 'number' || !isFinite(obj.total) || obj.total < 0) return null;
    if (typeof obj.last !== 'string') return null;
    // last は '' または 'YYYY-MM-DD'(押印なしの復元も許容)
    if (obj.last !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(obj.last)) return null;
    var sumKm = (typeof obj.sumKm === 'number' && isFinite(obj.sumKm) && obj.sumKm >= 0) ? obj.sumKm : 0;
    var out = {
      total: Math.floor(obj.total),
      last: obj.last,
      sumKm: sumKm,
    };
    if (obj.note != null) {
      if (typeof obj.note !== 'object') return null;
      if (typeof obj.note.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(obj.note.date)) return null;
      var km = (obj.note.km == null) ? null :
        ((typeof obj.note.km === 'number' && isFinite(obj.note.km) && obj.note.km > 0) ? obj.note.km : null);
      var min = (obj.note.min == null) ? null :
        ((typeof obj.note.min === 'number' && isFinite(obj.note.min) && obj.note.min > 0) ? obj.note.min : null);
      out.note = { date: obj.note.date, km: km, min: min };
    }
    return out;
  }

  var minamoCore = {
    TIME_ZONE: TIME_ZONE,
    dayKey: dayKey,
    createStore: createStore,
    applyStamp: applyStamp,
    applyNote: applyNote,
    carryAnon: carryAnon,
    bowQueryTargets: bowQueryTargets,
    shouldAdoptBow: shouldAdoptBow,
    makeBackup: makeBackup,
    parseBackup: parseBackup,
  };

  if (typeof window !== 'undefined') window.minamoCore = minamoCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = minamoCore;
})();

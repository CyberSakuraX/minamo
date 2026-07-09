/* minamo fit-reader — FIT ファイルから距離(km)・時間(分)の2値だけを読む最小リーダー。
   session メッセージ(global 18)の field 8(total_timer_time)・field 9(total_distance)以外は
   一切デコードせず読み飛ばす(座標・心拍・ケイデンスは変数にも取り出さない / docs/01 §7)。
   初回の .fit 選択時に index.html から遅延注入される(使わない訪問者には1バイトも読まれない)。 */
(function () {
  'use strict';

  // ArrayBuffer → { km, min }(どちらも number | null)。構造が読めなければ null
  window.minamoReadFit = function (buf) {
    var timerS = null; // total_timer_time の合算(秒)。複数 session は合算する
    var distM = null;  // total_distance の合算(m)

    try {
      var dv = new DataView(buf);
      if (buf.byteLength < 12) return done();

      // ヘッダ: [0]=ヘッダ長(12 or 14) [4-7]=データ長(LE) [8-11]=".FIT"
      var headerSize = dv.getUint8(0);
      if (headerSize < 12) return done();
      if (dv.getUint8(8) !== 0x2e || dv.getUint8(9) !== 0x46 ||
          dv.getUint8(10) !== 0x49 || dv.getUint8(11) !== 0x54) return done();

      var off = headerSize;
      var end = Math.min(headerSize + dv.getUint32(4, true), buf.byteLength);
      var defs = {}; // local message type → 定義(後着の定義で上書きされ得る。上書きが正)

      while (off < end) {
        var hdr = dv.getUint8(off); off += 1;
        var local, isDef = false;
        if (hdr & 0x80) {
          // 圧縮タイムスタンプヘッダ(常にデータメッセージ)。local type は bits 5-6。
          // normal 扱いすると local type を誤り以降のオフセットが全部ずれるため、ここだけは正しく読む
          local = (hdr >> 5) & 0x03;
        } else {
          local = hdr & 0x0f;
          isDef = !!(hdr & 0x40);
        }

        if (isDef) {
          // 定義: reserved(1) arch(1) global(2) numFields(1) + 各フィールド3バイト
          var le = dv.getUint8(off + 1) === 0;
          var global = dv.getUint16(off + 2, le);
          var numFields = dv.getUint8(off + 4);
          off += 5;
          var fields = [];
          var size = 0;
          for (var i = 0; i < numFields; i++) {
            fields.push({ num: dv.getUint8(off), sz: dv.getUint8(off + 1) });
            size += dv.getUint8(off + 1);
            off += 3;
          }
          if (hdr & 0x20) {
            // developer fields はサイズだけ合計し、中身は永遠にデコードしない
            var numDev = dv.getUint8(off); off += 1;
            for (var j = 0; j < numDev; j++) {
              size += dv.getUint8(off + 1);
              off += 3;
            }
          }
          defs[local] = { global: global, le: le, fields: fields, size: size };
        } else {
          var d = defs[local];
          if (!d) break; // 定義未到着 → サイズ不明で先へ進めない。ここまでの結果で打ち切り
          if (d.global === 18) {
            // session のときだけフィールドを順に歩く。8=total_timer_time(scale 1000, 秒) 9=total_distance(scale 100, m)
            var p = off;
            for (var k = 0; k < d.fields.length; k++) {
              var f = d.fields[k];
              if (f.sz === 4 && (f.num === 8 || f.num === 9)) {
                var v = dv.getUint32(p, d.le);
                if (v !== 0xffffffff) { // uint32 の invalid 値は捨てる
                  if (f.num === 8) timerS = (timerS || 0) + v / 1000;
                  else distM = (distM || 0) + v / 100;
                }
              }
              p += f.sz;
            }
          }
          off += d.size; // session 以外のメッセージは一律読み飛ばし
        }
      }
    } catch (e) {
      // 切り詰められたファイル等の RangeError。そこまでの抽出結果があれば返す
    }
    return done();

    function done() {
      if (timerS == null && distM == null) return null;
      return {
        km: distM != null ? distM / 1000 : null,
        min: timerS != null ? timerS / 60 : null
      };
    }
  };
})();

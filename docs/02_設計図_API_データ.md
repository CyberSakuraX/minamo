# 02_設計図 — API・データ設計（Cloudflare Workers + KV）

対象: `worker/src/index.js` + `worker/wrangler.toml`
思想的制約: サーバが知ってよいのは「今日、匿名の誰かが走った」「その匿名IDに1ビットの会釈が届いた」だけ。
**距離・時間・IP・UA・タイムスタンプ・送信者情報は一切保存しない。**

---

## 1. KVキー設計（これがすべて）

| キー | 値 | expirationTtl | 書く | 読む |
|---|---|---|---|---|
| `runner:{YYYY-MM-DD}:{anonId}` | `"1"` | **129600（36時間）** | POST /api/stamp | GET /api/today（list）、POST /api/bow（存在確認） |
| `bow:{YYYY-MM-DD}:{anonId}` | `"1"` | **129600（36時間）** | POST /api/bow | GET /api/bow |

- キーは2種のみ。**削除処理・cron・scheduledハンドラは書かない**。日付入りキー + TTL で「翌日にはすべて消える」を実現する
- TTL 36時間の根拠: 日付キーなので翌日には論理的に不可視（新しい日付のprefixしか参照されない）。
  物理削除はTTL任せ。36時間あれば「日曜朝に押印 → 月曜昼にページを開く」人にも前日分の会釈が届く
- `{YYYY-MM-DD}` は**必ずサーバ側で**算出: `new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date())`
  （クライアントの申告日付を信用しない。クライアントも同じ式なのでズレは日付境界の数秒のみ）
- `anonId` はサーバ発行。`crypto.getRandomValues` 由来の `[a-z0-9]{12}`（約62bit・1日スコープなら衝突は無視できる）
- 値はすべて `"1"`。**数えられる情報・紐づけられる情報をデータ構造ごと持たない**

## 2. エンドポイント仕様（4本のみ）

ベースURL: `https://minamo-api.<account>.workers.dev`（Step 2 デプロイ時に確定 → index.html の `API_BASE` に設定）。
上記以外のパス・メソッドは 404 / 405。レスポンスは全て `Content-Type: application/json`。

### POST /api/stamp — 押印（層2参加 + 匿名ID発行）

- リクエストボディ: なし（**クライアントから送る情報はゼロ**）
- 処理: `today` 算出 → `anonId` 生成 → `put("runner:{today}:{anonId}", "1", { expirationTtl: 129600 })`
- 200: `{ "date": "2026-07-12", "anonId": "k3f9a2m7x1qz" }`
- 冪等性: 1日1回はクライアント（localStorage）が保証。二重POSTは人数が1ブレるだけで「目安の数字」の範囲内として許容

### GET /api/today — 今日の人数と点

- 200: `{ "date": "2026-07-12", "count": 27, "dots": ["a1b2c3d4e5f6", ...] }`（dots は先頭最大38件）
- 実装: メモリキャッシュ（§4）ヒット時はKV操作ゼロ。ミス時に `list({ prefix: "runner:{today}:", limit: 1000 })` を
  カーソルで回して count を数え、先頭38件の anonId 部分を dots にする
  （anonId はランダムなので辞書順 ≒ ランダムサンプル。カウントとサンプルが1操作で済む）
- レスポンスヘッダ: `Cache-Control: public, max-age=300`（ブラウザにも5分キャッシュさせる）

### POST /api/bow — 会釈を送る

- リクエスト: `{ "to": "b2c4e6g8i0k2" }`（`^[a-z0-9]{12}$` を検証。日付はサーバが決める）
- 処理: `get("runner:{today}:{to}")` → 存在しなければ **404 を返して何も書かない**（ゴミキー防止）
  → 存在すれば `put("bow:{today}:{to}", "1", { expirationTtl: 129600 })`
- 200: `{ "ok": true }` / 404: `{ "ok": false }`
- **送信者が誰かはリクエストにもKVにも存在しない**（「誰からの会釈かは分からない」のデータ構造的保証）

### GET /api/bow?date=YYYY-MM-DD&id={anonId} — 受信確認（1ビット）

- 検証: `date` は**サーバJSTの今日または昨日のみ**許可（それ以外は400 — 過去の探索を無意味化）。id は正規表現検証
- 処理: `get("bow:{date}:{id}")` → 200: `{ "bowed": true | false }`
- キャッシュなし（個人宛の1ビットを共有キャッシュに載せない）
- 受信フラグは**削除しない**（その日はずっと灯ったまま。TTLで自然消滅。削除操作もゼロ）

### OPTIONS /api/* — CORSプリフライト

- 204 + §5 のCORSヘッダ

## 3. 層2カウントの方式（採用理由と代替案）

**KVには原子的インクリメントがない**（read-modify-write は同時押印でロスト更新が起きる。同一キー書き込みは1回/秒制限もある）。

**採用（案A）: 参加者ごとの独立キー + prefix list カウント**
- 押印 = 新キー1書き込み。キー同士が独立なので**競合が原理的に起きない**
- 弱点は list の無料枠（1,000回/日）→ §4 の2段キャッシュで対処。「数字は目安でよい」（CLAUDE.md 層2:
  リセットすら作らない設計 / 表示も 5分遅れを許容）という思想的許容があるため、これは欠陥ではなく仕様
- Durable Objects なら厳密な原子カウンタになるが、クラス定義・単一オブジェクト集約の運用複雑性が増える。
  「目安でよい数字」に厳密性を持ち込むのは**足すより削るへの違反**なので不採用

**フォールバック（案B・実装しない。枠が逼迫した将来のためのメモ）:**
`count:{date}` キーの read-modify-write + `dots:{date}` 配列。list はゼロになるが、カウント取りこぼしと
書き込み枠3倍消費のトレードオフ。1日700人を超える日が来たら $5/月の有料プラン or 案Bを検討する
（その日が来たら喜ばしいこと）。

### 無料枠概算（1日200押印・100会釈・400PVの想定。2026年時点の枠 — 実装時に最新値を再確認）

| 操作 | 消費見込み | 無料枠 | 判定 |
|---|---|---|---|
| KV書き込み | 押印200 + 会釈100 = 300 | 1,000/日 | ○ |
| KV読み取り | 受信確認 ~400 + bow存在確認 100 | 100,000/日 | ◎ |
| KV list | ~400（キャッシュ全ミス時の上限） | 1,000/日 | ○ |
| Workersリクエスト | ~1,300 | 100,000/日 | ◎ |

## 4. キャッシュ（GET /api/today のみ）

1. **Workerモジュールスコープの in-memory キャッシュ**: `{ date, count, dots, fetchedAt }`・TTL 300秒。
   日付が変わったら破棄（dateフィールド比較）。
   ※ `*.workers.dev` では Cache API（caches.default）が使えないためメモリ方式。アイソレート再生成時はミスするが、その時だけ list が走る
2. **`Cache-Control: public, max-age=300`** でブラウザ側にも5分キャッシュ

## 5. CORS

```js
const ALLOWED_ORIGINS = [
  "https://<project>.pages.dev",   // 本番（Step 4 で確定後に書き換え）
  "http://localhost:8788",         // ローカル確認用
  "http://127.0.0.1:8788",
];
// GitHub Pages 採用時は "https://<user>.github.io" を追加
```

- リクエストの `Origin` が一致した場合のみ `Access-Control-Allow-Origin: <そのorigin>` を返す
- `Access-Control-Allow-Methods: GET, POST, OPTIONS` / `Access-Control-Allow-Headers: Content-Type` / `Access-Control-Max-Age: 86400`
- **`Allow-Credentials` は付けない**（Cookieゼロ原則）

## 6. 簡易レート制限とプライバシー（実装ルール）

- 方式: Workerモジュールスコープの `Map<ip, { windowStart, n }>`。**書き込み系（POST 2種）のみ**対象、
  **10回/分/IP** 超で 429。Mapは上限1,000エントリで古いものから捨てる
- **IPの扱い**: `CF-Connecting-IP` はこのメモリ上の一時判定**にのみ**使う。
  **KV・console.log・レスポンスのどこにも書かない**。アイソレート終了とともに消える
- wrangler.toml に `[observability]` を**追加しない**（Workers Logs / logpush / Analytics Engine を有効化しない
  — IPを含むリクエストログを残さないため）
- これ以上のabuse対策（CAPTCHA・Turnstile・署名）は**意図的に作らない**。荒らして得られるのは
  「人数が少し増える」「匿名の誰かに1ビットが届く」だけ — 餌が存在しない（CLAUDE.md: 過剰防御をしない）
- 入力検証のみ最低限: ボディ256バイト上限 / anonId正規表現 / Content-Type確認

## 7. 会釈の重複防止はクライアントのみ（設計判断の記録）

受信は「キーの存在有無の1ビット」であり数を数えないため、同じ相手に100回会釈しても受信者の体験は1回と完全に同一。
**サーバ側で重複を防ぐ動機がデータ構造ごと消えている。** localStorage の `minamo.bowed` によるガードで十分。
サーバ側dedupキー（例: bowedBy:{date}:{sender}）を作ると送信者の痕跡がサーバに残り、書き込み枠も倍増するため**作らない**。
異なる相手への連打による枠浪費だけ §6 のレート制限が抑える。

## 8. クライアント側の接続仕様（index.html 側の責務）

- すべての fetch は try/catch + AbortController **4秒タイムアウト**。失敗時の挙動は
  [01_設計図_画面と挙動.md](01_設計図_画面と挙動.md) §9（02は「—」・03は非表示・エラーUIなし）
- `apiStamp()`: 押印直後に呼ぶ。成功で `minamo.anon = {date, id}` 保存。
  失敗時は無言。次回ロード時 `last === today && anon.date !== today` なら1回だけ再送
- `syncToday()`: ロード時に GET /api/today → #sec02 の人数・#sec03 の点を描画。
  自分の anonId は dots から除外して表示。押印直後で表示が古い場合は count+1 して見せてよい
- `bow(to)`: 点タップ → POST /api/bow → 成功で `minamo.bowed = {date, idx}` 保存・点を灯す・キャプション更新
- `checkBowReceived()`: ロード時、最終押印日（`minamo.anon.date` が今日 or 昨日のとき）について
  GET /api/bow → `bowed: true` なら受信バナーを表示

## 9. wrangler.toml（骨子）

```toml
name = "minamo-api"
main = "src/index.js"
compatibility_date = "2026-07-01"
workers_dev = true

[[kv_namespaces]]
binding = "MINAMO_KV"
id = "<wrangler kv namespace create MINAMO_KV の出力IDを貼る>"
```

`[observability]`・`[triggers]`（cron）・`[vars]` のトークン類は**書かない**。

## 10. サーバが持たないもの（監査基準）

以下が `worker/src/index.js` に存在したら設計違反（[04_検証チェックリスト.md](04_検証チェックリスト.md) §6.5 でgrep監査）:

- `scheduled`（cronハンドラ）/ `delete`（KV削除）
- `CF-Connecting-IP` の put・ログ出力（レート制限Mapでの一時利用のみ可）
- `console.log`（本番コードに残さない）
- 距離・時間・記録に関するフィールド名（km / min / distance / duration 等）
- 会釈を**数える**コード（カウンタ・配列蓄積・履歴）

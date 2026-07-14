// worker/src/index.js の API 挙動テスト。ビルド不要・依存ゼロ(node:test)。
// 注意事項:
//  - freshWorker() を beforeEach で呼び、`rl` Map と todayCache の汚染を切る
//  - CF-Connecting-IP はテスト毎に別値を渡す(未指定だと "unknown" バケツで 429 雪崩)
//  - todayCache は仕様として 5 分キャッシュ。stamp 直後の today 即時反映を assert しない

import { test } from "node:test";
import assert from "node:assert/strict";
import { freshWorker, makeEnv, makeKV, makeRequest } from "./helpers.mjs";

const ORIGIN_OK = "http://localhost:8898";
const ORIGIN_NG = "https://example.com";
const ANON_RE = /^[a-z0-9]{12}$/;

function todayJst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
}

test("POST /api/stamp — 200・anonId 形式・runner: キーが expirationTtl 付きで1件", async () => {
  const w = await freshWorker();
  const env = makeEnv();
  const r = await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_OK, ip: "10.0.0.1" }), env);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.match(body.anonId, ANON_RE);
  assert.equal(body.date, todayJst());
  const list = await env.MINAMO_KV.list({ prefix: "runner:" });
  assert.equal(list.keys.length, 1);
  assert.ok(list.keys[0].name.startsWith(`runner:${body.date}:`));
  assert.equal(env.MINAMO_KV._store.get(list.keys[0].name).expirationTtl, 129600);
});

test("Origin: 許可リスト外は 403 / ヘッダなしは 200 / 許可は 200 + CORS エコー", async () => {
  const w = await freshWorker();
  // 許可外
  let r = await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_NG, ip: "10.0.0.2" }), makeEnv());
  assert.equal(r.status, 403);
  // ヘッダなし(curl 等)
  r = await w.fetch(makeRequest("POST", "/api/stamp", { origin: null, ip: "10.0.0.3" }), makeEnv());
  assert.equal(r.status, 200);
  // 許可
  r = await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_OK, ip: "10.0.0.4" }), makeEnv());
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN_OK);
});

test("レート制限: 同一IP 11連投→11発目 429、別IPは 200", async () => {
  const w = await freshWorker();
  const env = makeEnv();
  for (let i = 0; i < 10; i++) {
    const r = await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_OK, ip: "10.0.1.1" }), env);
    assert.equal(r.status, 200, `#${i + 1} が 200 でない`);
  }
  const r11 = await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_OK, ip: "10.0.1.1" }), env);
  assert.equal(r11.status, 429);
  const rOther = await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_OK, ip: "10.0.1.2" }), env);
  assert.equal(rOther.status, 200);
});

test("GET /api/today — stamp×2で count=2 / 40件シードで dots は 38 頭打ち", async () => {
  const w = await freshWorker();
  const env = makeEnv();
  const date = todayJst();
  // KV に直接 40 件シード(rate limit を跨がない)
  for (let i = 0; i < 40; i++) {
    await env.MINAMO_KV.put(`runner:${date}:${String(i).padStart(12, "a")}`, "1", { expirationTtl: 129600 });
  }
  const r = await w.fetch(makeRequest("GET", "/api/today", { origin: ORIGIN_OK, ip: "10.0.2.1" }), env);
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.count, 40);
  assert.equal(body.dots.length, 38);
});

test("today: stamp×2 で count=2(freshWorkerで todayCache をクリア)", async () => {
  const w = await freshWorker();
  const env = makeEnv();
  await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_OK, ip: "10.0.3.1" }), env);
  await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_OK, ip: "10.0.3.2" }), env);
  const r = await w.fetch(makeRequest("GET", "/api/today", { origin: ORIGIN_OK, ip: "10.0.3.3" }), env);
  const body = await r.json();
  assert.equal(body.count, 2);
});

test("POST /api/bow: 正常→TTL付きキー / 同一宛2連投→キー1個のまま(上書き式1ビット)", async () => {
  const w = await freshWorker();
  const env = makeEnv();
  const r1 = await w.fetch(makeRequest("POST", "/api/stamp", { origin: ORIGIN_OK, ip: "10.0.4.1" }), env);
  const { anonId, date } = await r1.json();

  const bow = () => w.fetch(makeRequest("POST", "/api/bow", {
    origin: ORIGIN_OK, ip: "10.0.4.2", body: JSON.stringify({ to: anonId }),
  }), env);
  const b1 = await bow();
  assert.equal(b1.status, 200);
  const b2 = await bow();
  assert.equal(b2.status, 200);
  const list = await env.MINAMO_KV.list({ prefix: `bow:${date}:` });
  assert.equal(list.keys.length, 1);
  assert.equal(env.MINAMO_KV._store.get(list.keys[0].name).expirationTtl, 129600);
});

test("POST /api/bow: 不正 to / 非JSON / 存在しない to のガード", async () => {
  const w = await freshWorker();
  const env = makeEnv();

  // 不正な to(短すぎる)
  let r = await w.fetch(makeRequest("POST", "/api/bow", {
    origin: ORIGIN_OK, ip: "10.0.5.1", body: JSON.stringify({ to: "abc" }),
  }), env);
  assert.equal(r.status, 400);

  // 非JSON(Content-Type なし)
  r = await w.fetch(makeRequest("POST", "/api/bow", {
    origin: ORIGIN_OK, ip: "10.0.5.2",
    headers: { "Content-Type": "text/plain" }, body: "not-json",
  }), env);
  assert.equal(r.status, 400);

  // 存在しない to(正しい形式・KV になし)
  r = await w.fetch(makeRequest("POST", "/api/bow", {
    origin: ORIGIN_OK, ip: "10.0.5.3", body: JSON.stringify({ to: "abcdefghijkl" }),
  }), env);
  assert.equal(r.status, 404);
});

test("GET /api/bow: 一昨日以前の date は 400", async () => {
  const w = await freshWorker();
  const env = makeEnv();
  const r = await w.fetch(makeRequest("GET", "/api/bow?date=2000-01-01&id=abcdefghijkl", {
    origin: ORIGIN_OK, ip: "10.0.6.1",
  }), env);
  assert.equal(r.status, 400);
});

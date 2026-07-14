// minamo.run — 黙走会 API(Cloudflare Workers + KV)
// 仕様: docs/02_設計図_API_データ.md
// サーバが知ってよいのは「今日、匿名の誰かが走った」「その匿名IDに1ビットの会釈が届いた」だけ。
// 距離・時間・IP・UA・タイムスタンプ・送信者情報は一切保存しない。

const TTL = 129600; // 36時間。日付キー + TTL で「翌日にはすべて消える」(削除処理・cronは書かない)
const ID_RE = /^[a-z0-9]{12}$/;

// 「今日」を判定するタイムゾーン。憲章7条の複製時はこの値と public/js/minamo-core.js の
// TIME_ZONE を同じ値に(ズレると層1と層2/3で日の変わる瞬間が分かれる。データ喪失はなく、
// TTLで消える範囲の静かなズレに留まる)
const TIME_ZONE = "Asia/Tokyo";

const ALLOWED_ORIGINS = [
  "https://minamo-eyu.pages.dev", // 本番(Cloudflare Pages)。minamo.run 接続時に追加(docs/05 §4)
  "http://localhost:8788",        // wrangler pages dev
  "http://127.0.0.1:8788",
  "http://localhost:8898",        // ローカル確認用(静的サーバー)
  "http://127.0.0.1:8898",
];

// GET /api/today のメモリキャッシュ(workers.dev では Cache API が使えないため)
let todayCache = null; // { date, count, dots, fetchedAt }

// 簡易レート制限(書き込み系のみ)。IPはこのMapの一時判定にのみ使い、KV・レスポンスには書かない
const rl = new Map(); // ip -> { windowStart, n }
const RL_MAX = 10;       // 10回/分/IP
const RL_WINDOW = 60000;
const RL_CAP = 1000;

function dayKey(offsetDays) {
  const d = new Date(Date.now() + (offsetDays || 0) * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const h = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (ALLOWED_ORIGINS.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(request, body, status, extra) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(request), ...(extra || {}) },
  });
}

// 複製ページ(憲章7条)からの書き込みが元の水面に混ざらないための境界。
// CORSはレスポンスを読ませないだけでPOST自体は届くため、サーバー側でも見る。
// Originヘッダなし(curl等の検証用途)は通す — ブラウザ外はレート制限とTTLで足りる
function foreignBrowserOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin !== null && !ALLOWED_ORIGINS.includes(origin);
}

function makeAnonId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  let id = "";
  for (let i = 0; i < 12; i++) id += chars[buf[i] % 36];
  return id;
}

function rateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  let e = rl.get(ip);
  if (!e || now - e.windowStart >= RL_WINDOW) e = { windowStart: now, n: 0 };
  e.n++;
  rl.delete(ip);
  rl.set(ip, e);
  if (rl.size > RL_CAP) rl.delete(rl.keys().next().value);
  return e.n > RL_MAX;
}

async function stamp(request, env) {
  if (foreignBrowserOrigin(request)) return json(request, { ok: false }, 403);
  if (rateLimited(request)) return json(request, { ok: false }, 429);
  const date = dayKey(0);
  const anonId = makeAnonId();
  await env.MINAMO_KV.put(`runner:${date}:${anonId}`, "1", { expirationTtl: TTL });
  return json(request, { date, anonId });
}

async function today(request, env) {
  const date = dayKey(0);
  const now = Date.now();
  if (todayCache && todayCache.date === date && now - todayCache.fetchedAt < 300000) {
    return json(request, { date, count: todayCache.count, dots: todayCache.dots }, 200, {
      "Cache-Control": "public, max-age=300",
    });
  }
  const prefix = `runner:${date}:`;
  let count = 0;
  const dots = [];
  let cursor;
  do {
    const page = await env.MINAMO_KV.list({ prefix, limit: 1000, cursor });
    count += page.keys.length;
    for (const k of page.keys) {
      if (dots.length < 38) dots.push(k.name.slice(prefix.length));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  todayCache = { date, count, dots, fetchedAt: now };
  return json(request, { date, count, dots }, 200, { "Cache-Control": "public, max-age=300" });
}

async function bowSend(request, env) {
  if (foreignBrowserOrigin(request)) return json(request, { ok: false }, 403);
  if (rateLimited(request)) return json(request, { ok: false }, 429);
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) return json(request, { ok: false }, 400);
  let to;
  try {
    const text = await request.text();
    if (text.length > 256) return json(request, { ok: false }, 400);
    to = JSON.parse(text).to;
  } catch (e) {
    return json(request, { ok: false }, 400);
  }
  if (typeof to !== "string" || !ID_RE.test(to)) return json(request, { ok: false }, 400);
  const date = dayKey(0);
  const exists = await env.MINAMO_KV.get(`runner:${date}:${to}`);
  if (exists === null) return json(request, { ok: false }, 404);
  await env.MINAMO_KV.put(`bow:${date}:${to}`, "1", { expirationTtl: TTL });
  return json(request, { ok: true });
}

async function bowCheck(request, env, url) {
  const date = url.searchParams.get("date") || "";
  const id = url.searchParams.get("id") || "";
  if (!ID_RE.test(id)) return json(request, { ok: false }, 400);
  if (date !== dayKey(0) && date !== dayKey(-1)) return json(request, { ok: false }, 400);
  const v = await env.MINAMO_KV.get(`bow:${date}:${id}`);
  return json(request, { bowed: v !== null });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });

    if (path === "/api/stamp" && method === "POST") return stamp(request, env);
    if (path === "/api/today" && method === "GET") return today(request, env);
    if (path === "/api/bow" && method === "POST") return bowSend(request, env);
    if (path === "/api/bow" && method === "GET") return bowCheck(request, env, url);

    const known = path === "/api/stamp" || path === "/api/today" || path === "/api/bow";
    return json(request, { ok: false }, known ? 405 : 404);
  },
};

// テスト補助: KVモック / freshWorker / リクエストビルダー
// 実装(worker/src/index.js)には手を入れない。テストからだけ触る道具。

// Mapベースの KV モック。expirationTtl を各キー個別に記録し、list() を prefix で
// フィルタして {keys, list_complete, cursor} を返す(本物の KV と同じ形)。
export function makeKV() {
  const store = new Map(); // key -> { value, expirationTtl }
  return {
    _store: store,
    async put(key, value, opts) {
      store.set(key, { value: String(value), expirationTtl: opts && opts.expirationTtl });
    },
    async get(key) {
      const e = store.get(key);
      return e ? e.value : null;
    },
    async delete(key) {
      store.delete(key);
    },
    async list(opts) {
      const prefix = (opts && opts.prefix) || "";
      const keys = [];
      for (const [k, v] of store) {
        if (k.startsWith(prefix)) keys.push({ name: k, expiration: v.expirationTtl });
      }
      return { keys, list_complete: true };
    },
  };
}

// 毎テスト新品のモジュールを得る。srcの `rl` Map と `todayCache` のテスト間汚染を避ける。
// クエリ文字列で ESM のキャッシュキーを分岐させる(本番挙動には無関係)。
let _v = 0;
export async function freshWorker() {
  const mod = await import("../src/index.js?v=" + (++_v));
  return mod.default;
}

// リクエストビルダー。CF-Connecting-IP は必ず指定して、テスト間で 429 バケツが混ざらないようにする。
export function makeRequest(method, path, opts) {
  const o = opts || {};
  const url = "https://minamo-api.test" + path;
  const headers = new Headers(o.headers || {});
  if (o.origin != null) headers.set("Origin", o.origin);
  headers.set("CF-Connecting-IP", o.ip || "127.0.0.1");
  if (o.body != null && !headers.has("Content-Type") && typeof o.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const init = { method, headers };
  if (o.body != null) init.body = o.body;
  return new Request(url, init);
}

export function makeEnv(kv) {
  return { MINAMO_KV: kv || makeKV() };
}

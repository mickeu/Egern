/**
 * 网上国网 95598 — Egern 原生壳脚本（mickeu 2026-08-31）
 * 用 ctx.env 读账号密码，用 ctx.http/storage/notify 实现 Surge/Loon 兼容 API，
 * 再执行原版 95598.js 的逻辑。
 *
 * env 变量（在 95598.yaml 模块 env 段配置）：
 *   username / password / debug / show_recent_usage / notify_all_accounts / timeout
 */
export default async function(ctx) {
  // ---- 1. 构造 $argument 命名键值对 ----
  const argKeys = ['username','password','debug','show_recent_usage','notify_all_accounts','timeout','LogLevel'];
  const pairs = [];
  for (const k of argKeys) {
    const v = ctx.env[k];
    if (v !== undefined && v !== null && v !== '') pairs.push(k + '=' + v);
  }
  if (pairs.length > 0) {
    globalThis.$argument = pairs.join('&');
  }

  // ---- 2. Polyfill: $persistentStore（用 ctx.storage）----
  if (typeof globalThis.$persistentStore === 'undefined') {
    globalThis.$persistentStore = {
      read: function(key) {
        try { return ctx.storage.get(key) || null; } catch(e) { return null; }
      },
      write: function(val, key) {
        try { ctx.storage.set(key, val); return true; } catch(e) { return false; }
      }
    };
  }

  // ---- 3. Polyfill: $notification（用 ctx.notify）----
  if (typeof globalThis.$notification === 'undefined') {
    globalThis.$notification = {
      post: function(title, subtitle, body, extra) {
        try {
          const opts = { title: title || '' };
          if (subtitle) opts.subtitle = subtitle;
          if (body) opts.body = body;
          ctx.notify(opts);
        } catch(e) { console.log('[notify error] ' + e.message); }
      }
    };
  }

  // ---- 4. Polyfill: $httpClient（用 ctx.http）----
  if (typeof globalThis.$httpClient === 'undefined') {
    function makeRequest(method, opts, callback) {
      try {
        const httpOpts = {};
        if (opts.timeout) httpOpts.timeout = parseInt(opts.timeout) * 1000 || 60000;
        if (opts.headers) httpOpts.headers = opts.headers;
        if (opts.body) httpOpts.body = opts.body;
        if (opts['binary-mode']) httpOpts.responseType = 'arraybuffer';
        if (opts.policy) httpOpts.policy = opts.policy;
        const fn = method === 'get' ? ctx.http.get : method === 'post' ? ctx.http.post : method === 'put' ? ctx.http.put : method === 'delete' ? ctx.http.delete : ctx.http.get;
        fn.call(ctx.http, opts.url, httpOpts).then(async (resp) => {
          const status = resp.status;
          let body;
          try {
            if (opts['binary-mode']) { body = await resp.arrayBuffer(); }
            else { body = await resp.text(); }
          } catch(e) { body = ''; }
          const o = {
            status: status,
            statusCode: status,
            ok: /^2\d\d$/.test(String(status)),
            headers: resp.headers
          };
          o.body = body;
          callback(null, o, body);
        }).catch((err) => {
          callback(err, null, null);
        });
      } catch(e) {
        callback(e, null, null);
      }
    }
    globalThis.$httpClient = {
      get: function(opts, cb) { makeRequest('get', opts, cb); },
      post: function(opts, cb) { makeRequest('post', opts, cb); },
      put: function(opts, cb) { makeRequest('put', opts, cb); },
      delete: function(opts, cb) { makeRequest('delete', opts, cb); },
      head: function(opts, cb) { makeRequest('head', opts, cb); }
    };
  }

  // ---- 5. Polyfill: $done ----
  if (typeof globalThis.$done === 'undefined') {
    globalThis.$done = function(result) { /* Egern schedule 不需要 $done */ };
  }

  // ---- 6. 设置 Egern 环境标记（让脚本走 case "Egern" 分支）----
  globalThis.Egern = globalThis.Egern || true;

  // ---- 7. 下载并执行原版 95598.js ----
  try {
    const scriptUrl = ctx.env['script_url'] || 'https://raw.githubusercontent.com/mickeu/Egern/main/95598-core.js';
    const resp = await ctx.http.get(scriptUrl, { timeout: 30000 });
    const code = await resp.text();
    // 用 Function 构造器执行（IIFE 自执行）
    new Function(code)();
  } catch(e) {
    ctx.notify({ title: '网上国网', subtitle: '❌ 脚本执行错误', body: '壳脚本加载/执行失败: ' + e.message });
  }
}

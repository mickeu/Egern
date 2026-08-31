/**
 * 网上国网 95598 — Egern 原生壳脚本（mickeu 2026-08-31）
 * 
 * 根因：Egern schedule 脚本不注入 $argument，也不把 ctx 挂到 globalThis。
 * 95598.js 是 Loon 风格 IIFE，从 globalThis.$argument 读账号密码 → 永远 undefined。
 * 
 * 修法：用 export default async function(ctx) 拿到 ctx.env，
 * 构造 $argument 命名键值对设到 globalThis，再执行原版 95598-core.js。
 * $httpClient/$persistentStore/$notification/$done 由 Egern Loon 兼容层提供（已验证 $environment 存在）。
 * 
 * env 变量（在 95598.yaml 模块 env 段配置）：
 *   username / password / debug / show_recent_usage / notify_all_accounts / timeout
 */
export default async function(ctx) {
  // ---- 1. 从 ctx.env 构造 $argument 命名键值对 ----
  const argKeys = ['username','password','debug','show_recent_usage','notify_all_accounts','timeout','LogLevel','silent','service'];
  const pairs = [];
  for (const k of argKeys) {
    const v = ctx.env[k];
    if (v !== undefined && v !== null && v !== '') {
      pairs.push(k + '=' + v);
    }
  }
  if (pairs.length > 0) {
    globalThis.$argument = pairs.join('&');
  }

  // ---- 2. 确保 Egern 环境标记存在（让脚本走 case "Egern" 分支）----
  if (!globalThis.Egern) {
    globalThis.Egern = { 'egern-version': '2.x' };
  }

  // ---- 3. 下载并执行原版 95598 核心逻辑 ----
  try {
    const scriptUrl = 'https://raw.githubusercontent.com/mickeu/Egern/main/95598-core.js';
    const resp = await ctx.http.get(scriptUrl, { timeout: 30000 });
    const code = await resp.text();
    // 用 Function 构造器执行（原版是 IIFE 自执行）
    const fn = new Function(code);
    fn();
  } catch(e) {
    ctx.notify({ title: '网上国网', subtitle: '❌ 壳脚本错误', body: String(e.message || e) });
  }
}

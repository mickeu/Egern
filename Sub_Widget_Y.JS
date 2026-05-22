/**
 * 机场订阅流量监控小组件修改版
 * 修正版：移除“重置”字样，仅显示剩余天数，强制 2x2 布局
 */

export default async function (ctx) {
  const MAX = 5;
  const slots = [];

  for (let i = 1; i <= MAX; i++) {
    const url = (ctx.env[`URL${i}`] || "").trim();
    if (!url) continue;

    const rawReset = (ctx.env[`RESET${i}`] || "").trim();
    let resetDay = null;

    if (/^\d+$/.test(rawReset)) {
      const num = Number(rawReset);
      if (num >= 1 && num <= 31) {
        resetDay = num;
      }
    }

    slots.push({
      name: (ctx.env[`NAME${i}`] || "").trim() || "机场订阅",
      url,
      resetDay,
    });
  }

  const refreshTime = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const colors = {
    textPrimary: { light: "#000000", dark: "#FFFFFF" },
    textSecondary: { light: "#555555", dark: "#EBEBF5" },
    textTertiary: { light: "#888888", dark: "#8E8E93" },
    accentBlue: { light: "#007AFF", dark: "#0A84FF" },
    accentGreen: { light: "#34C759", dark: "#30D158" },
    accentOrange: { light: "#FF9500", dark: "#FF9F0A" },
    accentRed: { light: "#FF3B30", dark: "#FF453A" },
    accentPurple: { light: "#5856D6", dark: "#5856D6" },
    divider: { light: "#E5E5EA", dark: "#48484A" },
  };

  const bgGradient = {
    type: "linear",
    colors: [
      { light: "#FFFFFF", dark: "#2C2C2E" },
      { light: "#FFFFFF", dark: "#2C2C2E" },
    ],
    stops: [0, 1],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 0, y: 1 },
  };

  if (!slots.length) {
    return {
      type: "widget",
      backgroundGradient: bgGradient,
      padding: 16,
      gap: 12,
      refreshAfter: refreshTime,
      children: [
        {
          type: "stack",
          direction: "column",
          gap: 10,
          alignItems: "center",
          children: [
            { type: "image", src: "sf-symbol:wifi.slash", width: 32, height: 32, color: colors.accentRed },
            { type: "text", text: "未配置订阅", font: { size: "headline", weight: "semibold" }, textColor: colors.textPrimary },
          ],
        },
      ],
    };
  }

  const results = await Promise.all(slots.map((s) => fetchInfo(ctx, s)));

  const maxDisplay = 4; 
  const displayResults = results.slice(0, maxDisplay);
  const rows = [];
  for (let i = 0; i < displayResults.length; i += 2) {
    rows.push(displayResults.slice(i, i + 2));
  }

  return {
    type: "widget",
    backgroundGradient: bgGradient,
    padding: 8,
    gap: 8,
    refreshAfter: refreshTime,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 6,
        padding: [0, 4],
        children: [
          { type: "image", src: "sf-symbol:network", width: 12, height: 12, color: colors.accentBlue },
          { type: "text", text: "机场订阅", font: { size: "subheadline", weight: "bold" }, textColor: colors.textPrimary },
          { type: "spacer" },
          { type: "image", src: "sf-symbol:arrow.clockwise", width: 12, height: 12, color: colors.textTertiary },
          { type: "text", text: timeStr, font: { size: "caption2", weight: "medium" }, textColor: colors.textTertiary },
        ],
      },
      {
        type: "stack",
        direction: "column",
        gap: 8,
        children: rows.map(row => ({
          type: "stack",
          direction: "row",
          gap: 8,
          children: row.map(r => ({
            type: "stack",
            flex: 1, 
            children: [buildCard(r, colors, ctx)]
          }))
        })),
      },
    ],
  };
}

const CACHE_TIME = 1 * 60 * 60 * 1000;

async function fetchInfo(ctx, slot) {
  const cacheKey = `sub_cache_${slot.url}`;
  let cache = await ctx.storage.get(cacheKey);
  let cacheData = null;

  if (cache) {
    try {
      const parsed = JSON.parse(cache);
      if (Date.now() - parsed.time < CACHE_TIME) {
        return {
          ...parsed.data,
          name: slot.name,
          remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null,
        };
      }
      cacheData = parsed.data;
    } catch {}
  }

  const urls = buildVariants(slot.url);
  for (const method of ["head", "get"]) {
    for (const url of urls) {
      for (const headers of UA_LIST) {
        try {
          const resp = await ctx.http[method](url, { headers });
          const raw = resp.headers.get("subscription-userinfo") || "";
          const info = parseUserInfo(raw);
          if (info) {
            const used = (info.upload || 0) + (info.download || 0);
            const totalBytes = info.total || 0;
            const percent = totalBytes > 0 ? (used / totalBytes) * 100 : 0;
            const result = {
              error: null,
              used,
              totalBytes,
              percent,
              expire: info.expire || null,
              remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null,
            };
            await ctx.storage.set(cacheKey, JSON.stringify({ time: Date.now(), data: result }));
            return { ...result, name: slot.name };
          }
        } catch (_) {}
      }
    }
  }
  if (cacheData) return { ...cacheData, name: slot.name };
  return { name: slot.name, error: true };
}

function buildCard(result, colors, ctx) {
  const { name, error, used, totalBytes, percent, remainDays } = result;
  let statusColor = colors.accentGreen;
  if (error) statusColor = colors.accentRed;
  else if (percent >= 95) statusColor = colors.accentRed;
  else if (percent >= 80) statusColor = colors.accentOrange;
  else if (percent >= 50) statusColor = colors.accentPurple;

  if (error) {
    return { type: "stack", direction: "row", alignItems: "center", gap: 6, padding: [8, 10], backgroundColor: { light: "#FFF5F5", dark: "#3B1F1F" }, borderRadius: 8, children: [
        { type: "image", src: "sf-symbol:exclamationmark.circle.fill", width: 12, height: 12, color: colors.accentRed },
        { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: colors.textPrimary, flex: 1 },
      ] };
  }

  const progressPercent = Math.min(Math.max(percent, 0), 100);
  const usedStr = formatBytes(used);
  const totalStr = formatBytes(totalBytes);

  return {
    type: "stack",
    direction: "column",
    gap: 4,
    padding: [8, 10],
    backgroundColor: { light: "#FFFFFF", dark: "#2B2B2D" },
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 4,
        children: [
          { type: "image", src: "sf-symbol:circle.fill", width: 6, height: 6, color: statusColor },
          { type: "text", text: name, font: { size: "caption2", weight: "bold" }, textColor: colors.textPrimary, flex: 1 },
          { type: "text", text: `${Math.round(progressPercent)}%`, font: { size: "caption2", weight: "bold" }, textColor: statusColor },
        ],
      },
      { type: "stack", height: 4, borderRadius: 2, children: [
          { type: "stack", flex: Math.max(progressPercent, 1), height: 4, backgroundColor: statusColor, borderRadius: 2 },
          { type: "stack", flex: Math.max(100 - progressPercent, 1), height: 4, backgroundColor: { light: "#E8E8EA", dark: "#48484A" }, borderRadius: 2 },
        ]},
      { type: "stack", direction: "row", alignItems: "center", children: [
          { type: "text", text: `${usedStr}/${totalStr}`, font: { size: "caption2", weight: "medium" }, textColor: colors.textSecondary },
          { type: "spacer" },
          // 底部去掉了“重置”二字
          { type: "text", text: remainDays !== null ? `${remainDays}天` : "未知", font: { size: "caption2", weight: "semibold" }, textColor: colors.accentGreen },
        ]}
    ]
  };
}

const UA_LIST = [{ "User-Agent": "Quantumult%20X/1.5.2" }, { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" }, { "User-Agent": "mihomo/1.19.3", Accept: "application/x-yaml,text/plain,*/*" }];
function buildVariants(url) { const seen = new Set(); const out = []; const add = (u) => { if (u && !seen.has(u)) { seen.add(u); out.push(u); } }; add(url); add(withParam(url, "flag", "clash")); add(withParam(url, "flag", "meta")); return out; }
function withParam(url, key, value) { return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`; }
function parseUserInfo(header) { if (!header) return null; const pairs = header.match(/\w+=[\d.eE+-]+/g) || []; if (!pairs.length) return null; return Object.fromEntries(pairs.map(p => { const [k, v] = p.split("="); return [k, Number(v)]; })); }
function formatBytes(bytes) { if (!Number.isFinite(bytes) || bytes <= 0) return "0B"; const units = ["B", "KB", "MB", "GB", "TB"]; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); const value = bytes / Math.pow(1024, i); return `${value >= 10 ? Math.round(value) : value.toFixed(1)}${units[i]}`; }
function getRemainingDays(resetDay) { const now = new Date(); const maxDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const safeDay = Math.min(resetDay, maxDay); let next = new Date(now.getFullYear(), now.getMonth(), safeDay); if (now.getDate() >= safeDay) { const nextMonthMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate(); const nextSafeDay = Math.min(resetDay, nextMonthMax); next = new Date(now.getFullYear(), now.getMonth() + 1, nextSafeDay); } return Math.max(0, Math.ceil((next - now) / 86400000)); }

/**
 * 机场订阅流量监控小组件 (中号智能布局最终优化版)
 * 修复：无重置日统一精简显示为“永久”
 * * 【使用说明】
 * 1. 脚本类型：通用
 * 2. 环境变量配置：
 * - NAME1：订阅名称
 * - URL1 ：订阅链接
 * - RESET1：每月重置日期 (1-31 的数字)
 * (支持多组配置：NAME2/URL2/RESET2 ... 最多 4 组)
 * * 布局逻辑：
 * - 订阅数 <= 2 时：自动全宽列表显示
 * - 订阅数 > 2 时：自动 2x2 网格显示
 */
export default async function (ctx) {
  const startTime = Date.now();
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
      id: i,
      name: (ctx.env[`NAME${i}`] || "").trim() || `机场订阅 ${i}`,
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
    cardBg: { light: "#FFFFFF80", dark: "#2C2C2E80" },
  };

  const bgGradient = {
    type: "linear",
    colors: [
      { light: "#FFFFFF20", dark: "#2C2C2E40" },
      { light: "#FFFFFF20", dark: "#2C2C2E40" },
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

  const results = [];
  for (const slot of slots) {
    const elapsed = Date.now() - startTime;
    const forceCache = elapsed > 6500;
    const res = await safeFetchInfo(ctx, slot, forceCache);
    results.push(res);
  }

  const titleBar = {
    type: "stack",
    direction: "row",
    alignItems: "center",
    gap: 6,
    padding: [2, 4, 2, 4],
    children: [
      { type: "image", src: "sf-symbol:network", width: 12, height: 12, color: colors.accentBlue },
      { type: "text", text: "订阅流量信息", font: { size: "subheadline", weight: "bold" }, textColor: colors.textPrimary },
      { type: "spacer" },
      { type: "image", src: "sf-symbol:arrow.clockwise", width: 12, height: 12, color: colors.textTertiary },
      { type: "text", text: timeStr, font: { size: "caption2", weight: "medium" }, textColor: colors.textTertiary },
    ],
  };

  const contentAreaChildren = [];

  if (results.length === 1) {
    contentAreaChildren.push(buildCard(results[0], colors, ctx, "single"));
  } else if (results.length === 2) {
    contentAreaChildren.push(buildCard(results[0], colors, ctx, "double"));
    contentAreaChildren.push(buildCard(results[1], colors, ctx, "double"));
  } else if (results.length === 3) {
    contentAreaChildren.push({
      type: "stack",
      direction: "row",
      gap: 8,
      children: [
        { ...buildCard(results[0], colors, ctx, "grid"), flex: 1 },
        { ...buildCard(results[1], colors, ctx, "grid"), flex: 1 }
      ]
    });
    contentAreaChildren.push({
      type: "stack",
      direction: "row",
      children: [
        { ...buildCard(results[2], colors, ctx, "grid_full"), flex: 1 }
      ]
    });
  } else {
    contentAreaChildren.push({
      type: "stack",
      direction: "row",
      gap: 8,
      children: [
        { ...buildCard(results[0], colors, ctx, "grid"), flex: 1 },
        { ...buildCard(results[1], colors, ctx, "grid"), flex: 1 }
      ]
    });
    contentAreaChildren.push({
      type: "stack",
      direction: "row",
      gap: 8,
      children: [
        { ...buildCard(results[2], colors, ctx, "grid"), flex: 1 },
        { ...buildCard(results[3], colors, ctx, "grid"), flex: 1 }
      ]
    });
  }

  return {
    type: "widget",
    backgroundGradient: bgGradient,
    padding: [16, 12, 12, 12],
    refreshAfter: refreshTime,
    children: [
      {
        type: "stack",
        direction: "column",
        gap: 8,
        children: [
          titleBar,
          {
            type: "stack",
            direction: "column",
            padding: [4, 0, 0, 0],
            children: [{ type: "stack", direction: "column", gap: 6, children: contentAreaChildren }]
          }
        ]
      }
    ],
  };
}

function buildCard(result, colors, ctx, layoutMode = "single") {
  const { name, error, used, totalBytes, percent, remainDays } = result;
  
  // 原逻辑保留
  let statusColor = colors.accentGreen;
  if (error) statusColor = colors.accentRed;
  else if (percent >= 95) statusColor = colors.accentRed;
  else if (percent >= 80) statusColor = colors.accentOrange;
  else if (percent >= 50) statusColor = colors.accentPurple;

  let cardHeight = 60;
  let itemGap = 5;
  // 关键：为了不偏上，我们统一使用较小的 padding 
  let paddingConfig = [10, 12, 10, 12]; 

  if (layoutMode === "single") {
    cardHeight = 72;
    itemGap = 8;
  } else if (layoutMode === "double") {
    cardHeight = 54;
    itemGap = 4;
  } else if (layoutMode === "grid" || layoutMode === "grid_full") {
    cardHeight = 52;
    itemGap = 3;
    paddingConfig = [6, 10, 6, 10];
  }

  if (error) {
    return {
      type: "stack",
      direction: "row",
      alignItems: "center",
      gap: 6,
      padding: paddingConfig,
      height: cardHeight,
      backgroundColor: colors.cardBg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: { light: "#FFFFFF40", dark: "#FFFFFF10" },
      children: [
        { type: "image", src: "sf-symbol:exclamationmark.circle.fill", width: 12, height: 12, color: colors.accentRed },
        { type: "text", text: name, font: { size: "caption2", weight: "semibold" }, textColor: colors.textPrimary, flex: 1 },
        { type: "text", text: "同步失败", font: { size: "caption2", weight: "medium" }, textColor: colors.textTertiary }
      ]
    };
  }

  const progressPercent = Math.min(Math.max(percent, 0), 100);
  const usedStr = formatBytes(used);
  const totalStr = formatBytes(totalBytes);
  const remainStr = formatBytes(Math.max(0, totalBytes - used));

  let footerChildren = [];
  if (layoutMode === "single" || layoutMode === "double") {
    const resetText = remainDays !== null ? `流量重置时间 ${remainDays}天后` : "永久";
    footerChildren = [
      { type: "text", text: `${usedStr}/${totalStr}`, font: { size: "caption2", weight: "medium" }, textColor: colors.textSecondary },
      { type: "spacer" },
      { type: "text", text: resetText, font: { size: "caption2", weight: "medium" }, textColor: colors.textTertiary },
      { type: "spacer" },
      { type: "text", text: `剩 ${remainStr}`, font: { size: "caption2", weight: "semibold" }, textColor: statusColor }
    ];
  } else {
    const dayText = remainDays !== null ? `${remainDays}天` : "永久";
    const dayColor = remainDays !== null ? statusColor : colors.textTertiary;
    footerChildren = [
      { type: "text", text: `${usedStr}/${totalStr}`, font: { size: "caption2", weight: "medium" }, textColor: colors.textSecondary },
      { type: "spacer" },
      { type: "text", text: dayText, font: { size: "caption2", weight: "semibold" }, textColor: dayColor }
    ];
  }

  return {
    type: "stack",
    direction: "column",
    gap: itemGap,
    padding: paddingConfig,
    height: cardHeight,
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: { light: "#FFFFFF40", dark: "#FFFFFF10" },
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
      {
        type: "stack",
        direction: "row",
        height: 5,
        borderRadius: 2.5,
        children: [
          { type: "stack", flex: Math.max(progressPercent, 1), height: 5, backgroundColor: statusColor, borderRadius: 2.5 },
          { type: "stack", flex: Math.max(100 - progressPercent, 1), height: 5, backgroundColor: { light: "#00000010", dark: "#FFFFFF10" }, borderRadius: 2.5 },
        ]
      },
      { type: "stack", direction: "row", alignItems: "center", children: footerChildren }
    ]
  };
}

const CACHE_TIME = 30 * 60 * 1000;

async function safeFetchInfo(ctx, slot, forceCache) {
  const cacheKey = `sub_cache_v5_${encodeURIComponent(slot.url)}`;
  let savedCache = null;

  try {
    const rawCache = await ctx.storage.get(cacheKey);
    if (rawCache) {
      savedCache = JSON.parse(rawCache);
      if (!forceCache && (Date.now() - savedCache.time < CACHE_TIME)) {
        return { ...savedCache.data, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null };
      }
    }
  } catch (e) {}

  if (forceCache && savedCache) {
    return { ...savedCache.data, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null };
  }

  const targetRequests = [
    { url: slot.url, headers: { "User-Agent": "clash-verge-rev/2.3.1", Accept: "application/x-yaml,text/plain,*/*" } },
    { url: slot.url.includes("?") ? `${slot.url}&flag=clash` : `${slot.url}?flag=clash`, headers: { "User-Agent": "Quantumult%20X/1.5.2" } }
  ];

  for (const req of targetRequests) {
    try {
      const resp = await Promise.race([
        ctx.http.get(req.url, { headers: req.headers }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3000))
      ]);

      if (resp && resp.headers) {
        let raw = "";
        if (typeof resp.headers.get === "function") {
          raw = resp.headers.get("subscription-userinfo") || "";
        } else {
          raw = resp.headers["subscription-userinfo"] || resp.headers["Subscription-Userinfo"] || "";
        }

        const info = parseUserInfo(raw);
        if (info) {
          const used = (info.upload || 0) + (info.download || 0);
          const totalBytes = info.total || 0;
          const percent = totalBytes > 0 ? (used / totalBytes) * 100 : 0;
          const result = { error: null, used, totalBytes, percent, expire: info.expire || null, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null };
          ctx.storage.set(cacheKey, JSON.stringify({ time: Date.now(), data: result })).catch(() => {});
          return { ...result, name: slot.name };
        }
      }
    } catch (err) {}
  }

  return savedCache ? { ...savedCache.data, name: slot.name, remainDays: slot.resetDay ? getRemainingDays(slot.resetDay) : null } : { name: slot.name, error: true };
}

function parseUserInfo(header) { if (!header) return null; const pairs = header.match(/\w+=[\d.eE+-]+/g) || []; if (!pairs.length) return null; return Object.fromEntries(pairs.map(p => { const [k, v] = p.split("="); return [k, Number(v)]; })); }
function formatBytes(bytes) { if (!Number.isFinite(bytes) || bytes <= 0) return "0B"; const units = ["B", "KB", "MB", "GB", "TB"]; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); const value = bytes / Math.pow(1024, i); return `${value >= 10 ? Math.round(value) : value.toFixed(1)}${units[i]}`; }
function getRemainingDays(resetDay) { const now = new Date(); const maxDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const safeDay = Math.min(resetDay, maxDay); let next = new Date(now.getFullYear(), now.getMonth(), safeDay); if (now.getDate() >= safeDay) { const nextMonthMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate(); const nextSafeDay = Math.min(resetDay, nextMonthMax); next = new Date(now.getFullYear(), now.getMonth() + 1, nextSafeDay); } return Math.max(0, Math.ceil((next - now) / 86400000)); }

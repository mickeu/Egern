/*
@Name: PingMe 获取签到参数 (fmz200原版逻辑)
@Description: 拦截PingMe余额查询请求，自动捕获所有请求头和参数
@Author: fmz200 -> mickeu -> Egern
@Date: 2026-07-25
*/

const ckKey = 'pingme_capture_v3';

export default async function(ctx) {
    const cap = ctx.env && ctx.env.PINGME_CAPTURE;
    if (cap === 'false') {
        console.log('⏸ PingMe 已关闭，跳过抓参');
        return;
    }

    const url = ctx.request.url;
    const headers = ctx.request.headers || {};
    console.log('PingMe 开始抓参: ' + url);

    if (url.includes('/app/queryBalanceAndBonus')) {
        console.log('PingMe 开始');
        const capture = {
            url: url,
            paramsRaw: parseRawQuery(url),
            headers: normalizeHeaderNameMap(headers)
        };
        ctx.storage.set(ckKey, JSON.stringify(capture));
        console.log('PingMe 获取到的内容为：' + url);
    }
}

function parseRawQuery(url) {
    const idx = url.indexOf('?');
    if (idx === -1) return {};
    const qs = url.substring(idx + 1);
    const params = {};
    qs.split('&').forEach(pair => {
        const [k, v] = pair.split('=').map(s => decodeURIComponent(s || ''));
        if (k) params[k] = v;
    });
    return params;
}

function normalizeHeaderNameMap(headers) {
    const normalized = {};
    Object.keys(headers || {}).forEach(k => {
        normalized[k.toLowerCase()] = headers[k];
    });
    return normalized;
}
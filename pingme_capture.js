/*
@Name: PingMe 获取签到参数 (Egern专用)
@Description: 拦截PingMe余额查询请求，自动捕获Cookie和参数
@Author: mickeu (基于fmz200 Qx版 get_cookie.js 转换)
@Date: 2026-07-25
*/

const ckKey = 'pingme_capture_v3';

export default async function(ctx) {
    // 开关：模块 env PINGME_CAPTURE = false 关闭
    const cap = ctx.env && ctx.env.PINGME_CAPTURE;
    if (cap === 'false') {
        console.log('⏸ PingMe 已关闭，跳过抓参');
        return;
    }

    const url = ctx.request.url;
    console.log('PingMe 开始抓参: ' + url);

    // 捕获所有请求头 (Headers 对象 → 普通对象)
    const h = ctx.request.headers;
    const headers = {};

    // 常见HTTP请求头列表 (覆盖Qx版捕获的所有字段)
    const commonHeaders = [
        'Host', 'Accept', 'Content-Type', 'Cookie', 'Authorization',
        'User-Agent', 'Accept-Language', 'Accept-Encoding', 'Connection',
        'Origin', 'Referer', 'Cache-Control', 'Pragma', 'X-Requested-With',
        'X-Forwarded-For', 'X-Real-IP', 'X-User-ID', 'X-Token',
        'If-None-Match', 'If-Modified-Since', 'X-Client-Info',
        'X-App-Version', 'X-Platform', 'X-Device-Id', 'X-Device-Info',
        'X-Session-Token', 'X-Auth-Token', 'X-API-Key', 'X-Signature',
        'X-Timestamp', 'X-Nonce', 'X-Request-ID',
        'appVersion', 'platform', 'deviceId', 'deviceInfo',
        'token', 'userId', 'sessionId'
    ];

    for (const name of commonHeaders) {
        const val = h.get(name);
        if (val) headers[name] = val;
    }

    // 额外捕获所有非标准请求头 (通过遍历原始请求对象)
    // 尝试捕获可能存在的自定义头
    const extraHeaders = ['sign', 'signDate', 'nonce', 'timestamp', 'appid'];
    for (const name of extraHeaders) {
        const val = h.get(name);
        if (val) headers[name] = val;
    }

    // 从URL中提取查询参数
    const queryStr = url.split('?')[1] || '';
    const paramsRaw = {};
    queryStr.split('&').forEach(pair => {
        if (!pair) return;
        const idx = pair.indexOf('=');
        if (idx < 0) return;
        paramsRaw[pair.slice(0, idx)] = decodeURIComponent(pair.slice(idx + 1));
    });

    // 保存捕获的数据
    ctx.storage.setJSON(ckKey, { url, headers, paramsRaw });

    console.log('✅ PingMe 参数已保存');
    console.log('📋 捕获到 ' + Object.keys(headers).length + ' 个请求头');
    console.log('📋 捕获到 ' + Object.keys(paramsRaw).length + ' 个查询参数');

    // 发送通知
    ctx.notify({
        title: 'PingMe 获取成功✅',
        body: '参数已保存，可禁用此配置',
        sound: true,
        duration: 3
    });
}
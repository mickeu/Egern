/*
@Name: PingMe 获取签到参数 (Egern专用)
@Description: 拦截PingMe余额查询请求，自动捕获所有请求头和参数
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

    // ============ 捕获所有请求头 ============
    const h = ctx.request.headers;
    const headers = {};

    // 全量 HTTP 请求头列表 (覆盖所有标准头 + 常见自定义头)
    const ALL_HEADERS = [
        // 标准 HTTP 头
        'Host', 'Connection', 'Content-Length', 'Content-Type',
        'Accept', 'Accept-Language', 'Accept-Encoding', 'Accept-Charset',
        'User-Agent', 'Referer', 'Origin', 'Cookie', 'Set-Cookie',
        'Authorization', 'Proxy-Authorization',
        'Cache-Control', 'Pragma', 'Expires',
        'If-Modified-Since', 'If-None-Match', 'If-Match', 'If-Unmodified-Since',
        'If-Range', 'Range',
        'Transfer-Encoding', 'TE', 'Trailer',
        'Upgrade', 'Via', 'Warning',
        'From', 'Max-Forwards', 'Expect',
        'DNT', 'X-Forwarded-For', 'X-Forwarded-Proto', 'X-Forwarded-Host',
        'X-Real-IP', 'X-Requested-With', 'X-Request-ID',
        'X-CSRF-Token', 'X-XSS-Protection', 'X-Content-Type-Options',
        'X-Frame-Options',

        // 移动端/API 常见自定义头
        'X-Device-Id', 'X-Device-Info', 'X-Device-Model', 'X-Device-OS',
        'X-Device-Type', 'X-Platform', 'X-Platform-Version',
        'X-App-Version', 'X-App-Build', 'X-App-Id', 'X-App-Name',
        'X-Client-Id', 'X-Client-Info', 'X-Client-Version',
        'X-Session-Id', 'X-Session-Token', 'X-User-Id', 'X-User-Token',
        'X-Auth-Token', 'X-Auth-Key', 'X-API-Key', 'X-API-Version',
        'X-Signature', 'X-Sign', 'X-Timestamp', 'X-Nonce', 'X-Time',
        'X-Language', 'X-Locale', 'X-Timezone', 'X-Country',
        'X-Network-Type', 'X-Network-Operator',
        'X-Tracking-Id', 'X-Analytics-Id',

        // 小写变体 (部分App发小写)
        'host', 'connection', 'content-type', 'content-length',
        'accept', 'user-agent', 'referer', 'origin', 'cookie',
        'authorization', 'cache-control', 'pragma',
        'x-requested-with', 'x-device-id', 'x-platform',
        'x-app-version', 'x-client-info', 'x-user-id',
        'x-auth-token', 'x-api-key', 'x-signature', 'x-timestamp',
        'x-nonce', 'x-session-token', 'x-device-info',
        'x-forwarded-for', 'x-real-ip',

        // 其他可能出现的自定义头
        'AppVersion', 'Platform', 'DeviceId', 'DeviceInfo',
        'DeviceModel', 'DeviceOS', 'SessionId', 'UserId',
        'Token', 'AuthToken', 'APIKey', 'Signature', 'Timestamp',
        'Nonce', 'Language', 'appVersion', 'platform',
        'deviceId', 'deviceInfo', 'sessionId', 'userId',
        'token', 'authToken', 'apiKey', 'signature', 'timestamp',
        'nonce', 'language', 'appid', 'appkey',
        'sign', 'signDate', 'signData', 'signType',
        'accessToken', 'refreshToken', 'idToken',
    ];

    // 去重
    const seen = new Set();
    for (const name of ALL_HEADERS) {
        if (seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        const val = h.get(name);
        if (val !== null && val !== undefined && val !== '') {
            headers[name] = val;
        }
    }

    // 额外尝试：通过访问 headers 对象直接捕获未覆盖的字段
    // 部分 Headers 实现支持迭代
    try {
        if (typeof h.entries === 'function') {
            for (const [key, value] of h.entries()) {
                if (!seen.has(key.toLowerCase())) {
                    headers[key] = value;
                    seen.add(key.toLowerCase());
                }
            }
        } else if (typeof h.forEach === 'function') {
            h.forEach((value, key) => {
                if (!seen.has(key.toLowerCase())) {
                    headers[key] = value;
                    seen.add(key.toLowerCase());
                }
            });
        }
    } catch (e) {
        console.log('迭代headers失败: ' + e.message);
    }

    // ============ 从URL提取查询参数 ============
    const queryStr = url.split('?')[1] || '';
    const paramsRaw = {};
    queryStr.split('&').forEach(pair => {
        if (!pair) return;
        const idx = pair.indexOf('=');
        if (idx < 0) return;
        paramsRaw[pair.slice(0, idx)] = decodeURIComponent(pair.slice(idx + 1));
    });

    // ============ 保存到存储 ============
    ctx.storage.setJSON(ckKey, {
        url: url,
        headers: headers,
        paramsRaw: paramsRaw,
        capturedAt: new Date().toISOString()
    });

    const headerCount = Object.keys(headers).length;
    const paramCount = Object.keys(paramsRaw).length;
    console.log(`✅ PingMe 参数已保存 (${headerCount} headers, ${paramCount} params)`);

    // 打印关键信息
    if (headers['Cookie'] || headers['cookie']) {
        console.log('🍪 Cookie 已捕获');
    }
    if (headers['Authorization'] || headers['authorization']) {
        console.log('🔑 Authorization 已捕获');
    }

    // 发送通知
    ctx.notify({
        title: 'PingMe 获取成功✅',
        body: `已捕获 ${headerCount} 个请求头, ${paramCount} 个参数`,
        sound: true,
        duration: 3
    });
}
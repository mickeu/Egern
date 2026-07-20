/*
@Name: PingMe 获取签到参数 (Egern专用)
@Author: mickeu
@date 2026-07-20
*/

const ckKey = 'pingme_capture_v3';

export default async function(ctx) {
    // 开关：模块 arg2 = false 关闭
    const arg2 = ctx.env && ctx.env.arg2;
    if (arg2 === 'false') {
        console.log('⏸ PingMe 已关闭，跳过抓参');
        return;
    }

    const url = ctx.request.url;
    console.log('PingMe 开始');

    const headers = {};
    for (const [key, value] of ctx.request.headers) {
        headers[key] = value;
    }

    const queryStr = url.split('?')[1] || '';
    const paramsRaw = {};
    queryStr.split('&').forEach(pair => {
        if (!pair) return;
        const idx = pair.indexOf('=');
        if (idx < 0) return;
        paramsRaw[pair.slice(0, idx)] = decodeURIComponent(pair.slice(idx + 1));
    });

    ctx.storage.setJSON(ckKey, { url, headers, paramsRaw });
    ctx.notify({
        title: 'PingMe 获取成功✅',
        body: '现在你可以禁用此配置了'
    });
    console.log('PingMe 获取到的内容为：' + url);
}
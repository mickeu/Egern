/*
@Name: PingMe 获取签到参数 (Egern专用)
@Author: mickeu
@date 2026-07-20
*/

const ckKey = 'pingme_capture_v3';

export default async function(ctx) {
    const url = ctx.request.url;
    console.log('PingMe 开始: ' + url);

    // 解析 URL 参数
    const queryStr = url.split('?')[1] || '';
    const paramsRaw = {};
    queryStr.split('&').forEach(pair => {
        if (!pair) return;
        const idx = pair.indexOf('=');
        if (idx < 0) return;
        paramsRaw[pair.slice(0, idx)] = decodeURIComponent(pair.slice(idx + 1));
    });

    const capture = { url, headers: {}, paramsRaw };
    ctx.storage.setJSON(ckKey, capture);
    console.log('✅ PingMe 参数已保存');
    ctx.notify({ title: 'PingMe 获取成功✅', body: '现在你可以禁用此配置了' });
}
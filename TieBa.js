/*********************************
百度贴吧签到脚本 - Egern 原生版
原作者: @sazs34
修改: mickeu (适配 Egern ctx API)
更新日期: 2026/07/29

获取Cookie说明：
打开百度贴吧App后，点击"我的"，如通知成功获取cookie则可以使用该脚本.

支持通过环境变量 COOKIE_ENABLED 控制是否抓取Cookie。
*********************************/

export default async function(ctx) {
  // 判断模式：http_request 还是 schedule
  if (ctx.request) {
    // —— Cookie 获取模式 ——
    if (ctx.env.COOKIE_ENABLED === 'false') {
      return;
    }
    await GetCookie(ctx);
  } else {
    // —— 签到模式 ——
    await signTieBa(ctx);
  }
}

async function GetCookie(ctx) {
  var headerCookie = ctx.request.headers.get('Cookie') || ctx.request.headers.get('cookie');
  if (headerCookie && headerCookie.includes('BDUSS=')) {
    ctx.notify({ title: '写入百度贴吧Cookie成功 🎉' });
    ctx.storage.set('CookieTB', headerCookie);
  } else {
    console.log('写入Cookie失败, BDUSS值缺失.');
  }
  return;
}

async function signTieBa(ctx) {
  var cookieVal = ctx.storage.get('CookieTB');
  var useParallel = parseInt(ctx.storage.get('BDTB_DailyBonus_Mode') || '0', 10);
  var singleNotifyCount = parseInt(ctx.storage.get('BDTB_DailyBonus_notify') || '20', 10);

  if (!cookieVal) {
    ctx.notify({ title: '贴吧签到', subtitle: '签到失败', body: '未获取到cookie' });
    return;
  }

  try {
    var signResp = await ctx.http.get('https://tieba.baidu.com/mo/q/newmoindex', {
      headers: {
        'Content-Type': 'application/octet-stream',
        Referer: 'https://tieba.baidu.com/index/tbwise/forum',
        Cookie: cookieVal,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/16A366'
      }
    });

    var body = await signResp.json();
    var isSuccess = body && body.no === 0 && body.error === 'success' && body.data && body.data.tbs;

    if (!isSuccess) {
      ctx.notify({
        title: '贴吧签到',
        subtitle: '签到失败',
        body: (body && body.error) ? body.error : '接口数据获取失败'
      });
      return;
    }

    var forums = body.data.like_forum;
    var tbs = body.data.tbs;
    var total = forums.length;
    var results = [];

    if (!forums || forums.length === 0) {
      ctx.notify({ title: '贴吧签到', subtitle: '签到失败', body: '请确认您有关注的贴吧' });
      return;
    }

    // 决定并行还是串行
    var isParallel = useParallel === 2 || (useParallel === 0 && forums.length < 30);

    if (isParallel) {
      var promises = forums.map(function(bar) {
        return signBar(ctx, bar, tbs, cookieVal);
      });
      results = await Promise.all(promises);
    } else {
      for (var i = 0; i < forums.length; i++) {
        var bar = forums[i];
        var result = await signBar(ctx, bar, tbs, cookieVal);
        results.push(result);
      }
    }

    // 分批次发送通知
    for (var i = 0; i < Math.ceil(total / singleNotifyCount); i++) {
      var batch = results.splice(0, singleNotifyCount);
      var successCount = 0;
      var notifyText = '';

      for (var j = 0; j < batch.length; j++) {
        var res = batch[j];
        if (res.errorCode === 0 || res.errorCode === 9999) {
          successCount++;
        }
        if (res.errorCode === 9999) {
          notifyText += '【' + res.bar + '】已经签到，当前等级' + res.level + ',经验' + res.exp + '\n';
        } else {
          notifyText += '【' + res.bar + '】' + (res.errorCode === 0 ? '签到成功' : '签到失败') + '，' +
            (res.errorCode === 0 ? res.errorMsg : '原因：' + res.errorMsg) + '\n';
        }
      }

      ctx.notify({
        title: '贴吧签到',
        body: '签到' + batch.length + '个,成功' + successCount + '个\n' + notifyText
      });
    }

  } catch (e) {
    ctx.notify({ title: '贴吧签到', subtitle: '签到失败', body: '网络请求异常' });
  }
}

async function signBar(ctx, bar, tbs, cookieVal) {
  if (bar.is_sign === 1) {
    return {
      bar: bar.forum_name,
      level: bar.user_level,
      exp: bar.user_exp,
      errorCode: 9999,
      errorMsg: '已签到'
    };
  }

  try {
    var addResp = await ctx.http.post('https://tieba.baidu.com/sign/add', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieVal,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_1_1 like Mac OS X; zh-CN) AppleWebKit/537.51.1 (KHTML, like Gecko) Mobile/14B100 UCBrowser/10.7.5.650 Mobile'
      },
      body: 'tbs=' + encodeURIComponent(tbs) + '&kw=' + encodeURIComponent(bar.forum_name) + '&ie=utf-8'
    });

    var data = await addResp.json();
    if (data.no === 0) {
      return {
        bar: bar.forum_name,
        errorCode: 0,
        errorMsg: '获得' + data.data.uinfo.cont_sign_num + '积分,第' + data.data.uinfo.user_sign_rank + '个签到'
      };
    } else {
      return {
        bar: bar.forum_name,
        errorCode: data.no,
        errorMsg: data.error
      };
    }
  } catch (e) {
    return {
      bar: bar.forum_name,
      errorCode: 999,
      errorMsg: '接口错误'
    };
  }
}
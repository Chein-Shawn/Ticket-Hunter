/**
 * Ticket hunter — entry points: menu, trigger, monitoring cycle.
 */

var TH_TRIGGER_HANDLER = 'tick';
var TH_INVOCATION_OVERHEAD_MS = 250; // 估計每次觸發的啟動開銷，計入配額

var TH_SOURCE_INFO = [
  { id: 'ptt', label: 'PTT Drama-Ticket', where: '雲端 Cloud', needs: '無 None' },
  { id: 'opentix', label: 'OPENTIX', where: '雲端 Cloud', needs: '在「監測目標」填 OPENTIX 網址 / OPENTIX URL in Targets' },
  { id: 'tixcraft', label: '拓元 tixCraft', where: '雲端 Cloud', needs: '開發中 Coming soon' },
  { id: 'era', label: '年代 ticket.com.tw', where: '雲端 Cloud', needs: '開發中 Coming soon' },
  { id: 'kham', label: '寬宏 kham.com.tw', where: '雲端 Cloud', needs: '開發中 Coming soon' },
  { id: 'kktix', label: 'KKTIX', where: '本機 Local', needs: '瀏覽器擴充功能（第二階段） / Browser extension (phase 2)' },
  { id: 'dcard', label: 'Dcard 票券板', where: '本機 Local', needs: '瀏覽器擴充功能（第二階段） / Browser extension (phase 2)' },
  { id: 'carousell', label: '旋轉拍賣 Carousell', where: '本機 Local', needs: '瀏覽器擴充功能（第二階段） / Browser extension (phase 2)' },
  { id: 'social', label: 'Facebook / Threads / Instagram', where: '本機 Local', needs: '擴充功能＋瀏覽器已登入（第二階段） / Extension + logged-in browser (phase 2)' }
];

// ---------------------------------------------------------------- menu

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎫 Ticket hunter')
    .addItem('① 初始化工作表 Set up sheets', 'menuSetup')
    .addItem('② 寄測試信 Send test email', 'menuTestEmail')
    .addItem('③ 載入官方票區 Load official zones', 'menuLoadZones')
    .addSeparator()
    .addItem('▶ 開始監測 Start monitoring', 'menuStart')
    .addItem('■ 停止監測 Stop monitoring', 'menuStop')
    .addItem('↻ 立即檢查一次 Check now', 'menuCheckNow')
    .addSeparator()
    .addItem('重設已讀紀錄 Reset seen posts', 'menuResetState')
    .addToUi();
}

function menuSetup() {
  var ss = getSpreadsheet_();
  ensureSheets_(ss);
  var lang = readSettings_(ss).language;
  refreshStatus_(ss, true);
  ss.toast(t(lang, 'setupDone'), 'Ticket hunter', 8);
}

function menuTestEmail() {
  var ss = getSpreadsheet_();
  ensureSheets_(ss);
  var s = readSettings_(ss);
  MailApp.sendEmail({ to: recipient_(s), subject: t(s.language, 'testSubject'), body: t(s.language, 'testBody'), name: 'Ticket hunter' });
  ss.toast(recipient_(s), t(s.language, 'testSubject'), 6);
}

function menuLoadZones() {
  var ss = getSpreadsheet_();
  ensureSheets_(ss);
  var s = readSettings_(ss);
  var targets = readTargets_(ss).filter(function (x) { return x.enabled && isOpentixEventUrl(x.officialUrl); });
  if (!targets.length) { SpreadsheetApp.getUi().alert(t(s.language, 'noOfficialTargets')); return; }
  var total = 0;
  var now = new Date();
  targets.forEach(function (tg) {
    var parsed = fetchOpentix_(tg.officialUrl);
    total += writeZonesForTarget_(ss, tg.name, parsed, now);
  });
  ss.toast(t(s.language, 'zonesLoaded', { n: total }), 'Ticket hunter', 10);
}

function menuStart() {
  var ss = getSpreadsheet_();
  ensureSheets_(ss);
  removeTriggers_();
  ScriptApp.newTrigger(TH_TRIGGER_HANDLER).timeBased().everyMinutes(1).create();
  var s = readSettings_(ss);
  refreshStatus_(ss, true);
  ss.toast(t(s.language, 'started'), 'Ticket hunter', 6);
}

function menuStop() {
  var ss = getSpreadsheet_();
  removeTriggers_();
  var s = readSettings_(ss);
  refreshStatus_(ss, true);
  ss.toast(t(s.language, 'stopped'), 'Ticket hunter', 6);
}

function menuCheckNow() {
  var ss = getSpreadsheet_();
  ensureSheets_(ss);
  var r = withLock_(function () { return runCycle_({ force: true }); });
  var s = readSettings_(ss);
  ss.toast(t(s.language, 'checkDone', { hits: r ? r.hits : 0 }), 'Ticket hunter', 8);
}

function menuResetState() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('Ticket hunter', '清除已讀文章、重貼紀錄與 OPENTIX 上次張數？下次檢查會重新判斷最近 1 小時的文章。\nReset seen posts, repost memory and last OPENTIX counts?', ui.ButtonSet.OK_CANCEL) !== ui.Button.OK) return;
  [TH_KEYS.seenPtt, TH_KEYS.repost, TH_KEYS.opentixRemain, TH_KEYS.lastRun].forEach(storeDelete);
  getSpreadsheet_().toast('OK', 'Ticket hunter', 4);
}

// ---------------------------------------------------------------- trigger

/** 時間觸發器每分鐘呼叫一次。 */
function tick() {
  var t0 = Date.now();
  var active = false;
  try {
    var r = withLock_(function () { return runCycle_({}); });
    active = !!(r && r.ran);
  } finally {
    var day = taipeiDayKey(new Date());
    storeSet(TH_KEYS.usage, addUsage(storeGet(TH_KEYS.usage, null), day, Date.now() - t0 + TH_INVOCATION_OVERHEAD_MS, active));
  }
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(2000)) return null;
  try { return fn(); } finally { lock.releaseLock(); }
}

function removeTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (tr) {
    if (tr.getHandlerFunction() === TH_TRIGGER_HANDLER) ScriptApp.deleteTrigger(tr);
  });
}

function isTriggerInstalled_() {
  return ScriptApp.getProjectTriggers().some(function (tr) { return tr.getHandlerFunction() === TH_TRIGGER_HANDLER; });
}

// ---------------------------------------------------------------- cycle

function runCycle_(opts) {
  opts = opts || {};
  var ss = getSpreadsheet_();
  var now = new Date();
  var nowMs = now.getTime();
  var settings = readSettings_(ss);
  var lang = settings.language;
  var plan = planCycle_(settings, now);
  var result = { ran: false, hits: 0 };

  if (!opts.force && (plan.quiet || plan.eff.paused)) {
    maybeWriteStatus_(ss, settings, plan, false);
    return result;
  }

  var targets = readTargets_(ss).filter(function (x) { return x.enabled; });
  var rules = readRules_(ss);
  var health = storeGet(TH_KEYS.health, {});
  var lastRun = storeGet(TH_KEYS.lastRun, {});
  var ctx = { ss: ss, now: now, nowMs: nowMs, settings: settings, lang: lang, targets: targets, rules: rules, hits: [], logs: [] };

  var sources = [
    { id: 'ptt', label: 'PTT', enabled: settings.ptt_enabled && targets.length > 0, interval: settings.ptt_interval_minutes, run: runPtt_ },
    { id: 'opentix', label: 'OPENTIX', enabled: settings.opentix_enabled && targets.some(function (x) { return isOpentixEventUrl(x.officialUrl); }), interval: settings.opentix_interval_minutes, run: runOpentix_ }
  ];

  sources.forEach(function (src) {
    if (!src.enabled) return;
    var interval = Math.max(src.interval, plan.eff.interval);
    if (!opts.force && !isDue(lastRun[src.id], nowMs, interval)) return;
    result.ran = true;
    lastRun[src.id] = nowMs;
    var ok = true;
    var err = '';
    try {
      src.run(ctx);
    } catch (e) {
      ok = false;
      err = String(e && e.message ? e.message : e);
      ctx.logs.push([now, src.label, t(lang, 'logError'), '', err, '']);
    }
    var hr = recordHealth(health[src.id], ok, settings.failure_alert_threshold, err, nowMs);
    health[src.id] = hr.health;
    if (hr.event) sendAlert_(settings, hr.event, src.label, hr.health, ctx);
  });

  storeSet(TH_KEYS.health, health);
  storeSet(TH_KEYS.lastRun, lastRun);

  if (ctx.hits.length) sendHits_(settings, ctx);
  result.hits = ctx.hits.length;
  appendLogs_(ss, ctx.logs);
  maybeWriteStatus_(ss, settings, plan, result.ran || opts.force);
  return result;
}

function planCycle_(settings, now) {
  var day = taipeiDayKey(now);
  var avg = usageAverages(storeGet(TH_KEYS.usage, null), day);
  var left = minutesLeftToday(now, settings.quietRanges);
  var eff = computeEffectiveInterval({
    configured: settings.check_interval_minutes,
    budgetMs: settings.daily_runtime_budget_minutes * 60000,
    usedMs: avg.usedMs,
    idleMs: avg.idleMs,
    activeMs: avg.activeMs,
    minutesTotalLeft: left.total,
    minutesActiveLeft: left.active
  });
  return { quiet: isQuiet(now, settings.quietRanges), eff: eff, usedMs: avg.usedMs };
}

// ---------------------------------------------------------------- sources

function runPtt_(ctx) {
  var res = UrlFetchApp.fetch(PTT_ATOM_URL, { muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('PTT feed HTTP ' + code);
  var entries = parsePttAtom(res.getContentText('UTF-8'));
  if (!entries.length) throw new Error('PTT feed has no entries');

  var seen = storeGet(TH_KEYS.seenPtt, null);
  var firstRun = seen == null;
  seen = seen || [];
  var seenSet = {};
  seen.forEach(function (id) { seenSet[id] = true; });
  var fresh = entries.filter(function (e) { return !seenSet[e.id]; });
  if (firstRun) {
    // 第一次執行：只看最近 60 分鐘的文章，其餘標為已讀。
    fresh = fresh.filter(function (e) { return e.publishedMs && ctx.nowMs - e.publishedMs <= 3600000; });
  } else if (fresh.length === entries.length && entries.length >= 20) {
    ctx.logs.push([ctx.now, 'PTT', t(ctx.lang, 'logInfo'), '', 'Feed 20 篇都是新文章，停機期間可能漏看較舊的文章 / All 20 feed items are new; older posts may have been missed', '']);
  }

  var cands = [];
  fresh.forEach(function (e) {
    var m = findMatchingTargets(e.title + '\n' + e.content, ctx.targets);
    if (m.length) cands.push({ e: e, targets: m, text: null });
  });

  if (cands.length) {
    var resps = UrlFetchApp.fetchAll(cands.map(function (c) { return { url: c.e.url, muteHttpExceptions: true }; }));
    resps.forEach(function (r, i) {
      if (r.getResponseCode() === 200) cands[i].text = extractPttArticleText(r.getContentText('UTF-8'));
    });
  }

  var s = ctx.settings;
  var repost = pruneRepostMap(storeGet(TH_KEYS.repost, {}), ctx.nowMs, s.repost_dedupe_hours);
  cands.forEach(function (c) {
    var text = c.text || c.e.content;
    var extraFlags = c.text ? [] : ['flag_article_fetch_failed'];
    c.targets.forEach(function (tg) {
      var v = evaluatePost({ title: c.e.title, text: text, author: c.e.author, url: c.e.url }, tg, ctx.rules, s);
      if (!v.notify) {
        ctx.logs.push([ctx.now, 'PTT', t(ctx.lang, 'logSkip'), tg.name, t(ctx.lang, v.reason.key, v.reason.params) + ' — ' + c.e.title, c.e.url]);
        return;
      }
      var rk = repostKey(c.e.author, c.e.title) + '|' + tg.name;
      if (s.repost_dedupe_hours > 0 && repost[rk]) {
        ctx.logs.push([ctx.now, 'PTT', t(ctx.lang, 'logSkip'), tg.name, t(ctx.lang, 'skip_repost', { hours: s.repost_dedupe_hours }) + ' — ' + c.e.title, c.e.url]);
        return;
      }
      repost[rk] = ctx.nowMs;
      ctx.hits.push({ source: 'ptt', target: tg.name, title: c.e.title, url: c.e.url, author: c.e.author, excerpt: truncate(text, 300), price: v.price, flags: extraFlags.concat(v.flags) });
      ctx.logs.push([ctx.now, 'PTT', t(ctx.lang, 'logHit'), tg.name, c.e.title, c.e.url]);
    });
  });

  storeSet(TH_KEYS.seenPtt, rememberSeen(seen, entries.map(function (e) { return e.id; }), 400));
  storeSet(TH_KEYS.repost, repost);
}

function fetchOpentix_(url) {
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('OPENTIX HTTP ' + res.getResponseCode());
  var parsed = extractOpentixSessions(parseNuxtStateFromHtml(res.getContentText('UTF-8')));
  if (!parsed.sessions.length) throw new Error('OPENTIX: no sessions found');
  return parsed;
}

function runOpentix_(ctx) {
  var list = ctx.targets.filter(function (x) { return isOpentixEventUrl(x.officialUrl); });
  var resps = UrlFetchApp.fetchAll(list.map(function (x) { return { url: x.officialUrl, muteHttpExceptions: true }; }));
  var prev = storeGet(TH_KEYS.opentixRemain, {});
  var current = {};
  var errors = [];
  var zones = readZones_(ctx.ss);

  resps.forEach(function (r, i) {
    var tg = list[i];
    try {
      if (r.getResponseCode() !== 200) throw new Error('HTTP ' + r.getResponseCode());
      var parsed = extractOpentixSessions(parseNuxtStateFromHtml(r.getContentText('UTF-8')));
      if (!parsed.sessions.length) throw new Error('no sessions found');
      var mine = zones.filter(function (z) { return z.target === tg.name && z.source === 'opentix'; });
      if (!mine.length) {
        writeZonesForTarget_(ctx.ss, tg.name, parsed, ctx.now);
        zones = readZones_(ctx.ss);
        mine = zones.filter(function (z) { return z.target === tg.name && z.source === 'opentix'; });
        ctx.logs.push([ctx.now, 'OPENTIX', t(ctx.lang, 'logInfo'), tg.name, t(ctx.lang, 'zonesLoaded', { n: mine.length }), tg.officialUrl]);
      }
      var ev = evaluateOpentixZones(parsed, mine, prev, tg.name);
      ev.hits.forEach(function (h) {
        h.url = tg.officialUrl;
        ctx.hits.push(h);
        ctx.logs.push([ctx.now, 'OPENTIX', t(ctx.lang, 'logHit'), tg.name, h.session + ' ' + h.zone + ' ' + t(ctx.lang, 'remaining') + ' ' + h.remaining, tg.officialUrl]);
      });
      Object.keys(ev.current).forEach(function (k) { current[k] = ev.current[k]; });
    } catch (e) {
      errors.push(tg.name + ': ' + (e && e.message ? e.message : e));
    }
  });

  var merged = {};
  Object.keys(prev).forEach(function (k) { merged[k] = prev[k]; });
  Object.keys(current).forEach(function (k) { merged[k] = current[k]; });
  storeSet(TH_KEYS.opentixRemain, merged);
  updateZoneRemaining_(ctx.ss, current, ctx.now);
  if (errors.length) throw new Error('OPENTIX ' + errors.join('; '));
}

// ---------------------------------------------------------------- email

function recipient_(settings) {
  return settings.notify_email || Session.getEffectiveUser().getEmail();
}

function sendHits_(settings, ctx) {
  if (MailApp.getRemainingDailyQuota() < 1) {
    ctx.logs.push([ctx.now, 'Email', t(ctx.lang, 'logError'), '', 'Daily email quota exhausted / 今日寄信額度已用完', '']);
    return;
  }
  var mail = buildHitsEmail(ctx.hits, ctx.lang);
  MailApp.sendEmail({ to: recipient_(settings), subject: mail.subject, body: mail.text, htmlBody: mail.html, name: 'Ticket hunter' });
}

function sendAlert_(settings, event, label, health, ctx) {
  if (MailApp.getRemainingDailyQuota() < 1) return;
  var mail = buildAlertEmail(event, label, health, ctx.lang);
  MailApp.sendEmail({ to: recipient_(settings), subject: mail.subject, body: mail.text, name: 'Ticket hunter' });
  ctx.logs.push([ctx.now, label, t(ctx.lang, 'logInfo'), '', mail.subject, '']);
}

// ---------------------------------------------------------------- status

function maybeWriteStatus_(ss, settings, plan, force) {
  var last = storeGet(TH_KEYS.statusWrittenAt, 0);
  if (!force && Date.now() - last < 5 * 60000) return;
  refreshStatus_(ss, true, settings, plan);
}

function refreshStatus_(ss, force, settings, plan) {
  settings = settings || readSettings_(ss);
  var now = new Date();
  plan = plan || planCycle_(settings, now);
  var lang = settings.language;
  var health = storeGet(TH_KEYS.health, {});
  var running = isTriggerInstalled_();
  var monitoringText = !running ? t(lang, 'stStopped')
    : plan.eff.paused ? t(lang, 'stBudget')
    : plan.quiet ? t(lang, 'stQuiet')
    : t(lang, 'stRunning');
  var intervalText = (isFinite(plan.eff.interval) ? plan.eff.interval + ' 分鐘 min' : '—') + (plan.eff.throttled ? '（' + t(lang, 'stThrottled') + '）' : '');
  var runtimeText = (plan.usedMs / 60000).toFixed(1) + ' / ' + settings.daily_runtime_budget_minutes + ' 分鐘 min';
  var quota = '';
  try { quota = MailApp.getRemainingDailyQuota(); } catch (e) { quota = '?'; }

  var enabled = {
    ptt: settings.ptt_enabled,
    opentix: settings.opentix_enabled
  };
  var sources = TH_SOURCE_INFO.map(function (info) {
    var h = health[info.id] || {};
    var implemented = info.id === 'ptt' || info.id === 'opentix';
    var state = !implemented ? '—'
      : !enabled[info.id] ? t(lang, 'stDisabled')
      : !h.lastRun ? t(lang, 'stNever')
      : h.fails ? t(lang, 'stFail')
      : t(lang, 'stOk');
    return { label: info.label, where: info.where, state: state, lastRun: h.lastRun, lastOk: h.lastOk, fails: h.fails, message: h.lastError, needs: info.needs };
  });
  writeStatus_(ss, { lang: lang, now: now, monitoringText: monitoringText, intervalText: intervalText, runtimeText: runtimeText, emailQuota: quota, sources: sources });
  storeSet(TH_KEYS.statusWrittenAt, Date.now());
}

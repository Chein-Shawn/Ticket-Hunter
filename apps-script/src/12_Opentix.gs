/**
 * Ticket hunter — OPENTIX (pure functions).
 * 活動頁 https://www.opentix.life/event/<id> 的 __NUXT__ 內含每個場次與票區的 remainingQuantity。
 */

function isOpentixEventUrl(url) {
  return /^https?:\/\/(www\.)?opentix\.life\/event\/\d+/.test(String(url || '').trim());
}

/**
 * state（parseNuxtStateFromHtml 的結果）→
 * { title, sessions: [{sessionId, venue, startMs, remaining, zones: [{zoneId, name, price, remaining}]}] }
 */
function extractOpentixSessions(state) {
  var sessions = [];
  var title = '';
  var seenSession = {};

  function walk(o, depth) {
    if (!o || typeof o !== 'object' || depth > 40) return;
    if (!title && o.program && typeof o.program.name === 'string') title = o.program.name;
    if (o.venue && Array.isArray(o.events)) {
      var venueName = (o.venue && o.venue.name) || '';
      o.events.forEach(function (ev) {
        if (!ev || ev.id == null || seenSession[ev.id]) return;
        seenSession[ev.id] = true;
        var zones = [];
        var gs = ev.groupSections || {};
        Object.keys(gs).forEach(function (k) {
          (Array.isArray(gs[k]) ? gs[k] : []).forEach(function (sec) {
            if (!sec || sec.id == null) return;
            zones.push({
              zoneId: String(sec.id),
              name: String(sec.name == null ? '' : sec.name),
              price: typeof sec.price === 'number' ? sec.price : toNumber(sec.price, null),
              remaining: sec.quantity && typeof sec.quantity.remainingQuantity === 'number' ? sec.quantity.remainingQuantity : null,
              unlimited: !!(sec.quantity && sec.quantity.unlimited)
            });
          });
        });
        sessions.push({
          sessionId: String(ev.id),
          venue: venueName,
          startMs: typeof ev.startDateTime === 'number' ? ev.startDateTime * 1000 : null,
          remaining: ev.quantity && typeof ev.quantity.remainingQuantity === 'number' ? ev.quantity.remainingQuantity : null,
          zones: zones
        });
      });
      return;
    }
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], depth + 1); return; }
    for (var key in o) if (Object.prototype.hasOwnProperty.call(o, key)) walk(o[key], depth + 1);
  }

  walk(state, 0);
  sessions.sort(function (a, b) { return (a.startMs || 0) - (b.startMs || 0); });
  return { title: title, sessions: sessions };
}

function opentixSessionLabel(s) {
  return (s.startMs ? formatTaipei(new Date(s.startMs)) : '') + (s.venue ? ' ' + s.venue : '');
}

/** 輪椅席與輪椅陪同席預設不勾選（只有自備輪椅者可購買）。 */
function defaultZoneMonitored(zoneName) {
  return !/輪椅|wheelchair/i.test(String(zoneName || ''));
}

/**
 * 比對勾選的票區：剩餘張數 > 0 且（第一次看到或比上次多）就通知。
 * zoneRows: parseZoneRow 結果；prev: { "sessionId:zoneId": n }
 * 回傳 { hits: [...], current: {...} }（current 包含所有看到的票區，供下次比較）。
 */
function evaluateOpentixZones(parsed, zoneRows, prev, targetName) {
  prev = prev || {};
  var current = {};
  var hits = [];
  var monitored = {};
  (zoneRows || []).forEach(function (z) {
    if (z.monitor && z.zoneId && (!targetName || z.target === targetName)) monitored[z.sessionId + ':' + z.zoneId] = z;
  });
  parsed.sessions.forEach(function (s) {
    s.zones.forEach(function (z) {
      var key = s.sessionId + ':' + z.zoneId;
      if (z.remaining == null) return;
      current[key] = z.remaining;
      if (!monitored[key]) return;
      var before = prev[key];
      if (z.remaining > 0 && (before == null || z.remaining > before)) {
        hits.push({
          source: 'opentix',
          target: targetName || monitored[key].target,
          title: parsed.title,
          session: opentixSessionLabel(s),
          zone: z.name,
          price: z.price,
          remaining: z.remaining,
          previous: before == null ? null : before,
          key: key
        });
      }
    });
  });
  return { hits: hits, current: current };
}

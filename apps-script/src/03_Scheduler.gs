/**
 * Ticket hunter — quiet hours, due checks, quota guard, source health (pure functions).
 */

/** "01:00-07:00, 23:30-00:30" → [{start: 60, end: 420}, {start: 1410, end: 30}] (minutes of day). */
function parseQuietHours(s) {
  var out = [];
  parseList(s).forEach(function (part) {
    var m = toHalfWidth(part).match(/^(\d{1,2})(?::(\d{2}))?\s*[-~到至]\s*(\d{1,2})(?::(\d{2}))?$/);
    if (!m) return;
    var a = (+m[1]) * 60 + (+(m[2] || 0));
    var b = (+m[3]) * 60 + (+(m[4] || 0));
    if (a > 1440 || b > 1440 || a === b) return;
    out.push({ start: a % 1440, end: b % 1440 });
  });
  return out;
}

function isMinuteQuiet(minute, ranges) {
  for (var i = 0; i < ranges.length; i++) {
    var r = ranges[i];
    if (r.start < r.end ? (minute >= r.start && minute < r.end) : (minute >= r.start || minute < r.end)) return true;
  }
  return false;
}

function isQuiet(date, ranges) {
  return isMinuteQuiet(taipeiMinuteOfDay(date), ranges || []);
}

/** 從現在到今天 24:00（臺北）之間：總分鐘數、非靜音分鐘數。 */
function minutesLeftToday(date, ranges) {
  var now = taipeiMinuteOfDay(date);
  var total = 1440 - now;
  var active = 0;
  for (var m = now; m < 1440; m++) if (!isMinuteQuiet(m, ranges || [])) active++;
  return { total: total, active: active };
}

function isDue(lastRunMs, nowMs, intervalMinutes) {
  if (!lastRunMs) return true;
  // 留 15 秒寬限，避免觸發器時間抖動讓每分鐘檢查變成每兩分鐘。
  return nowMs - lastRunMs >= intervalMinutes * 60000 - 15000;
}

/**
 * 配額保護。Apps Script 每分鐘都會觸發一次（idle 也會耗時），
 * 只有「到期」時才真正抓資料（active，額外耗時）。
 *   需求 = 剩餘總分鐘 × idleMs + (剩餘非靜音分鐘 / 間隔) × (activeMs − idleMs) ≤ 剩餘預算
 * o: { configured, budgetMs, usedMs, idleMs, activeMs, minutesTotalLeft, minutesActiveLeft }
 */
function computeEffectiveInterval(o) {
  var configured = Math.max(1, o.configured || 1);
  if (!o.budgetMs) return { interval: configured, paused: false, throttled: false };
  var left = o.budgetMs - (o.usedMs || 0);
  if (left <= 0) return { interval: Infinity, paused: true, throttled: false };
  var idle = o.idleMs != null ? o.idleMs : 300;
  var active = o.activeMs != null ? o.activeMs : 2500;
  var extra = Math.max(0, active - idle);
  var forActive = left - (o.minutesTotalLeft || 0) * idle;
  if (forActive <= 0) return { interval: Infinity, paused: true, throttled: false };
  if (!o.minutesActiveLeft || !extra) return { interval: configured, paused: false, throttled: false };
  var need = Math.ceil(o.minutesActiveLeft * extra / forActive);
  var interval = Math.max(configured, need);
  return { interval: interval, paused: false, throttled: interval > configured };
}

/** 依當日用量更新統計。usage: {day, usedMs, runs, idleMs, idleRuns, activeMs, activeRuns} */
function addUsage(usage, dayKey, elapsedMs, wasActive) {
  var u = (usage && usage.day === dayKey) ? usage : { day: dayKey, usedMs: 0, runs: 0, idleMs: 0, idleRuns: 0, activeMs: 0, activeRuns: 0 };
  u.usedMs += elapsedMs;
  u.runs += 1;
  if (wasActive) { u.activeMs += elapsedMs; u.activeRuns += 1; } else { u.idleMs += elapsedMs; u.idleRuns += 1; }
  return u;
}

function usageAverages(usage, dayKey) {
  var u = (usage && usage.day === dayKey) ? usage : null;
  return {
    usedMs: u ? u.usedMs : 0,
    idleMs: u && u.idleRuns ? u.idleMs / u.idleRuns : null,
    activeMs: u && u.activeRuns ? u.activeMs / u.activeRuns : null
  };
}

/**
 * 來源健康狀態。回傳 event：'down'（剛達到門檻）、'recovered'（警告過後恢復）或 null。
 * h: {fails, alerted, lastOk, lastRun, lastError}
 */
function recordHealth(h, ok, threshold, message, nowMs) {
  h = h || { fails: 0, alerted: false };
  var event = null;
  h.lastRun = nowMs;
  if (ok) {
    if (h.alerted) event = 'recovered';
    h.fails = 0;
    h.alerted = false;
    h.lastOk = nowMs;
    h.lastError = '';
  } else {
    h.fails = (h.fails || 0) + 1;
    h.lastError = String(message || '');
    if (h.fails >= threshold && !h.alerted) {
      h.alerted = true;
      event = 'down';
    }
  }
  return { health: h, event: event };
}

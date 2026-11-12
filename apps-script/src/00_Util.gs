/**
 * Ticket hunter — shared helpers (pure functions, no Google services).
 * 共用工具（純函式，不呼叫 Google 服務，可離線測試）。
 */

var TH_TZ_OFFSET_MS = 8 * 3600 * 1000; // Asia/Taipei, no DST
var TH_VERSION = '0.1.0';

/** 全形 ASCII → 半形；全形空白 → 半形空白。 */
function toHalfWidth(s) {
  return String(s == null ? '' : s).replace(/[！-～]/g, function (c) {
    return String.fromCharCode(c.charCodeAt(0) - 0xFEE0);
  }).replace(/　/g, ' ');
}

/**
 * 比對用的正規化：半形、小寫，只留英數、拉丁字母、假名、漢字、韓文。
 * "F✦FOREVER"、"F.FOREVER"、"Ｆ ＦＯＲＥＶＥＲ" 都會變成 "fforever"。
 */
function normalizeForMatch(s) {
  return toHalfWidth(s).toLowerCase()
    .replace(/[^a-z0-9À-ɏ぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]+/g, '');
}

/** "a, b，c、d\n e" → ["a","b","c","d","e"]（去空白、去重複、去空字串）。 */
function parseList(s) {
  var seen = {};
  return String(s == null ? '' : s).split(/[,，、;；\n]+/).map(function (x) { return x.trim(); })
    .filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = true;
      return true;
    });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function decodeHtmlEntities(s) {
  return String(s == null ? '' : s)
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripTags(html) {
  return String(html == null ? '' : html).replace(/<[^>]*>/g, '');
}

/** 臺北時間的各欄位（不依賴執行環境時區）。 */
function taipeiParts(date) {
  var d = new Date(date.getTime() + TH_TZ_OFFSET_MS);
  return {
    y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(),
    h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), dow: d.getUTCDay()
  };
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

/** "2026-11-12" */
function taipeiDayKey(date) {
  var p = taipeiParts(date);
  return p.y + '-' + pad2(p.mo) + '-' + pad2(p.d);
}

/** "2026/11/12 21:05" */
function formatTaipei(date) {
  if (!date) return '';
  var p = taipeiParts(date instanceof Date ? date : new Date(date));
  return p.y + '/' + pad2(p.mo) + '/' + pad2(p.d) + ' ' + pad2(p.h) + ':' + pad2(p.mi);
}

/** 今天（臺北）已過的分鐘數 0–1439。 */
function taipeiMinuteOfDay(date) {
  var p = taipeiParts(date);
  return p.h * 60 + p.mi;
}

function truncate(s, n) {
  s = String(s == null ? '' : s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function toBool(v, dflt) {
  if (v === true || v === false) return v;
  if (v == null || v === '') return dflt;
  var s = String(v).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'on', '是', '開', '開啟'].indexOf(s) >= 0) return true;
  if (['false', 'no', 'n', '0', 'off', '否', '關', '關閉'].indexOf(s) >= 0) return false;
  return dflt;
}

function toNumber(v, dflt) {
  if (typeof v === 'number' && isFinite(v)) return v;
  var n = parseFloat(String(v == null ? '' : v).replace(/,/g, ''));
  return isFinite(n) ? n : dflt;
}

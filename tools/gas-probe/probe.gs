/**
 * Ticket hunter — Google Apps Script 來源探測（一次性工具）
 * Ticket hunter — one-off source probe for Google Apps Script
 *
 * 用途：從 Google 主機實際抓取各候選來源，確認哪些可以走雲端監測。
 * Purpose: fetch each candidate source from Google's servers to see which can be monitored in the cloud.
 *
 * 使用方式 / How to run
 *   1. 開 https://script.google.com → 新專案 / New project。
 *   2. 刪掉預設內容，整份貼上本檔。Paste this whole file.
 *   3. 上方函式選單選 probeSources → 執行 / Run。
 *      第一次會要求授權「連線到外部服務」。Authorize "Connect to an external service".
 *   4. 執行完，在「執行記錄 / Execution log」最下方找 ===== COPY FROM HERE =====，
 *      把那一段整段複製貼回給 Claude。Copy the block after ===== COPY FROM HERE =====.
 *
 * 本腳本只會讀取公開網頁（GET），共約 15 次請求，每次間隔 0.5 秒；不登入、不送出表單、不寄信、
 * 不讀 Gmail，也不執行任何從網站抓下來的程式碼。
 * GET requests to public pages only (~15, 0.5 s apart). No login, no form posts, no email, no Gmail access,
 * and no execution of any code downloaded from the sites.
 */

var PROBE_DELAY_MS = 500;
var SNIPPET_CHARS = 160;

var PROBE_TARGETS = [
  // ---- PTT ----
  { id: 'ptt_atom', url: 'https://www.ptt.cc/atom/Drama-Ticket.xml', expect: /<entry>/ },
  { id: 'ptt_index', url: 'https://www.ptt.cc/bbs/Drama-Ticket/index.html', expect: /class="r-ent"/ },
  // ptt_article 的網址由 ptt_atom 的第一篇決定（見 probeSources）。
  // ---- 官方售票 / Official ticketing ----
  { id: 'opentix_event', url: 'https://www.opentix.life/event/2108010089152028673', expect: /window\.__NUXT__/ },
  { id: 'era_home', url: 'https://ticket.com.tw/', expect: /年代/ },
  { id: 'kham_home', url: 'https://kham.com.tw/', expect: /寬宏/ },
  { id: 'ibon_home', url: 'https://ticket.ibon.com.tw/', expect: /ibon/i },
  { id: 'ticketplus_home', url: 'https://ticketplus.com.tw/', expect: /Ticket\s*Plus|遠大/i },
  { id: 'kktix_events', url: 'https://kktix.com/events', expect: /KKTIX/i },
  { id: 'tixcraft_list', url: 'https://tixcraft.com/activity', expect: /26_forever/ },
  { id: 'tixcraft_game', url: 'https://tixcraft.com/activity/game/26_forever', expect: /gameList|場次/ },
  // ---- 論壇 / 拍賣 / Forums & marketplaces ----
  { id: 'dcard_forum_api', url: 'https://www.dcard.tw/service/api/v2/forums/tickets/posts?limit=30', expect: /^\s*\[/ },
  { id: 'dcard_search_api', url: 'https://www.dcard.tw/service/api/v2/search/posts?query=' + encodeURIComponent('恆星之城') + '&limit=10', expect: /^\s*\[/ },
  { id: 'carousell_search', url: 'https://tw.carousell.com/search/' + encodeURIComponent('恆星之城') + '/', expect: /NT\$/ },
  { id: 'threads_search', url: 'https://www.threads.com/search?q=' + encodeURIComponent('恆星之城'), expect: /恆星之城/ }
];

function probeSources() {
  var startedAt = new Date();
  var results = [];

  PROBE_TARGETS.forEach(function (t) {
    results.push(probeOne_(t));
    Utilities.sleep(PROBE_DELAY_MS);
  });

  // PTT 文章頁：取 feed 第一篇的連結。PTT article: first link in the Atom feed.
  var atom = results.filter(function (r) { return r.id === 'ptt_atom'; })[0];
  var articleUrl = atom && atom._body ? firstAtomLink_(atom._body) : null;
  if (articleUrl) {
    results.push(probeOne_({ id: 'ptt_article', url: articleUrl, expect: /id="main-content"/ }));
  } else {
    results.push({ id: 'ptt_article', url: null, ok: false, note: 'no article link (atom failed)' });
  }

  // 額外解析檢查（純文字比對，不執行網站程式碼）。Extra parsing checks (text matching only).
  results.forEach(function (r) {
    if (!r._body) return;
    if (r.id === 'ptt_atom') r.extra = { entries: (r._body.match(/<entry>/g) || []).length };
    if (r.id === 'opentix_event') r.extra = opentixSummary_(r._body);
    if (r.id === 'dcard_forum_api' || r.id === 'dcard_search_api') r.extra = dcardSummary_(r._body);
  });

  var totalMs = new Date() - startedAt;
  var report = {
    probe: 'ticket-hunter-gas-probe/1',
    ranAt: startedAt.toISOString(),
    totalMs: totalMs,
    results: results.map(function (r) {
      var copy = {};
      Object.keys(r).forEach(function (k) { if (k.charAt(0) !== '_') copy[k] = r[k]; });
      return copy;
    })
  };

  // 人看的摘要 / Human-readable summary
  console.log('id | ok | http | ms | KB | marker | blocked | server');
  report.results.forEach(function (r) {
    console.log([r.id, r.ok, r.status, r.ms, r.kb, r.markerFound, r.blockedHint || '-', r.server || '-'].join(' | '));
  });
  console.log('total ms: ' + totalMs);

  console.log('===== COPY FROM HERE =====\n' + JSON.stringify(report) + '\n===== COPY UNTIL HERE =====');
  return report;
}

function probeOne_(t) {
  var t0 = new Date();
  var out = { id: t.id, url: t.url };
  try {
    var res = UrlFetchApp.fetch(t.url, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true
    });
    var body = res.getContentText('UTF-8');
    var headers = res.getAllHeaders();
    out.status = res.getResponseCode();
    out.ms = new Date() - t0;
    out.kb = Math.round(body.length / 102.4) / 10;
    out.server = headerOf_(headers, 'server');
    out.cfRay = headerOf_(headers, 'cf-ray') ? true : false;
    out.markerFound = t.expect.test(body);
    out.blockedHint = blockedHint_(out.status, body);
    out.ok = out.status === 200 && out.markerFound && !out.blockedHint;
    if (!out.ok) out.snippet = body.replace(/\s+/g, ' ').slice(0, SNIPPET_CHARS);
    out._body = body;
  } catch (e) {
    out.ms = new Date() - t0;
    out.ok = false;
    out.error = String(e && e.message ? e.message : e).slice(0, 300);
  }
  return out;
}

function headerOf_(headers, name) {
  var lower = name.toLowerCase();
  for (var k in headers) {
    if (k.toLowerCase() === lower) {
      var v = headers[k];
      return Array.isArray(v) ? v.join(', ') : String(v);
    }
  }
  return null;
}

function blockedHint_(status, body) {
  if (/Just a moment\.\.\.|cf-chl-|Attention Required! \| Cloudflare/i.test(body)) return 'cloudflare-challenge';
  if (/captcha/i.test(body) && status !== 200) return 'captcha';
  if (status === 403) return 'http-403';
  if (status === 401) return 'http-401';
  if (status === 429) return 'rate-limited';
  if (status >= 500) return 'http-' + status;
  return null;
}

function firstAtomLink_(xml) {
  var m = xml.match(/<entry>[\s\S]*?<link[^>]*href="([^"]+)"/);
  return m ? m[1] : null;
}

function opentixSummary_(html) {
  var i = html.indexOf('window.__NUXT__');
  var nuxt = i >= 0 ? html.slice(i) : '';
  return {
    nuxtFound: i >= 0,
    remainingQuantityFields: (nuxt.match(/remainingQuantity:/g) || []).length,
    numericRemaining: (nuxt.match(/remainingQuantity:\d+/g) || []).slice(0, 10),
    eventIds: unique_((nuxt.match(/events:\[\{id:"(\d+)"/g) || []).map(function (s) { return s.replace(/\D/g, ''); }))
  };
}

function dcardSummary_(text) {
  try {
    var arr = JSON.parse(text);
    if (!Array.isArray(arr)) return { parsed: true, isArray: false };
    return {
      parsed: true,
      count: arr.length,
      newest: arr[0] && arr[0].createdAt,
      oldest: arr.length ? arr[arr.length - 1].createdAt : null
    };
  } catch (e) {
    return { parsed: false };
  }
}

function unique_(a) {
  var seen = {};
  return a.filter(function (x) { if (seen[x]) return false; seen[x] = true; return true; });
}

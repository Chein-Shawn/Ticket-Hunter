/*
 * End-to-end cycle with fake Google services (Sheets, UrlFetch, Properties, Mail, Lock, Script, Session).
 * 用假的 Google 服務把「初始化 → 載入票區 → 檢查 → 通知 → 失敗警告」整個跑一遍。
 */

function FakeRange(sheet, r, c, nr, nc) { this.s = sheet; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
FakeRange.prototype.getValues = function () {
  var out = [];
  for (var i = 0; i < this.nr; i++) {
    var row = [];
    for (var j = 0; j < this.nc; j++) {
      var v = (this.s.cells[this.r + i - 1] || [])[this.c + j - 1];
      row.push(v === undefined ? '' : v);
    }
    out.push(row);
  }
  return out;
};
FakeRange.prototype.setValues = function (vals) {
  if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error('setValues size mismatch ' + vals.length + 'x' + vals[0].length + ' vs ' + this.nr + 'x' + this.nc);
  for (var i = 0; i < this.nr; i++) {
    this.s.cells[this.r + i - 1] = this.s.cells[this.r + i - 1] || [];
    for (var j = 0; j < this.nc; j++) this.s.cells[this.r + i - 1][this.c + j - 1] = vals[i][j];
  }
  return this;
};
FakeRange.prototype.setValue = function (v) { return this.setValues([[v]]); };
FakeRange.prototype.clearContent = function () {
  for (var i = 0; i < this.nr; i++) for (var j = 0; j < this.nc; j++) {
    if (this.s.cells[this.r + i - 1]) this.s.cells[this.r + i - 1][this.c + j - 1] = '';
  }
  return this;
};
['setFontWeight', 'setBackground', 'setFontSize', 'setWrap', 'setFontColor', 'insertCheckboxes', 'setNumberFormat'].forEach(function (m) {
  FakeRange.prototype[m] = function () { return this; };
});

function FakeSheet(name) { this.name = name; this.cells = []; }
FakeSheet.prototype.getName = function () { return this.name; };
FakeSheet.prototype.getRange = function (r, c, nr, nc) { return new FakeRange(this, r, c, nr, nc); };
FakeSheet.prototype.getLastRow = function () {
  for (var i = this.cells.length - 1; i >= 0; i--) {
    var row = this.cells[i] || [];
    if (row.some(function (v) { return v !== '' && v !== undefined && v !== null; })) return i + 1;
  }
  return 0;
};
FakeSheet.prototype.setFrozenRows = function () {};
FakeSheet.prototype.setColumnWidth = function () {};
FakeSheet.prototype.clearContents = function () { this.cells = []; };
FakeSheet.prototype.deleteRows = function (start, n) { this.cells.splice(start - 1, n); };

var FAKE = {};

function fakeReset(responses) {
  FAKE = { sheets: [], props: {}, mails: [], triggers: [], responses: responses, fetches: [] };
}

function fakeResponse(url) {
  FAKE.fetches.push(url);
  var r = FAKE.responses(url);
  return { getResponseCode: function () { return r.code; }, getContentText: function () { return r.body; } };
}

var SpreadsheetApp = {
  getActiveSpreadsheet: function () {
    return {
      getSheetByName: function (n) { return FAKE.sheets.filter(function (s) { return s.name === n; })[0] || null; },
      insertSheet: function (n, idx) { var s = new FakeSheet(n); FAKE.sheets.splice(idx, 0, s); return s; },
      getSheets: function () { return FAKE.sheets.slice(); },
      deleteSheet: function (s) { FAKE.sheets.splice(FAKE.sheets.indexOf(s), 1); },
      toast: function () {}
    };
  },
  getUi: function () { return { alert: function () {} }; }
};
var UrlFetchApp = {
  fetch: function (url) { return fakeResponse(url); },
  fetchAll: function (reqs) { return reqs.map(function (r) { return fakeResponse(r.url); }); }
};
var PropertiesService = {
  getScriptProperties: function () {
    return {
      getProperty: function (k) { return FAKE.props.hasOwnProperty(k) ? FAKE.props[k] : null; },
      setProperty: function (k, v) { FAKE.props[k] = String(v); },
      setProperties: function (o) { Object.keys(o).forEach(function (k) { FAKE.props[k] = String(o[k]); }); },
      deleteProperty: function (k) { delete FAKE.props[k]; }
    };
  }
};
var MailApp = {
  sendEmail: function (o) { FAKE.mails.push(o); },
  getRemainingDailyQuota: function () { return 100 - FAKE.mails.length; }
};
var LockService = { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } };
var ScriptApp = {
  getProjectTriggers: function () { return FAKE.triggers.map(function (h) { return { getHandlerFunction: function () { return h; } }; }); },
  deleteTrigger: function () { FAKE.triggers = []; },
  newTrigger: function (h) {
    var b = { timeBased: function () { return b; }, everyMinutes: function () { return b; }, create: function () { FAKE.triggers.push(h); } };
    return b;
  }
};
var Session = { getEffectiveUser: function () { return { getEmail: function () { return 'me@example.com'; } }; } };

/** 在 Atom 最前面插入一篇剛發的 F.FOREVER 售票文（published = now）。 */
function atomWithFreshPost(nowMs) {
  var atom = readFixture('ptt_atom_20261112.xml');
  var iso = new Date(nowMs - 60000).toISOString();
  var entry = '<entry><title>[售票] 11/29 F FOREVER 恆星之城 降售</title><id>https://www.ptt.cc/bbs/Drama-Ticket/M.1799999999.A.ABC.html</id>' +
    '<link rel="alternate" href="https://www.ptt.cc/bbs/Drama-Ticket/M.1799999999.A.ABC.html" type="text/html"></link>' +
    '<published>' + iso + '</published><updated>' + iso + '</updated><author><name>sellerx</name></author>' +
    '<content type="html">&lt;pre&gt;節目：F FOREVER 恆星之城&#xA;&lt;/pre&gt;</content></entry>';
  return atom.replace('<entry>', entry + '<entry>');
}

var FRESH_ARTICLE = '<div id="main-content"><div class="article-metaline"><span>作者</span></div>節目：F FOREVER 恆星之城\n時間：11 月 29 日\n原價：1680\n售價：1300\n張數：1\n--\n※ 發信站: 批踢踢實業坊</div>';

function setTargets_(rows) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TH_SHEETS.targets.name);
  sh.getRange(2, 1, rows.length, 8).setValues(rows);
}

function logRows_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TH_SHEETS.log.name).cells.slice(1);
}

test('integration: setup, load zones, PTT + OPENTIX hits, dedupe, status', function () {
  var now = Date.now();
  var atom = atomWithFreshPost(now);
  var opentix = readFixture('opentix_chloe_20261112.html');
  fakeReset(function (url) {
    if (url === PTT_ATOM_URL) return { code: 200, body: atom };
    if (url.indexOf('M.1799999999.A.ABC') >= 0) return { code: 200, body: FRESH_ARTICLE };
    if (url.indexOf('opentix.life') >= 0) return { code: 200, body: opentix };
    return { code: 404, body: '' };
  });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  assertEq(ensureSheets_(ss), true);
  assertEq(FAKE.sheets.map(function (s) { return s.name; }), ['狀態 Status', '監測目標 Targets', '票區 Zones', '規則 Rules', '設定 Settings', '記錄 Log']);
  assertEq(readSettings_(ss).failure_alert_threshold, 2);
  assertEq(readTargets_(ss).filter(function (x) { return x.enabled; }).length, 0, 'examples start disabled');

  setTargets_([
    [true, 'F.FOREVER 恆星之城', '恆星之城, F.FOREVER', '', '11/28, 11/29', '', '', ''],
    [true, '蔡珂宜 Chloe Chua', '蔡珂宜, Chloe Chua', '', '1/2, 1/3', 'https://www.opentix.life/event/2108010089152028673', '', '']
  ]);
  menuStart();
  assertEq(FAKE.triggers, ['tick']);

  var r = runCycle_({ force: true });
  assertEq(r.hits, 1, 'only the fresh F.FOREVER post; wheelchair zones are unticked');
  assertEq(FAKE.mails.length, 1);
  assertTrue(FAKE.mails[0].subject.indexOf('恆星之城') >= 0, FAKE.mails[0].subject);
  assertEq(FAKE.mails[0].to, 'me@example.com');

  var zones = readZones_(ss);
  assertEq(zones.length, 14, 'Kaohsiung 5 + Taipei 9 zones');
  assertEq(zones.filter(function (z) { return z.monitor; }).length, 11, 'three wheelchair zones unticked');
  assertEq(readTargets_(ss)[1].maxFace, 3600, 'max face filled from zones');

  // 第二輪：同一篇不重複通知
  var r2 = runCycle_({ force: true });
  assertEq(r2.hits, 0);
  assertEq(FAKE.mails.length, 1);

  // 勾選臺北輪椅席：張數沒變（上次已看過 11 張）→ 不通知
  var zsh = ss.getSheetByName(TH_SHEETS.zones.name);
  zsh.cells.forEach(function (row, i) { if (i > 0 && row[3] === '輪椅席' && String(row[2]).indexOf('國家音樂廳') >= 0) row[0] = true; });
  var r3 = runCycle_({ force: true });
  assertEq(r3.hits, 0, 'count unchanged since last check');
  // 上次張數較少（模擬有人退票）→ 通知
  var remain = storeGet(TH_KEYS.opentixRemain, {});
  var wheelKey = zones.filter(function (z) { return z.zone === '輪椅席' && z.session.indexOf('國家音樂廳') >= 0; }).map(function (z) { return z.sessionId + ':' + z.zoneId; })[0];
  remain[wheelKey] = 10;
  storeSet(TH_KEYS.opentixRemain, remain);
  var r4 = runCycle_({ force: true });
  assertEq(r4.hits, 1, 'increase 10 → 11 on a ticked zone');
  assertTrue(FAKE.mails[1].body.indexOf('剩餘 11（原本 10）') >= 0, FAKE.mails[1].body);

  var status = ss.getSheetByName(TH_SHEETS.status.name).cells;
  assertEq(status[1][1], '監測中');
  assertEq(status[8][0], 'PTT Drama-Ticket');
  assertEq(status[8][2], '正常');
  assertTrue(logRows_().some(function (row) { return row[2] === '通知'; }), 'hit logged');
});

test('integration: failure alert after 2 consecutive failures, then recovery', function () {
  var down = true;
  fakeReset(function (url) {
    if (url === PTT_ATOM_URL) return down ? { code: 403, body: 'blocked' } : { code: 200, body: readFixture('ptt_atom_20261112.xml') };
    return { code: 404, body: '' };
  });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets_(ss);
  setTargets_([[true, 'F', '恆星之城', '', '', '', '', '']]);
  runCycle_({ force: true });
  assertEq(FAKE.mails.length, 0, 'first failure: no alert yet');
  runCycle_({ force: true });
  assertEq(FAKE.mails.length, 1);
  assertTrue(FAKE.mails[0].subject.indexOf('連續 2 次') >= 0, FAKE.mails[0].subject);
  runCycle_({ force: true });
  assertEq(FAKE.mails.length, 1, 'no repeated alert');
  down = false;
  runCycle_({ force: true });
  assertEq(FAKE.mails.length, 2);
  assertTrue(FAKE.mails[1].subject.indexOf('已恢復') >= 0, FAKE.mails[1].subject);
});

test('integration: quiet hours skip fetching unless forced', function () {
  fakeReset(function () { return { code: 200, body: readFixture('ptt_atom_20261112.xml') }; });
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheets_(ss);
  setTargets_([[true, 'F', '恆星之城', '', '', '', '', '']]);
  var st = ss.getSheetByName(TH_SHEETS.settings.name);
  st.cells.forEach(function (row) { if (row[0] === 'quiet_hours') row[1] = '00:00-23:59'; });
  var r = runCycle_({});
  assertEq(r.ran, false);
  assertEq(FAKE.fetches.length, 0);
});

test('integration: tick records usage and large state is chunked', function () {
  fakeReset(function () { return { code: 200, body: readFixture('ptt_atom_20261112.xml') }; });
  ensureSheets_(SpreadsheetApp.getActiveSpreadsheet());
  tick();
  var u = storeGet(TH_KEYS.usage, null);
  assertEq(u.runs, 1);
  assertTrue(u.usedMs >= TH_INVOCATION_OVERHEAD_MS);
  var big = [];
  for (var i = 0; i < 2000; i++) big.push('M.17944' + i + '.A.ABC');
  storeSet('bigtest', big);
  assertTrue(FAKE.props['bigtest#n'] > 1, 'chunked');
  assertEq(storeGet('bigtest', null).length, 2000);
  storeSet('bigtest', ['small']);
  assertEq(FAKE.props['bigtest#n'], undefined);
  assertEq(storeGet('bigtest', null), ['small']);
});

/**
 * Ticket hunter — Google Sheet layout, reading and writing.
 * 工作表名稱與欄位標題固定雙語（中文 English），程式以名稱找工作表。
 */

var TH_SHEETS = {
  status: { name: '狀態 Status' },
  targets: {
    name: '監測目標 Targets',
    headers: ['啟用 Enabled', '活動名稱 Name', '關鍵字 Keywords', '排除字 Exclude', '場次日期 Dates (m/d)', '官方網址 Official URL (OPENTIX)', '最高原價 Max face (auto)', '備註 Notes'],
    checkboxCols: [1],
    widths: [80, 200, 260, 160, 140, 300, 120, 200]
  },
  zones: {
    name: '票區 Zones',
    headers: ['監測 Monitor', '活動名稱 Target', '場次 Session', '票區 Zone', '原價 Price', '剩餘 Remaining', '更新時間 Updated', '來源 Source', '場次ID Session ID', '票區ID Zone ID'],
    checkboxCols: [1],
    widths: [80, 180, 200, 200, 80, 100, 140, 80, 170, 170]
  },
  rules: {
    name: '規則 Rules',
    headers: ['啟用 Enabled', '套用活動 Target (blank = all)', '同時出現就不通知 Skip if ALL appear', '說明 Note'],
    checkboxCols: [1],
    widths: [80, 200, 300, 300]
  },
  settings: {
    name: '設定 Settings',
    headers: ['key', '值 Value', '說明 Description'],
    widths: [230, 220, 560]
  },
  log: {
    name: '記錄 Log',
    headers: ['時間 Time', '來源 Source', '類型 Type', '活動 Target', '內容 Message', '連結 Link'],
    widths: [140, 90, 80, 160, 520, 300]
  }
};

var TH_LOG_MAX_ROWS = 3000;

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Ticket hunter must be bound to a Google Sheet.');
  return ss;
}

/** 建立缺少的工作表；新建時放入範例。回傳是否有新建。 */
function ensureSheets_(ss) {
  var created = false;
  ['status', 'targets', 'zones', 'rules', 'settings', 'log'].forEach(function (k, idx) {
    var def = TH_SHEETS[k];
    var sh = ss.getSheetByName(def.name);
    if (sh) return;
    created = true;
    sh = ss.insertSheet(def.name, Math.min(idx, ss.getSheets().length));
    if (def.headers) {
      sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]).setFontWeight('bold').setBackground('#f1f3f4');
      sh.setFrozenRows(1);
    }
    (def.widths || []).forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    (def.checkboxCols || []).forEach(function (c) { sh.getRange(2, c, 300, 1).insertCheckboxes(); });
    seedSheet_(k, sh);
  });
  // 升級時補上新設定項目
  var st = ss.getSheetByName(TH_SHEETS.settings.name);
  var have = {};
  if (st.getLastRow() >= 2) st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().forEach(function (r) { have[String(r[0]).trim()] = true; });
  var missing = defaultSettingsRows('zh-TW').filter(function (r) { return !have[r[0]]; });
  if (missing.length) st.getRange(st.getLastRow() + 1, 1, missing.length, 3).setValues(missing);
  // 移除新試算表預設的空白「工作表1 / Sheet1」
  ['工作表1', 'Sheet1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1 && s.getLastRow() === 0) ss.deleteSheet(s);
  });
  return created;
}

function seedSheet_(kind, sh) {
  if (kind === 'targets') {
    sh.getRange(2, 1, 2, 8).setValues([
      [false, 'F.FOREVER 恆星之城', '恆星之城, F.FOREVER, F FOREVER, 光年赴約', '', '11/28, 11/29', '', '', '範例：拓元售票，官方監測待第一階段後半 / Example'],
      [false, '蔡珂宜 Chloe Chua', '蔡珂宜, Chloe Chua, 珂宜', '', '1/2, 1/3', 'https://www.opentix.life/event/2108010089152028673', '', '範例：OPENTIX / Example']
    ]);
  } else if (kind === 'rules') {
    sh.getRange(2, 1, 1, 4).setValues([[false, '', '青年, 視線遮蔽', '範例：青年席位且視線遮蔽的票不要通知 / Example rule']]);
  } else if (kind === 'settings') {
    var rows = defaultSettingsRows('zh-TW');
    TH_SETTINGS_SCHEMA.forEach(function (f, i) { if (f.type === 'bool') sh.getRange(2 + i, 2).insertCheckboxes(); });
    sh.getRange(2, 1, rows.length, 3).setValues(rows);
    sh.getRange(2, 3, rows.length, 1).setWrap(true).setFontColor('#555555');
  }
}

function readRows_(ss, kind) {
  var sh = ss.getSheetByName(TH_SHEETS[kind].name);
  if (!sh || sh.getLastRow() < 2) return [];
  var width = TH_SHEETS[kind].headers.length;
  return sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
}

function readSettings_(ss) {
  return parseSettings(readRows_(ss, 'settings'));
}

function readTargets_(ss) {
  return readRows_(ss, 'targets').map(parseTargetRow).filter(function (x) { return x.name; });
}

function readRules_(ss) {
  return readRows_(ss, 'rules').map(parseRuleRow).filter(function (x) { return x.words.length; });
}

function readZones_(ss) {
  return readRows_(ss, 'zones').map(parseZoneRow).filter(function (x) { return x.zoneId; });
}

/** 寫入某活動的票區（保留既有勾選），並更新該活動的「最高原價」。回傳寫入列數。 */
function writeZonesForTarget_(ss, targetName, parsed, now) {
  var sh = ss.getSheetByName(TH_SHEETS.zones.name);
  var width = TH_SHEETS.zones.headers.length;
  var rows = readRows_(ss, 'zones').filter(function (r) { return String(r[0]) !== '' || String(r[1]) !== '' || String(r[9]) !== ''; });
  var keep = [];
  var prevMonitor = {};
  rows.forEach(function (r) {
    var z = parseZoneRow(r);
    if (z.target === targetName) prevMonitor[z.sessionId + ':' + z.zoneId] = z.monitor;
    else keep.push(r);
  });
  var fresh = [];
  var maxFace = null;
  parsed.sessions.forEach(function (s) {
    s.zones.forEach(function (z) {
      var key = s.sessionId + ':' + z.zoneId;
      var monitor = prevMonitor.hasOwnProperty(key) ? prevMonitor[key] : defaultZoneMonitored(z.name);
      if (defaultZoneMonitored(z.name) && z.price != null) maxFace = Math.max(maxFace || 0, z.price);
      fresh.push([monitor, targetName, opentixSessionLabel(s), z.name, z.price, z.remaining, formatTaipei(now), 'opentix', s.sessionId, z.zoneId]);
    });
  });
  var all = keep.concat(fresh);
  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, width).clearContent();
  if (all.length) {
    sh.getRange(2, 1, all.length, 1).insertCheckboxes();
    sh.getRange(2, 1, all.length, width).setValues(all);
    sh.getRange(2, 9, all.length, 2).setNumberFormat('@');
  }
  if (maxFace != null) setTargetMaxFace_(ss, targetName, maxFace);
  return fresh.length;
}

function setTargetMaxFace_(ss, targetName, maxFace) {
  var sh = ss.getSheetByName(TH_SHEETS.targets.name);
  if (!sh || sh.getLastRow() < 2) return;
  var names = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim() === targetName) sh.getRange(i + 2, 7).setValue(maxFace);
  }
}

/** 只更新有變動的「剩餘／更新時間」欄。current: {"sessionId:zoneId": n} */
function updateZoneRemaining_(ss, current, now) {
  var sh = ss.getSheetByName(TH_SHEETS.zones.name);
  if (!sh || sh.getLastRow() < 2) return;
  var n = sh.getLastRow() - 1;
  var ids = sh.getRange(2, 9, n, 2).getValues();
  var vals = sh.getRange(2, 6, n, 2).getValues();
  var changed = false;
  var stamp = formatTaipei(now);
  for (var i = 0; i < n; i++) {
    var key = String(ids[i][0]).trim() + ':' + String(ids[i][1]).trim();
    if (current.hasOwnProperty(key) && vals[i][0] !== current[key]) {
      vals[i][0] = current[key];
      vals[i][1] = stamp;
      changed = true;
    }
  }
  if (changed) sh.getRange(2, 6, n, 2).setValues(vals);
}

/** rows: [[Date, source, type, target, message, link]] */
function appendLogs_(ss, rows) {
  if (!rows.length) return;
  var sh = ss.getSheetByName(TH_SHEETS.log.name);
  if (!sh) return;
  var out = rows.map(function (r) { return [formatTaipei(r[0]), r[1], r[2], r[3] || '', truncate(r[4], 500), r[5] || '']; });
  sh.getRange(sh.getLastRow() + 1, 1, out.length, 6).setValues(out);
  var excess = sh.getLastRow() - 1 - TH_LOG_MAX_ROWS;
  if (excess > 200) sh.deleteRows(2, excess);
}

/** 狀態儀表板：雲端與本機各監控、配額、間隔。 */
function writeStatus_(ss, m) {
  var sh = ss.getSheetByName(TH_SHEETS.status.name);
  if (!sh) return;
  var rows = [
    ['Ticket hunter', 'v' + TH_VERSION, '', '', '', '', '', ''],
    ['監測狀態 Monitoring', m.monitoringText, '', '', '', '', '', ''],
    ['有效間隔 Effective interval', m.intervalText, '', '', '', '', '', ''],
    ['今日執行時間 Runtime today', m.runtimeText, '', '', '', '', '', ''],
    ['今日剩餘寄信額度 Emails left today', m.emailQuota, '', '', '', '', '', ''],
    ['最後更新 Updated', formatTaipei(m.now), '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['來源 Source', '位置 Where', '狀態 State', '最後檢查 Last check', '最後成功 Last OK', '連續失敗 Fails', '訊息 Message', '需要 Needs']
  ];
  m.sources.forEach(function (s) {
    rows.push([s.label, s.where, s.state, s.lastRun ? formatTaipei(new Date(s.lastRun)) : '', s.lastOk ? formatTaipei(new Date(s.lastOk)) : '', s.fails || 0, truncate(s.message || '', 200), s.needs]);
  });
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 8).setValues(rows);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sh.getRange(8, 1, 1, 8).setFontWeight('bold').setBackground('#f1f3f4');
  sh.getRange(2, 1, 5, 1).setFontWeight('bold');
}

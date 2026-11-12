/**
 * Ticket hunter — settings schema and parsing.
 * 「設定 Settings」工作表的每一列：key | 值 Value | 說明 Description。
 */

var TH_SETTINGS_SCHEMA = [
  { key: 'notify_email', type: 'string', dflt: '', zh: '通知寄到哪個 Email（空白＝你自己的帳號）', en: 'Where to send notifications (blank = your own account)' },
  { key: 'language', type: 'enum', values: ['zh-TW', 'en'], dflt: 'zh-TW', zh: 'Email 與狀態的語言：zh-TW 或 en', en: 'Language for emails and status: zh-TW or en' },
  { key: 'check_interval_minutes', type: 'number', dflt: 1, min: 1, zh: '多久檢查一次（分鐘，最少 1）', en: 'How often to check (minutes, min 1)' },
  { key: 'quiet_hours', type: 'string', dflt: '', zh: '不監測的時段，例如 01:00-07:00, 13:00-13:30（臺北時間）', en: 'Hours not to monitor, e.g. 01:00-07:00, 13:00-13:30 (Taipei time)' },
  { key: 'failure_alert_threshold', type: 'number', dflt: 2, min: 1, zh: '同一來源連續失敗幾次才寄警告信', en: 'Consecutive failures of a source before an alert email' },
  { key: 'daily_runtime_budget_minutes', type: 'number', dflt: 80, min: 5, zh: '每天最多用多少分鐘執行時間（免費 Gmail 帳號上限 90，Workspace 360）', en: 'Daily runtime budget in minutes (free Gmail limit 90, Workspace 360)' },
  { key: 'accept_above_face', type: 'bool', dflt: false, zh: '是否接受高於原價的票（台灣法規禁止高於票面價轉售，違法的是賣方）', en: 'Accept tickets above face value (reselling above face value is illegal for sellers in Taiwan)' },
  { key: 'above_face_max_percent', type: 'number', dflt: 0, min: 0, zh: '接受高於原價時，最多高出幾 %', en: 'If accepting above face value, maximum markup in %' },
  { key: 'notify_when_price_unknown', type: 'bool', dflt: true, zh: '看不出價格時仍通知（建議開啟，避免漏掉）', en: 'Notify even when the price cannot be read (recommended)' },
  { key: 'skip_title_tags', type: 'string', dflt: '徵, 求, 公告, 換票, 代訂, 心得, 問題, 情報, 閒聊, 協尋', zh: 'PTT 標題分類含這些字就略過', en: 'Skip PTT posts whose title tag contains these words' },
  { key: 'repost_dedupe_hours', type: 'number', dflt: 12, min: 0, zh: '同一賣家同標題重貼，幾小時內不重複通知（0＝每篇都通知）', en: 'Hours to suppress reposts by the same seller with the same title (0 = notify every post)' },
  { key: 'ptt_enabled', type: 'bool', dflt: true, zh: '監測 PTT Drama-Ticket 板', en: 'Monitor PTT Drama-Ticket board' },
  { key: 'ptt_interval_minutes', type: 'number', dflt: 1, min: 1, zh: 'PTT 檢查間隔（分鐘）', en: 'PTT check interval (minutes)' },
  { key: 'opentix_enabled', type: 'bool', dflt: true, zh: '監測 OPENTIX 官方釋出', en: 'Monitor OPENTIX official releases' },
  { key: 'opentix_interval_minutes', type: 'number', dflt: 1, min: 1, zh: 'OPENTIX 檢查間隔（分鐘）', en: 'OPENTIX check interval (minutes)' }
];

/** rows: [[key, value], ...] → settings object with defaults and validation. */
function parseSettings(rows) {
  var raw = {};
  (rows || []).forEach(function (r) {
    if (r && r[0] != null && String(r[0]).trim()) raw[String(r[0]).trim()] = r[1];
  });
  var out = {};
  TH_SETTINGS_SCHEMA.forEach(function (f) {
    var v = raw[f.key];
    if (f.type === 'bool') v = toBool(v, f.dflt);
    else if (f.type === 'number') {
      v = toNumber(v, f.dflt);
      if (f.min != null && v < f.min) v = f.min;
    } else if (f.type === 'enum') {
      v = String(v == null ? '' : v).trim();
      if (f.values.indexOf(v) < 0) v = f.dflt;
    } else v = String(v == null ? '' : v).trim() || f.dflt;
    out[f.key] = v;
  });
  out.quietRanges = parseQuietHours(out.quiet_hours);
  out.skipTags = parseList(out.skip_title_tags);
  return out;
}

function defaultSettingsRows(lang) {
  return TH_SETTINGS_SCHEMA.map(function (f) {
    var v = f.dflt;
    if (f.type === 'bool') v = !!f.dflt;
    return [f.key, v, (lang === 'en' ? f.en : f.zh + ' / ' + f.en)];
  });
}

/**
 * Targets sheet row → target object.
 * Columns: 啟用 | 活動名稱 | 關鍵字 | 排除字 | 場次日期 | 官方網址 | 最高原價(自動) | 備註
 */
function parseTargetRow(r) {
  return {
    enabled: toBool(r[0], false),
    name: String(r[1] == null ? '' : r[1]).trim(),
    keywords: parseList(r[2]),
    excludes: parseList(r[3]),
    dates: parseList(r[4]),
    officialUrl: String(r[5] == null ? '' : r[5]).trim(),
    maxFace: toNumber(r[6], null),
    notes: String(r[7] == null ? '' : r[7])
  };
}

/** Rules sheet row: 啟用 | 套用活動(空白=全部) | 同時出現就不通知的字詞 | 說明 */
function parseRuleRow(r) {
  return {
    enabled: toBool(r[0], false),
    target: String(r[1] == null ? '' : r[1]).trim(),
    words: parseList(r[2]),
    note: String(r[3] == null ? '' : r[3])
  };
}

/** Zones sheet row: 監測 | 活動名稱 | 場次 | 票區 | 原價 | 剩餘 | 更新時間 | 來源 | 場次ID | 票區ID */
function parseZoneRow(r) {
  return {
    monitor: toBool(r[0], false),
    target: String(r[1] == null ? '' : r[1]).trim(),
    session: String(r[2] == null ? '' : r[2]),
    zone: String(r[3] == null ? '' : r[3]),
    price: toNumber(r[4], null),
    remaining: toNumber(r[5], null),
    source: String(r[7] == null ? '' : r[7]).trim(),
    sessionId: String(r[8] == null ? '' : r[8]).trim(),
    zoneId: String(r[9] == null ? '' : r[9]).trim()
  };
}

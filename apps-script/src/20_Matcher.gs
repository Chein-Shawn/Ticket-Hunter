/**
 * Ticket hunter — post matching, price reading, rules (pure functions).
 *
 * 第一階段（尚無 AI）：關鍵字初篩 → 標題分類／已售 → 排除字與排除規則 → 日期 → 價格。
 * 看不出價格時預設仍通知並加註，寧可多報不可漏報。
 */

/** 找出關鍵字命中的目標。text 通常是「標題＋摘要」。 */
function findMatchingTargets(text, targets) {
  var norm = normalizeForMatch(text);
  return (targets || []).filter(function (tg) {
    if (!tg.enabled) return false;
    return tg.keywords.some(function (k) {
      var nk = normalizeForMatch(k);
      return nk && norm.indexOf(nk) >= 0;
    });
  });
}

/** 文中出現的「月/日」（11/28、11月28日、1/2）→ ["11/28", ...] */
function extractMonthDays(text) {
  var out = [];
  var seen = {};
  var re = /(^|[^\d\/.])(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})(?=[^\d\/]|$)/g;
  var m;
  var s = toHalfWidth(text);
  while ((m = re.exec(s))) {
    var mo = +m[2], d = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      var k = mo + '/' + d;
      if (!seen[k]) { seen[k] = true; out.push(k); }
    }
  }
  return out;
}

function normalizeMonthDay(s) {
  var m = toHalfWidth(String(s)).match(/(\d{1,2})\s*(?:\/|月|-)\s*(\d{1,2})/);
  return m ? (+m[1]) + '/' + (+m[2]) : null;
}

var TH_NUM = '(\\d{1,3}(?:,\\d{3})+|\\d{3,6})(?!\\d)';

function toPrice_(s) {
  var n = parseInt(String(s).replace(/,/g, ''), 10);
  return n >= 100 && n <= 200000 ? n : null;
}

/**
 * 從文字讀出原價與售價。
 * 回傳 {face, ask, atFace, below, surcharge, extras, titlePrice}
 */
function parsePrices(title, body) {
  var text = toHalfWidth(String(title || '') + '\n' + String(body || ''));
  var r = { face: null, ask: null, atFace: false, below: false, surcharge: false, extras: false, titlePrice: null };

  // 原價（若寫成 1350-1880 這類範圍，取最大值）
  var fm = new RegExp('(?:原價|票面(?:價)?|定價)\\s*[:：]?\\s*(?:每張|NT\\$?|\\$)?\\s*' + TH_NUM + '(?:\\s*[-~～]\\s*' + TH_NUM + ')?').exec(text);
  if (fm) {
    var f1 = toPrice_(fm[1]), f2 = fm[2] ? toPrice_(fm[2]) : null;
    r.face = f2 && f1 ? Math.max(f1, f2) : f1;
  }

  // 售價
  var am = new RegExp('(?:售價|讓價|價格|價錢|金額|降售|降讓|賠售|特價|只要|出售|售|讓)\\s*[:：]?\\s*(?:每張|NT\\$?|\\$)?\\s*' + TH_NUM).exec(text);
  if (am) r.ask = toPrice_(am[1]);

  // 「原價讓」「原讓」「原價售」「原價出」
  if (/原價(?:讓|售|出|轉)|原讓|原價釋出/.test(text)) r.atFace = true;
  if (/降售|降讓|降價|賠售|賠本|折售|打折/.test(text)) r.below = true;
  if (/\+\s*福利|含福利|加價/.test(text)) r.extras = true;

  // 標題 "4980+200" → 原價 4980、售價 5180
  var sm = new RegExp(TH_NUM + '\\s*\\+\\s*(\\d{2,5})(?!\\d)').exec(toHalfWidth(title || ''));
  if (sm) {
    var base = toPrice_(sm[1]), add = parseInt(sm[2], 10);
    if (base) {
      r.surcharge = true;
      if (r.face == null) r.face = base;
      if (r.ask == null) r.ask = base + add;
    }
  }

  // 標題 "1680*2"、"2800x1" 的單價
  var tm = new RegExp(TH_NUM + '\\s*[*xX×]\\s*\\d{1,2}(?!\\d)').exec(toHalfWidth(title || ''));
  if (tm) r.titlePrice = toPrice_(tm[1]);

  if (r.ask == null && r.atFace && r.face != null) r.ask = r.face;
  if (r.ask == null && r.titlePrice != null) r.ask = r.titlePrice;
  return r;
}

/**
 * 判斷一篇貼文對某個目標要不要通知。
 * post: {title, text, author, url}；target: parseTargetRow 結果；rules: parseRuleRow[]；settings: parseSettings 結果
 * 回傳 {notify, reason: {key, params}|null, flags: [], price}
 */
function evaluatePost(post, target, rules, settings) {
  var title = String(post.title || '');
  var text = String(post.text || '');
  var all = title + '\n' + text;
  var normAll = normalizeForMatch(all);
  var flags = [];

  var tag = pttTitleTag(title);
  if (tag) {
    for (var i = 0; i < settings.skipTags.length; i++) {
      if (tag.indexOf(settings.skipTags[i]) >= 0) return skip_('skip_tag', { tag: tag });
    }
  }
  if (/已售|售出|已出|已讓|已換|徵得|收到了/.test(title)) return skip_('skip_sold', {});

  for (var e = 0; e < target.excludes.length; e++) {
    var ne = normalizeForMatch(target.excludes[e]);
    if (ne && normAll.indexOf(ne) >= 0) return skip_('skip_exclude', { word: target.excludes[e] });
  }

  for (var r = 0; r < (rules || []).length; r++) {
    var rule = rules[r];
    if (!rule.enabled || !rule.words.length) continue;
    if (rule.target && rule.target !== target.name) continue;
    var allIn = rule.words.every(function (w) {
      var nw = normalizeForMatch(w);
      return nw && normAll.indexOf(nw) >= 0;
    });
    if (allIn) return skip_('skip_rule', { words: rule.words.join(' + ') });
  }

  if (target.dates.length) {
    var wanted = target.dates.map(normalizeMonthDay).filter(Boolean);
    var found = extractMonthDays(all);
    if (wanted.length && found.length && !found.some(function (d) { return wanted.indexOf(d) >= 0; })) {
      return skip_('skip_date', { dates: found.join(', ') });
    }
  }

  var price = parsePrices(title, text);
  var face = price.face;
  if (face == null && target.maxFace) {
    face = target.maxFace;
    if (price.ask != null) flags.push('flag_face_from_target');
  }
  if (price.surcharge) flags.push('flag_surcharge');
  if (price.extras) flags.push('flag_extras');

  if (price.ask != null && face != null) {
    var limit = settings.accept_above_face ? face * (1 + (settings.above_face_max_percent || 0) / 100) : face;
    if (price.ask > limit) return skip_('skip_above_face', { ask: price.ask, face: face });
    if (price.ask > face) flags.push('flag_above_face_allowed');
    else if (price.ask < face) flags.push('flag_below_face');
    else flags.push('flag_at_face');
  } else {
    if (price.atFace) flags.push('flag_at_face');
    else if (price.below) flags.push('flag_below_face');
    if (!price.atFace && !price.below) {
      if (!settings.notify_when_price_unknown) return skip_('skip_price_unknown', {});
      flags.push('flag_price_unknown');
    }
  }

  return { notify: true, reason: null, flags: flags, price: { face: face, ask: price.ask } };

  function skip_(key, params) {
    return { notify: false, reason: { key: key, params: params }, flags: flags, price: null };
  }
}

/** 同一賣家、同一標題（正規化後）的重貼鍵。 */
function repostKey(author, title) {
  var t = normalizeForMatch(String(title || '').replace(/^\s*\[[^\]]*\]/, ''));
  return String(author || '').toLowerCase() + '|' + t;
}

/** 清掉超過 hours 的紀錄；回傳新物件。 */
function pruneRepostMap(map, nowMs, hours) {
  var out = {};
  var limit = nowMs - hours * 3600000;
  Object.keys(map || {}).forEach(function (k) { if (map[k] >= limit) out[k] = map[k]; });
  return out;
}

/** 已讀清單：保留最後 max 筆。 */
function rememberSeen(list, ids, max) {
  var seen = {};
  var out = [];
  (list || []).concat(ids || []).forEach(function (id) {
    if (!seen[id]) { seen[id] = true; out.push(id); }
  });
  return out.slice(Math.max(0, out.length - (max || 400)));
}

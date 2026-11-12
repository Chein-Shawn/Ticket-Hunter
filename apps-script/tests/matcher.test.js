/* Keyword matching, price reading, rules, email */

function settingsWith(o) {
  var s = parseSettings([]);
  Object.keys(o || {}).forEach(function (k) { s[k] = o[k]; });
  return s;
}

var FF = parseTargetRow([true, 'F.FOREVER 恆星之城', '恆星之城, F.FOREVER, 光年赴約', '', '11/28, 11/29', '', '', '']);
var CHLOE = parseTargetRow([true, '蔡珂宜 Chloe Chua', '蔡珂宜, Chloe Chua', '', '1/2, 1/3', 'https://www.opentix.life/event/2108010089152028673', 3600, '']);

test('findMatchingTargets matches spelling variants and skips disabled targets', function () {
  assertEq(findMatchingTargets('[售票] 11/29 F✦FOREVER 演唱會', [FF, CHLOE]).map(function (x) { return x.name; }), ['F.FOREVER 恆星之城']);
  var off = parseTargetRow([false, 'off', '恆星之城', '', '', '', '', '']);
  assertEq(findMatchingTargets('恆星之城', [off]).length, 0);
  assertEq(findMatchingTargets('[售票] AAA 12/06 4980*1', [FF, CHLOE]).length, 0);
});

test('extractMonthDays finds dates but not prices or times', function () {
  assertEq(extractMonthDays('[售票] 11/29 K-wonder 晚場 12月5日 原價：1350-1880 17時00分'), ['11/29', '12/5']);
  assertEq(extractMonthDays('Tizzy bac 1/23北流'), ['1/23']);
  assertEq(extractMonthDays('2026/11/28'), []);
});

test('parsePrices: labelled face and asking price', function () {
  var p = parsePrices('[售票] 11/29 恆星之城', '節目：F FOREVER\n原價：1680\n售價：1300\n張數：1');
  assertEq([p.face, p.ask], [1680, 1300]);
});

test('parsePrices: free-form "原價每張4880，大降售每張3100"', function () {
  var p = parsePrices('[售票] 恆星之城', '【票價】：原價每張4880，大降售每張3100');
  assertEq([p.face, p.ask, p.below], [4880, 3100, true]);
});

test('parsePrices: title surcharge 4980+200', function () {
  var p = parsePrices('[售票] 售12/6AAA 4980+200*1', '');
  assertEq([p.face, p.ask, p.surcharge], [4980, 5180, true]);
});

test('parsePrices: title unit price 1680*2 and face range', function () {
  var p = parsePrices('[售票] 11/28 F.FOREVER恆星之城1680*2', '');
  assertEq([p.face, p.ask, p.titlePrice], [null, 1680, 1680]);
  assertEq(parsePrices('x', '原價：1350-1880').face, 1880);
});

test('parsePrices: 原讓 means at face; phone numbers are not prices', function () {
  var p = parsePrices('[讓票] 原讓 12/5 AAA 連號兩張', '原價：6980');
  assertEq([p.face, p.ask, p.atFace], [6980, 6980, true]);
  assertEq(parsePrices('x', '售價 0912345678').ask, null);
});

test('evaluatePost: notifies below-face sale', function () {
  var v = evaluatePost({ title: '[售票] 11/29 F FOREVER 恆星之城', text: '時間：11 月 29 日\n原價：1680\n售價：1300' }, FF, [], settingsWith({}));
  assertEq(v.notify, true);
  assertEq(v.price, { face: 1680, ask: 1300 });
  assertTrue(v.flags.indexOf('flag_below_face') >= 0);
});

test('evaluatePost: skips by tag, sold, exclude word and date', function () {
  var s = settingsWith({});
  assertEq(evaluatePost({ title: '[徵票] 恆星之城 11/28', text: '' }, FF, [], s).reason.key, 'skip_tag');
  assertEq(evaluatePost({ title: '[換票] 恆星之城 11/28 換 11/29', text: '' }, FF, [], s).reason.key, 'skip_tag');
  assertEq(evaluatePost({ title: '[售票] 11/28 恆星之城（已售）', text: '' }, FF, [], s).reason.key, 'skip_sold');
  var ex = parseTargetRow([true, 'F', '恆星之城', '搖滾區', '', '', '', '']);
  assertEq(evaluatePost({ title: '[售票] 恆星之城 搖滾區', text: '' }, ex, [], s).reason.key, 'skip_exclude');
  assertEq(evaluatePost({ title: '[售票] 12/5 恆星之城', text: '' }, FF, [], s).reason.key, 'skip_date');
  assertEq(evaluatePost({ title: '[售票] 恆星之城', text: '時間：11月 28日' }, FF, [], s).notify, true, 'matching date');
  assertEq(evaluatePost({ title: '[售票] 恆星之城', text: '' }, FF, [], s).notify, true, 'no date → keep');
});

test('evaluatePost: rule skips only when ALL words appear', function () {
  var rules = [parseRuleRow([true, '', '青年, 視線遮蔽', ''])];
  var s = settingsWith({});
  assertEq(evaluatePost({ title: '[售票] 1/3 蔡珂宜 青年席位', text: '視線遮蔽 原價1800 售價1800' }, CHLOE, rules, s).reason.key, 'skip_rule');
  assertEq(evaluatePost({ title: '[售票] 1/3 蔡珂宜 青年席位', text: '原價1800 售價1800' }, CHLOE, rules, s).notify, true);
  var otherTarget = [parseRuleRow([true, 'F.FOREVER 恆星之城', '青年, 視線遮蔽', ''])];
  assertEq(evaluatePost({ title: '[售票] 1/3 蔡珂宜 青年', text: '視線遮蔽' }, CHLOE, otherTarget, s).notify, true, 'rule scoped to another target');
});

test('evaluatePost: above face value is skipped unless allowed within margin', function () {
  var post = { title: '[售票] 售12/6 恆星之城 4980+200*1', text: '' };
  var tgt = parseTargetRow([true, 'X', '恆星之城', '', '', '', '', '']);
  assertEq(evaluatePost(post, tgt, [], settingsWith({})).reason.key, 'skip_above_face');
  var ok = evaluatePost(post, tgt, [], settingsWith({ accept_above_face: true, above_face_max_percent: 5 }));
  assertEq(ok.notify, true);
  assertTrue(ok.flags.indexOf('flag_above_face_allowed') >= 0);
  assertEq(evaluatePost(post, tgt, [], settingsWith({ accept_above_face: true, above_face_max_percent: 3 })).notify, false, '5180 > 4980*1.03');
});

test('evaluatePost: unknown price is flagged, or skipped if configured', function () {
  var post = { title: '[售票] 1/3 蔡珂宜 二樓', text: '私訊詳談' };
  var noFace = parseTargetRow([true, 'C', '蔡珂宜', '', '', '', '', '']);
  var v = evaluatePost(post, noFace, [], settingsWith({}));
  assertEq(v.notify, true);
  assertTrue(v.flags.indexOf('flag_price_unknown') >= 0);
  assertEq(evaluatePost(post, noFace, [], settingsWith({ notify_when_price_unknown: false })).reason.key, 'skip_price_unknown');
});

test('evaluatePost: falls back to the target max face value', function () {
  var v = evaluatePost({ title: '[售票] 1/3 蔡珂宜 2800*1', text: '' }, CHLOE, [], settingsWith({}));
  assertEq(v.notify, true);
  assertEq(v.price, { face: 3600, ask: 2800 });
  assertTrue(v.flags.indexOf('flag_face_from_target') >= 0);
  assertEq(evaluatePost({ title: '[售票] 1/3 蔡珂宜 4000*1', text: '' }, CHLOE, [], settingsWith({})).reason.key, 'skip_above_face');
});

test('repost keys, pruning and seen list', function () {
  assertEq(repostKey('UserA', '[售票] 11/29 F.FOREVER 恆星之城'), repostKey('usera', '[降售] 11/29 F FOREVER 恆星之城'));
  assertEq(pruneRepostMap({ a: 1000, b: 9000 }, 10000, 0.001), { b: 9000 });
  var seen = rememberSeen(['a', 'b'], ['b', 'c', 'd'], 3);
  assertEq(seen, ['b', 'c', 'd']);
});

test('buildHitsEmail merges hits and escapes HTML', function () {
  var mail = buildHitsEmail([
    { source: 'ptt', target: 'F', title: '[售票] <script>x</script>', url: 'https://www.ptt.cc/bbs/Drama-Ticket/M.1.A.1.html', excerpt: '原價：1680', price: { face: 1680, ask: 1300 }, flags: ['flag_below_face'] },
    { source: 'opentix', target: 'C', title: 'Chloe', session: '2027/01/03 19:30 國家音樂廳', zone: '2800元區', price: 2800, remaining: 1, previous: 0, url: 'https://www.opentix.life/event/1' }
  ], 'zh-TW');
  assertTrue(mail.subject.indexOf('2 筆') >= 0, mail.subject);
  assertTrue(mail.html.indexOf('<script>') < 0, 'escaped');
  assertTrue(mail.html.indexOf('低於原價') >= 0);
  assertTrue(mail.text.indexOf('剩餘 1（原本 0）') >= 0, mail.text);
  assertTrue(buildHitsEmail([{ source: 'ptt', title: 'x', url: 'u', flags: [] }], 'en').subject.indexOf('1 possible') >= 0);
});

test('buildAlertEmail', function () {
  var m = buildAlertEmail('down', 'PTT', { fails: 2, lastError: 'HTTP 403' }, 'zh-TW');
  assertTrue(m.subject.indexOf('連續 2 次') >= 0 && m.text.indexOf('HTTP 403') >= 0);
  assertTrue(buildAlertEmail('recovered', 'PTT', {}, 'en').subject.indexOf('recovered') >= 0);
});

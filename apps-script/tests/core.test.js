/* Util, settings, scheduler, health */

test('normalizeForMatch unifies F.FOREVER spellings', function () {
  ['F✦FOREVER', 'F.FOREVER', 'f forever', 'Ｆ．ＦＯＲＥＶＥＲ', 'F+FOREVER', 'F◆FOREVER'].forEach(function (s) {
    assertEq(normalizeForMatch(s), 'fforever', s);
  });
  assertEq(normalizeForMatch('蔡珂宜 Chloe Chua'), '蔡珂宜chloechua');
});

test('parseList splits on Chinese and English separators', function () {
  assertEq(parseList('a, b，c、d\n e;; a'), ['a', 'b', 'c', 'd', 'e']);
  assertEq(parseList(''), []);
});

test('decodeHtmlEntities handles numeric and named entities', function () {
  assertEq(decodeHtmlEntities('&lt;pre&gt;A&#xA;B&#39;&amp;'), "<pre>A\nB'&");
});

test('parseSettings applies defaults, booleans and minimums', function () {
  var s = parseSettings([['check_interval_minutes', 0], ['accept_above_face', 'FALSE'], ['language', 'xx'], ['quiet_hours', '01:00-07:00'], ['ptt_enabled', false]]);
  assertEq(s.check_interval_minutes, 1);
  assertEq(s.accept_above_face, false);
  assertEq(s.language, 'zh-TW');
  assertEq(s.failure_alert_threshold, 2);
  assertEq(s.ptt_enabled, false);
  assertEq(s.quietRanges, [{ start: 60, end: 420 }]);
  assertTrue(s.skipTags.indexOf('徵') >= 0);
});

test('quiet hours, including ranges across midnight', function () {
  var r = parseQuietHours('23:30-00:30, 13:00-13:30');
  assertEq(r, [{ start: 1410, end: 30 }, { start: 780, end: 810 }]);
  assertTrue(isQuiet(taipei(2026, 11, 12, 23, 45), r), '23:45 quiet');
  assertTrue(isQuiet(taipei(2026, 11, 13, 0, 10), r), '00:10 quiet');
  assertTrue(!isQuiet(taipei(2026, 11, 13, 0, 30), r), '00:30 not quiet');
  assertTrue(isQuiet(taipei(2026, 11, 13, 13, 0), r), '13:00 quiet');
  assertTrue(!isQuiet(taipei(2026, 11, 13, 12, 59), r), '12:59 not quiet');
  assertEq(parseQuietHours('garbage, 7-7'), []);
});

test('minutesLeftToday subtracts quiet minutes', function () {
  var r = parseQuietHours('23:00-24:00');
  assertEq(minutesLeftToday(taipei(2026, 11, 12, 22, 0), r), { total: 120, active: 60 });
});

test('isDue tolerates trigger jitter', function () {
  assertTrue(isDue(null, 1000, 1));
  assertTrue(isDue(0 + 1, 50000, 1), '49 s after counts as due for 1-minute interval');
  assertTrue(!isDue(1, 30000, 1));
  assertTrue(!isDue(1, 60000, 2));
});

test('quota guard keeps configured interval when budget is ample', function () {
  var e = computeEffectiveInterval({ configured: 1, budgetMs: 80 * 60000, usedMs: 0, idleMs: 300, activeMs: 1800, minutesTotalLeft: 1440, minutesActiveLeft: 1440 });
  assertEq(e, { interval: 1, paused: false, throttled: false });
});

test('quota guard slows down when runs are expensive', function () {
  var e = computeEffectiveInterval({ configured: 1, budgetMs: 80 * 60000, usedMs: 0, idleMs: 300, activeMs: 6000, minutesTotalLeft: 1440, minutesActiveLeft: 1440 });
  assertTrue(e.throttled && e.interval >= 2, JSON.stringify(e));
  // check: total cost at that interval fits the budget
  var cost = 1440 * 300 + (1440 / e.interval) * (6000 - 300);
  assertTrue(cost <= 80 * 60000, 'cost ' + cost);
});

test('quota guard pauses when the budget is spent', function () {
  assertEq(computeEffectiveInterval({ configured: 1, budgetMs: 60000, usedMs: 60000 }).paused, true);
  assertEq(computeEffectiveInterval({ configured: 1, budgetMs: 60000, usedMs: 0, idleMs: 300, activeMs: 1000, minutesTotalLeft: 1000, minutesActiveLeft: 1000 }).paused, true, 'idle ticks alone exceed budget');
});

test('usage accumulates per Taipei day and resets next day', function () {
  var u = addUsage(null, '2026-11-12', 1000, true);
  u = addUsage(u, '2026-11-12', 300, false);
  assertEq(usageAverages(u, '2026-11-12'), { usedMs: 1300, idleMs: 300, activeMs: 1000 });
  assertEq(addUsage(u, '2026-11-13', 200, false).usedMs, 200);
});

test('health alerts once at threshold and once on recovery', function () {
  var h = null, r;
  r = recordHealth(h, false, 2, 'e1', 1); assertEq(r.event, null); h = r.health;
  r = recordHealth(h, false, 2, 'e2', 2); assertEq(r.event, 'down'); h = r.health;
  r = recordHealth(h, false, 2, 'e3', 3); assertEq(r.event, null); h = r.health;
  assertEq(h.fails, 3);
  r = recordHealth(h, true, 2, '', 4); assertEq(r.event, 'recovered'); h = r.health;
  r = recordHealth(h, true, 2, '', 5); assertEq(r.event, null);
  assertEq(r.health.fails, 0);
});

test('formatTaipei and taipeiDayKey use UTC+8', function () {
  var d = new Date(Date.UTC(2026, 10, 12, 16, 30)); // 00:30 next day in Taipei
  assertEq(taipeiDayKey(d), '2026-11-13');
  assertEq(formatTaipei(d), '2026/11/13 00:30');
});

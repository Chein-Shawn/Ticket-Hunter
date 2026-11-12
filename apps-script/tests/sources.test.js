/* PTT and OPENTIX parsing against real (de-identified) fixtures */

test('PTT Atom fixture parses 20 entries with ids, titles and authors', function () {
  var entries = parsePttAtom(readFixture('ptt_atom_20261112.xml'));
  assertEq(entries.length, 20);
  entries.forEach(function (e) {
    assertTrue(/^M\.\d+\.A\.[0-9A-F]{3}$/.test(e.id), 'id ' + e.id);
    assertTrue(/^https:\/\/www\.ptt\.cc\/bbs\/Drama-Ticket\/M\./.test(e.url), 'url ' + e.url);
    assertTrue(/^user\d+$/.test(e.author), 'author ' + e.author);
    assertTrue(e.publishedMs > Date.UTC(2026, 10, 12), 'published');
    assertTrue(e.content.indexOf('<') < 0 || e.content.indexOf('<pre>') < 0, 'content has no pre tag');
  });
  var tri = entries.filter(function (e) { return e.title.indexOf('TRIANGLE') >= 0; })[0];
  assertEq(tri.title, '[售票] K-WONDER < TRIANGLE >', 'entities decoded');
});

test('pttTitleTag reads the bracket tag', function () {
  assertEq(pttTitleTag('[售票] 11/28 恆星之城'), '售票');
  assertEq(pttTitleTag('Re: [徵票] AAA'), '徵票');
  assertEq(pttTitleTag('no tag'), '');
});

test('extractPttArticleText drops header, signature and pushes', function () {
  var html = '<div id="main-content" class="bbs-screen bbs-content"><div class="article-metaline"><span class="article-meta-tag">作者</span><span class="article-meta-value">someone</span></div>' +
    '<div class="article-metaline"><span class="article-meta-tag">標題</span><span class="article-meta-value">[售票] x</span></div>' +
    '節目：F FOREVER 恆星之城\n原價：1680\n售價：1300\n\n--\n<span class="f2">※ 發信站: 批踢踢實業坊(ptt.cc), 來自: 1.2.3.4</span>' +
    '<div class="push"><span class="push-tag">推 </span><span class="push-userid">a</span><span class="push-content">: hi</span></div></div>';
  var text = extractPttArticleText(html);
  assertEq(text, '節目：F FOREVER 恆星之城\n原價：1680\n售價：1300');
});

test('NUXT parser reads the OPENTIX fixture without executing code', function () {
  var state = parseNuxtStateFromHtml(readFixture('opentix_chloe_20261112.html'));
  var parsed = extractOpentixSessions(state);
  assertTrue(parsed.title.indexOf('Chloe Chua') >= 0, 'title ' + parsed.title);
  assertEq(parsed.sessions.length, 2);
  var ks = parsed.sessions[0], tp = parsed.sessions[1];
  assertEq(ks.venue, '高雄市音樂館');
  assertEq(formatTaipei(new Date(ks.startMs)), '2027/01/02 19:30');
  assertEq(tp.venue, '國家音樂廳');
  assertEq(formatTaipei(new Date(tp.startMs)), '2027/01/03 19:30');
  assertEq(ks.remaining, 0);
  assertEq(tp.remaining, 22);
  var byName = {};
  tp.zones.forEach(function (z) { byName[z.name] = z; });
  assertEq(byName['輪椅席'].remaining, 11);
  assertEq(byName['輪椅陪同席'].remaining, 11);
  assertEq(byName['3600元區'].price, 3600);
  assertEq(byName['3600元區'].remaining, 0);
  assertTrue(!!byName['青年席位300元（原價1800）'], 'youth zone present');
  assertEq(ks.zones.map(function (z) { return z.name; }), ['2800元區', '2200元區', '1600元區', '輪椅席', '800元區']);
});

test('NUXT parser supports assignments, Array(n), escapes and !0', function () {
  var src = 'window.__NUXT__=(function(a,b,c){b.x="q\\u002Fr";b[0]=!0;return {v:a,o:b,arr:c,e:"\\"",n:-1.5e2,u:void 0}}(7,{},Array(3)));';
  var st = parseNuxtStateFromHtml('<script>' + src + '</script>');
  assertEq(st.v, 7);
  assertEq(st.o.x, 'q/r');
  assertEq(st.o['0'], true);
  assertEq(st.arr.length, 3);
  assertEq(st.e, '"');
  assertEq(st.n, -150);
  assertEq(st.u, undefined);
});

test('NUXT parser refuses function calls and unknown identifiers', function () {
  assertThrows(function () { parseNuxtExpression('(function(a){return {x:alert(1)}}(1))'); });
  assertThrows(function () { parseNuxtExpression('(function(a){fetch("x");return {}}(1))'); });
  assertThrows(function () { parseNuxtExpression('(function(a){return {x:new Date()}}(1))'); });
});

test('OPENTIX: wheelchair zones are unticked by default', function () {
  assertEq(defaultZoneMonitored('輪椅席'), false);
  assertEq(defaultZoneMonitored('輪椅陪同席'), false);
  assertEq(defaultZoneMonitored('2800元區'), true);
});

test('OPENTIX: notify on first sight or increase of a ticked zone only', function () {
  var parsed = { title: 'T', sessions: [{ sessionId: 's1', venue: 'V', startMs: 0, remaining: 3, zones: [
    { zoneId: 'z1', name: '2800元區', price: 2800, remaining: 2 },
    { zoneId: 'z2', name: '輪椅席', price: 800, remaining: 1 },
    { zoneId: 'z3', name: '800元區', price: 800, remaining: 0 }
  ] }] };
  var rows = [
    { monitor: true, target: 'A', sessionId: 's1', zoneId: 'z1' },
    { monitor: false, target: 'A', sessionId: 's1', zoneId: 'z2' },
    { monitor: true, target: 'A', sessionId: 's1', zoneId: 'z3' }
  ];
  var r1 = evaluateOpentixZones(parsed, rows, {}, 'A');
  assertEq(r1.hits.map(function (h) { return h.zone; }), ['2800元區']);
  assertEq(r1.current, { 's1:z1': 2, 's1:z2': 1, 's1:z3': 0 });
  var r2 = evaluateOpentixZones(parsed, rows, r1.current, 'A');
  assertEq(r2.hits.length, 0, 'unchanged count does not notify again');
  parsed.sessions[0].zones[0].remaining = 3;
  assertEq(evaluateOpentixZones(parsed, rows, r1.current, 'A').hits[0].previous, 2);
  parsed.sessions[0].zones[0].remaining = 1;
  assertEq(evaluateOpentixZones(parsed, rows, { 's1:z1': 3 }, 'A').hits.length, 0, 'decrease does not notify');
});

test('isOpentixEventUrl', function () {
  assertTrue(isOpentixEventUrl('https://www.opentix.life/event/2108010089152028673'));
  assertTrue(!isOpentixEventUrl('https://tixcraft.com/activity/detail/26_forever'));
});

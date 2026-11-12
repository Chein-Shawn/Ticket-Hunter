/* Ticket hunter — tiny test harness. Runs under macOS JavaScriptCore (osascript -l JavaScript) or Node. */
var TH_TESTS = [];

function test(name, fn) { TH_TESTS.push({ name: name, fn: fn }); }

function assertEq(actual, expected, msg) {
  var a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error((msg ? msg + ': ' : '') + 'expected ' + e + ' but got ' + a);
}

function assertTrue(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

function assertThrows(fn, msg) {
  var threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) throw new Error(msg || 'expected an error');
}

function readFixture(name) {
  var path = TH_FIXTURE_DIR + '/' + name;
  if (typeof require === 'function') return require('fs').readFileSync(path, 'utf8');
  ObjC.import('Foundation');
  var s = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
  if (!s || s.isNil && s.isNil()) throw new Error('fixture not found: ' + path);
  return s.js;
}

/** 臺北時間 → Date */
function taipei(y, mo, d, h, mi) { return new Date(Date.UTC(y, mo - 1, d, h - 8, mi || 0)); }

function thRunAll() {
  var failed = [];
  var lines = [];
  TH_TESTS.forEach(function (tc) {
    try { tc.fn(); lines.push('  ok   ' + tc.name); }
    catch (e) { failed.push(tc.name); lines.push('  FAIL ' + tc.name + '\n       ' + (e && e.message ? e.message : e)); }
  });
  lines.push('');
  lines.push((TH_TESTS.length - failed.length) + ' passed, ' + failed.length + ' failed');
  var out = lines.join('\n');
  if (failed.length) throw new Error('\n' + out);
  return out;
}

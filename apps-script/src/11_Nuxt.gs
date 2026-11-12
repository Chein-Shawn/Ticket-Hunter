/**
 * Ticket hunter — safe parser for Nuxt 2 "window.__NUXT__" state.
 *
 * OPENTIX 把頁面資料放在 window.__NUXT__=(function(a,b,…){ 指派…; return {…} }(值1,值2,…))。
 * 這裡「只解析資料、不執行程式碼」（不用 eval / new Function）：Apps Script 有 Gmail 權限，
 * 執行第三方網站的 JavaScript 等於把信箱交給它。支援的語法僅限 Nuxt 產生的資料：
 * 物件、陣列、字串、數字、true/false/null/undefined、void 0、!0、!1、Array(n)、參數名稱參照，
 * 以及函式內 `x.y=值;`、`x[0]=值;` 這類指派。遇到其他語法就丟出錯誤（視為來源失敗，不會亂猜）。
 */

function parseNuxtStateFromHtml(html) {
  html = String(html || '');
  var marker = 'window.__NUXT__=';
  var start = html.indexOf(marker);
  if (start < 0) throw new Error('NUXT state not found');
  var end = html.indexOf('</script>', start);
  if (end < 0) end = html.length;
  var src = html.slice(start + marker.length, end).trim().replace(/;\s*$/, '');
  return parseNuxtExpression(src);
}

function parseNuxtExpression(src) {
  var head = '(function(';
  if (src.indexOf(head) !== 0) return new NuxtLiteralParser(src, 0, {}).parseValue();

  var p = new NuxtLiteralParser(src, head.length, {});
  var params = p.readIdentifierList(')');
  p.skipWs();
  p.expect('{');
  var bodyStart = p.pos;
  var bodyEnd = p.findMatchingBrace(bodyStart - 1);

  var a = new NuxtLiteralParser(src, bodyEnd + 1, {});
  a.skipWs();
  a.expect('(');
  var args = a.readValueList(')');

  var env = {};
  params.forEach(function (name, i) { env[name] = args[i]; });

  var b = new NuxtLiteralParser(src, bodyStart, env);
  for (var guard = 0; guard < 100000; guard++) {
    b.skipWs();
    if (b.pos >= bodyEnd) throw new Error('NUXT: no return statement');
    if (b.startsWithWord('return')) {
      b.pos += 6;
      return b.parseValue();
    }
    b.parseAssignment();
    b.skipWs();
    if (b.peek() === ';' || b.peek() === ',') b.pos++;
  }
  throw new Error('NUXT: too many statements');
}

function NuxtLiteralParser(src, pos, env) {
  this.src = src;
  this.pos = pos || 0;
  this.env = env || {};
}

NuxtLiteralParser.prototype.peek = function () { return this.src.charAt(this.pos); };

NuxtLiteralParser.prototype.fail = function (msg) {
  throw new Error('NUXT parse error at ' + this.pos + ': ' + msg + ' near "' + this.src.slice(this.pos, this.pos + 30) + '"');
};

NuxtLiteralParser.prototype.skipWs = function () {
  var s = this.src;
  while (this.pos < s.length && /\s/.test(s.charAt(this.pos))) this.pos++;
};

NuxtLiteralParser.prototype.expect = function (ch) {
  this.skipWs();
  if (this.src.charAt(this.pos) !== ch) this.fail('expected "' + ch + '"');
  this.pos++;
};

NuxtLiteralParser.prototype.startsWithWord = function (w) {
  if (this.src.substr(this.pos, w.length) !== w) return false;
  var next = this.src.charAt(this.pos + w.length);
  return !/[\w$]/.test(next);
};

NuxtLiteralParser.prototype.readIdentifier = function () {
  this.skipWs();
  var m = /^[A-Za-z_$][\w$]*/.exec(this.src.slice(this.pos, this.pos + 64));
  if (!m) this.fail('identifier expected');
  this.pos += m[0].length;
  return m[0];
};

NuxtLiteralParser.prototype.readIdentifierList = function (close) {
  var out = [];
  this.skipWs();
  if (this.peek() === close) { this.pos++; return out; }
  for (;;) {
    out.push(this.readIdentifier());
    this.skipWs();
    var c = this.peek();
    this.pos++;
    if (c === close) return out;
    if (c !== ',') this.fail('"," or "' + close + '" expected');
  }
};

NuxtLiteralParser.prototype.readValueList = function (close) {
  var out = [];
  this.skipWs();
  if (this.peek() === close) { this.pos++; return out; }
  for (;;) {
    out.push(this.parseValue());
    this.skipWs();
    var c = this.peek();
    this.pos++;
    if (c === close) return out;
    if (c !== ',') this.fail('"," or "' + close + '" expected');
  }
};

/** 從 openIndex 的 "{" 找到對應的 "}"（略過字串內容）。 */
NuxtLiteralParser.prototype.findMatchingBrace = function (openIndex) {
  var s = this.src, depth = 0;
  for (var i = openIndex; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '"' || c === "'") {
      for (i++; i < s.length && s.charAt(i) !== c; i++) if (s.charAt(i) === '\\') i++;
    } else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  this.fail('unbalanced braces');
};

NuxtLiteralParser.prototype.parseValue = function () {
  this.skipWs();
  var c = this.peek();
  if (c === '{') return this.parseObject();
  if (c === '[') return this.parseArray();
  if (c === '"' || c === "'") return this.parseString();
  if (c === '-' || c === '.' || (c >= '0' && c <= '9')) return this.parseNumber();
  if (c === '!') {
    this.pos++;
    var v = this.parseValue();
    return !v;
  }
  var id = this.readIdentifier();
  switch (id) {
    case 'true': return true;
    case 'false': return false;
    case 'null': return null;
    case 'undefined': return undefined;
    case 'NaN': return NaN;
    case 'Infinity': return Infinity;
    case 'void':
      this.parseValue();
      return undefined;
    case 'Array':
      this.expect('(');
      var n = this.parseValue();
      this.expect(')');
      if (typeof n !== 'number' || n < 0 || n > 100000) this.fail('bad Array length');
      return new Array(n);
  }
  if (Object.prototype.hasOwnProperty.call(this.env, id)) return this.env[id];
  this.fail('unknown identifier "' + id + '"');
};

NuxtLiteralParser.prototype.parseObject = function () {
  this.expect('{');
  var obj = {};
  for (;;) {
    this.skipWs();
    var c = this.peek();
    if (c === '}') { this.pos++; return obj; }
    var key;
    if (c === '"' || c === "'") key = this.parseString();
    else if (c >= '0' && c <= '9') key = String(this.parseNumber());
    else key = this.readIdentifier();
    this.expect(':');
    obj[key] = this.parseValue();
    this.skipWs();
    c = this.peek();
    if (c === ',') { this.pos++; continue; }
    if (c === '}') { this.pos++; return obj; }
    this.fail('"," or "}" expected in object');
  }
};

NuxtLiteralParser.prototype.parseArray = function () {
  this.expect('[');
  var arr = [];
  for (;;) {
    this.skipWs();
    var c = this.peek();
    if (c === ']') { this.pos++; return arr; }
    arr.push(this.parseValue());
    this.skipWs();
    c = this.peek();
    if (c === ',') { this.pos++; continue; }
    if (c === ']') { this.pos++; return arr; }
    this.fail('"," or "]" expected in array');
  }
};

NuxtLiteralParser.prototype.parseNumber = function () {
  var m = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.src.slice(this.pos, this.pos + 40));
  if (!m) this.fail('number expected');
  this.pos += m[0].length;
  return parseFloat(m[0]);
};

NuxtLiteralParser.prototype.parseString = function () {
  var s = this.src, q = s.charAt(this.pos), out = '';
  this.pos++;
  while (this.pos < s.length) {
    var c = s.charAt(this.pos++);
    if (c === q) return out;
    if (c !== '\\') { out += c; continue; }
    var e = s.charAt(this.pos++);
    switch (e) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case 'v': out += '\v'; break;
      case '0': out += '\0'; break;
      case 'x':
        out += String.fromCharCode(parseInt(s.substr(this.pos, 2), 16));
        this.pos += 2;
        break;
      case 'u':
        if (s.charAt(this.pos) === '{') {
          var close = s.indexOf('}', this.pos);
          out += String.fromCodePoint(parseInt(s.slice(this.pos + 1, close), 16));
          this.pos = close + 1;
        } else {
          out += String.fromCharCode(parseInt(s.substr(this.pos, 4), 16));
          this.pos += 4;
        }
        break;
      case '\n': break; // line continuation
      default: out += e;
    }
  }
  this.fail('unterminated string');
};

/** `name(.prop|[index])+ = value` → 寫入 env 中的物件。 */
NuxtLiteralParser.prototype.parseAssignment = function () {
  var base = this.readIdentifier();
  if (!Object.prototype.hasOwnProperty.call(this.env, base)) this.fail('assignment to unknown "' + base + '"');
  var path = [];
  for (;;) {
    this.skipWs();
    var c = this.peek();
    if (c === '.') { this.pos++; path.push(this.readIdentifier()); }
    else if (c === '[') {
      this.pos++;
      var k = this.parseValue();
      this.expect(']');
      path.push(String(k));
    } else break;
  }
  this.expect('=');
  var value = this.parseValue();
  if (!path.length) { this.env[base] = value; return; }
  var obj = this.env[base];
  for (var i = 0; i < path.length - 1; i++) {
    if (obj == null) this.fail('assignment into undefined');
    obj = obj[path[i]];
  }
  if (obj == null || typeof obj !== 'object') this.fail('assignment target is not an object');
  obj[path[path.length - 1]] = value;
};

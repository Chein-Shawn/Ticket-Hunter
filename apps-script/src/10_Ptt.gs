/**
 * Ticket hunter — PTT parsing (pure functions).
 * Atom feed: https://www.ptt.cc/atom/Drama-Ticket.xml （每則 content 只有內文前幾行）
 */

var PTT_ATOM_URL = 'https://www.ptt.cc/atom/Drama-Ticket.xml';

/** Atom XML → [{id, url, title, author, publishedMs, content}]（id 例如 "M.1794491104.A.4E8"）。 */
function parsePttAtom(xml) {
  var entries = [];
  var re = /<entry>([\s\S]*?)<\/entry>/g;
  var m;
  while ((m = re.exec(String(xml || '')))) {
    var e = m[1];
    var url = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || (e.match(/<id>([^<]+)<\/id>/) || [])[1] || '';
    url = decodeHtmlEntities(url);
    var id = (url.match(/\/(M\.[^/]+?)\.html/) || [])[1] || url;
    var title = decodeHtmlEntities(((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim());
    var author = decodeHtmlEntities(((e.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || '').trim());
    var published = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || (e.match(/<updated>([^<]+)<\/updated>/) || [])[1] || '';
    var contentRaw = (e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || '';
    // content 是被跳脫過的 HTML（&lt;pre&gt;…），先解跳脫再去標籤，最後再解一次實體。
    var content = decodeHtmlEntities(stripTags(decodeHtmlEntities(contentRaw))).trim();
    var t = Date.parse(published);
    entries.push({ id: id, url: url, title: title, author: author, publishedMs: isFinite(t) ? t : null, content: content });
  }
  return entries;
}

/** PTT 文章頁 HTML → 內文純文字（去掉標頭、推文、簽名檔）。 */
function extractPttArticleText(html) {
  html = String(html || '');
  var start = html.indexOf('<div id="main-content"');
  if (start < 0) return '';
  var body = html.slice(start);
  // 內文到「※ 發信站」為止（之後是 IP 與推文）。
  var cut = body.search(/※ 發信站|<span class="f2">※ 發信站/);
  if (cut > 0) body = body.slice(0, cut);
  body = body
    .replace(/<div class="article-metaline[\s\S]*?<\/div>/g, '')
    .replace(/<div class="article-metaline-right[\s\S]*?<\/div>/g, '')
    .replace(/<div class="push">[\s\S]*?<\/div>/g, '')
    .replace(/<br\s*\/?>/gi, '\n');
  var text = decodeHtmlEntities(stripTags(body));
  // 去掉簽名檔分隔線 "--" 之後的內容
  var sig = text.lastIndexOf('\n--\n');
  if (sig > 0) text = text.slice(0, sig);
  return text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** "[售票] 11/28 ..." → "售票"；沒有分類回傳 ''。 */
function pttTitleTag(title) {
  var m = String(title || '').match(/^\s*(?:Re:\s*|Fw:\s*)?\[([^\]]{1,8})\]/i);
  return m ? m[1].trim() : '';
}

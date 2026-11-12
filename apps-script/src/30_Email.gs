/**
 * Ticket hunter — email composition (pure functions).
 * 同一輪的所有命中合併成一封信（免費 Gmail 帳號每天只能寄給 100 位收件人）。
 */

/**
 * hits: [{source:'ptt', target, title, url, author, excerpt, price:{face,ask}, flags:[]}
 *        | {source:'opentix', target, title, session, zone, price, remaining, previous, url}]
 */
function buildHitsEmail(hits, lang) {
  var first = hits[0];
  var firstLabel = first.source === 'opentix'
    ? (first.target || first.title) + ' ' + first.zone
    : first.title;
  var subject = t(lang, 'emailSubjectHits', { n: hits.length, first: truncate(firstLabel, 60) });

  var html = ['<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">'];
  var text = [];
  html.push('<p>' + escapeHtml(t(lang, 'emailIntro')) + '</p>');
  text.push(t(lang, 'emailIntro'), '');

  hits.forEach(function (h, i) {
    html.push('<div style="border:1px solid #ddd;border-radius:8px;padding:10px 12px;margin:10px 0">');
    if (h.source === 'opentix') {
      var line = h.zone + '｜' + t(lang, 'face') + ' ' + (h.price != null ? h.price : '?') + '｜' + t(lang, 'remaining') + ' ' + h.remaining +
        (h.previous != null ? '（' + t(lang, 'was') + ' ' + h.previous + '）' : '');
      html.push('<div style="font-size:12px;color:#666">' + escapeHtml(t(lang, 'srcOpentix')) + ' · ' + escapeHtml(h.target || '') + '</div>');
      html.push('<div style="font-weight:600;margin:2px 0">' + escapeHtml(h.title || '') + '</div>');
      html.push('<div>' + escapeHtml(h.session || '') + '</div>');
      html.push('<div>' + escapeHtml(line) + '</div>');
      if (h.url) html.push('<div style="margin-top:6px"><a href="' + escapeHtml(h.url) + '">' + escapeHtml(t(lang, 'open')) + ' OPENTIX →</a></div>');
      text.push((i + 1) + '. [' + t(lang, 'srcOpentix') + '] ' + (h.title || ''), '   ' + (h.session || ''), '   ' + line, '   ' + (h.url || ''), '');
    } else {
      var priceBits = [];
      if (h.price && h.price.ask != null) priceBits.push(t(lang, 'ask') + ' ' + h.price.ask);
      if (h.price && h.price.face != null) priceBits.push(t(lang, 'face') + ' ' + h.price.face);
      var flagText = (h.flags || []).map(function (f) { return t(lang, f); }).join('；');
      html.push('<div style="font-size:12px;color:#666">' + escapeHtml(t(lang, 'srcPtt')) + ' · ' + escapeHtml(h.target || '') + '</div>');
      html.push('<div style="font-weight:600;margin:2px 0"><a href="' + escapeHtml(h.url) + '">' + escapeHtml(h.title) + '</a></div>');
      if (priceBits.length) html.push('<div>' + escapeHtml(priceBits.join('｜')) + '</div>');
      if (flagText) html.push('<div style="color:#a35b00">' + escapeHtml(flagText) + '</div>');
      if (h.excerpt) html.push('<pre style="white-space:pre-wrap;font-family:inherit;background:#f7f7f7;padding:8px;border-radius:6px;margin:6px 0 0">' + escapeHtml(h.excerpt) + '</pre>');
      text.push((i + 1) + '. [' + t(lang, 'srcPtt') + '] ' + h.title, '   ' + h.url);
      if (priceBits.length) text.push('   ' + priceBits.join(' | '));
      if (flagText) text.push('   ' + flagText);
      if (h.excerpt) text.push('   ' + h.excerpt.replace(/\n/g, '\n   '));
      text.push('');
    }
    html.push('</div>');
  });

  html.push('<p style="color:#a00">' + escapeHtml(t(lang, 'emailScam')) + '</p>');
  html.push('<p style="font-size:12px;color:#888">' + escapeHtml(t(lang, 'emailFooter')) + '</p></div>');
  text.push(t(lang, 'emailScam'), '', t(lang, 'emailFooter'));
  return { subject: subject, html: html.join(''), text: text.join('\n') };
}

function buildAlertEmail(event, sourceLabel, health, lang) {
  if (event === 'down') {
    return {
      subject: t(lang, 'alertDownSubject', { source: sourceLabel, n: health.fails }),
      text: t(lang, 'alertDownBody', { source: sourceLabel, n: health.fails, error: truncate(health.lastError || '', 300) })
    };
  }
  return {
    subject: t(lang, 'alertUpSubject', { source: sourceLabel }),
    text: t(lang, 'alertUpBody', { source: sourceLabel })
  };
}

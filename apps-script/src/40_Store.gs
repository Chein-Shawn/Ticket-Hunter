/**
 * Ticket hunter — persistent state in Script Properties.
 * 每個屬性值上限 9 KB，大的 JSON 會自動切塊存放（key#0, key#1, …）。
 */

var TH_CHUNK = 8000;

function storeGet(key, dflt) {
  var props = PropertiesService.getScriptProperties();
  var n = props.getProperty(key + '#n');
  try {
    if (n == null) {
      var v = props.getProperty(key);
      return v == null ? dflt : JSON.parse(v);
    }
    var parts = [];
    for (var i = 0; i < +n; i++) parts.push(props.getProperty(key + '#' + i) || '');
    return JSON.parse(parts.join(''));
  } catch (e) {
    return dflt;
  }
}

function storeSet(key, value) {
  var props = PropertiesService.getScriptProperties();
  var s = JSON.stringify(value);
  var oldN = props.getProperty(key + '#n');
  if (s.length <= TH_CHUNK) {
    props.setProperty(key, s);
    if (oldN != null) {
      for (var i = 0; i < +oldN; i++) props.deleteProperty(key + '#' + i);
      props.deleteProperty(key + '#n');
    }
    return;
  }
  var batch = {};
  var count = Math.ceil(s.length / TH_CHUNK);
  for (var j = 0; j < count; j++) batch[key + '#' + j] = s.slice(j * TH_CHUNK, (j + 1) * TH_CHUNK);
  batch[key + '#n'] = String(count);
  props.setProperties(batch, false);
  props.deleteProperty(key);
  if (oldN != null) for (var k = count; k < +oldN; k++) props.deleteProperty(key + '#' + k);
}

function storeDelete(key) {
  var props = PropertiesService.getScriptProperties();
  var n = props.getProperty(key + '#n');
  if (n != null) {
    for (var i = 0; i < +n; i++) props.deleteProperty(key + '#' + i);
    props.deleteProperty(key + '#n');
  }
  props.deleteProperty(key);
}

var TH_KEYS = {
  seenPtt: 'seen.ptt',
  repost: 'repost',
  health: 'health',
  usage: 'usage',
  lastRun: 'lastRun',
  opentixRemain: 'opentix.remain',
  statusWrittenAt: 'statusWrittenAt',
  lastCycle: 'lastCycle'
};

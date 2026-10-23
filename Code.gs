const ROSTER_TAB = 'Roster';    // student names (see the layouts below)
const LOG_TAB = 'HallPass';     // the log is written here (created automatically)
const MESSAGES_TAB = 'Messages'; // announcements for the board (see the layout below)
const SECRET = '';              // optional: put a word here and the same word in the board's Settings
const LAT = 28.5383, LON = -81.3792;   // Orlando, for the weather warnings
const ALERTS_UA = 'OSHS-classroom-board (teacher classroom display)';   // api.weather.gov asks for this header

// The board asks for: the names (default), ?action=messages, or ?action=alerts.
function doGet(e) {
  const p = (e && e.parameter) || {};
  let body;
  if (SECRET && p.key !== SECRET) body = { ok: false, error: 'bad key' };
  else if (p.action === 'messages') body = { ok: true, messages: readMessages_() };
  else if (p.action === 'alerts') {
    try { body = { ok: true, alerts: readAlerts_() }; }
    catch (err) { body = { ok: false, error: 'alerts: ' + err.message }; }
  }
  else body = { ok: true, roster: readRoster_(), tab: tabInfo_() };
  const json = JSON.stringify(body);
  if (p.callback && /^[\w$]+$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// The board sends one finished trip.
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (SECRET && d.key !== SECRET) return ContentService.createTextOutput('bad key');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(LOG_TAB) || ss.insertSheet(LOG_TAB);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Logged at', 'Date', 'Student', 'Reason', 'Pass #', 'Out', 'In',
                  'Minutes', 'Period', 'Grades', 'Day type', 'Trip ID', 'Section', 'Outside window', 'Mode', 'Board', 'Status']);
  }
  sh.appendRow([new Date(), d.date, d.student, d.reason, d.slot, d.timeOut, d.timeIn,
                d.durationMin, d.period, d.grades, d.dayType, d.id, d.section || '',
                d.outsideWindow ? 'yes' : '', d.mode || 'LIVE', d.board || '', d.status || 'Returned']);
  return ContentService.createTextOutput('ok');
}

// Roster tab layouts (the script works out which one you used):
//   1) Class code at the start of each row, the names to the right:   A1 | John D. | Mary K. | ...
//   2) Class codes across row 1, the names listed under each one:     A1 / A2 / B1 in row 1
//   3) Two columns with headers "Section" and "Name", one student per row.
//   4) One column of names (header "Name" optional) = a single list called "All".
// A class code is letters + digits, like A1, B2, A4.
function isCode_(s) { return /^[A-Za-z]{1,3}[ -]?\d{1,2}$/.test(s); }

function readRoster_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_TAB);
  const out = {};
  if (!sh || sh.getLastRow() < 1 || sh.getLastColumn() < 1) return out;
  const v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues()
    .map(function (r) { return r.map(function (c) { return String(c).trim(); }); });
  const head = v[0];
  const filled = head.filter(Boolean);
  const iSec = head.findIndex(function (h) { return /^(section|class|period)$/i.test(h); });
  const iName = head.findIndex(function (h) { return /^(name|student|students|full name)$/i.test(h); });
  function add(sec, name) { if (sec && name) (out[sec] = out[sec] || []).push(name); }

  if (iSec > -1 && iName > -1) {                                   // 3) Section | Name
    v.slice(1).forEach(function (r) { add(r[iSec], r[iName]); });
  } else if (filled.length > 1 && isCode_(head[0]) && !head.slice(1).some(isCode_)) {   // 1) code, then names across
    v.forEach(function (r) {
      if (isCode_(r[0])) r.slice(1).forEach(function (n) { add(r[0], n); });
    });
  } else if (filled.length > 0 && filled.every(isCode_)) {         // 2) codes across the top
    head.forEach(function (h, c) { if (h) v.slice(1).forEach(function (r) { add(h, r[c]); }); });
  } else if (iName > -1) {                                         // 4) a "Name" column
    v.slice(1).forEach(function (r) { add('All', r[iName]); });
  } else {                                                         // 4) one column of names
    v.forEach(function (r) { add('All', r[0]); });
  }
  return out;
}

// How much is on the Roster tab (lets the board say WHY a list came back empty).
function tabInfo_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ROSTER_TAB);
  if (!sh) return { found: false, cells: 0 };
  let n = 0;
  sh.getDataRange().getValues().forEach(function (r) {
    r.forEach(function (c) { if (String(c).trim()) n++; });
  });
  return { found: true, cells: n };
}

// Messages tab: one announcement per row.
//   A = the text (e.g. "Test on Friday!")   B = show from (optional)   C = show until (optional)
// Dates can be real dates or text like 2026-10-09. Leave B and C empty to show it every day.
// A first row that says "Message" (or "Announcement") is treated as a header and skipped.
function readMessages_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(MESSAGES_TAB);
  if (!sh || sh.getLastRow() < 1) return [];
  const tz = ss.getSpreadsheetTimeZone();
  const out = [];
  sh.getDataRange().getValues().forEach(function (r, i) {
    const text = String(r[0]).trim();
    if (!text) return;
    if (i === 0 && /^(message|messages|announcement|announcements|text)$/i.test(text)) return;
    out.push({ text: text, from: dateText_(r[1], tz), to: dateText_(r[2], tz) });
  });
  return out;
}
function dateText_(c, tz) {
  if (c instanceof Date) return Utilities.formatDate(c, tz, 'yyyy-MM-dd');
  const s = String(c).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

// Weather warnings from the National Weather Service. A browser can't send the User-Agent
// header that api.weather.gov asks for, so the script fetches them and the board asks the script.
function readAlerts_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('alerts');
  if (hit) return JSON.parse(hit);
  const res = UrlFetchApp.fetch('https://api.weather.gov/alerts/active?point=' + LAT + ',' + LON,
    { headers: { 'User-Agent': ALERTS_UA, 'Accept': 'application/geo+json' }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('NWS answered ' + res.getResponseCode());
  const feats = (JSON.parse(res.getContentText()).features || []);
  const out = feats.map(function (f) {
    const p = f.properties || {};
    return { event: p.event || '', severity: p.severity || '', urgency: p.urgency || '',
             ends: p.ends || p.expires || '', headline: p.headline || '' };
  }).filter(function (a) { return a.event; });
  cache.put('alerts', JSON.stringify(out), 240);   // 4 minutes, so several boards don't hammer NWS
  return out;
}

// Run this once from the editor (select "authorize" above the code, press Run) and allow access,
// so the script is permitted to contact the weather service.
function authorize() {
  UrlFetchApp.fetch('https://api.weather.gov/');
}

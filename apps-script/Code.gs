/* Hall Pass Board: the school's central script (version 2).
   Copyright (c) 2026 Shamil Ganiev. Free School Use License (see LICENSE in the repository).

   One Google Sheet holds everything. Teachers never open it; their boards talk to this script with a personal code.
     Master    the school's schedule export, pasted here once (it may contain parent e-mails: clear the tab after the import)
     Schedule  the clean copy the boards use (student ID, name, block, time, teacher, course, room, role)
     Teachers  one row per teacher: code, name, role, active
     Settings  site_url, semester2_start, exclude_courses
     Log       ONE tab, one row per finished trip (never split by week)
     Messages  announcements (optional): A = text, B = show from, C = show until
   Menu "Hall Pass" in the sheet does the set-up steps. See apps-script/SETUP.md. */

const TZ = 'America/New_York';
const LAT = 28.5383, LON = -81.3792;   // Orlando, for the weather warnings
const ALERTS_UA = 'OSHS-classroom-board (teacher classroom display)';   // api.weather.gov asks for this header
const TAB = { master: 'Master', schedule: 'Schedule', teachers: 'Teachers', settings: 'Settings', log: 'Log', messages: 'Messages', names: 'Names', announcements: 'Announcements', questions: 'Questions', bells: 'Bells', calendar: 'Calendar', prefs: 'Teacher settings', defaults: 'School defaults' };
const BLOCKS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
const LUNCH = 'LUNCH';                                       // lunch is a section too: in the cafeteria it belongs to the teacher "Lunch", in a classroom to that room's teacher
const ALL_BLOCKS = BLOCKS.concat([LUNCH]);
const NAMES_HEAD = ['Student ID', 'Preferred name', 'Status', 'Suggested by', 'Date', 'Note'];     // Status: ok (or empty) = used, pending = waits for an administrator
const ANN_HEAD = ['Teacher', 'Announcement'].concat(BLOCKS, ['Updated']);                       // an x in A1..B4 = shown during that lesson
const QA_HEAD = ['Teacher', 'Question', 'Answer'].concat(BLOCKS, ['Updated']);
const PREFS_HEAD = ['Teacher', 'Key', 'Value', 'Updated'];                                  // one row per teacher and setting; Value is JSON; Updated is a time in milliseconds
const DEFAULTS_HEAD = ['Key', 'Value', 'Locked', 'Note'];                              // the school's defaults; Locked = x means a teacher cannot change it
// The settings that follow a teacher from board to board. (Theme, screen width, sounds, volumes, the bell shift and the connection stay on each board.)
const PREF_KEY_RE = /^(extras\.(hallPass|cards|agenda|timer|ann|qa|live)|stage\.(phases|arc|facts|riddles|messages|calendar|weather|alerts|cardSec)|pass\.(slots|autoLeaveSec|useWindow|closedStartMin|closedEndMin|allowOutside|maxMinutes|reasons|limits)|pass\.profile\.(name|room|nameEdited|roomEdited)|pin|pinEnabled|agenda\.(clearDaily|leadMin)|agenda\.texts\.[AB][1-4]|live\.texts\.[AB][1-4]|live\.sound|timer\.(duration|threshold|thresholdUnit|endOn|endSound|warnOn|warnSound|presets)|countdownFormat|hour12)$/;
const PREF_MAX = 40000;                                                                     // characters in one value (a cell holds 50,000)
const BELLS_HEAD = ['Band', 'Day type', 'Day name', 'Label', 'Kind', 'Start', 'End'];      // Band: 912 or 1011. Kind: class, break or lunch. Times like 07:50 (24 hours)
const CAL_HEAD = ['Date', 'Day', 'Type', 'Event', 'Event kind'];                          // Day: A or B, empty = no school. Type: regular, wednesday... Event kind: break, end or year

// The sample the tabs are filled with the first time: Orlando Science High School 2026-27. Replace it with your own.
const DEFAULT_BELLS = [
  ["912","regular","Block Day","Period 1","class","07:50","09:22"],
  ["912","regular","Block Day","Break","break","09:22","09:27"],
  ["912","regular","Block Day","Period 2","class","09:27","10:55"],
  ["912","regular","Block Day","Break","break","10:55","11:00"],
  ["912","regular","Block Day","Period 3","class","11:00","12:28"],
  ["912","regular","Block Day","Break","break","12:28","12:33"],
  ["912","regular","Block Day","Lunch","lunch","12:33","13:13"],
  ["912","regular","Block Day","Break","break","13:13","13:18"],
  ["912","regular","Block Day","Period 4","class","13:18","14:50"],
  ["912","regular","Block Day","Break","break","14:50","14:55"],
  ["912","regular","Block Day","Clubs","class","14:55","15:30"],
  ["912","wednesday","Wednesday","Period 1","class","07:50","09:05"],
  ["912","wednesday","Wednesday","Break","break","09:05","09:10"],
  ["912","wednesday","Wednesday","Period 2","class","09:10","10:22"],
  ["912","wednesday","Wednesday","Break","break","10:22","10:27"],
  ["912","wednesday","Wednesday","Period 3","class","10:27","11:40"],
  ["912","wednesday","Wednesday","Break","break","11:40","11:45"],
  ["912","wednesday","Wednesday","Lunch","lunch","11:45","12:25"],
  ["912","wednesday","Wednesday","Break","break","12:25","12:30"],
  ["912","wednesday","Wednesday","Period 4","class","12:30","13:45"],
  ["912","wednesday","Wednesday","Break","break","13:45","13:50"],
  ["912","wednesday","Wednesday","Clubs","class","13:50","14:25"],
  ["1011","regular","Block Day","Period 1","class","07:50","09:22"],
  ["1011","regular","Block Day","Break","break","09:22","09:27"],
  ["1011","regular","Block Day","Period 2","class","09:27","10:55"],
  ["1011","regular","Block Day","Break","break","10:55","11:00"],
  ["1011","regular","Block Day","Lunch","lunch","11:00","11:40"],
  ["1011","regular","Block Day","Break","break","11:40","11:45"],
  ["1011","regular","Block Day","Period 3","class","11:45","13:13"],
  ["1011","regular","Block Day","Break","break","13:13","13:18"],
  ["1011","regular","Block Day","Period 4","class","13:18","14:50"],
  ["1011","regular","Block Day","Break","break","14:50","14:55"],
  ["1011","regular","Block Day","Clubs","class","14:55","15:30"],
  ["1011","wednesday","Wednesday","Period 1","class","07:50","09:05"],
  ["1011","wednesday","Wednesday","Break","break","09:05","09:10"],
  ["1011","wednesday","Wednesday","Period 2","class","09:10","10:22"],
  ["1011","wednesday","Wednesday","Break","break","10:22","10:27"],
  ["1011","wednesday","Wednesday","Lunch","lunch","10:27","11:07"],
  ["1011","wednesday","Wednesday","Break","break","11:07","11:12"],
  ["1011","wednesday","Wednesday","Period 3","class","11:12","12:25"],
  ["1011","wednesday","Wednesday","Break","break","12:25","12:30"],
  ["1011","wednesday","Wednesday","Period 4","class","12:30","13:45"],
  ["1011","wednesday","Wednesday","Break","break","13:45","13:50"],
  ["1011","wednesday","Wednesday","Clubs","class","13:50","14:25"]
];
const DEFAULT_CALENDAR = [
  ["2026-08-11","A","regular","",""],
  ["2026-08-12","B","wednesday","",""],
  ["2026-08-13","A","regular","",""],
  ["2026-08-14","B","regular","",""],
  ["2026-08-17","A","regular","",""],
  ["2026-08-18","B","regular","",""],
  ["2026-08-19","A","wednesday","",""],
  ["2026-08-20","B","regular","",""],
  ["2026-08-21","A","regular","",""],
  ["2026-08-24","B","regular","",""],
  ["2026-08-25","A","regular","",""],
  ["2026-08-26","B","wednesday","",""],
  ["2026-08-27","A","regular","",""],
  ["2026-08-28","B","regular","",""],
  ["2026-08-31","A","regular","",""],
  ["2026-09-01","B","regular","",""],
  ["2026-09-02","A","wednesday","",""],
  ["2026-09-03","B","regular","",""],
  ["2026-09-04","A","regular","",""],
  ["2026-09-07","","","Labor Day","break"],
  ["2026-09-08","B","regular","",""],
  ["2026-09-09","A","wednesday","",""],
  ["2026-09-10","B","regular","",""],
  ["2026-09-11","A","regular","",""],
  ["2026-09-14","B","regular","",""],
  ["2026-09-15","A","regular","",""],
  ["2026-09-16","B","wednesday","",""],
  ["2026-09-17","A","regular","",""],
  ["2026-09-18","B","regular","",""],
  ["2026-09-21","A","regular","",""],
  ["2026-09-22","B","regular","",""],
  ["2026-09-23","A","wednesday","",""],
  ["2026-09-24","B","regular","",""],
  ["2026-09-25","A","regular","",""],
  ["2026-09-28","B","regular","",""],
  ["2026-09-29","A","regular","",""],
  ["2026-09-30","B","wednesday","",""],
  ["2026-10-01","A","regular","",""],
  ["2026-10-02","B","regular","",""],
  ["2026-10-05","A","regular","",""],
  ["2026-10-06","B","regular","",""],
  ["2026-10-07","A","wednesday","",""],
  ["2026-10-08","B","regular","",""],
  ["2026-10-09","A","regular","the 1st marking period","end"],
  ["2026-10-12","","","the Oct 12 student holiday","break"],
  ["2026-10-13","B","regular","",""],
  ["2026-10-14","A","wednesday","",""],
  ["2026-10-15","B","regular","",""],
  ["2026-10-16","A","regular","",""],
  ["2026-10-19","B","regular","",""],
  ["2026-10-20","A","regular","",""],
  ["2026-10-21","B","wednesday","",""],
  ["2026-10-22","A","regular","",""],
  ["2026-10-23","B","regular","",""],
  ["2026-10-26","A","regular","",""],
  ["2026-10-27","B","regular","",""],
  ["2026-10-28","A","wednesday","",""],
  ["2026-10-29","B","regular","",""],
  ["2026-10-30","A","regular","",""],
  ["2026-11-02","B","regular","",""],
  ["2026-11-03","A","regular","",""],
  ["2026-11-04","B","wednesday","",""],
  ["2026-11-05","A","regular","",""],
  ["2026-11-06","B","regular","",""],
  ["2026-11-09","A","regular","",""],
  ["2026-11-10","B","regular","",""],
  ["2026-11-11","A","wednesday","",""],
  ["2026-11-12","B","regular","",""],
  ["2026-11-13","A","regular","",""],
  ["2026-11-16","B","regular","",""],
  ["2026-11-17","A","regular","",""],
  ["2026-11-18","B","wednesday","",""],
  ["2026-11-19","A","regular","",""],
  ["2026-11-20","B","regular","",""],
  ["2026-11-23","","","Thanksgiving Break","break"],
  ["2026-11-24","","","",""],
  ["2026-11-25","","","",""],
  ["2026-11-26","","","",""],
  ["2026-11-27","","","",""],
  ["2026-11-30","A","regular","",""],
  ["2026-12-01","B","regular","",""],
  ["2026-12-02","A","wednesday","",""],
  ["2026-12-03","B","regular","",""],
  ["2026-12-04","A","regular","",""],
  ["2026-12-07","B","regular","",""],
  ["2026-12-08","A","regular","",""],
  ["2026-12-09","B","wednesday","",""],
  ["2026-12-10","A","regular","",""],
  ["2026-12-11","B","regular","",""],
  ["2026-12-14","A","regular","",""],
  ["2026-12-15","B","regular","",""],
  ["2026-12-16","A","wednesday","",""],
  ["2026-12-17","B","regular","",""],
  ["2026-12-18","A","regular","the 2nd marking period","end"],
  ["2026-12-21","","","Winter Break","break"],
  ["2026-12-22","","","",""],
  ["2026-12-23","","","",""],
  ["2026-12-24","","","",""],
  ["2026-12-25","","","",""],
  ["2026-12-28","","","",""],
  ["2026-12-29","","","",""],
  ["2026-12-30","","","",""],
  ["2026-12-31","","","",""],
  ["2027-01-01","","","",""],
  ["2027-01-04","","","",""],
  ["2027-01-05","B","regular","",""],
  ["2027-01-06","A","wednesday","",""],
  ["2027-01-07","B","regular","",""],
  ["2027-01-08","A","regular","",""],
  ["2027-01-11","B","regular","",""],
  ["2027-01-12","A","regular","",""],
  ["2027-01-13","B","wednesday","",""],
  ["2027-01-14","A","regular","",""],
  ["2027-01-15","B","regular","",""],
  ["2027-01-18","","","MLK Day","break"],
  ["2027-01-19","A","regular","",""],
  ["2027-01-20","B","wednesday","",""],
  ["2027-01-21","A","regular","",""],
  ["2027-01-22","B","regular","",""],
  ["2027-01-25","A","regular","",""],
  ["2027-01-26","B","regular","",""],
  ["2027-01-27","A","wednesday","",""],
  ["2027-01-28","B","regular","",""],
  ["2027-01-29","A","regular","",""],
  ["2027-02-01","B","regular","",""],
  ["2027-02-02","A","regular","",""],
  ["2027-02-03","B","wednesday","",""],
  ["2027-02-04","A","regular","",""],
  ["2027-02-05","B","regular","",""],
  ["2027-02-08","A","regular","",""],
  ["2027-02-09","B","regular","",""],
  ["2027-02-10","A","wednesday","",""],
  ["2027-02-11","B","regular","",""],
  ["2027-02-12","A","regular","",""],
  ["2027-02-15","","","Presidents' Day","break"],
  ["2027-02-16","B","regular","",""],
  ["2027-02-17","A","wednesday","",""],
  ["2027-02-18","B","regular","",""],
  ["2027-02-19","A","regular","",""],
  ["2027-02-22","B","regular","",""],
  ["2027-02-23","A","regular","",""],
  ["2027-02-24","B","wednesday","",""],
  ["2027-02-25","A","regular","",""],
  ["2027-02-26","B","regular","",""],
  ["2027-03-01","A","regular","",""],
  ["2027-03-02","B","regular","",""],
  ["2027-03-03","A","wednesday","",""],
  ["2027-03-04","B","regular","",""],
  ["2027-03-05","A","regular","",""],
  ["2027-03-08","B","regular","",""],
  ["2027-03-09","A","regular","",""],
  ["2027-03-10","B","wednesday","",""],
  ["2027-03-11","A","regular","the 3rd marking period","end"],
  ["2027-03-12","","","",""],
  ["2027-03-15","","","Spring Break","break"],
  ["2027-03-16","","","",""],
  ["2027-03-17","","","",""],
  ["2027-03-18","","","",""],
  ["2027-03-19","","","",""],
  ["2027-03-22","B","regular","",""],
  ["2027-03-23","A","regular","",""],
  ["2027-03-24","B","wednesday","",""],
  ["2027-03-25","A","regular","",""],
  ["2027-03-26","B","regular","",""],
  ["2027-03-29","A","regular","",""],
  ["2027-03-30","B","regular","",""],
  ["2027-03-31","A","wednesday","",""],
  ["2027-04-01","B","regular","",""],
  ["2027-04-02","A","regular","",""],
  ["2027-04-05","B","regular","",""],
  ["2027-04-06","A","regular","",""],
  ["2027-04-07","B","wednesday","",""],
  ["2027-04-08","A","regular","",""],
  ["2027-04-09","B","regular","",""],
  ["2027-04-12","A","regular","",""],
  ["2027-04-13","B","regular","",""],
  ["2027-04-14","A","wednesday","",""],
  ["2027-04-15","B","regular","",""],
  ["2027-04-16","A","regular","",""],
  ["2027-04-19","B","regular","",""],
  ["2027-04-20","A","regular","",""],
  ["2027-04-21","B","wednesday","",""],
  ["2027-04-22","A","regular","",""],
  ["2027-04-23","","","the Apr 23 student holiday","break"],
  ["2027-04-26","B","regular","",""],
  ["2027-04-27","A","regular","",""],
  ["2027-04-28","B","wednesday","",""],
  ["2027-04-29","A","regular","",""],
  ["2027-04-30","B","regular","",""],
  ["2027-05-03","A","regular","",""],
  ["2027-05-04","B","regular","",""],
  ["2027-05-05","A","wednesday","",""],
  ["2027-05-06","B","regular","",""],
  ["2027-05-07","A","regular","",""],
  ["2027-05-10","B","regular","",""],
  ["2027-05-11","A","regular","",""],
  ["2027-05-12","B","wednesday","",""],
  ["2027-05-13","A","regular","",""],
  ["2027-05-14","B","regular","",""],
  ["2027-05-17","A","regular","",""],
  ["2027-05-18","B","regular","",""],
  ["2027-05-19","A","wednesday","",""],
  ["2027-05-20","B","regular","",""],
  ["2027-05-21","A","regular","",""],
  ["2027-05-24","B","regular","",""],
  ["2027-05-25","A","regular","",""],
  ["2027-05-26","B","wednesday","the school year","year"]
];

const SCHEDULE_HEAD = ['Student ID', 'Name', 'Block', 'Time', 'Teacher', 'Course', 'Room', 'Role', 'Grade'];
const TEACHERS_HEAD = ['Code', 'Teacher', 'Role', 'Active', 'Link', 'Note'];
const LOG_HEAD = ['Exit ID', 'Student ID', 'Section', 'Teacher', 'Room', 'Where', 'Out', 'Back', 'Minutes', 'Status', 'Outside window', 'Mode', 'Board', 'Guest name', 'Substitute', 'Sub room'];
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no 0/O, 1/I/L
const DEDUPE_ROWS = 3000;                                   // a repeated trip is recognised among the last rows

/* ===================== the boards ask ===================== */

function doGet(e) {
  const p = (e && e.parameter) || {};
  let body;
  try { body = route_(p); } catch (err) { body = { ok: false, error: 'server: ' + err.message }; }
  const json = JSON.stringify(body);
  if (p.callback && /^[\w$]+$/.test(p.callback)) {
    return ContentService.createTextOutput(p.callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {   // older boards posted here; the new ones use GET so that they can read the answer
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'old board: reload the page to update it' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function route_(p) {
  const a = p.action || '';
  if (a === 'messages') return { ok: true, messages: readMessages_() };           // no student data: no code needed
  if (a === 'alerts') {
    try { return { ok: true, alerts: readAlerts_() }; } catch (err) { return { ok: false, error: 'alerts: ' + err.message }; }
  }
  const t = teacherByCode_(p.code || p.key);                                       // everything below needs a personal code
  if (!t) { Utilities.sleep(400); return { ok: false, error: 'unknown code' }; }   // the pause slows guessing
  if (a === 'hello' || a === '') return hello_(t);
  if (a === 'log') return log_(t, p);
  if (a === 'lookup') return lookup_(t, p);
  if (a === 'prefs_get') return prefsGet_(t);
  if (a === 'prefs_set') return prefsSet_(t, p);
  if (a === 'suggest') return suggestName_(t, p);
  if (a === 'ann_set') return saveItems_(t, p, 'ann');
  if (a === 'qa_set') return saveItems_(t, p, 'qa');
  return { ok: false, error: 'unknown action' };
}

/* ===================== codes and teachers ===================== */

function norm_(c) { return String(c == null ? '' : c).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function teachers_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('teachers');
  if (hit) return JSON.parse(hit);
  const sh = sheet_(TAB.teachers), map = {};
  if (sh && sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(function (r) {
      const code = norm_(r[0]);
      if (!code) return;
      map[code] = { teacher: String(r[1]).trim(), role: String(r[2] || 'teacher').trim().toLowerCase() || 'teacher', active: /^(y|yes|true|1)$/i.test(String(r[3]).trim()) };
    });
  }
  cache.put('teachers', JSON.stringify(map), 60);       // a switched-off code stops working within a minute
  return map;
}

function teacherByCode_(raw) {
  const c = norm_(raw);
  if (c.length < 6) return null;
  const t = teachers_()[c];
  return (t && t.active && t.teacher) ? t : null;
}

/* ===================== hello: who is this, and which students ===================== */

function titleCase_(s) { return String(s || '').toLowerCase().replace(/(^|[\s\-'\u2019])([a-z\u00e0-\u00ff])/g, function (m, a, b) { return a + b.toUpperCase(); }); }

function splitName_(full) {            // "SMITH, JOHN PAUL" or "John Smith"
  const s = String(full || '').trim();
  let last = '', first = '';
  if (s.indexOf(',') >= 0) { last = s.split(',')[0].trim(); first = s.split(',').slice(1).join(' ').trim(); }
  else { const p = s.split(/\s+/); first = p[0] || ''; last = p.slice(1).join(' '); }
  return { first: titleCase_(first.split(/\s+/)[0] || ''), last: titleCase_(last) };
}

function uniqueNames_(students, pref) {      // "First L."; two of the same get more of the last name, then the end of the ID. A preferred first name (Names tab) replaces the official one
  const out = students.map(function (s) { const n = splitName_(s.name); return { id: s.id, first: (pref && pref[s.id]) ? pref[s.id] : n.first, last: n.last.replace(/[\s'\-]/g, ''), label: '' }; });
  const label = function (o, k) { return o.first + (o.last ? ' ' + o.last.slice(0, k) + (k >= o.last.length ? '' : '.') : ''); };
  let pending = out.slice();
  for (let k = 1; k <= 4 && pending.length; k++) {
    const groups = {};
    pending.forEach(function (o) { o.label = label(o, k); (groups[o.label] = groups[o.label] || []).push(o); });
    pending = [];
    Object.keys(groups).forEach(function (g) { if (groups[g].length > 1) groups[g].forEach(function (o) { pending.push(o); }); });
  }
  const seen = {};
  out.forEach(function (o) { seen[o.label] = (seen[o.label] || 0) + 1; });
  out.forEach(function (o) { if (seen[o.label] > 1) o.label = o.label + ' (' + String(o.id).slice(-3) + ')'; });
  return out.map(function (o) { return { n: o.label, id: String(o.id) }; })
    .sort(function (a, b) { return a.n < b.n ? -1 : a.n > b.n ? 1 : 0; });
}

function parseRange_(txt) {            // "11:00AM - 12:28PM" -> [660, 748] (minutes after midnight), or null
  const m = /^(\d{1,2}):(\d{2})([AP])M?-(\d{1,2}):(\d{2})([AP])M?$/i.exec(String(txt).replace(/\s+/g, ''));
  if (!m) return null;
  const mins = function (h, mi, ap) { h = Number(h) % 12; if (/p/i.test(ap)) h += 12; return h * 60 + Number(mi); };
  const a = mins(m[1], m[2], m[3]), b = mins(m[4], m[5], m[6]);
  return b > a ? [a, b] : null;
}

function sectionGroups_(rows) {        // a class whose students have different times (block 3, the two lunches): one group per time. null when everybody has the same time
  const map = {}, order = [];
  rows.forEach(function (r) {
    const k = String(r.time).replace(/\s+/g, '').toUpperCase();
    if (!map[k]) { map[k] = { time: r.time, grades: {} }; order.push(k); }
    if (r.grade) map[k].grades[r.grade] = 1;
  });
  if (order.length < 2) return null;
  const list = [];
  order.forEach(function (k) {
    const rg = parseRange_(map[k].time);
    if (rg) list.push({ key: k, start: rg[0], end: rg[1], grades: Object.keys(map[k].grades).map(Number).sort(function (a, b) { return a - b; }) });
  });
  list.sort(function (a, b) { return a.start - b.start; });
  if (list.length < 2) return null;
  const index = {};
  list.forEach(function (g, i) { index[g.key] = i; });
  return { groups: list.map(function (g) { return { start: g.start, end: g.end, grades: g.grades }; }), index: index };
}

function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function setting_(key, fallback) {
  const sh = sheet_(TAB.settings);
  if (!sh || sh.getLastRow() < 1) return fallback;
  const v = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  for (let i = 0; i < v.length; i++) {
    if (String(v[i][0]).trim().toLowerCase() === key) {
      const x = v[i][1];
      const s = (x instanceof Date) ? Utilities.formatDate(x, TZ, 'yyyy-MM-dd') : String(x).trim();
      return s === '' ? fallback : s;
    }
  }
  return fallback;
}

function semester_() { const d = setting_('semester2_start', ''); return (d && today_() >= d) ? 2 : 1; }

function teacherNames_() {              // the names of all teachers (no codes, no students): for choosing a substitute on a board
  const map = teachers_(), seen = {}, names = [];
  Object.keys(map).forEach(function (code) {
    const x = map[code];
    if (!x.active || x.role !== 'teacher' || x.teacher.toUpperCase() === 'LUNCH') return;
    const n = x.teacher.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
    if (!seen[n]) { seen[n] = 1; names.push(n); }
  });
  return names.sort();
}

function pad2_(n) { n = Number(n); return (n < 10 ? '0' : '') + n; }

function hhmm_(v) {                      // 07:50, 7:50, 7:50 AM, a time cell or a fraction of a day -> "07:50" ('' if it is not a time)
  if (v instanceof Date) {
    const p = Utilities.formatDate(v, TZ, 'HH:mm:ss').split(':').map(Number), total = p[0] * 60 + p[1] + (p[2] >= 30 ? 1 : 0);
    return pad2_(Math.floor(total / 60) % 24) + ':' + pad2_(total % 60);
  }
  if (typeof v === 'number') { if (!(v >= 0 && v < 1)) return ''; const m = Math.round(v * 1440); return pad2_(Math.floor(m / 60) % 24) + ':' + pad2_(m % 60); }
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*([AaPp][Mm])?\s*$/.exec(String(v));
  if (!m) return '';
  let h = Number(m[1]); const mi = Number(m[2]);
  if (mi > 59 || h > 23) return '';
  if (m[3]) { if (h < 1 || h > 12) return ''; h = h % 12 + (/p/i.test(m[3]) ? 12 : 0); }
  return pad2_(h) + ':' + pad2_(mi);
}

function isoDate_(v) {                   // a date cell, 2026-09-07 or 9/7/2026 -> "2026-09-07" ('' if it is not a date)
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  const t = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return m[1] + '-' + pad2_(m[2]) + '-' + pad2_(m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  return m ? m[3] + '-' + pad2_(m[1]) + '-' + pad2_(m[2]) : '';
}

function capital_(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

function buildSchool_() {               // the school's own bell schedules, calendar and names, from the Bells and Calendar tabs (null if there are none)
  const bs = sheet_(TAB.bells);
  if (!bs || bs.getLastRow() < 2) return null;
  const tables = {}, problems = [];
  bs.getRange(2, 1, bs.getLastRow() - 1, BELLS_HEAD.length).getValues().forEach(function (r, i) {
    const band = String(r[0]).replace(/\D/g, ''), type = String(r[1]).trim().toLowerCase().replace(/[^a-z0-9]/g, ''), kind = String(r[4]).trim().toLowerCase();
    const label = safeText_(r[3], 30), a = hhmm_(r[5]), b = hhmm_(r[6]);
    if (!band && !type && !label && !String(r[5]).trim()) return;                       // an empty line
    if ((band !== '912' && band !== '1011') || !type || !label || !a || !b || a >= b) { problems.push('Bells row ' + (i + 2)); return; }
    const tb = (tables[band] = tables[band] || {}), tt = (tb[type] = tb[type] || { label: '', rows: [] });
    if (!tt.label) tt.label = safeText_(r[2], 30);
    tt.rows.push({ label: label, type: (kind === 'break' || kind === 'lunch') ? kind : 'class', start: a, end: b });
  });
  Object.keys(tables).forEach(function (b) {
    Object.keys(tables[b]).forEach(function (t) {
      const x = tables[b][t];
      x.rows.sort(function (p, q) { return p.start < q.start ? -1 : p.start > q.start ? 1 : 0; });
      if (!x.label) x.label = capital_(t);
    });
  });
  if (!tables['912'] && !tables['1011']) return null;
  const calendar = {}, events = [], cs = sheet_(TAB.calendar);
  if (cs && cs.getLastRow() > 1) cs.getRange(2, 1, cs.getLastRow() - 1, CAL_HEAD.length).getValues().forEach(function (r, i) {
    if (!String(r[0]).trim() && !String(r[1]).trim() && !String(r[3]).trim()) return;
    const iso = isoDate_(r[0]);
    if (!iso) { problems.push('Calendar row ' + (i + 2)); return; }
    const letter = String(r[1]).trim().toUpperCase(), type = String(r[2]).trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'regular';
    calendar[iso] = (letter === 'A' || letter === 'B') ? letter + ' Day ' + capital_(type) : null;
    const name = safeText_(r[3], 60), kind = String(r[4]).trim().toLowerCase();
    if (name) { const ev = { name: name, date: iso, kind: kind === 'end' || kind === 'year' ? 'end' : 'break' }; if (kind === 'year') ev.year = true; events.push(ev); }
  });
  events.sort(function (p, q) { return p.date < q.date ? -1 : p.date > q.date ? 1 : 0; });
  return { name: safeText_(setting_('school_name', 'OSHS Bell Schedule'), 60), bands: { '912': safeText_(setting_('band_912_label', '9th-12th Grade'), 30), '1011': safeText_(setting_('band_1011_label', '10th-11th Grade'), 30) },
           tables: tables, calendar: calendar, events: events, problems: problems.length };
}

function school_() {
  const cache = CacheService.getScriptCache(), key = 'school:' + ver_(), hit = cache.get(key);
  if (hit) return hit === 'null' ? null : JSON.parse(hit);
  const out = buildSchool_();
  cache.put(key, out ? JSON.stringify(out) : 'null', 120);
  return out;
}

function ver_() {                       // changes whenever the names or the teacher's own announcements change: old answers stop being used
  const c = CacheService.getScriptCache();
  let v = c.get('ver');
  if (!v) { v = String(Date.now()); c.put('ver', v, 21600); }
  return v;
}
function bumpVer_() { const c = CacheService.getScriptCache(); c.put('ver', String(Date.now()) + Math.floor(Math.random() * 1000), 21600); c.remove('names'); }

function names_() {                     // student ID -> preferred first name (only the rows that are approved)
  const cache = CacheService.getScriptCache(), hit = cache.get('names');
  if (hit) return JSON.parse(hit);
  const sh = sheet_(TAB.names), map = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
    const id = String(r[0]).trim(), nm = safeText_(r[1], 30), status = String(r[2] || '').trim().toLowerCase();
    if (id && nm && (status === '' || status === 'ok' || status === 'yes' || status === 'approved')) map[id] = nm;
  });
  cache.put('names', JSON.stringify(map), 60);
  return map;
}

function flagsOf_(row, from) { return BLOCKS.filter(function (b, i) { const v = String(row[from + i] == null ? '' : row[from + i]).trim().toLowerCase(); return v !== '' && v !== '0' && v !== 'no' && v !== 'false'; }); }

function readItems_(tab, teacher, kind) {  // this teacher's announcements ({t, b}) or questions ({q, a, b}); b = the lessons they are shown in
  const sh = sheet_(tab), out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  const cols = kind === 'ann' ? ANN_HEAD.length : QA_HEAD.length;
  sh.getRange(2, 1, sh.getLastRow() - 1, cols).getValues().forEach(function (r) {
    if (String(r[0]).trim() !== teacher) return;
    if (kind === 'ann') { const t = safeText_(r[1], 140); if (t) out.push({ t: t, b: flagsOf_(r, 2) }); }
    else { const q = safeText_(r[1], 100), a = safeText_(r[2], 100); if (q && a) out.push({ q: q, a: a, b: flagsOf_(r, 3) }); }
  });
  return out;
}

function hello_(t) {
  const cache = CacheService.getScriptCache(), key = 'hello:' + ver_() + ':' + t.teacher + ':' + t.role;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const display = t.teacher.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  const res = { ok: true, teacher: t.teacher, display: display, role: t.role, semester: semester_(), sections: [], teachers: teacherNames_(), announcements: [], questions: [] };
  if (t.role === 'teacher') {
    const pref = names_(), sem = res.semester, byBlock = {};
    res.announcements = readItems_(TAB.announcements, t.teacher, 'ann');
    res.questions = readItems_(TAB.questions, t.teacher, 'qa');
    readSchedule_().forEach(function (r) {
      if (r.teacher !== t.teacher) return;
      if (r.role === 'S1' && sem !== 1) return;
      if (r.role === 'S2' && sem !== 2) return;
      (byBlock[r.block] = byBlock[r.block] || []).push(r);
    });
    ALL_BLOCKS.forEach(function (b) {
      const rows = byBlock[b];
      if (!rows) return;
      const sec = { block: b, time: rows[0].time, room: rows[0].room, course: rows[0].course,
                    students: uniqueNames_(rows.map(function (r) { return { id: r.id, name: r.name }; }), pref) };
      if (b === LUNCH) { const rg = parseRange_(rows[0].time); if (rg) { sec.start = rg[0]; sec.end = rg[1]; } }       // lunch times (a lunch with one time is found by them)
      const gr = sectionGroups_(rows);
      if (gr) {
        sec.groups = gr.groups;
        const of = {};
        rows.forEach(function (r) { const g = gr.index[String(r.time).replace(/\s+/g, '').toUpperCase()]; if (g !== undefined && of[r.id] === undefined) of[r.id] = g; });
        sec.students.forEach(function (st) { if (of[st.id] !== undefined) st.g = of[st.id]; });       // which group (time) the student belongs to
      }
      res.sections.push(sec);
    });
  }
  const sc = school_();
  if (sc) res.school = sc;
  const json = JSON.stringify(res);
  if (json.length < 90000) cache.put(key, json, 300);
  return res;
}

function lookup_(t, p) {                // a guest: "the last 4 digits of the ID" -> the names (usually one) that end that way
  const d = String(p.d || '').replace(/\D/g, '');
  if (d.length !== 4) return { ok: false, error: 'type the last 4 digits' };
  const seen = {}, found = [], pref = names_();
  readSchedule_().forEach(function (r) {
    if (r.id.slice(-4) !== d) return;
    const g = seen[r.id];
    if (g) { if (r.grade > g.grade) g.grade = r.grade; return; }
    const n = splitName_(r.name);
    seen[r.id] = { id: r.id, n: (pref[r.id] || n.first) + (n.last ? ' ' + n.last.charAt(0) + '.' : ''), grade: r.grade || 0 };
    found.push(seen[r.id]);
  });
  return { ok: true, matches: found.slice(0, 6) };
}

function prefsGet_(t) {                 // the school's defaults and this teacher's own settings (only the keys that may be shared)
  const cache = CacheService.getScriptCache(), key = 'prefs:' + ver_() + ':' + t.teacher, hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const school = {}, mine = {};
  const ds = sheet_(TAB.defaults);
  if (ds && ds.getLastRow() > 1) ds.getRange(2, 1, ds.getLastRow() - 1, 3).getValues().forEach(function (r) {
    const k = String(r[0]).trim(), v = String(r[1]).trim();
    if (PREF_KEY_RE.test(k) && v !== '') school[k] = { v: v, lock: /^(x|yes|true|1)$/i.test(String(r[2]).trim()) };
  });
  const ps = sheet_(TAB.prefs);
  if (ps && ps.getLastRow() > 1) ps.getRange(2, 1, ps.getLastRow() - 1, 4).getValues().forEach(function (r) {
    if (String(r[0]).trim() !== t.teacher) return;
    const k = String(r[1]).trim(), v = String(r[2]);
    if (PREF_KEY_RE.test(k) && v !== '') mine[k] = { v: v, t: Number(r[3]) || 0 };
  });
  const res = { ok: true, school: school, mine: mine };
  const json = JSON.stringify(res);
  if (json.length < 90000) cache.put(key, json, 300);
  return res;
}

function prefsSet_(t, p) {              // one setting of the teacher, in one or several parts (a long text is cut into pieces of about 1,200 characters)
  const k = String(p.k || '').trim(), stamp = Number(p.t) || 0;
  if (!PREF_KEY_RE.test(k)) return { ok: false, error: 'bad key' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cache = CacheService.getScriptCache();
    let value = '';
    if (String(p.d) !== '1') {
      const n = Math.max(1, Math.min(60, parseInt(p.n, 10) || 1)), i = parseInt(p.i, 10) || 0, x = String(p.x || '').replace(/[^\w\-]/g, '').slice(0, 24);
      if (i < 0 || i >= n) return { ok: false, error: 'bad part' };
      if (n === 1) value = String(p.v == null ? '' : p.v);
      else {
        if (!x) return { ok: false, error: 'bad transfer' };
        cache.put('pf:' + t.teacher + ':' + x + ':' + i, String(p.v == null ? '' : p.v), 3600);
        const parts = [];
        for (let j = 0; j < n; j++) { const piece = cache.get('pf:' + t.teacher + ':' + x + ':' + j); if (piece === null) return { ok: true, done: false, have: j }; parts.push(piece); }
        value = parts.join('');
        for (let j = 0; j < n; j++) cache.remove('pf:' + t.teacher + ':' + x + ':' + j);
      }
      if (value.length > PREF_MAX) return { ok: false, error: 'too long' };
      try { JSON.parse(value); } catch (e) { return { ok: false, error: 'bad value' }; }
    }
    const ds = sheet_(TAB.defaults);
    if (ds && ds.getLastRow() > 1) {
      const rows = ds.getRange(2, 1, ds.getLastRow() - 1, 3).getValues();
      for (let r = 0; r < rows.length; r++) if (String(rows[r][0]).trim() === k && /^(x|yes|true|1)$/i.test(String(rows[r][2]).trim())) return { ok: true, done: true, locked: true };
    }
    const sh = ensureTab_(TAB.prefs, PREFS_HEAD).sh, last = sh.getLastRow();
    let at = 0;
    if (last > 1) {
      const rows = sh.getRange(2, 1, last - 1, 4).getValues();
      for (let r = 0; r < rows.length; r++) if (String(rows[r][0]).trim() === t.teacher && String(rows[r][1]).trim() === k) { at = r + 2; if (Number(rows[r][3]) > stamp) return { ok: true, done: true, stale: true }; break; }
    }
    if (String(p.d) === '1') {
      if (at) { sh.getRange(at, 1, 1, 4).clearContent(); }
    } else if (at) {
      sh.getRange(at, 3).setNumberFormat('@'); sh.getRange(at, 3, 1, 2).setValues([[value, stamp]]);
    } else {
      sh.getRange(last + 1, 1, 1, 4).setNumberFormat('@');
      sh.getRange(last + 1, 1, 1, 4).setValues([[t.teacher, k, value, stamp]]);
    }
    bumpVer_();
    return { ok: true, done: true };
  } finally { lock.releaseLock(); }
}

function showPrefKeys() {
  say_('The settings that can be shared (Key; the Value on the School defaults tab is written as JSON):\n' +
       'extras.hallPass / cards / agenda / timer / ann / qa / live   (true or false)\n' +
       'stage.phases / arc / facts / riddles / messages / calendar / weather / alerts   (true or false), stage.cardSec (seconds)\n' +
       'pass.slots, pass.autoLeaveSec, pass.closedStartMin, pass.closedEndMin, pass.maxMinutes   (numbers)\n' +
       'pass.useWindow, pass.allowOutside   (true or false)   |   pass.reasons (a list), pass.limits (minutes per reason)\n' +
       'pass.profile.name, pass.profile.room   (text, e.g. "Room 214")\n' +
       'pin (text, e.g. "1234"), pinEnabled (true or false)\n' +
       'agenda.clearDaily, agenda.leadMin, agenda.texts.A1 ... B4   |   live.texts.A1 ... B4, live.sound\n' +
       'timer.duration / threshold (seconds), timer.thresholdUnit ("s" or "m"), timer.endOn / warnOn, timer.endSound / warnSound, timer.presets ("1,2,5,10")\n' +
       'countdownFormat ("hms" or "ms"), hour12 (true or false)\n\n' +
       'Locked = x on the School defaults tab means the teachers cannot change that setting.');
}

function makeDefaultsFromTeacher() {    // copy one teacher's settings to the School defaults (not locked)
  const ui = SpreadsheetApp.getUi();
  const r1 = ui.prompt('School defaults', 'A part of the teacher\'s name (for example the last name). All of that teacher\'s shared settings become the defaults for everybody who has not set their own:', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const q = String(r1.getResponseText()).trim().toUpperCase();
  if (q.length < 2) { say_('Type at least 2 letters.'); return; }
  const ps = sheet_(TAB.prefs);
  if (!ps || ps.getLastRow() < 2) { say_('There are no teacher settings yet.'); return; }
  const rows = ps.getRange(2, 1, ps.getLastRow() - 1, 4).getValues(), names = {};
  rows.forEach(function (r) { const n = String(r[0]).trim(); if (n && n.toUpperCase().indexOf(q) >= 0) names[n] = (names[n] || 0) + 1; });
  const list = Object.keys(names);
  if (list.length !== 1) { say_(list.length ? 'More than one teacher matches (' + list.join(', ') + '). Type more of the name.' : 'No teacher with saved settings matches "' + q + '".'); return; }
  const who = list[0], mine = rows.filter(function (r) { return String(r[0]).trim() === who && PREF_KEY_RE.test(String(r[1]).trim()) && String(r[2]) !== ''; });
  if (ui.alert('Make defaults from ' + who + '?', mine.length + ' settings will be written to the School defaults tab (settings of the same name there are replaced; Locked is left as it is). Teachers who changed a setting themselves keep their own.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const sh = ensureTab_(TAB.defaults, DEFAULTS_HEAD).sh, last = sh.getLastRow(), have = {};
  if (last > 1) sh.getRange(2, 1, last - 1, 4).getValues().forEach(function (r, i) { have[String(r[0]).trim()] = i + 2; });
  let next = last + 1;
  mine.forEach(function (r) {
    const k = String(r[1]).trim(), at = have[k];
    if (at) { sh.getRange(at, 2).setNumberFormat('@'); sh.getRange(at, 2).setValue(String(r[2])); }
    else { sh.getRange(next, 1, 1, 2).setNumberFormat('@'); sh.getRange(next, 1, 1, 4).setValues([[k, String(r[2]), '', 'from ' + who]]); next++; }
  });
  bumpVer_();
  say_('Done: ' + mine.length + ' settings from ' + who + ' are now the school defaults. Put an x in the Locked column of the ones the teachers must not change.');
}

function suggestName_(t, p) {          // a teacher suggests a preferred first name; it is used only after an administrator approves it
  if (t.role !== 'teacher') return { ok: false, error: 'this code cannot suggest names' };
  const id = String(p.s || '').trim(), nm = safeText_(p.n, 30);
  if (!/^\d{4,14}$/.test(id)) return { ok: false, error: 'bad student id' };
  if (!nm || /[0-9<>@=]/.test(nm)) return { ok: false, error: 'bad name' };
  if (!readSchedule_().some(function (r) { return r.id === id; })) return { ok: false, error: 'unknown student' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = ensureTab_(TAB.names, NAMES_HEAD).sh, last = sh.getLastRow();
    let mine = 0;
    if (last > 1) {
      const rows = sh.getRange(2, 1, last - 1, NAMES_HEAD.length).getValues();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], status = String(r[2] || '').trim().toLowerCase();
        if (String(r[0]).trim() === id && String(r[1]).trim().toLowerCase() === nm.toLowerCase() && status !== 'no') return { ok: true, dup: true };
        if (status === 'pending' && String(r[3]) === t.teacher) mine++;
      }
    }
    if (mine >= 10) return { ok: false, error: 'too many waiting suggestions' };
    sh.getRange(last + 1, 1).setNumberFormat('@');
    sh.getRange(last + 1, 1, 1, NAMES_HEAD.length).setValues([[id, nm, 'pending', t.teacher, today_(), '']]);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function saveItems_(t, p, kind) {       // a teacher saves his own announcements or questions (all of them at once); admins see them on the sheet
  if (t.role !== 'teacher') return { ok: false, error: 'this code cannot save' };
  let data;
  try { data = JSON.parse(String(p.data || '[]')); } catch (e) { return { ok: false, error: 'bad data' }; }
  if (!Array.isArray(data)) return { ok: false, error: 'bad data' };
  const ann = kind === 'ann', tab = ann ? TAB.announcements : TAB.questions, head = ann ? ANN_HEAD : QA_HEAD, cols = head.length, max = ann ? 8 : 12, rows = [];
  data.slice(0, max).forEach(function (x) {
    if (!x || typeof x !== 'object') return;
    const text = safeText_(ann ? x.t : x.q, ann ? 140 : 100), answer = ann ? '' : safeText_(x.a, 100);
    if (!text || (!ann && !answer)) return;
    const flags = BLOCKS.map(function (b) { return (Array.isArray(x.b) && x.b.indexOf(b) >= 0) ? 'x' : ''; });
    rows.push((ann ? [t.teacher, text] : [t.teacher, text, answer]).concat(flags, [today_()]));
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = ensureTab_(tab, head).sh, last = sh.getLastRow(), keep = [];
    if (last > 1) {
      sh.getRange(2, 1, last - 1, cols).getValues().forEach(function (r) { if (String(r[0]).trim() !== t.teacher) keep.push(r.slice(0, cols)); });
      sh.getRange(2, 1, last - 1, cols).clearContent();
    }
    const all = keep.concat(rows);
    if (all.length) sh.getRange(2, 1, all.length, cols).setValues(all);
    bumpVer_();
    return { ok: true, saved: rows.length };
  } finally { lock.releaseLock(); }
}

function readSchedule_() {
  const sh = sheet_(TAB.schedule), out = [];
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues().forEach(function (r) {
    if (!String(r[0]).trim()) return;
    out.push({ id: String(r[0]).trim(), name: String(r[1]), block: String(r[2]).trim().toUpperCase(), time: String(r[3]), teacher: String(r[4]).trim(),
              course: String(r[5]), room: String(r[6]), role: String(r[7] || 'YR').trim().toUpperCase(), grade: Number(String(r[8]).trim()) || 0 });
  });
  return out;
}

/* ===================== log: one finished trip -> one row on the single Log tab ===================== */

function safeText_(v, max) {            // free text for the sheet: no control characters, and never something a sheet would read as a formula
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[=+\-@]+/, '').trim().slice(0, max);
}
function cleanWhere_(w) { return safeText_(String(w || '').replace(/[^\w &'\/\-]/g, ''), 30); }

function log_(t, p) {
  if (t.role !== 'teacher') return { ok: false, error: 'this code cannot log trips' };
  const id = String(p.i || '');
  if (!/^[A-Za-z0-9_\-]{6,64}$/.test(id)) return { ok: false, error: 'bad trip id' };
  const tOut = Number(p.to), tIn = Number(p.ti), lo = 1577836800000, hi = 4102444800000;   // 2020 .. 2100
  if (!(tOut > lo && tOut < hi && tIn > lo && tIn < hi) || tIn < tOut - 5000) return { ok: false, error: 'bad times' };
  const status = String(p.st || 'Returned');
  if (status !== 'Returned' && status !== 'Cancelled') return { ok: false, error: 'bad status' };
  const studentId = /^\d{4,14}$/.test(String(p.s || '')) ? String(p.s) : '';
  const section = ALL_BLOCKS.indexOf(String(p.sec)) >= 0 ? String(p.sec) : (String(p.sec) === 'Guest' ? 'Guest' : '');
  const block = ALL_BLOCKS.indexOf(String(p.blk)) >= 0 ? String(p.blk) : (ALL_BLOCKS.indexOf(section) >= 0 ? section : '');
  let room = '';
  hello_(t).sections.forEach(function (s) { if (s.block === block) room = s.room; });
  const minutes = status === 'Returned' ? Math.round((tIn - tOut) / 6000) / 10 : '';
  const mode = String(p.m) === 'TEST' ? 'TEST' : 'LIVE';
  const row = [id, studentId, section, t.teacher, room, cleanWhere_(p.w), new Date(tOut), new Date(tIn), minutes, status,
               String(p.o) === '1' ? 'yes' : '', mode, String(p.b || '').replace(/[^\w\-]/g, '').slice(0, 24), safeText_(p.g, 40), safeText_(p.sb, 40), safeText_(p.sr, 12)];
  const guest = row[13], dupKey = id + '|' + t.teacher + '|' + studentId + '|' + guest;   // a plain date-and-time ID can repeat: the trip is the ID + teacher + student
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get('x:' + dupKey)) return { ok: true, dup: true };
    const sh = logSheet_();
    if (!String(sh.getRange(1, LOG_HEAD.length).getValue()).trim()) sh.getRange(1, 1, 1, LOG_HEAD.length).setValues([LOG_HEAD]).setFontWeight('bold');     // an older Log tab gets the new column titles
    const last = sh.getLastRow();
    if (last > 1) {                                       // a retry of something already written?
      const from = Math.max(2, last - DEDUPE_ROWS + 1);
      const rows = sh.getRange(from, 1, last - from + 1, LOG_HEAD.length).getValues();
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (String(r[0]) === id && r[3] === t.teacher && String(r[1]) === studentId && String(r[13]) === guest) { cache.put('x:' + dupKey, '1', 21600); return { ok: true, dup: true }; }
      }
    }
    sh.getRange(last + 1, 2).setNumberFormat('@');                                  // the student ID stays text on every new row, however far down
    sh.getRange(last + 1, 1, 1, row.length).setValues([row]);
    cache.put('x:' + dupKey, '1', 21600);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function logSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB.log);
  if (!sh) {
    sh = ss.insertSheet(TAB.log);
    sh.getRange(1, 1, 1, LOG_HEAD.length).setValues([LOG_HEAD]).setFontWeight('bold');
    sh.getRange(2, 2, sh.getMaxRows() - 1, 1).setNumberFormat('@');          // student IDs stay text
    sh.getRange(2, 7, sh.getMaxRows() - 1, 2).setNumberFormat('m/d/yyyy h:mm:ss AM/PM');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* ===================== the menu: set-up steps for the administrator ===================== */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Hall Pass')
    .addItem('1. Set up tabs', 'setupTabs')
    .addItem('2. Import schedule from Master', 'importSchedule')
    .addItem('3. Make teacher codes', 'makeTeacherCodes')
    .addItem('4. Make setup links', 'makeSetupLinks')
    .addSeparator()
    .addItem('Add a preferred name...', 'addPreferredName')
    .addItem('Approve waiting preferred names', 'approveNames')
    .addSeparator()
    .addItem('Make school defaults from a teacher...', 'makeDefaultsFromTeacher')
    .addItem('Show the setting keys', 'showPrefKeys')
    .addSeparator()
    .addItem('Check setup', 'checkSetup')
    .addItem('Clear the Master tab', 'clearMaster')
    .addToUi();
}

function sheet_(name) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name); }
function say_(msg) { SpreadsheetApp.getUi().alert(msg); }

function ensureTab_(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name), made = false;
  if (!sh) { sh = ss.insertSheet(name); made = true; }
  if (head && sh.getLastRow() === 0) { sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return { sh: sh, made: made };
}

function setupTabs() {
  const made = [];
  [[TAB.master, null], [TAB.schedule, SCHEDULE_HEAD], [TAB.teachers, TEACHERS_HEAD], [TAB.names, NAMES_HEAD], [TAB.announcements, ANN_HEAD], [TAB.questions, QA_HEAD], [TAB.bells, BELLS_HEAD], [TAB.calendar, CAL_HEAD], [TAB.prefs, PREFS_HEAD], [TAB.defaults, DEFAULTS_HEAD]].forEach(function (x) {
    const r = ensureTab_(x[0], x[1]); if (r.made) made.push(x[0]);
    if (r.sh.getLastRow() <= 1 && (x[0] === TAB.bells || x[0] === TAB.calendar)) {        // the sample school, to be replaced by yours
      const data = x[0] === TAB.bells ? DEFAULT_BELLS : DEFAULT_CALENDAR;
      r.sh.getRange(2, 1, data.length, data[0].length).setNumberFormat('@');                // text: dates and times stay as typed
      r.sh.getRange(2, 1, data.length, data[0].length).setValues(data);
    }
  });
  const st = ensureTab_(TAB.settings, null);
  if (st.made || st.sh.getLastRow() === 0) {
    st.sh.getRange(1, 1, 7, 3).setValues([
      ['site_url', 'https://orlandoscience.github.io/hallpass/', 'The address of the board (used for the setup links)'],
      ['semester2_start', '', 'The first day of the second semester, like 2027-01-11. Until then the first-semester classes are used.'],
      ['exclude_courses', '', 'Courses that are not classrooms, separated by commas (a part of the name is enough). Their students are not imported.'],
      ['script_url', '', 'The address of this script: Deploy -> Manage deployments -> the web app URL that ends in /exec. It goes into the setup links, so teachers never have to paste it. Do not publish it.'],
      ['school_name', 'OSHS Bell Schedule', 'The title at the top of the board.'],
      ['band_912_label', '9th-12th Grade', 'The name of the first group of grades on the board (its bell schedule is on the Bells tab under 912).'],
      ['band_1011_label', '10th-11th Grade', 'The name of the second group of grades (Bells tab, 1011).']]);
    if (st.made) made.push(TAB.settings);
  }
  if (!sheet_(TAB.log)) { logSheet_(); made.push(TAB.log); }
  SpreadsheetApp.getActiveSpreadsheet().setSpreadsheetTimeZone(TZ);
  say_('Tabs are ready' + (made.length ? ' (created: ' + made.join(', ') + ')' : '') + '. Next: paste the school\'s schedule export into the Master tab, then use "2. Import schedule from Master".');
}

function findCol_(head, names) {
  for (let i = 0; i < head.length; i++) { const h = String(head[i]).trim().toUpperCase(); if (names.indexOf(h) >= 0) return i; }
  return -1;
}

function importSchedule() {
  const m = sheet_(TAB.master);
  if (!m || m.getLastRow() < 2) { say_('The Master tab is empty. Paste the school\'s schedule export there first (header row included).'); return; }
  const v = m.getRange(1, 1, m.getLastRow(), m.getLastColumn()).getValues(), head = v[0];
  const c = { id: findCol_(head, ['STUDENT ID', 'STUDENTID', 'ID']), name: findCol_(head, ['NAME', 'STUDENT NAME', 'STUDENT']), block: findCol_(head, ['BLOCK']),
              time: findCol_(head, ['TIME']), teacher: findCol_(head, ['TEACHER']), course: findCol_(head, ['COURSE']), room: findCol_(head, ['ROOM']), role: findCol_(head, ['ROLE']), grade: findCol_(head, ['GRADE']) };
  const missing = ['id', 'name', 'block', 'teacher', 'room'].filter(function (k) { return c[k] < 0; });
  if (missing.length) { say_('The Master tab is missing these columns: ' + missing.join(', ') + '. Nothing was changed.'); return; }
  const exclude = String(setting_('exclude_courses', '')).split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  const rows = [], students = {}, teachers = {};
  const skippedBy = {}, roomCount = {}, roomOwner = {};
  let skipped = 0, excluded = 0, lunchRooms = 0, lunchCafe = 0;
  const roomKey = function (x) { return String(x).replace(/\s+/g, '').toUpperCase(); };
  v.slice(1).forEach(function (r) {                 // first: which teacher sits in which classroom (for lunch that is eaten in a classroom)
    const b = String(r[c.block]).trim().toUpperCase(), rm = roomKey(r[c.room]), tn = String(r[c.teacher]).trim();
    if (BLOCKS.indexOf(b) >= 0 && rm && tn) { roomCount[rm] = roomCount[rm] || {}; roomCount[rm][tn] = (roomCount[rm][tn] || 0) + 1; }
  });
  Object.keys(roomCount).forEach(function (rm) { roomOwner[rm] = Object.keys(roomCount[rm]).sort(function (a, b) { return roomCount[rm][b] - roomCount[rm][a]; })[0]; });
  v.slice(1).forEach(function (r) {
    let block = String(r[c.block]).trim().toUpperCase();
    const id = String(r[c.id]).trim();
    if (block.indexOf(LUNCH) === 0) block = LUNCH;
    if (ALL_BLOCKS.indexOf(block) < 0 || !id) { skipped++; const why = !id ? '(no student ID)' : (block || '(no block)'); skippedBy[why] = (skippedBy[why] || 0) + 1; return; }
    const course = c.course >= 0 ? String(r[c.course]).trim() : '';
    if (exclude.some(function (x) { return course.toLowerCase().indexOf(x) >= 0; })) { excluded++; return; }
    const role = c.role >= 0 ? (String(r[c.role]).trim().toUpperCase() || 'YR') : 'YR';
    rows.push([id, String(r[c.name]).trim(), block, c.time >= 0 ? String(r[c.time]).trim() : '', String(r[c.teacher]).trim(), course, String(r[c.room]).trim(), role, c.grade >= 0 ? String(r[c.grade]).trim() : '']);
    if (block === LUNCH) {                          // eaten in a classroom: that room's teacher is in charge; in the cafeteria: "Lunch"
      const rm = roomKey(r[c.room]), owner = rm && !/CAF/.test(rm) ? roomOwner[rm] : '';
      if (owner) { rows[rows.length - 1][4] = owner; lunchRooms++; } else { if (!rows[rows.length - 1][4]) rows[rows.length - 1][4] = 'Lunch'; lunchCafe++; }
    }
    students[id] = 1; teachers[rows[rows.length - 1][4]] = 1;
  });
  const s = ensureTab_(TAB.schedule, SCHEDULE_HEAD).sh;
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, SCHEDULE_HEAD.length).clearContent();   // (Range has clearContent, Sheet has clearContents)
  if (rows.length) {
    s.getRange(2, 1, rows.length, 1).setNumberFormat('@');
    s.getRange(2, 1, rows.length, SCHEDULE_HEAD.length).setValues(rows);
  }
  CacheService.getScriptCache().remove('teachers');
  say_('Imported ' + rows.length + ' class rows: ' + Object.keys(students).length + ' students, ' + Object.keys(teachers).length + ' teachers.\n' +
       'Lunch rows: ' + lunchRooms + ' eaten in a classroom (given to that room\'s teacher), ' + lunchCafe + ' in the cafeteria (teacher "Lunch").\n' +
       'Skipped ' + skipped + ' rows that are not in a class block A1-B4 or lunch' + (skipped ? ' (' + Object.keys(skippedBy).map(function (k) { return k + ': ' + skippedBy[k]; }).join(', ') + ')' : '') + (excluded ? ', and ' + excluded + ' rows of excluded courses' : '') + '.\n' +
       'Parent e-mails and the other Master columns were NOT copied. Next: "3. Make teacher codes", then clear the Master tab.');
}

function addPreferredName() {           // find the student by a part of the last name (or the last 4 digits), then type the name he wants to be called
  const ui = SpreadsheetApp.getUi();
  const r1 = ui.prompt('Preferred name', 'A part of the last name, or the last 4 digits of the student ID:', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const q = String(r1.getResponseText()).trim().toUpperCase();
  if (q.length < 2) { say_('Type at least 2 letters or 4 digits.'); return; }
  const seen = {}, list = [];
  readSchedule_().forEach(function (r) {
    if (seen[r.id]) return;
    if (/^\d{4}$/.test(q) ? r.id.slice(-4) === q : r.name.toUpperCase().indexOf(q) >= 0) { seen[r.id] = 1; list.push(r); }
  });
  if (!list.length) { say_('Nobody found for \"' + q + '\".'); return; }
  list.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
  const shown = list.slice(0, 9);
  const text = shown.map(function (r, i) { return (i + 1) + '. ' + titleCase_(r.name) + ' (grade ' + (r.grade || '?') + ', ID ...' + r.id.slice(-4) + ')'; }).join('\n') + (list.length > 9 ? '\n(' + (list.length - 9) + ' more: type more letters next time)' : '');
  const r2 = ui.prompt('Which student?', text + '\n\nType the number:', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const k = parseInt(r2.getResponseText(), 10);
  if (!(k >= 1 && k <= shown.length)) { say_('That was not one of the numbers. Nothing was saved.'); return; }
  const who = shown[k - 1];
  const r3 = ui.prompt('Preferred first name', 'The name that ' + titleCase_(who.name) + ' wants to be called:', ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK) return;
  const nm = safeText_(r3.getResponseText(), 30);
  if (!nm || /[0-9<>@=]/.test(nm)) { say_('That name cannot be used. Nothing was saved.'); return; }
  const sh = ensureTab_(TAB.names, NAMES_HEAD).sh, last = sh.getLastRow();
  sh.getRange(last + 1, 1).setNumberFormat('@');
  sh.getRange(last + 1, 1, 1, NAMES_HEAD.length).setValues([[who.id, nm, 'ok', 'administrator', today_(), '']]);
  bumpVer_();
  say_('Saved: boards will show \"' + nm + '\" instead of the official first name (within a few minutes).');
}

function approveNames() {               // the suggestions that teachers sent from the boards
  const sh = sheet_(TAB.names);
  if (!sh || sh.getLastRow() < 2) { say_('There are no suggestions.'); return; }
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, NAMES_HEAD.length).getValues(), waiting = [];
  rows.forEach(function (r, i) { if (String(r[2]).trim().toLowerCase() === 'pending') waiting.push(i); });
  if (!waiting.length) { say_('There are no waiting suggestions.'); return; }
  const ui = SpreadsheetApp.getUi();
  const text = waiting.slice(0, 12).map(function (i) { return '...' + String(rows[i][0]).slice(-4) + '  ->  ' + rows[i][1] + '  (from ' + rows[i][3] + ')'; }).join('\n') + (waiting.length > 12 ? '\n(and ' + (waiting.length - 12) + ' more)' : '');
  if (ui.alert('Approve ' + waiting.length + ' waiting preferred name(s)?', text + '\n\nYES approves them all. To refuse one, set its Status to "no" on the Names tab first.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  waiting.forEach(function (i) { sh.getRange(i + 2, 3).setValue('ok'); });
  bumpVer_();
  say_('Approved ' + waiting.length + '.');
}

function randomCode_() {
  const h = Utilities.getUuid().replace(/-/g, '');
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET.charAt(parseInt(h.substr(i * 2, 2), 16) % CODE_ALPHABET.length);
  return s;
}

function makeTeacherCodes() {
  const t = ensureTab_(TAB.teachers, TEACHERS_HEAD).sh;
  const have = {}, codes = {};
  if (t.getLastRow() > 1) t.getRange(2, 1, t.getLastRow() - 1, 2).getValues().forEach(function (r) { codes[norm_(r[0])] = 1; have[String(r[1]).trim()] = 1; });
  const names = {};
  readSchedule_().forEach(function (r) { if (r.teacher) names[r.teacher] = 1; });
  const add = Object.keys(names).sort().filter(function (n) { return !have[n]; });
  const rows = add.map(function (n) {
    let c; do { c = randomCode_(); } while (codes[c]);
    codes[c] = 1;
    return [c, n, 'teacher', 'yes', '', ''];
  });
  if (rows.length) t.getRange(t.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
  CacheService.getScriptCache().remove('teachers');
  say_(rows.length ? 'Added ' + rows.length + ' teachers with new codes. Next: "4. Make setup links".' : 'Every teacher in the Schedule already has a code.');
}

const SCRIPT_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

function makeSetupLinks() {
  const t = sheet_(TAB.teachers);
  if (!t || t.getLastRow() < 2) { say_('There are no teachers yet. Use "3. Make teacher codes" first.'); return; }
  const base = String(setting_('site_url', 'https://orlandoscience.github.io/hallpass/')).replace(/#.*$/, '');
  const url = String(setting_('script_url', '')).trim(), hasUrl = SCRIPT_URL_RE.test(url);
  const v = t.getRange(2, 1, t.getLastRow() - 1, 1).getValues().map(function (r) { return [norm_(r[0]) ? base + '#code=' + norm_(r[0]) + (hasUrl ? '&u=' + encodeURIComponent(url) : '') : '']; });
  t.getRange(2, 5, v.length, 1).setValues(v);
  say_('Setup links written to column E of the Teachers tab. Each teacher opens their own link once on the classroom board. Do not publish the links.' +
       (hasUrl ? '\nThey carry the script address too, so nobody has to paste it.' : '\nWARNING: the Settings tab has no valid script_url (the web app address that ends in /exec), so these links carry only the code and the teachers would have to paste the address. Add it and run this step again.'));
}

function checkSetup() {
  const lines = [];
  const sch = readSchedule_(), tc = teachers_();
  const ids = {}, tn = {};
  sch.forEach(function (r) { ids[r.id] = 1; tn[r.teacher] = 1; });
  lines.push('Schedule: ' + sch.length + ' rows, ' + Object.keys(ids).length + ' students, ' + Object.keys(tn).length + ' teachers.');
  const active = Object.keys(tc).filter(function (k) { return tc[k].active; });
  const coded = {}; Object.keys(tc).forEach(function (k) { coded[tc[k].teacher] = 1; });
  const without = Object.keys(tn).filter(function (n) { return !coded[n]; });
  lines.push('Teachers tab: ' + Object.keys(tc).length + ' codes, ' + active.length + ' active.' + (without.length ? ' ' + without.length + ' teachers in the Schedule have no code yet.' : ''));
  lines.push('Script address: ' + (SCRIPT_URL_RE.test(String(setting_('script_url', '')).trim()) ? 'set (it goes into the setup links).' : 'NOT set: add script_url to the Settings tab, or the setup links carry only the code.'));
  const sc = buildSchool_();
  if (!sc) lines.push('Bells and calendar: none on the Bells tab, boards use the built-in sample.');
  else {
    const days = Object.keys(sc.calendar).filter(function (k) { return sc.calendar[k]; }).sort();
    lines.push('Bells and calendar: ' + Object.keys(sc.tables).length + ' grade group(s), ' + days.length + ' school days (' + (days[0] || '?') + ' to ' + (days[days.length - 1] || '?') + '), ' + sc.events.length + ' events' + (sc.problems ? ', ' + sc.problems + ' rows NOT understood (check the Bells and Calendar tabs)' : '') + '.');
  }
  const sem = setting_('semester2_start', '');
  lines.push('Semester: now ' + semester_() + (sem ? ' (second semester starts ' + sem + ')' : ' (set semester2_start on the Settings tab)') + '.');
  const lg = sheet_(TAB.log);
  lines.push('Log: ' + (lg ? Math.max(0, lg.getLastRow() - 1) + ' trips so far.' : 'not created yet (it is created by "1. Set up tabs" or by the first trip).'));
  const m = sheet_(TAB.master);
  if (m && m.getLastRow() > 1) lines.push('REMINDER: the Master tab still holds the export (with parent e-mails). Clear it when the import is done.');
  say_(lines.join('\n'));
}

function clearMaster() {
  const m = sheet_(TAB.master);
  if (!m || m.getLastRow() === 0) { say_('The Master tab is already empty.'); return; }
  const ui = SpreadsheetApp.getUi();
  if (ui.alert('Clear the Master tab?', 'This deletes the pasted export (the Schedule tab is not touched).', ui.ButtonSet.YES_NO) === ui.Button.YES) {
    m.clearContents(); say_('The Master tab is empty.');
  }
}

/* ===================== announcements and weather warnings (no student data) ===================== */

// Messages tab: one announcement per row. A = the text, B = show from (optional), C = show until (optional).
function readMessages_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TAB.messages);
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

// Weather warnings from the National Weather Service (a browser can't send the User-Agent header api.weather.gov asks for).
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
    return { event: p.event || '', severity: p.severity || '', urgency: p.urgency || '', ends: p.ends || p.expires || '', headline: p.headline || '' };
  }).filter(function (a) { return a.event; });
  cache.put('alerts', JSON.stringify(out), 240);   // 4 minutes, so several boards don't hammer NWS
  return out;
}

// Run this once from the editor (select "authorize" above the code, press Run) and allow access,
// so the script is permitted to contact the weather service.
function authorize() {
  UrlFetchApp.fetch('https://api.weather.gov/');
}

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
const TAB = { master: 'Master', schedule: 'Schedule', teachers: 'Teachers', settings: 'Settings', log: 'Log', messages: 'Messages' };
const BLOCKS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'];
const SCHEDULE_HEAD = ['Student ID', 'Name', 'Block', 'Time', 'Teacher', 'Course', 'Room', 'Role', 'Grade'];
const TEACHERS_HEAD = ['Code', 'Teacher', 'Role', 'Active', 'Link', 'Note'];
const LOG_HEAD = ['Exit ID', 'Student ID', 'Section', 'Teacher', 'Room', 'Where', 'Out', 'Back', 'Minutes', 'Status', 'Outside window', 'Mode', 'Board', 'Guest name'];
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

function uniqueNames_(students) {      // "First L."; two of the same get more of the last name, then the end of the ID
  const out = students.map(function (s) { const n = splitName_(s.name); return { id: s.id, first: n.first, last: n.last.replace(/[\s'\-]/g, ''), label: '' }; });
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

function sectionGroups_(rows) {        // a class whose students have different times (block 3: the two lunch groups): one group per time
  const map = {}, order = [];
  rows.forEach(function (r) {
    const k = String(r.time).replace(/\s+/g, '').toUpperCase();
    if (!map[k]) { map[k] = { time: r.time, grades: {} }; order.push(k); }
    if (r.grade) map[k].grades[r.grade] = 1;
  });
  if (order.length < 2) return null;
  const groups = [];
  order.forEach(function (k) {
    const rg = parseRange_(map[k].time);
    if (rg) groups.push({ start: rg[0], end: rg[1], grades: Object.keys(map[k].grades).map(Number).sort(function (a, b) { return a - b; }) });
  });
  groups.sort(function (a, b) { return a.start - b.start; });
  return groups.length > 1 ? groups : null;
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

function hello_(t) {
  const cache = CacheService.getScriptCache(), key = 'hello:' + t.teacher + ':' + t.role;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const display = t.teacher.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  const res = { ok: true, teacher: t.teacher, display: display, role: t.role, semester: semester_(), sections: [] };
  if (t.role === 'teacher') {
    const sem = res.semester, byBlock = {};
    readSchedule_().forEach(function (r) {
      if (r.teacher !== t.teacher) return;
      if (r.role === 'S1' && sem !== 1) return;
      if (r.role === 'S2' && sem !== 2) return;
      (byBlock[r.block] = byBlock[r.block] || []).push(r);
    });
    BLOCKS.forEach(function (b) {
      const rows = byBlock[b];
      if (!rows) return;
      const sec = { block: b, time: rows[0].time, room: rows[0].room, course: rows[0].course,
                    students: uniqueNames_(rows.map(function (r) { return { id: r.id, name: r.name }; })) };
      const groups = sectionGroups_(rows);
      if (groups) sec.groups = groups;
      res.sections.push(sec);
    });
  }
  const json = JSON.stringify(res);
  if (json.length < 90000) cache.put(key, json, 300);
  return res;
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

function cleanWhere_(w) { return String(w || '').replace(/[^\w &'\/\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30); }

function log_(t, p) {
  if (t.role !== 'teacher') return { ok: false, error: 'this code cannot log trips' };
  const id = String(p.i || '');
  if (!/^[A-Za-z0-9_\-]{6,64}$/.test(id)) return { ok: false, error: 'bad trip id' };
  const tOut = Number(p.to), tIn = Number(p.ti), lo = 1577836800000, hi = 4102444800000;   // 2020 .. 2100
  if (!(tOut > lo && tOut < hi && tIn > lo && tIn < hi) || tIn < tOut - 5000) return { ok: false, error: 'bad times' };
  const status = String(p.st || 'Returned');
  if (status !== 'Returned' && status !== 'Cancelled') return { ok: false, error: 'bad status' };
  const studentId = /^\d{4,14}$/.test(String(p.s || '')) ? String(p.s) : '';
  const section = BLOCKS.indexOf(String(p.sec)) >= 0 ? String(p.sec) : (String(p.sec) === 'Guest' ? 'Guest' : '');
  const block = BLOCKS.indexOf(String(p.blk)) >= 0 ? String(p.blk) : (BLOCKS.indexOf(section) >= 0 ? section : '');
  let room = '';
  hello_(t).sections.forEach(function (s) { if (s.block === block) room = s.room; });
  const minutes = status === 'Returned' ? Math.round((tIn - tOut) / 6000) / 10 : '';
  const mode = String(p.m) === 'TEST' ? 'TEST' : 'LIVE';
  const row = [id, studentId, section, t.teacher, room, cleanWhere_(p.w), new Date(tOut), new Date(tIn), minutes, status,
               String(p.o) === '1' ? 'yes' : '', mode, String(p.b || '').replace(/[^\w\-]/g, '').slice(0, 24), String(p.g || '').replace(/[\r\n]/g, ' ').trim().slice(0, 40)];
  const guest = row[13], dupKey = id + '|' + t.teacher + '|' + studentId + '|' + guest;   // a plain date-and-time ID can repeat: the trip is the ID + teacher + student
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get('x:' + dupKey)) return { ok: true, dup: true };
    const sh = logSheet_();
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
  [[TAB.master, null], [TAB.schedule, SCHEDULE_HEAD], [TAB.teachers, TEACHERS_HEAD]].forEach(function (x) {
    const r = ensureTab_(x[0], x[1]); if (r.made) made.push(x[0]);
  });
  const st = ensureTab_(TAB.settings, null);
  if (st.made || st.sh.getLastRow() === 0) {
    st.sh.getRange(1, 1, 3, 3).setValues([
      ['site_url', 'https://orlandoscience.github.io/hallpass/', 'The address of the board (used for the setup links)'],
      ['semester2_start', '', 'The first day of the second semester, like 2027-01-11. Until then the first-semester classes are used.'],
      ['exclude_courses', '', 'Courses that are not classrooms, separated by commas (a part of the name is enough). Their students are not imported.']]);
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
  const skippedBy = {};
  let skipped = 0, excluded = 0;
  v.slice(1).forEach(function (r) {
    const block = String(r[c.block]).trim().toUpperCase(), id = String(r[c.id]).trim();
    if (BLOCKS.indexOf(block) < 0 || !id) { skipped++; const why = !id ? '(no student ID)' : (block || '(no block)'); skippedBy[why] = (skippedBy[why] || 0) + 1; return; }
    const course = c.course >= 0 ? String(r[c.course]).trim() : '';
    if (exclude.some(function (x) { return course.toLowerCase().indexOf(x) >= 0; })) { excluded++; return; }
    const role = c.role >= 0 ? (String(r[c.role]).trim().toUpperCase() || 'YR') : 'YR';
    rows.push([id, String(r[c.name]).trim(), block, c.time >= 0 ? String(r[c.time]).trim() : '', String(r[c.teacher]).trim(), course, String(r[c.room]).trim(), role, c.grade >= 0 ? String(r[c.grade]).trim() : '']);
    students[id] = 1; teachers[String(r[c.teacher]).trim()] = 1;
  });
  const s = ensureTab_(TAB.schedule, SCHEDULE_HEAD).sh;
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, SCHEDULE_HEAD.length).clearContent();   // (Range has clearContent, Sheet has clearContents)
  if (rows.length) {
    s.getRange(2, 1, rows.length, 1).setNumberFormat('@');
    s.getRange(2, 1, rows.length, SCHEDULE_HEAD.length).setValues(rows);
  }
  CacheService.getScriptCache().remove('teachers');
  say_('Imported ' + rows.length + ' class rows: ' + Object.keys(students).length + ' students, ' + Object.keys(teachers).length + ' teachers.\n' +
       'Skipped ' + skipped + ' rows that are not in a class block A1-B4' + (skipped ? ' (' + Object.keys(skippedBy).map(function (k) { return k + ': ' + skippedBy[k]; }).join(', ') + ')' : '') + (excluded ? ', and ' + excluded + ' rows of excluded courses' : '') + '.\n' +
       'Parent e-mails and the other Master columns were NOT copied. Next: "3. Make teacher codes", then clear the Master tab.');
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

function makeSetupLinks() {
  const t = sheet_(TAB.teachers);
  if (!t || t.getLastRow() < 2) { say_('There are no teachers yet. Use "3. Make teacher codes" first.'); return; }
  const base = String(setting_('site_url', 'https://orlandoscience.github.io/hallpass/')).replace(/#.*$/, '');
  const v = t.getRange(2, 1, t.getLastRow() - 1, 1).getValues().map(function (r) { return [norm_(r[0]) ? base + '#code=' + norm_(r[0]) : '']; });
  t.getRange(2, 5, v.length, 1).setValues(v);
  say_('Setup links written to column E of the Teachers tab. Each teacher opens their own link once on the classroom board. Do not publish the links.');
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

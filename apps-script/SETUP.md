# Administrator's guide: the school's Google Sheet

One Google Sheet in the **school's account** holds everything. Teachers never open it: their boards talk to a small script with a personal **teacher code**.

| Tab | What it is | Who fills it |
|---|---|---|
| `Master` | The school's schedule export, pasted once. It may contain parent e-mails, so it is **cleared after the import**. | You |
| `Schedule` | The clean copy the boards use: student ID, name, block, time, teacher, course, room, role, grade. | The import |
| `Teachers` | One row per teacher: code, name, role, active, setup link. | "Make teacher codes" |
| `Settings` | `site_url`, `semester2_start`, `exclude_courses`, `script_url`, `school_name` (the title on the board), `band_912_label` and `band_1011_label` (the names of the two grade groups). | You |
| `Teacher settings` | The settings of each teacher: teacher, key, value (JSON), when it was changed. Written by the boards; you may read and fix it. | The boards |
| `School defaults` | Settings for everybody: key, value (JSON), **Locked** (x = teachers cannot change it), note. | You |
| `Bells` | The school's bell schedules: one row per part of the day (band, day type, day name, label, kind, start, end). | You (a sample school is put there first) |
| `Calendar` | The school's calendar: one row per date (the day letter A or B, the type of day, an event name and its kind). | You (a sample school is put there first) |
| `Log` | **One tab**, one row per finished trip. Never split by week. | The boards |
| `Messages` | Optional school-wide announcements: A = text, B = show from, C = show until. | You |
| `Names` | Preferred first names: student ID, preferred name, status (`ok` or empty = used, `pending` = waits for you, `no` = refused), who suggested it, date, note. | You (menu) and the teachers' boards (suggestions) |
| `Announcements` | The teachers' own announcements: teacher, text, and an `x` under each lesson (A1..B4) it is shown in. | The teachers, from their boards; you can read and edit |
| `Questions` | The teachers' own quick questions: teacher, question, answer, and an `x` under each lesson. | The teachers, from their boards; you can read and edit |

## 1. Put the script in the sheet

1. Open the school's sheet (or create one). **Extensions -> Apps Script**.
2. Delete the old code, paste the whole of `Code.gs`, press **Save**.
3. **Deploy -> Manage deployments**, pencil, *Version: New version*, **Deploy**. The web app address stays the same, so the boards keep working.
   *(First time ever: Deploy -> New deployment -> Web app, Execute as **Me**, Who has access **Anyone**, copy the address into the `script_url` row of the `Settings` tab. It is **not** written anywhere public: **4. Make setup links** puts it into each teacher's personal link (`...#code=CODE&u=ADDRESS`), which you send by e-mail; the board takes it from the link once and the link is cleared from the address bar. Without an address the boards stay disconnected.)*
4. Reload the sheet. A menu **Hall Pass** appears. The first run asks for permission: Review permissions -> your account -> Advanced -> Go to the project -> Allow.

"Anyone" means anybody *with the address* can send a request, but the script answers nothing without a valid teacher code.

## 2. Set up the tabs and the schedule

1. **Hall Pass -> 1. Set up tabs.** Creates `Master`, `Schedule`, `Teachers`, `Settings`, `Log` and puts the sheet on New York time.
2. Open the school's schedule export and copy everything, **header row included**, into the `Master` tab (cell A1). Needed columns: `STUDENT ID`, `NAME`, `BLOCK`, `TIME`, `TEACHER`, `COURSE`, `ROOM`, `ROLE`, `GRADE` (the other columns are ignored; `GRADE` is only used to say which grades are in a class with two times).
3. On `Settings`: write the first day of the second semester in `semester2_start` (like `2027-01-11`), and in `exclude_courses` the courses that are not classrooms, separated by commas (for example `Full-Time No OSS, Dual Enrollment`).
4. **Hall Pass -> 2. Import schedule from Master.** It keeps the blocks A1-A4 and B1-B4 **and the LUNCH rows**, and copies **only the needed columns** (no parent e-mails). Student IDs stay text, so a leading zero is not lost. Run it again after a new export: it replaces the `Schedule` tab.

**Lunch.** Lunch is a section of its own (`LUNCH`). A lunch eaten in the **cafeteria** belongs to the teacher named `Lunch` (one code for the cafeteria board; the log says `Lunch` in the Teacher column). A lunch eaten in a **classroom** (a room that is the room of a teacher) goes to that room's teacher, so those students are in that teacher's list during their lunch. The two lunch times are two groups: a board shows only the students whose lunch is on right now (the big cafeteria list uses the first-letter strip). Run the import again, then **3. Make teacher codes** (it adds the code for `Lunch`).
5. **Hall Pass -> Clear the Master tab** (answer Yes). The sensitive export is gone, `Schedule` stays.

**Classes with two times.** In block 3 the two lunch groups have different class times (11:00-12:28 and 11:45-1:13). When the students of one class (for example Dual Enrollment) have more than one time, the board draws the lesson bar with the 10/10 zones of **each** group (four red zones) and says which grades are in the room. **In every red zone passes are closed for everybody in the room** (the general rule), and the exception "allow passes in the closed minutes" works in all of them. The list of names shows only the students who are in the room at that time by their own schedule. Run the import again after adding the `Grade` column: older `Schedule` tabs without it still work, the strip then says "Group 1 / Group 2".

**Semesters.** A course with ROLE `YR` counts all year, `S1` until `semester2_start`, `S2` from that day. Until the date is set, the first semester is used.

## 3. Teacher codes

1. **Hall Pass -> 3. Make teacher codes.** One row per teacher found in `Schedule`, with a random 8-character code (no 0/O, 1/I/L). Running it again adds only new teachers and never changes an existing code.
2. **Hall Pass -> 4. Make setup links.** Column E gets a personal link for each teacher: the site address + `#code=CODE`.
3. Send each teacher their own link (or just the code). On the classroom board the teacher opens the link once; the code is saved on that board and disappears from the address bar. A code can also be typed at *Settings -> Teacher code*.
4. **Do not publish codes or links.** Anyone with a code can read that teacher's student list and write to the log in that teacher's name.

The `Teacher` text must be exactly the one in the schedule export (`First.Last`). If a teacher's name changes, change it in both `Schedule` and `Teachers`.

- **Switch a teacher off:** set `Active` to `no`. It takes effect within a minute.
- **Lost or leaked code:** type a new code over the old one in column A (8 letters and digits). The old board is locked within a minute.
- **A different role:** `admin` codes can say hello but get no student lists and cannot write to the log.

## 4. The log

One row per finished trip, appended to the **`Log`** tab:

| Column | Meaning |
|---|---|
| Exit ID | The date and times of the trip: the day, the time out and the time back, for example `20261027113215113412` (2026-10-27, out 11:32:15, back 11:34:12). A trip sent twice is recognised (same ID, teacher and student) and written once. |
| Student ID | Text. Names are **not** in the log: look them up in `Schedule`. |
| Section | The class (A1...B4), or `Guest` for a student who is not on the teacher's list. |
| Teacher, Room | Filled in by the script from the code and the schedule. They cannot be faked by a board. |
| Where | Restroom, Locker, Water, Office, Nurse, Other (the teacher may add others). |
| Out, Back, Minutes | Real date-times; minutes only for `Returned`. |
| Status | `Returned`, or `Cancelled` (Undo, or a cancelled pass; Back is the time Cancel was tapped). |
| Outside window | `yes` when a pass was given in the closed 10/10 minutes. |
| Mode, Board | `LIVE` or `TEST`; which classroom screen sent it. Filter `TEST` out of reports. |
| Guest name | A visitor typed by hand, or found by the last 4 digits of the ID (then the Student ID is filled in too). |
| Substitute | The name of the substitute teacher who was in charge when the trip started (empty otherwise). The Teacher column keeps the teacher whose code the board uses. |
| Sub room | The substitute's room, if one was entered. |

Tip: **Data -> Create a filter**, or build a pivot table on this tab. About 600-1,000 trips a day is roughly 150,000 rows a year, well inside the limits of one tab. When a year ends, copy the sheet and start a fresh `Log`.

## Changing the teacher on a board

*Settings -> Teacher code and hall pass log -> **Disconnect this board***, then type the new teacher's code (or open the new teacher's setup link on that board). The old code and the old student lists are forgotten. Trips that were still waiting to be sent **stay marked with the teacher who made them** and are sent only when that teacher's code is typed on a board again; they are never sent under the new teacher's name. *Delete waiting trips* (two taps) removes them for good. A student who is still out when the code is changed can still be returned; his trip stays the first teacher's.

## 5. Check and troubleshoot

- **Hall Pass -> Check setup** shows the counts (students, teachers, codes, semester, log rows) and reminds you if `Master` still holds the export.
- "Code not recognized" on a board: a typo, `Active` is `no`, or it was just changed (wait a minute).
- A teacher gets no students: the name in `Teachers` is not exactly the one in `Schedule`, or that teacher has no class in the current semester.
- Names show as `Alex Br.` and `Alex Ba.`: two students share a first name, so more of the last name is shown. Identical names get the end of the ID, like `Alex Smith (001)`.
- The old log tab `HallPass` from the first version may stay or be deleted. Boards no longer write to it.
- Announcements and weather warnings need no code. For warnings, once: in the script editor choose the function `authorize`, press Run, and allow access.

## 6. Privacy checklist

- Share the sheet with administrators only. The `Schedule` tab holds student names.
- Clear `Master` after every import. The boards and the log never carry parent e-mails.
- A board only ever receives the students of its own teacher's classes.
- Boards store the code, the student lists and waiting trips in the browser of that device. *Settings -> Disconnect this board* wipes the code and the lists.

## Substitute teachers

On a board, tap the **teacher's name** at the top of the right half. The board asks for the PIN (or the master code, even when the PIN for the settings is off), then a window asks for the substitute's name (a list of all teachers, or type any name, for example a visitor), the room (optional) and, if wanted, ticks for the other lessons of that teacher (a whole day or half a day). Without a tick it lasts for the lesson it was entered for. It is shown at the top in colour ("for <teacher>") and written to the `Substitute` and `Sub room` columns of the Log; it ends by itself when the lesson ends, comes back in the ticked lessons, and is forgotten the next day. Someone else coming in can write a new name over it.

## Guests by the last 4 digits of the ID

In the "Someone else" window the teacher can type the last 4 digits of any student's ID and press *Look up*: the script answers with the names (First L.) and grade of the students whose ID ends with them, from the whole school (up to 6). Tapping one fills in the name and the student ID for the log. This needs the teacher code. A name can still be typed by hand.

## Preferred names

A student who does not want to be called by the official first name: put a row on the `Names` tab, or use the menu **Hall Pass -> Add a preferred name...**: type a part of the last name (or the last 4 digits of the ID), pick the student from the numbered list, type the name. The boards then show the preferred first name with the first letter of the official last name ("Alex B.") in every list: all classes, lunch, the guest look-up and the substitute lists. It applies to every teacher at once, within a few minutes (the menu action makes it immediate). The Log keeps only the student ID, so the official name is seen only on the `Schedule` tab.

Teachers can **suggest** a name from their board (Settings -> *Preferred names*: the last 4 digits, look up, type the name, send). It lands on the `Names` tab with Status `pending` and is **not used until you approve it**: menu **Hall Pass -> Approve waiting preferred names** (or set Status to `ok` by hand; set `no` to refuse). One teacher can have at most 10 suggestions waiting. Only the first name can be changed.

## Announcements and questions of a teacher

In their board's Settings the teachers write their own **announcements** (up to 8, 140 characters) and **questions with answers** (up to 12) and tick the lessons each is for. **Save to the school sheet** stores them on the `Announcements` and `Questions` tabs under the teacher's name, so you (the administrators) can read them there, and the board shows them as cards for the ticked lessons. Saving again replaces that teacher's rows and only his. You can also edit the rows by hand (an `x` under a lesson, any other text or empty = not shown). Text that starts with `=`, `+`, `-` or `@` is made harmless.

## Bell schedules and the calendar (so the page is not tied to one school)

The page has the Orlando Science High School 2026-27 times and calendar built in only as a **sample**. The real ones come from your two tabs: after **Hall Pass -> 1. Set up tabs** they are filled with that sample (the first time only; running it again never overwrites your edits), you replace the rows with yours, and every connected board takes them within an hour (at once after *Check code and load names*, and the board keeps them for when the internet is down). **Check setup** tells you how many school days and events it understood and how many rows it did **not** understand.

**`Bells` tab** (one row per part of the day):

| Column | What to write |
|---|---|
| Band | `912` or `1011`: the two groups of grades that have different bells (their names are `band_912_label` and `band_1011_label` on the `Settings` tab). If both groups have the same bells, write every row twice. |
| Day type | One word, for example `regular`, `wednesday`, `earlyrelease`. The calendar uses the same word. |
| Day name | How the day is called in the lists (the same on every row of that type), for example `Block Day`. |
| Label | `Period 1`, `Period 2` ... for the classes (these are shown as A1, B2 ... and used by the lists of students), `Break`, `Lunch`, or anything else you want shown (for example `Clubs`). |
| Kind | `class`, `break` or `lunch` (anything else counts as `class`). |
| Start, End | Times like `07:50` (24 hours); `7:50 AM` also works. **Format these two columns as plain text** (Format -> Number -> Plain text) so Google does not change them. Rows may be in any order. |

**`Calendar` tab** (one row per date; a date that is not on the tab is a day without school):

| Column | What to write |
|---|---|
| Date | `2026-09-07` or `9/7/2026`. |
| Day | `A` or `B` for a school day; **empty = no school** (a holiday, a break). |
| Type | The day type from the `Bells` tab (`regular`, `wednesday` ...). Empty = `regular`. |
| Event | Optional name, shown by the board's calendar cards ("Labor Day", "the 1st marking period"). |
| Event kind | `break` (a break or holiday: the board counts the days until it), `end` (the end of a marking period) or `year` (the last day of school). |

**For the next school year:** paste the new calendar over the `Calendar` tab (delete the old rows first), check the `Bells` rows, run **Check setup**, and the boards follow by themselves.

## The teachers' settings follow the teacher

The settings of a teacher are kept on the sheet, so they come with him to **any board** (a new board, a cleaned browser, a substitute computer) as soon as his code is typed or his link is opened. They are saved when he presses **Apply** or **Save** in the board's settings (and a change made outside the settings window, such as the timer's time, follows within seconds). Several boards of one teacher agree by time: the **newest change wins** for each setting separately. Without internet the changes wait on the board and are sent when the connection is back.

**What is shared:** which functions are on (passes, cards, agenda, timer, announcements, questions, Live Agenda), the number of pass buttons, the places and their limits, the 10/10 rule and the permission to go out in the closed minutes, the auto-leave seconds, the settings PIN (kept on the sheet **in plain text**, like the codes), the agenda and Live Agenda plans of every class (any length), the timer's time, red limit and the choice of its two sounds, the card choices, the clock and countdown formats, and the name and room shown at the top.
**What stays on each board:** the theme, the width of the left part, the sounds and volumes of the alerts and the bell, the bell shift, the day overrides, and the connection (the code and the script address).

**School defaults.** Put a row on the `School defaults` tab: **Key** (see the menu *Hall Pass -> Show the setting keys*), **Value** as JSON (`true`, `false`, `3`, `"text"`, a list), and an `x` under **Locked** to forbid changes. An unlocked default is taken by every teacher who has not set that setting himself (and followed later when you change it); a **locked** one is forced on every board, and a teacher who changes it sees it put back on **Apply** with a note. The easy way: configure one board the way you want it, then use **Hall Pass -> Make school defaults from a teacher...** (you type part of his name) to copy all of his settings to the defaults, and then add the **x** to the ones that must not change.

**The first time** a teacher connects and the sheet knows nothing about him (and there are no school defaults), what his board already has becomes his: only the settings that differ from the built-in ones are sent. If you removed a row on the `Teacher settings` tab, that setting returns to the school default or the built-in value on his next check. The `Updated` number is a time in milliseconds; do not edit it unless you know why.

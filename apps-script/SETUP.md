# Administrator's guide: the school's Google Sheet

One Google Sheet in the **school's account** holds everything. Teachers never open it: their boards talk to a small script with a personal **teacher code**.

| Tab | What it is | Who fills it |
|---|---|---|
| `Master` | The school's schedule export, pasted once. It may contain parent e-mails, so it is **cleared after the import**. | You |
| `Schedule` | The clean copy the boards use: student ID, name, block, time, teacher, course, room, role. | The import |
| `Teachers` | One row per teacher: code, name, role, active, setup link. | "Make teacher codes" |
| `Settings` | `site_url`, `semester2_start`, `exclude_courses`. | You |
| `Log` | **One tab**, one row per finished trip. Never split by week. | The boards |
| `Messages` | Optional announcements: A = text, B = show from, C = show until. | You |

## 1. Put the script in the sheet

1. Open the school's sheet (or create one). **Extensions -> Apps Script**.
2. Delete the old code, paste the whole of `Code.gs`, press **Save**.
3. **Deploy -> Manage deployments**, pencil, *Version: New version*, **Deploy**. The web app address stays the same, so the boards keep working.
   *(First time ever: Deploy -> New deployment -> Web app, Execute as **Me**, Who has access **Anyone**, copy the address into `apps-script/webapplink` and the page.)*
4. Reload the sheet. A menu **Hall Pass** appears. The first run asks for permission: Review permissions -> your account -> Advanced -> Go to the project -> Allow.

"Anyone" means anybody *with the address* can send a request, but the script answers nothing without a valid teacher code.

## 2. Set up the tabs and the schedule

1. **Hall Pass -> 1. Set up tabs.** Creates `Master`, `Schedule`, `Teachers`, `Settings`, `Log` and puts the sheet on New York time.
2. Open the school's schedule export and copy everything, **header row included**, into the `Master` tab (cell A1). Needed columns: `STUDENT ID`, `NAME`, `BLOCK`, `TIME`, `TEACHER`, `COURSE`, `ROOM`, `ROLE` (the other columns are ignored).
3. On `Settings`: write the first day of the second semester in `semester2_start` (like `2027-01-11`), and in `exclude_courses` the courses that are not classrooms, separated by commas (for example `Full-Time No OSS, Dual Enrollment`).
4. **Hall Pass -> 2. Import schedule from Master.** It keeps only the blocks A1-A4 and B1-B4, skips lunch rows, and copies **only the needed columns** (no parent e-mails). Student IDs stay text, so a leading zero is not lost. Run it again after a new export: it replaces the `Schedule` tab.
5. **Hall Pass -> Clear the Master tab** (answer Yes). The sensitive export is gone, `Schedule` stays.

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
| Exit ID | Made by the board. A trip sent twice is recognised and written once. |
| Student ID | Text. Names are **not** in the log: look them up in `Schedule`. |
| Section | The class (A1...B4), or `Guest` for a student who is not on the teacher's list. |
| Teacher, Room | Filled in by the script from the code and the schedule. They cannot be faked by a board. |
| Where | Restroom, Locker, Water, Office, Nurse, Other (the teacher may add others). |
| Out, Back, Minutes | Real date-times; minutes only for `Returned`. |
| Status | `Returned`, or `Cancelled` (Undo, or a cancelled pass; Back is the time Cancel was tapped). |
| Outside window | `yes` when a pass was given in the closed 10/10 minutes. |
| Mode, Board | `LIVE` or `TEST`; which classroom screen sent it. Filter `TEST` out of reports. |
| Guest name | Only for a visitor typed by hand (no ID). |

Tip: **Data -> Create a filter**, or build a pivot table on this tab. About 600-1,000 trips a day is roughly 150,000 rows a year, well inside the limits of one tab. When a year ends, copy the sheet and start a fresh `Log`.

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

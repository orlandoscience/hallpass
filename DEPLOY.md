# Putting the Hall Pass Board into use (and again next year)

This guide is for the person who sets the system up: one Google Sheet with a small script, one web page on GitHub, and one personal link for every teacher.

## What you need

| You need | Why |
|---|---|
| A Google account of the school (Google Workspace for Education) that may create Sheets and Apps Script projects and may deploy a **web app that "Anyone" can open** | The sheet stores the schedule, the codes and the log. The boards talk to its script. Ask IT whether web apps with access "Anyone" are allowed. |
| Permission from the school (IT / administration) to keep student IDs and names in a Google Sheet in the school's account | The `Schedule` tab holds them. The boards never get anything but first names, last initials and IDs of the teacher's own students. |
| A GitHub account and a repository with GitHub Pages switched on (Settings -> Pages -> Deploy from a branch -> main) | The page the boards open (for example `https://orlandoscience.github.io/hallpass/`). |
| The school's schedule export (Excel or CSV) with the columns STUDENT ID, NAME, BLOCK, TIME, TEACHER, COURSE, ROOM, ROLE and GRADE | It is pasted once into the `Master` tab. |
| E-mail addresses of the teachers | The personal setup links are sent by e-mail. |
| A browser on every classroom board or computer (Chrome or Edge are best) | The page works in the browser; it can also be installed as an app. |

The page itself contains **no secrets**: no script address, no codes, no student data. The address of the script is only in the personal links and in the sheet.

## First time: step by step

1. **The page.** Upload the files of this repository to your GitHub repository (the whole content of `hall-pass-oss.zip`), switch on GitHub Pages, and open the address once to check that the board appears.
2. **The sheet.** Create a new Google Sheet (name it for example "Hall Pass 2026-27"). Open **Extensions -> Apps Script**, delete the sample code, paste the whole of `apps-script/Code.gs`, press **Save**.
3. **The tabs.** Reload the sheet. A menu **Hall Pass** appears (the first time Google asks you to allow the script: choose your account, *Advanced*, *Go to ... (unsafe)*, *Allow*). Use **Hall Pass -> 1. Set up tabs**. It creates `Master`, `Schedule`, `Teachers`, `Names`, `Announcements`, `Questions`, `Bells`, `Calendar`, `Teacher settings`, `School defaults`, `Settings` and `Log`.
4. **The settings.** On the `Settings` tab: `site_url` = the address of your page (with a slash at the end); `semester2_start` = the first day of the second semester (like `2027-01-11`); `exclude_courses` = parts of course names that are not classrooms (optional); `school_name` = the title on the board; `band_912_label` / `band_1011_label` = the names of the two groups of grades.
   **Your bells and calendar:** the `Bells` and `Calendar` tabs were filled with a sample school (Orlando Science High School 2026-27). Replace the rows with your school's bell schedules and calendar (the formats are in `apps-script/SETUP.md`), then run **Check setup**: it says how many school days it understood and whether any row was not understood.
5. **Deploy the script as a web app.** In Apps Script: **Deploy -> New deployment -> Select type: Web app**. *Execute as*: **Me**. *Who has access*: **Anyone**. Press **Deploy** and copy the **Web app URL** (it ends in `/exec`). Put it into the `script_url` row of the `Settings` tab. **Do not publish this address** (not on the page, not in the repository). In the Apps Script description of the deployment write the date or the version.
6. **The students.** Paste the schedule export (with its header row) into the `Master` tab. **Hall Pass -> 2. Import schedule from Master.** Check the message: the numbers of rows, students and teachers, and how lunch was handled.
7. **The codes and links.** **Hall Pass -> 3. Make teacher codes** (one 8-character code per teacher, plus one for the cafeteria teacher named `Lunch`), then **4. Make setup links**. Column E of the `Teachers` tab now holds a personal link for every teacher; the message must not say "WARNING" (that means `script_url` is empty).
8. **Clean up.** When the import is right, **Clear the Master tab** (it may hold parent e-mails). Restrict who can open the sheet to the administrators.
9. **Send the links.** E-mail every teacher **only his own link**. The teacher opens it once on the classroom board: the board takes the code and the address from the link and clears them from the address bar, then loads the names. **The link is personal: it is the teacher's password.**
10. **Test.** Open your own link on a board, sign a pass out and back in, and look at the `Log` tab: one row per trip.

## During the year

* **A new export** (changes in the schedule): paste it into `Master`, run **2. Import**, then **3. Make teacher codes** (existing codes never change; only new teachers get one). Clear `Master` again.
* **A teacher left or lost a link:** on the `Teachers` tab set `Active` to `no` (the code stops working within a minute) or write a new code in column A and run **4. Make setup links**.
* **Preferred names, substitutes, announcements:** see `apps-script/SETUP.md`.
* **Changing the script:** paste the new `Code.gs`, **Save**, then **Deploy -> Manage deployments -> pencil -> Version: New version -> Deploy**. This keeps the same address. (A *new deployment* makes a *new* address.)
* **The log** grows by one row per trip (about 130,000-190,000 rows per school year); it stays on one tab. If you want to analyse it, use a pivot table or copy the tab.

## Next school year (or when the log gets too big): a fresh document

The simplest way is **a new document with the same script**:

1. In Google Drive, **Make a copy** of last year's sheet (or create a new sheet and paste `Code.gs` again). Name it for the new year.
2. In the copy, clear the old data (keep `School defaults` and, if you like, `Teacher settings`: they carry over the teachers' settings and the plans): the `Log` (keep the header row), the `Schedule`, the `Names` (keep the preferred names you still want), the `Announcements` and `Questions` (keep the header rows) and the `Teachers` codes if you want all-new codes.
3. **Deploy again** (step 5: **New deployment**, Web app, Execute as Me, Anyone). It gives a **new address**; put it into `script_url`.
4. Replace the rows of the `Calendar` tab with the new year's calendar and check the `Bells` rows (the new `Settings` values too, if the title changed); run **Check setup**. Then paste the new export into `Master`, **2. Import**, **3. Make teacher codes**, **4. Make setup links**, clear `Master`.
5. E-mail the **new links** to the teachers. Each opens his link once on his board. Boards that still have the old address stop working as soon as you **archive the old deployment** (Deploy -> Manage deployments -> archive) and last year's sheet can be kept as a record.
6. The page on GitHub does not change.

## If the address of the script became known

The address alone gives nobody any student data: every request needs a personal code. But anyone who has it could send many requests. To change it: make a **new deployment** (a new address), put it into `script_url`, run **4. Make setup links**, send the new links, and **archive the old deployment**. The boards then need their links opened again.

## Things that go wrong

| What you see | What it means |
|---|---|
| The pass buttons are grey: "Hall passes are off. Double-tap the gear and type your teacher code" | The board has no recognised teacher. Open the teacher's personal link, or type the code in Settings -> *Teacher code* (and paste the script address if the link did not carry it). |
| "Code not recognized" | The code is wrong, or the teacher's row is `Active = no`. |
| Setup links without `&u=` (the message says WARNING) | `script_url` on the `Settings` tab is empty or is not a `https://script.google.com/macros/s/.../exec` address. |
| Names are missing or out of date | Press *Check code and load names* in the settings. After an import the boards refresh within an hour on their own. |
| The log has no new rows | Check the script address and the deployment: *Execute as* **Me**, *Who has access* **Anyone**; after changing the script deploy a **New version**. |
| An error mentioning a method name when you run a menu item | The script was not saved or not redeployed. Save, reload the sheet, try again. |

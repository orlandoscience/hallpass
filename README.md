# Hall Pass Board

A classroom screen that shows the bell schedule, a live progress bar for the class period, and the **10/10 hall pass rule**:
passes are closed during the first and last 10 minutes of class, open in between, and the screen says so in big letters.

**Open it here:** https://orlandoscience.github.io/hallpass/
**Try the demo (fast clock, no setup):** https://orlandoscience.github.io/hallpass/?demo=1 (or press *Just look first* on the welcome screen, or *Try the demo* in the Quick start guide)

| Passes open | Passes closed |
|---|---|
| ![Passes open](docs/screen-open.jpg) | ![Passes closed](docs/screen-closed.jpg) |

## For teachers: start in three steps

1. Open the address above on the classroom screen (Chrome works best). Double-tap an empty spot to go full screen.
2. The first time, a short welcome asks three things: your schedule (9th-12th or 10th-11th grade), the 10/10 minutes (change them if your rule is different), and a PIN for the settings (or no PIN).
3. That's it. The A/B day and the bell times are worked out by the page itself.

**What the colors mean**

| Color | Meaning |
|---|---|
| Green | Hall passes are open. The countdown shows when they close. |
| Red | Hall passes are closed (first and last minutes of class). The countdown shows when they open. |
| Blue | Passing period or lunch. The countdown shows when the next class starts. |

The bar under the big timer is the whole class period: red zones are the closed minutes, the white marker moves as time passes.

**Agenda note (optional):** switch on *Agenda note* under Extras, then type the plan for each class in the settings (one item per line). Students see it on a yellow lined note with a red pin during that class and a few minutes before it. Start a line with `[x]` to cross it out.

**If the school bell and the board disagree:** line the board up with the bell using the -1 / +1 buttons on the main screen, then open the settings, *School bell drift*, and press *Remember the current shift*. The board then adds the bell's daily drift (0.6 seconds a day by default) by itself, so nobody has to nudge it again. After the school puts its bell right, press *The bell was just reset*.

The board keeps working without internet once it has been opened online, and it installs like an app (Chrome menu, "Install"). It checks for a newer version by itself and loads it after school, never in the middle of class.

## Extras (all off until you switch them on)

Open the settings by double-tapping the gear button (bottom right), then your PIN if you use one (the PIN can be switched off in the settings). Under **Extras** you can switch on only what you want:

- **Hall pass buttons and log**: students tap their name, choose where they are going, and tap again when they return. Any number of pass buttons. Each place (restroom, locker, water...) has its own limit in minutes; the pass turns red on the board after it (limits stay on the board and are not sent anywhere). A pass can be undone for 30 seconds without the PIN; after that it is cancelled with the PIN (or one confirmation if the PIN is off). Undone and cancelled passes stay in the log as Cancelled, with the time of the tap. Long class lists (study hall) are chosen by first letter. Optionally a teacher may allow passes in the closed 10/10 minutes: the board asks once, then it looks like any other pass and the log notes it. Trips can be saved to your own Google Sheet.
- **Sounds**: warnings before the bell and a bell ring.
- **Cards**: a rotating panel with the lesson phase, a day arc, facts, Java riddles, announcements, school calendar numbers and the Orlando weather (temperatures in degrees F with C in brackets, plus weather warnings).

`Quick setup -> Basic` brings back the simple screen at any time.

## For whoever looks after this repository

**Publishing.** The page is plain files, no build step.

1. Upload everything in this folder to the repository (Add file -> Upload files; drag the folders in too) and commit to `main`.
2. Repository **Settings -> Pages -> Build and deployment**: Source *Deploy from a branch*, Branch `main`, folder `/ (root)`, Save.
3. After a minute the board is live at `https://<user>.github.io/<repository>/`.

**Updating.** Replace `index.html` and change the version text in the line `const APP_VERSION = "..."` so that boards know there is something new. Boards pick it up by themselves after school hours.

| File | What it is |
|---|---|
| `index.html` | The whole board (page, bell schedules, A/B calendar). |
| `sw.js`, `manifest.webmanifest`, `icon*.png/svg` | Make it work offline and installable. |
| `apps-script/Code.gs` | Optional Google Apps Script for the hall pass log, student names, announcements and weather warnings. |
| `docs/` | Screenshots and QR codes for slides. |

**Optional: hall pass log in a Google Sheet** (only if you switch on the hall pass extra)

1. Create a Google Sheet. Extensions -> Apps Script. Paste `apps-script/Code.gs`.
2. Deploy -> New deployment -> Web app. Execute as: *Me*. Who has access: *Anyone*. Copy the web app address.
3. On the board: settings -> Hall pass log: paste the address (and the secret word if you set `SECRET` in the script), press *Send test row*.
4. Trips appear in a tab called `HallPass` (created automatically). A tab called `Roster` (class codes such as A1, A2 in row 1, names underneath) feeds the name buttons. A tab called `Messages` feeds announcements. For weather warnings, choose `authorize` in the script editor and press Run once.

## Privacy

- Everything is stored in the browser of the board itself (IndexedDB). Nothing is sent anywhere unless you connect a Google Sheet or switch on the weather.
- **This repository and the website are public. Never commit student names, rosters or sheet addresses.** Names live only on the boards and in your own Google Sheet.
- The weather extra contacts open-meteo.com and api.weather.gov (through your Google script). The time sync contacts public time servers.
- Forgot the PIN? Clear the site's data in Chrome (site settings) and the welcome screen returns. This also clears that board's saved settings.

## Credits

QR codes use *qrcode-generator* by Kazuhiko Arase (MIT license, see `THIRD_PARTY_NOTICES.md`). Weather data: Open-Meteo.com. Warnings: U.S. National Weather Service.

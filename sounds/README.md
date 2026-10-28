# School sounds

Put the sound files for the board in this folder (`.mp3`, also `.wav`, `.ogg`, `.m4a`).

Every file here appears **by itself** in the sound lists of the board (Settings -> Notifications / Attention Signal), under "School sounds". The name in the list is the file name without the extension, so `Morning bell.mp3` shows as "Morning bell". A new file shows up on the boards within a few hours, or at once when someone presses *Refresh school sounds* in the settings. The files are saved on each board after the first time, so they also play without internet.

How to add a file: on GitHub open this folder, **Add file -> Upload files**, drag the mp3 files, **Commit changes**.

Only use sounds you have the right to use (for example royalty-free ones). Keep the files small (a few seconds each): the boards download all the ones in use.

Optional: a file `index.json` with a list of file names, like `["Bell.mp3", "Chime.mp3"]`, is used when the folder cannot be read from GitHub (for example on another web server).

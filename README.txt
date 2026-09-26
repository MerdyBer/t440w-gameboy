T440W GB/GBC Emulator v0.7 - GITHUB PAGES READY

WHAT THIS IS
A general-purpose Game Boy / Game Boy Color browser emulator interface built
for the TCL T440W running KaiOS 4. ROMs are NOT included and are never uploaded
by this app. The user chooses a local .gb or .gbc file from the phone.

IMPORTANT
- Upload ONLY this emulator folder to GitHub.
- DO NOT upload Pokemon Crystal or any other ROM.
- Keep ROMs on the phone (for example, in Downloads).
- First real launch should use Wi-Fi because the third-party emulator core is
  not physically bundled in vendor/ yet.
- After a successful online core load, the app attempts to cache it for reuse.

LOCKED CONTROLS
D-pad      = Up / Down / Left / Right
Left dot   = B
Right dot  = A
1          = Select
2          = Start
3          = Fast-forward (3x while held)
4          = Mute / unmute
6          = Hold to reset
7          = Load state
8          = Game selection
9          = Save state
OK         = Fullscreen
*          = Emulator menu
5 and #    = unused

STARTUP
Every launch shows the complete control map for 10 seconds while the emulator
initializes, then opens Game Selection.

GITHUB PAGES
All site paths are relative, so this folder works from a repository subpath
such as:
  https://YOURNAME.github.io/t440w-gameboy/

The included .nojekyll file tells GitHub Pages to serve the files directly.

PRIVACY
Selected ROM bytes stay inside the browser page. This wrapper contains no
analytics, accounts, tracking, uploads, or ROM-transfer code.

THIRD-PARTY CORE
GameBoy-Online by Grant Galitz / taisel is MIT licensed. See
THIRD_PARTY_LICENSE.txt. The hosted beta loads that public core at runtime
unless local copies are later added under vendor/.

PHYSICAL DEVICE VALIDATION STILL NEEDED
No simulator can perfectly reproduce TCL firmware. Final checks on the real
T440W are:
- file picker behavior
- exact physical soft-key events
- audio wake-up
- real GB/GBC execution speed
- save/RTC behavior after closing and reopening the browser/app

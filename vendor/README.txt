LOCAL CORE OVERRIDE (OPTIONAL)

If these three files are placed in this folder, the emulator will use them
instead of downloading the upstream core on first launch:

  resampler.js
  XAudioServer.js
  GameBoyCore.js

Current GitHub-ready build intentionally leaves them absent and falls back to:
  1) jsDelivr copy of taisel/GameBoy-Online
  2) taisel.github.io/GameBoy-Online

Do not place ROM files in this folder.

# PLD_PM

Paragon Live Design — **production management** UI workspace (HTML/JS prototype).

**Folder name:** Prefer the directory name `PLD_PM` on Desktop (`C:\Users\codya\Desktop\PLD_PM`). If this folder is still named `TEST UI`, rename it when nothing has the folder open (close Cursor tabs / File Explorer windows pointing here), then reopen the workspace.

**Git:** Remote — [github.com/Paragonlivedesign/PLD_PM](https://github.com/Paragonlivedesign/PLD_PM). You can keep this as a standalone frontend repo or later move the app into a larger monorepo `frontend/` folder.

**Deploy:** Production target is `https://pm.paragonlivedesign.com` (Firebase Hosting — second site). See Planning repo’s multi-agent start plan for full bootstrap steps.

## Local dev & tests

```bash
npm install
npm run emulators:hosting   # http://127.0.0.1:5000
npm run test:e2e          # Playwright (starts Hosting emulator if needed)
```

Details: [docs/emulators-and-testing.md](docs/emulators-and-testing.md).

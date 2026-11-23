# Windows Setup

## Prerequisites

- **Node.js 22 LTS or newer** (includes npm): https://nodejs.org/
- **Git**: https://git-scm.com/download/win
- **VS Code** (recommended): https://code.visualstudio.com/
- A modern browser (Edge, Chrome or Firefox) to play.
- Python is **not** needed.

Check the versions in PowerShell:

```powershell
node --version   # v22 or newer
npm --version
git --version
```

## Console setup

1. Clone the repository (the base branch for games is `web-2d-games`):

   ```powershell
   git clone -b web-2d-games --single-branch <repository-url> my-game
   cd my-game
   ```

2. Install the development dependencies and the test browser:

   ```powershell
   npm install
   npx playwright install chromium
   ```

3. Configure environment variables: nothing to do. There is no `.env` file; settings live in `source/src/config.js`.

4. Run the game (keep this terminal open):

   ```powershell
   npm run dev
   ```

   Open http://127.0.0.1:5180/

5. Run the tests (in a second terminal):

   ```powershell
   npm test
   ```

Git Bash works the same way with the same commands.

## Alternative methods

- **winget** to install the prerequisites:

  ```powershell
  winget install OpenJS.NodeJS.LTS
  winget install Git.Git
  winget install Microsoft.VisualStudioCode
  ```

- **VS Code tasks**: Terminal → Run Task → `dev` (starts the server in the background) or `test`. Defined in `.vscode/tasks.json`.
- **GitHub Codespaces**: open the repository in a codespace, run `npm install` and `npm run dev`, and open the forwarded port 5180.
- **VS Code port forwarding** (to try the game on a phone over HTTPS): Ports panel → Forward a Port → `5180` → set visibility to Public and open the URL on the phone.

## Verification

- `npm run dev` prints `Dev server: http://127.0.0.1:5180/  (live reload on)`.
- The page shows the title screen; Play starts the game, arrows/WASD move, Escape pauses.
- Add `?debug` to the URL to see FPS and errors (`errors 0`).
- `npm test` ends with `fail 0`.
- Template only (no game yet): `npm run demo` and open http://127.0.0.1:5181/; "Play online" → "Create room" works, and with `?net=local` two tabs can join the same room.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| `Port 5180 is in use by another program` | Run `npm run dev -- --port 5181` or close the other program. If the dev server is already running, the command just prints its URL. |
| `node` is not recognized | Reinstall Node.js with "Add to PATH" checked, then open a new terminal. |
| The page shows old code after editing | The server sends `no-store`, so do a normal reload; if a browser extension caches, use a private window. |
| No sound | Browsers block audio until the first click or key press; click the page once. |
| `Executable doesn't exist` or `chrome not found` from Playwright | Run `npx playwright install chromium` and open the browser with `--browser=chromium`. |
| Blank page and a red error bar | The bar shows the JavaScript error; check the file and line it names. Opening `index.html` directly (`file://`) does not work: use `npm run dev`. |
| Online rooms fail on a phone using `http://192.168.x.x` | WebRTC encryption needs HTTPS or localhost. Use VS Code port forwarding or the GitHub Pages build. |
| Online rooms never connect | A firewall may block WebRTC or the public relays (`peer-connect-failed`, `relay-failed`). Try another network; see the `p2p-rooms` skill for TURN servers. |
| PowerShell blocks `npm` scripts (`running scripts is disabled`) | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Git Bash. |

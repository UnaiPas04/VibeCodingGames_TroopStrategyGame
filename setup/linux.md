# Linux Setup

## Prerequisites

- **Node.js 22 LTS or newer** (includes npm): https://nodejs.org/ (distribution packages are often older: check the version)
- **Git**
- **VS Code** (recommended): https://code.visualstudio.com/
- A modern browser (Firefox or Chromium) to play.
- Python is **not** needed.

Check the versions (bash):

```bash
node --version   # v22 or newer
npm --version
git --version
```

## Console setup

1. Clone the repository (the base branch for games is `web-2d-games`):

   ```bash
   git clone -b web-2d-games --single-branch <repository-url> my-game
   cd my-game
   ```

2. Install the development dependencies and the test browser (with its system libraries):

   ```bash
   npm install
   npx playwright install --with-deps chromium
   ```

3. Configure environment variables: nothing to do. There is no `.env` file; settings live in `source/src/config.js`.

4. Run the game (keep this terminal open):

   ```bash
   npm run dev
   ```

   Open http://127.0.0.1:5180/

5. Run the tests (in a second terminal):

   ```bash
   npm test
   ```

## Alternative methods

- **Package managers** (make sure the result is Node 22+):

  ```bash
  # Debian / Ubuntu (NodeSource repository for a current Node)
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs git

  # Fedora
  sudo dnf install -y nodejs git
  ```

- **nvm** (per-user Node versions): `nvm install 22 && nvm use 22`.
- **VS Code tasks**: Terminal → Run Task → `dev` or `test` (`.vscode/tasks.json`).
- **GitHub Codespaces**: open the repository in a codespace, run `npm install` and `npm run dev`, and open the forwarded port 5180.
- **VS Code port forwarding** (to try the game on a phone over HTTPS): Ports panel → Forward a Port → `5180` → visibility Public.

## Verification

- `npm run dev` prints `Dev server: http://127.0.0.1:5180/  (live reload on)`.
- The page shows the title screen; Play starts the game, arrows/WASD move, Escape pauses.
- Add `?debug` to the URL to see FPS and errors (`errors 0`).
- `npm test` ends with `fail 0`.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| `Port 5180 is in use by another program` | Run `npm run dev -- --port 5181`. If the dev server is already running, the command just prints its URL. |
| Old Node version (`node --version` below 22) | Install Node 22 with NodeSource or nvm (see Alternative methods). |
| Live reload does not trigger | Increase inotify watches: `echo fs.inotify.max_user_watches=524288 \| sudo tee -a /etc/sysctl.conf && sudo sysctl -p`. |
| Playwright reports missing libraries | Run `npx playwright install --with-deps chromium`. |
| No sound | Browsers block audio until the first click or key press; click the page once. |
| Blank page and a red error bar | The bar shows the JavaScript error. Opening `index.html` directly (`file://`) does not work: use `npm run dev`. |
| Online rooms fail on a phone using `http://192.168.x.x` | WebRTC encryption needs HTTPS or localhost. Use VS Code port forwarding or the GitHub Pages build. |
| Online rooms never connect | A firewall may block WebRTC or the public relays. Try another network; see the `p2p-rooms` skill for TURN servers. |

# macOS Setup

## Prerequisites

- **Node.js 22 LTS or newer** (includes npm): https://nodejs.org/
- **Git**: included with the Xcode Command Line Tools (`xcode-select --install`) or https://git-scm.com/download/mac
- **VS Code** (recommended): https://code.visualstudio.com/
- A modern browser (Safari, Chrome or Firefox) to play.
- Python is **not** needed.

Check the versions in Terminal (zsh):

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

2. Install the development dependencies and the test browser:

   ```bash
   npm install
   npx playwright install chromium
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

- **Homebrew** to install the prerequisites:

  ```bash
  brew install node git
  brew install --cask visual-studio-code
  ```

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
| `command not found: node` | Install Node.js and open a new terminal; with Homebrew, check `brew doctor`. |
| No sound | Browsers block audio until the first click or key press; click the page once. |
| `Executable doesn't exist` from Playwright | Run `npx playwright install chromium` and open the browser with `--browser=chromium`. |
| Blank page and a red error bar | The bar shows the JavaScript error. Opening `index.html` directly (`file://`) does not work: use `npm run dev`. |
| Online rooms fail on a phone using `http://192.168.x.x` | WebRTC encryption needs HTTPS or localhost. Use VS Code port forwarding or the GitHub Pages build. |
| Online rooms never connect | A firewall may block WebRTC or the public relays. Try another network; see the `p2p-rooms` skill for TURN servers. |
| macOS asks to allow incoming connections for `node` | Not needed: the server only listens on 127.0.0.1. You can deny it. |

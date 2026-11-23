# Trystero (vendored)

Serverless WebRTC rooms used by `src/net/transports.js` for online play.

| | |
| - | - |
| Library | [Trystero](https://github.com/dmotz/trystero) 0.27.0 (Nostr strategy, the default) |
| Author | Dan Motzenbecker (https://oxism.com) |
| Includes | `@trystero-p2p/core` 0.27.0, `@trystero-p2p/nostr` 0.27.0 (same author); `@noble/secp256k1` 3.2.0 by Paul Miller (https://paulmillr.com) |
| License | MIT, full texts in [LICENSE](LICENSE) |
| File | `trystero.js`: one minified ES module, no external imports |

The game never downloads code at runtime: this file is served with the game and imported only when online play starts. Peer discovery still needs internet access to public Nostr relays.

## Update

1. In a scratch folder (not in the game):

   ```bash
   npm init -y
   npm i trystero@<version> esbuild
   npx esbuild node_modules/trystero/dist/index.mjs --bundle --format=esm --platform=browser --target=es2022 --minify --legal-comments=inline --outfile=trystero.js
   ```

2. Replace `trystero.js` here, keep the attribution header at the top of the file, update the versions in this README and the header, and refresh `LICENSE` from the packages' `LICENSE` files.
3. Read the Trystero changelog for API changes, then re-test online play with both transports (`?net=local` and real relays), as described in the `run-game` skill.

# Mingy’s World

A browser mystery for two golden retriever puppies. Built for a long-distance date, with a fully explorable 3D house, original Blender puppy models, cooperative evidence, camera tiles, and a personal photo ending.

## Playing (no spoilers)

Both players open https://mingy.world, choose a puppy, and press **Join our adventure**. The server pairs the first two browsers into the same saved adventure and assigns the available puppy if both choose the same one. Each browser remembers its puppy when reconnecting; an extra tab replaces its own previous connection, while a third device cannot displace either player. Keep your existing call open for audio. Choose **Enable camera** on the welcome card for a live preview. The camera button in the top right remains available while playing. Camera capture is video only.

- Arrow keys or WASD: move
- Space: jump
- Shift: sprint
- E: inspect / interact
- Q: sniff for nearby evidence
- B: bark to your Mingy
- J: shared notebook
- Scroll: zoom
- Right-drag: orbit the camera
- Escape: close a panel

The expanded adventure targets roughly 55–75 minutes for two first-time players, depending on exploration and puzzle-solving pace. This is a design estimate, not a timed first-time human playtest. Progressive hints are optional, wrong answers do not cost lives, and the brief timed section can be retried. Refreshing or reconnecting preserves the case file. Touch controls are included; a laptop in Chrome or Edge gives the best experience.

Open `/reset` and choose **Start a fresh adventure** to move the shared homepage to a new empty case. Connected players return to the welcome screen automatically. Both still use the same address. The reset page also links to the previous saved adventure.

## Runtime

- React, Three.js / React Three Fiber, and Rapier physics. Sculpted, articulated puppies with instanced fur, physically based surfaces, baked material batches for static furniture, contact shadows, bloom, animated water, and an adaptive original Web Audio score.
- Native Vercel WebSockets, with an isolated Upstash Redis database for shared state, presence, locks, and cross-instance fan-out.
- WebRTC peer-to-peer video and an unordered data channel for fast avatar movement. WebSockets provide signaling and server-validated progress. Avatar updates and small JPEG camera frames continue over WebSocket if a direct route is blocked. No audio capture, audio transceiver, or recording.
- The homepage and photo API are public; no invitation, account or cookie is needed. Atomic, expiring seat reservations limit each adventure to two active puppies. Personal images are excluded from Git, and exported images contain no EXIF metadata.

## Local development

Use Node.js 24 or later.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Configure `REDIS_URL` in `.env.local`. Vercel’s linked integration supplies Redis in the deployed environments. Set `MINGY_WORLD_KEY` to a unique local QA namespace when testing public pairing or reset against the same Redis database. Open the local origin directly.

Original photographs stay in the local `pictures/` directory. `node scripts/prepare-photos.mjs` converts the supplied HEIC images on macOS into gallery assets and thumbnails. `scripts/build-puppies.py` builds and exports the original puppy with Blender. The resulting GLB is included in the source repository.

```sh
npm test
npm run build
vercel deploy --prod --scope harshagberkeleyedus-projects
```

The `.env` files, original photos, gallery exports, and test screenshots are not committed. A deploy must be made from a checkout containing `private-assets/photos/`; Vercel bundles that directory only into the photo function.

## Validation

The checks cover puzzle uniqueness, clue and distance requirements, separate player participation, atomic progress, retry behavior, and portal gates. Browser validation uses two independent Chromium instances, actual Rapier movement, all chapter transitions, and synthetic camera streams to verify bidirectional WebRTC, camera toggling, and WebSocket fallback. Test instrumentation exists only in development and is removed from the production bundle.

Always launch automated browsers with `--args "--mute-audio"` so tests stay silent on the host Mac. This mutes the browser output while preserving the audio graph for verification.

Browser QA artifacts and logs remain in the ignored `output/` directory. The game’s solution logic is intentionally kept out of this README.

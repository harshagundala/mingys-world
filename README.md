# Mingy’s World

A private browser mystery for two golden retriever puppies. Built for a long-distance date, with a fully explorable 3D house, original Blender puppy models, cooperative evidence, camera tiles, and a personal photo ending.

## Playing (no spoilers)

Open the private invitation, choose your collar, and enter. Copy the in-game invitation for your partner; they choose the other collar. Keep your existing call open for audio. The camera button requests video only.

- Arrow keys or WASD: move
- Space: jump
- Shift: sprint
- E: inspect / interact
- Q: sniff for nearby evidence
- B: bark to your Mingy
- J: shared notebook
- Scroll: zoom
- Escape: close a panel

The adventure is designed for about an hour at an exploratory pace. Progressive hints are optional, wrong answers do not cost lives, and the brief timed section can be retried. Refreshing or reconnecting preserves the case file. Touch controls are included; a laptop in Chrome or Edge gives the best experience.

## Runtime

- React, Three.js / React Three Fiber, and Rapier physics.
- Native Vercel WebSockets, with an isolated Upstash Redis database for shared state, presence, locks, and cross-instance fan-out.
- WebRTC peer-to-peer video and an unordered data channel for fast avatar movement. WebSockets provide signaling and server-validated progress. Avatar updates and small JPEG camera frames continue over WebSocket if a direct route is blocked. No audio capture, audio transceiver, or recording.
- A random invitation is exchanged for an HttpOnly session cookie. Photos are served by an authenticated API, never as public static files. Room access is limited to two puppy roles. Personal images are excluded from Git, and exported images contain no EXIF metadata.

## Local development

Use Node.js 24 or later.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Configure `REDIS_URL` and a random `WORLD_SECRET` in `.env.local`. Vercel’s linked integration supplies Redis in the deployed environments. Open the local origin with `#invite=YOUR_WORLD_SECRET` for initial access.

Original photographs stay in the local `pictures/` directory. `node scripts/prepare-photos.mjs` converts the supplied HEIC images on macOS into authenticated gallery assets and thumbnails. `scripts/build-puppies.py` builds and exports the original puppy with Blender. The resulting GLB is included in the source repository.

```sh
npm test
npm run build
vercel deploy --prod --scope harshagberkeleyedus-projects
```

The `.env` files, original photos, gallery exports, and test screenshots are not committed. A deploy must be made from a checkout containing `private-assets/photos/`; Vercel bundles that directory only into the protected photo function.

## Validation

The checks cover puzzle uniqueness, clue and distance requirements, separate player participation, atomic progress, retry behavior, and portal gates. Browser validation uses two independent Chromium instances, actual Rapier movement, all chapter transitions, and synthetic camera streams to verify bidirectional WebRTC, camera toggling, and WebSocket fallback. Test instrumentation exists only in development and is removed from the production bundle.

Browser QA artifacts and logs remain in the ignored `output/` directory. The game’s solution logic is intentionally kept out of this README.

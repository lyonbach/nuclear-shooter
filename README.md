# Nuclear Shooter — Blackout Protocol

A polished, top-down helicopter survival shooter. Fly the AH-07 Nighthawk through increasingly difficult enemy waves, choose upgrades between sorties, and face the Goliath command vehicle every fifth wave.

## Play locally

Double-click `index.html` to play. The included `blackout.js` bundle works without a server or internet connection.

For development, serve this folder with any static HTTP server. For example:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open http://localhost:8080.

No dependency installation, asset downloads, or API keys are needed. All visuals are rendered in Canvas and all audio is synthesized with Web Audio. The Turkish interface scales to desktop, tablet, and phone screens.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move | WASD / arrows | Left virtual joystick |
| Aim | Mouse | Automatically tracks nearest enemy |
| Fire | Hold left click / Space | Hold ATEŞ |
| Homing rocket | E / right click | Small rocket button |
| Evasive dash | Shift | Small arrow button |
| Pause / resume | Escape / P | Pause button |
| Mute | M | Speaker button |
| Choose an upgrade | Click / 1, 2, 3 | Tap a card |

Rockets recharge individually. Dash briefly prevents damage. Green field supplies repair 30 hull points. Consecutive kills raise the score multiplier up to ×5. Each cleared wave awards bonus points and a choice of upgrades. Every fifth wave includes a boss.

Choose Çaylak, Pilot, or As before a new run. Sound volume, procedural music, screen shake, effects quality, difficulty, and your best score are saved locally when browser storage is available. Switching tabs automatically pauses the action. Reduced-motion preferences disable screen shake by default.

## Checks

With Node.js 18 or later:

```sh
npm test
npm run check
npm run build
```

Rebuild `blackout.js` after editing `core.js`, `audio.js`, `renderer.js`, or `game.js`. The dependency-free build script combines those source modules into a browser script.

The 12 tests cover continuous projectile collision, wave scaling, enemy unlocks, aiming across the angle boundary, deterministic terrain, movement, pause, rocket damage and replenishment, dash protection, upgrade transitions, boss spawning, records, and restart behavior.

## GitHub Pages

The existing workflow deploys on pushes to `main`. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. All game assets use relative paths, so repository subpath hosting works without configuration.

Nothing is sent to a backend, and the game does not need an internet connection once its files have loaded. Audio begins only after a user gesture. Current Chrome, Edge, Firefox, and Safari support the required Canvas, Web Audio, and ES modules APIs. Fullscreen is offered when the browser supports it.

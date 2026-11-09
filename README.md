# Nuclear Shooter — Blackout Protocol

A polished, top-down helicopter survival shooter. Fly the AH-07 Nighthawk through increasingly difficult enemy waves, choose upgrades between sorties, and face the Goliath command vehicle every fifth wave.

## Play locally

Double-click `index.html` to play. The included `blackout.js` bundle works without a server or internet connection.

For development, serve this folder with any static HTTP server. For example:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open http://localhost:8080.

No dependency installation or API keys are needed. All visuals are rendered in Canvas. Music and effects use Web Audio; the game has synthesized music scores when custom tracks are not present. The Turkish interface scales to desktop, tablet, and phone screens.

The battlefield uses a pixel-art rendering style: the world is drawn to a lower-resolution canvas and enlarged without smoothing, while controls and text remain at display resolution.

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

Rockets accelerate after launch and recharge individually. The machine gun heats with each shot; release fire to cool it, or wait three seconds for a fully overheated gun to cool before it can fire again. Faster firing upgrades build heat faster. The helicopter coasts briefly when movement is released, while dash briefly prevents damage. Green field supplies repair 30 hull points. Consecutive kills raise the score multiplier up to ×5. Each cleared wave awards bonus points and a choice of upgrades. The battlefield rotates through desert, valley, and red-zone sectors each wave; every fifth wave includes a boss.

Choose Çaylak, Pilot, or As before a new run. Sound volume, music, screen shake, effects quality, difficulty, and your best score are saved locally when browser storage is available. Switching tabs automatically pauses the action. Reduced-motion preferences disable the tracking camera and screen shake by default.

## Music tracks

The soundtrack switches between menu, wave-combat, and boss music using the MP3 tracks in `sound/`. Missing or unsupported tracks fall back to the built-in synthesized scores. Music starts after the first user interaction and follows the music setting and master volume.

## Checks

With Node.js 18 or later:

```sh
npm test
npm run check
npm run build
```

Rebuild `blackout.js` after editing `core.js`, `audio.js`, `renderer.js`, or `game.js`. The dependency-free build script combines those source modules into a browser script.

The tests cover continuous projectile collision, wave scaling, sector rotation, aiming, camera tracking, terrain generation, movement and drift, gun overheating, rocket acceleration and damage, pause, dash protection, upgrade transitions, boss spawning, records, and restart behavior.

## GitHub Pages

The existing workflow deploys on pushes to `main`. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. All game assets use relative paths, so repository subpath hosting works without configuration.

Nothing is sent to a backend, and the game does not need an internet connection once its files have loaded. Audio begins only after a user gesture. Current Chrome, Edge, Firefox, and Safari support the required Canvas, Web Audio, and ES modules APIs. Fullscreen is offered when the browser supports it.

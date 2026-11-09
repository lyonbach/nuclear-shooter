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

## Enemy tuning

Edit `enemies.csv` in a spreadsheet or text editor, save it as comma-separated UTF-8, and run `npm run build`. The build validates the sheet and generates `enemy-data.js` and `blackout.js`; commit both generated files with the sheet. The game reads the built-in sheet data, so it also works when opening `index.html` directly offline. Editing the CSV alone does not change the game until it is rebuilt. Keep the header, row names, and column order unchanged; use non-negative numbers and `.` for decimals.

Each row configures one enemy. Distances and speeds use game world units and world units per second; times are seconds, and angles are radians.

| Columns | Meaning |
| --- | --- |
| `health`, `healthPerWave` | Base health and extra health per wave, before the shared wave health multiplier. |
| `speed`, `speedPerWave`, `speedWaveCap`, `speedMultiplier` | Movement speed: `(speed + min(wave * speedPerWave, speedWaveCap)) * speedMultiplier`. |
| `points`, `radius`, `scale`, `deathExplosion` | Score, collision radius, visual scale, and death explosion size. Set radius and scale separately. |
| `stopDistance`, `strafeSpeed`, `turnRate`, `turretRate`, `contactDamage` | Movement, aiming and collision damage. |
| `spawnWave`, `spawnModulo`, `spawnRemainder` | Earliest wave and zero-based spawn-index pattern; a zero modulo disables ordinary spawning. When patterns overlap, priority is rocket semi, AA, kamikaze, artillery, then drone; otherwise a tank spawns. Bosses are spawned separately on boss waves. |
| `projectileDamage`, `projectileSpeed`, `projectileSpeedPerWave`, `projectileSpeedCap`, `projectileLife` | Weapon damage, initial speed, wave speed bonus and cap, and lifetime. For kamikazes, damage is applied once to a player in the blast radius. For AA, damage is per explosion. All damage is also multiplied by the selected difficulty. |
| `fireInterval`, `fireWaveReduction`, `fireWaveReductionCap`, `fireRandom`, `initialCooldown`, `initialRandom` | Time between attacks, wave reduction and cap, random extra delay, and initial delay plus random extra delay. AA uses the base interval and random delay between bursts. |
| `spread`, `shotCount` | Angular separation and number of projectiles or AA explosions per burst. |
| `explosionRadius`, `warningDelay`, `warningSpread`, `burstInterval` | Kamikaze blast radius or AA explosion radius; AA warning duration, placement spread around the player, and delay between the nine shots. Warnings persist if the gun is destroyed. |
| `rocketTurn`, `rocketAcceleration`, `rocketMaxSpeed`, `easyInterval`, `normalInterval`, `hardInterval` | Rocket semi homing and speed parameters, and difficulty multipliers for its firing interval. Lower multipliers fire faster. |

Kamikazes pursue the player and explode on contact or destruction. AA guns mark each delayed impact with a flashing crosshair and circle. Rocket semis fire homing rockets.

## Music tracks

The soundtrack switches between menu, wave-combat, and boss music using the MP3 tracks in `sound/`. Missing or unsupported tracks fall back to the built-in synthesized scores. Music starts after the first user interaction and follows the music setting and master volume.

## Checks

With Node.js 18 or later:

```sh
npm test
npm run check
npm run build
```

Rebuild `blackout.js` after editing `enemies.csv`, `core.js`, `audio.js`, `renderer.js`, or `game.js`. The dependency-free build script combines the sheet and source modules into a browser script.

The tests cover continuous projectile collision, wave scaling, sector rotation, aiming, camera tracking, terrain generation, movement and drift, gun overheating, rocket acceleration and damage, pause, dash protection, upgrade transitions, boss spawning, records, and restart behavior.

## GitHub Pages

The existing workflow deploys on pushes to `main`. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. All game assets use relative paths, so repository subpath hosting works without configuration.

Nothing is sent to a backend, and the game does not need an internet connection once its files have loaded. Audio begins only after a user gesture. Current Chrome, Edge, Firefox, and Safari support the required Canvas, Web Audio, and ES modules APIs. Fullscreen is offered when the browser supports it.

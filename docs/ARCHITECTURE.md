# Architecture

`game.js` is the browser bootstrap. It creates a shared runtime and composes the focused modules in dependency order.

- `state.js` owns DOM/bootstrap state, persistence (`blackout.settings` and `blackout.best`), lifecycle, and UI state transitions.
- `input.js` binds keyboard, pointer, touch, menu, and settings controls.
- `entities.js` manages effects, particles, explosions, and decals.
- `combat.js` owns player weapons, movement, damage, enemy AI, projectiles, and simulation updates.
- `waves.js` creates wave plans, sectors, and enemies.
- `upgrades.js` renders the HUD and manages upgrades, pause/end states, and settings UI.
- `loop.js` advances simulation/effects and renders each animation frame.
- `constants.js` contains shared gameplay tuning constants.

The runtime object is the data-flow boundary: state creates it, composition adds public operations, input invokes those operations, and the loop calls combat/effects before rendering. This preserves the public runtime operations used by tests without introducing dependencies.

## Build and tests

`npm run build` validates the CSV inputs, regenerates `enemy-data.js`, `level-data.js`, and `weapon-data.js`, then concatenates modules in the explicit order in `scripts/build.mjs`. Imports/exports are removed for the checked-in, offline `blackout.js` bundle, which remains the browser entry from `index.html`.

`tests/game.test.js` concatenates the same source-module order into its small browser adapter, replacing only rendering and sound. It exercises gameplay behavior through the runtime API. Core, localization, and renderer tests cover their respective isolated modules. Run `npm test`; `npm run check` syntax-checks sources and the generated bundle.

# Audio Lab Usage

Use the Audio Lab to listen to Nuclear Shooter's sound effects, adjust their
parameters, and export a complete `sounds.csv`. The lab uses the same audio
library as the game, without running gameplay or music.

## Quick start

You need Node.js 18 or later, npm, and Python 3. The project has no npm
dependencies to install; `npm start` uses `python3` to serve the files.

From your local repository, get the Audio Lab branch:

```bash
git fetch origin
git switch feature/class-based-audio
git pull --ff-only origin feature/class-based-audio
```

Save or commit any local work before updating your checkout. Then start the
server from the directory containing `package.json`:

```bash
npm start
```

Open the [Audio Lab](http://localhost:8080/audio-test.html). Keep the terminal
running, and press `Ctrl+C` there when you want to stop the server.

Use the HTTP address, not a double-clicked `file://` page: the Audio Lab loads
JavaScript modules. If Python is available as `python` rather than `python3`,
you can start the server directly:

```bash
python -m http.server 8080 --bind 127.0.0.1
```

## Tune a sound

1. Select an effect from the list, or use the effect dropdown on a narrow screen.
2. Start at a low master volume and press **Play sound**.
3. Under **Edit CSV parameters**, change a base value or variation percentage.
4. Press Play again to hear the edited recipe. No rebuild is needed while tuning
   inside the page.
5. Switch between effects as needed. Your edits remain in the current page
   session.

Parameter edits stop active sounds and queued bursts before applying the change.
For a rotor loop, start it again after editing. Playback controls remain visible
while scrolling through the parameter table.

- **Base value:** The central parameter value. Durations are in seconds,
  frequencies in Hz, and gains and ratios are unitless.
- **Variation %:** Symmetric variation around the base value when Randomize is
  enabled. A base value of `1` and variation of `20` samples between `0.8` and
  `1.2`. A variation of `0` keeps that parameter fixed.
- **Chance parameters:** Values such as `heavyChance` and `debrisChance` range
  from `0` to `1`. For example, `0.25` means a 25% chance. Their variation is
  fixed at zero.

## Playback controls

- **Play sound:** Starts one playback using the current settings. For the rotor,
  the same button starts or stops its continuous loop.
- **Burst ×5:** Attempts five plays, 120 milliseconds apart. The status message
  reports how many started and how many were blocked by the voice limit. This
  control is unavailable for the rotor.
- **Stop all / Escape:** Stops active sounds and cancels queued bursts. Switching
  effects also stops the previous sound.
- **Randomize:** Enabled by default. Disabling it uses base values and a fixed
  noise-buffer offset, and omits chance-based heavy/debris layers. It is an
  audition setting, not a CSV field.
- **Spatial audio:** Enables stereo placement. When disabled, the effect is
  centered regardless of the pan slider.
- **Stereo position:** Moves a spatial effect left or right. Headphones are useful
  for comparing placement.
- **Max voices:** Limits simultaneous playbacks of the selected effect, including
  delayed layers. When the limit is reached, new plays are rejected rather than
  cutting off existing voices. Changing the limit in the lab stops active sounds.
- **Master volume:** Adjusts the listening level for the lab. Start low,
  particularly when increasing gain parameters or testing overlapping sounds.
- **Rotor speed:** Changes the running rotor's speed input. This is an audition
  control, separate from the rotor's editable CSV parameters.
- **Reset effect:** Restores the selected effect's parameters, spatial setting,
  and voice limit to the defaults loaded when the page opened. It also restores
  Randomize and centered panning for that effect, and resets the rotor speed
  control when applicable. Other effects' edits and master volume are preserved.

The waveform is a live mono monitor of the actual output after the limiter.
It is not a recording or a separate display of the left and right channels.
Moving the page into the background stops active playback.

## Save changes and use them in the game

1. Fix any invalid fields. Playback and download remain disabled if an invalid
   draft exists in any effect, including an effect you are not currently viewing.
2. Click **Download sounds.csv** under **Save your sound library**.
3. Locate the downloaded file. Your browser may rename it if a file with that
   name already exists.
4. Back up your existing project CSV if needed, then replace the repository's
   root `sounds.csv` with the downloaded file, keeping the filename `sounds.csv`.
5. Rebuild from the project directory:

   ```bash
   npm run build
   ```

6. Refresh the Audio Lab to load the saved defaults, or open the
   [game](http://localhost:8080/) to hear them in gameplay.

The download contains all effects, not just the selected or modified ones.
The browser downloads a file; it does not overwrite your repository's CSV.
Editing in the page also does not change an already-open game.

**Download before refreshing or closing the page.** Edits are held in memory and
are not restored automatically. The lab starts from generated
`audio/sound-data.js`; it does not read a newly downloaded CSV automatically or
provide a CSV import control.

### What is included in the CSV?

| Setting | Exported? |
| --- | --- |
| Parameter base values | Yes |
| Parameter variation ranges | Yes, as fractions rather than percentages |
| Spatial audio setting per effect | Yes |
| Max voices per effect | Yes |
| Randomize checkbox | No |
| Master volume and stereo position | No |
| Rotor speed audition control | No |

For example, variation entered as `20` in the editor is saved as `0.2` in the
CSV's `spread` column. Units and effect/parameter names are preserved.

## Edit the CSV directly

The header is:

```csv
effect,param,value,spread,spatial,maxVoices,unit
```

Each row describes one parameter. Put `spatial` and `maxVoices` on the first
row of each effect, leaving those cells blank on following rows. Repeated
metadata is accepted only when it is identical.

- **Values:** Must be finite and nonnegative. Frequency and duration must be
  greater than zero.
- **Spread:** Must be at least `0` and less than `1`; this is a fraction, not a
  percentage.
- **Chance values:** Must be between `0` and `1`, with spread `0`.
- **Spatial:** Must be `true` or `false`.
- **Max voices:** Must be an integer from `1` to `128`.
- **Units:** Must be `duration`, `hertz`, `gain`, or `ratio`. Keep the existing
  unit for each parameter.
- **Schema:** Keep all existing effects and required parameters. Unknown names,
  duplicate rows, missing parameters, and conflicting metadata are rejected.

Run a build after editing the CSV directly. Do not hand-edit the generated
`audio/sound-data.js` or `blackout.js` files.

## Commands and generated files

| Command | Purpose |
| --- | --- |
| `npm start` | Serve the project at `http://localhost:8080`. |
| `npm run build:sounds` | Validate `sounds.csv` and regenerate `audio/sound-data.js` for the Audio Lab. |
| `npm run build` | Regenerate sound data and the game's `blackout.js` bundle, along with the other game data. |
| `npm run check` | Check JavaScript syntax. |
| `npm test` | Run the automated tests. |

For Audio Lab-only testing, `npm run build:sounds` is sufficient. To update the
game too, use `npm run build`. Neither command requires restarting an already
running local server; refresh the browser afterward.

When committing sound changes, include `sounds.csv` and the regenerated
`audio/sound-data.js` and `blackout.js` together. Review the diff before committing.

## Troubleshooting

- **The page is missing:** Check that you are on the updated
  `feature/class-based-audio` branch and that `audio-test.html`, `audio-test.js`,
  and `audio-test.css` are in the project root.
- **The page does not load:** Run the server from the repository root and use
  the HTTP address. If `python3` is not found, use the direct Python command
  above with the command available on your system.
- **Port 8080 is busy:** Stop the earlier server, or run
  `python3 -m http.server 8081 --bind 127.0.0.1` and open
  [the Audio Lab on port 8081](http://localhost:8081/audio-test.html).
- **There is no sound:** Click Play to enable audio, check the master volume,
  and check your browser/system output. Resolve any validation errors. A message
  about unavailable Web Audio means this browser cannot initialize the engine.
- **Play or Download is disabled:** Find the effect named in the validation
  message and correct its invalid or blank fields, or use Reset effect for that
  effect. Invalid drafts are retained when switching effects.
- **Randomize sounds unchanged:** Check that the parameter has nonzero
  variation. Zero-spread parameters intentionally remain fixed.
- **Panning has no effect:** Enable Spatial audio for the selected effect.
  Start another playback after moving the slider, or restart the rotor.
- **The rotor stopped while editing:** This is intentional. Parameter edits
  stop playback; press Start rotor again to audition the new recipe.
- **CSV edits do not appear:** Replace the correct root CSV, run the appropriate
  build, and refresh. Download any unsaved page edits before refreshing.
- **The game still uses old sounds:** Run the full `npm run build`, not only
  `npm run build:sounds`, and refresh the game.

For class construction, playback overrides, listener positioning, and the
compatibility facade, see the audio library section in `README.md`.

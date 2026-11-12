import { clamp, mapForWave, wavePlan, ENEMIES } from '../core.js';
import { SoundEngine } from '../audio.js';
import { Renderer } from '../renderer.js';
import { languages, setLocale, t } from '../i18n.js';

export function createState() {
    const $ = (id) => document.getElementById(id);
    const canvas = $('game'),
        arena = $('arena'),
        overlay = $('overlay'),
        dialog = $('settings-dialog');
    const panels = ['intro-panel', 'pause-panel', 'over-panel', 'upgrade-panel'];
    const defaults = {
        volume: 0.6,
        muted: false,
        music: true,
        shake: !matchMedia('(prefers-reduced-motion: reduce)').matches,
        effects: true,
        difficulty: 'normal',
        language: 'en'
    };
    const read = (key, fallback) => {
        try {
            return JSON.parse(localStorage.getItem(key)) ?? fallback;
        } catch {
            return fallback;
        }
    };

    const stored = read('blackout.settings', {}),
        settings = { ...defaults };

    for (const key of ['muted', 'music', 'shake', 'effects'])
        if (typeof stored?.[key] === 'boolean') settings[key] = stored[key];
    if (typeof stored?.volume === 'number') settings.volume = clamp(stored.volume, 0, 1);
    if (['easy', 'normal', 'hard'].includes(stored?.difficulty))
        settings.difficulty = stored.difficulty;
    if (languages[stored?.language]) settings.language = stored.language;

    setLocale(settings.language);
    const write = (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            /* Private mode can disable storage. */
        }
    };

    const sound = new SoundEngine(settings),
        renderer = new Renderer(canvas, settings),
        keys = new Set();
    const pointer = { x: 600, y: 230, screenX: null, screenY: null, down: false };
    const bestValue = read('blackout.best', 0);
    const g = {
        world: { width: 1600, height: 900 },
        state: 'ready',
        pointer,
        touch: matchMedia('(pointer:coarse)').matches,
        enemies: [],
        bullets: [],
        particles: [],
        pickups: [],
        explosions: [],
        deathBursts: [],
        warnings: [],
        floaters: [],
        decals: [],
        treadMarks: [],
        wreckSmoke: [],
        time: 0,
        visualTime: 0,
        shake: 0,
        wave: 1,
        score: 0,
        kills: 0,
        best:
            typeof bestValue === 'number' && Number.isFinite(bestValue)
                ? Math.max(0, bestValue)
                : 0,
        combo: 0,
        comboTimer: 0,
        spawnRemaining: 0,
        spawnTimer: 0,
        waveWait: -1,
        bannerTime: 0,
        hudTimer: 0,
        testRange: null,
        camera: { x: 0, y: 0, zoom: 1 },
        map: mapForWave(1)
    };
    const runtime = {
        $,
        canvas,
        arena,
        overlay,
        dialog,
        panels,
        settings,
        read,
        write,
        saveSettings: () => write('blackout.settings', settings),
        sound,
        renderer,
        keys,
        pointer,
        g,
        pad: (n, length = 6) => String(Math.floor(n)).padStart(length, '0'),
        clock: (value) =>
            `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`,
        t,
        upgrades: {},
        choices: [],
        joystick: { x: 0, y: 0, id: null },
        firePointer: null,
        gamePointer: null,
        lastTime: 0,
        settingsPaused: false,
        starting: false
    };
    function newPlayer() {
        return {
            x: g.world.width * 0.43,
            y: g.world.height * 0.52,
            vx: 0,
            vy: 0,
            angle: -Math.PI / 2,
            cannonAngle: -Math.PI / 2,
            bank: 0,
            pitch: 0,
            health: 100,
            maxHealth: 100,
            cooldown: 0,
            heat: 0,
            overheated: false,
            invulnerable: 0,
            dashTime: 0,
            dashCooldown: 0,
            flareCooldown: 0,
            lowHealthAlarm: 0,
            missileAlarm: 0,
            rockets: 3,
            maxRockets: 3,
            rocketTimer: 0,
            rocketCooldown: 0,
            rocketSide: -1,
            muzzle: 0
        };
    }

    function readTestRange() {
        const enemy = $('test-enemy').value,
            validEnemy = Object.hasOwn(ENEMIES, enemy) ? enemy : 'tank';
        const number = (id, fallback, min, max) =>
            clamp(Number($(`test-${id}`).value) || fallback, min, max);
        return {
            enemy: validEnemy,
            interval: number('interval', 1, 0.2, 5),
            maxActive: number('max-active', 3, 1, 20),
            health: number('health', 1, 0.25, 5),
            distance: number('distance', 350, 120, 700),
            upgrades: {
                damage: number('damage', 0, 0, 4),
                fireRate: number('fire-rate', 0, 0, 4),
                armor: number('armor', 0, 0, 4),
                engine: number('engine', 0, 0, 3),
                rockets: number('rockets', 0, 0, 3)
            }
        };
    }

    function applyStartingUpgrades() {
        const p = g.player;
        p.maxHealth += 25 * (runtime.upgrades.armor || 0);
        p.health = p.maxHealth;
        p.maxRockets += runtime.upgrades.rockets || 0;
        p.rockets = p.maxRockets;
    }
    g.player = newPlayer();

    function resize() {
        const rect = arena.getBoundingClientRect(),
            old = { ...g.world };
        g.touch = matchMedia('(pointer:coarse), (max-width:600px)').matches;
        g.world.width = clamp(rect.width * 1.3, 680, 1700);
        g.world.height = (g.world.width * rect.height) / rect.width;
        if (old.width && old.height) {
            for (const obj of [
                g.player,
                ...g.enemies,
                ...g.pickups,
                ...g.decals,
                ...g.treadMarks,
                ...g.bullets,
                ...g.particles,
                ...g.floaters,
                ...g.explosions,
                ...g.deathBursts,
                ...g.warnings,
                ...g.wreckSmoke
            ]) {
                obj.x = (obj.x / old.width) * g.world.width;
                obj.y = (obj.y / old.height) * g.world.height;
            }
            pointer.x = (pointer.x / old.width) * g.world.width;
            pointer.y = (pointer.y / old.height) * g.world.height;
            if (pointer.screenX !== null) {
                pointer.screenX = (pointer.screenX / old.width) * g.world.width;
                pointer.screenY = (pointer.screenY / old.height) * g.world.height;
            }
        }
        renderer.resize(g.world, rect, g.map);
        runtime.updateCamera(0, true);
    }

    function clearInput() {
        keys.clear();
        pointer.down = false;
        runtime.gamePointer = null;
        runtime.firePointer = null;
        runtime.joystick = { x: 0, y: 0, id: null };
        $('joystick-knob').style.transform = '';
    }

    function updateStateText() {
        $('feed-status').textContent = t(`status.${g.state}`);
        $('mission-status').textContent = t(`mission.${g.state}`);
    }

    function setState(state, panel) {
        g.state = state;
        clearInput();
        overlay.hidden = !panel;
        panels.forEach((id) => ($(id).hidden = id !== panel));
        $('pause').hidden = state !== 'playing';
        $('touch-controls').hidden = state !== 'playing';
        $('bottom-hud').hidden = !['playing', 'ready'].includes(state);
        arena.classList.toggle('playing', state === 'playing');
        sound.setActive(state === 'playing');
        updateStateText();
        if (state === 'ready' || state === 'over') sound.setMusicScene('menu');
    }

    function focusPanel(id) {
        requestAnimationFrame(() => $(id).focus({ preventScroll: true }));
    }

    function announce(tag, title, note = '', duration = 2.5) {
        $('announcement-tag').textContent = tag;
        $('announcement-title').textContent = title;
        $('announcement-note').textContent = note;
        g.bannerTime = duration;
        $('announcement').classList.add('visible');
    }

    function activateMenuMusic() {
        if (g.state === 'ready' || g.state === 'over') void sound.init();
    }

    async function start(mode = 'operation') {
        if (dialog.open || runtime.starting) return;
        runtime.starting = true;
        await sound.init();
        g.testRange = mode === 'test' ? readTestRange() : null;
        g.player = newPlayer();
        runtime.upgrades = g.testRange ? { ...g.testRange.upgrades } : {};
        applyStartingUpgrades();
        for (const key of [
            'enemies',
            'bullets',
            'particles',
            'pickups',
            'explosions',
            'deathBursts',
            'warnings',
            'floaters',
            'decals',
            'treadMarks',
            'wreckSmoke'
        ])
            g[key] = [];
        g.time = 0;
        g.wave = 0;
        g.score = 0;
        g.kills = 0;
        g.combo = 0;
        g.comboTimer = 0;
        g.shake = 0;
        g.waveWait = -1;
        pointer.x = g.player.x;
        pointer.y = g.player.y - 150;
        pointer.screenX = null;
        pointer.screenY = null;
        runtime.updateCamera(0, true);
        setState('playing');
        if (g.testRange) {
            g.wave = 1;
            g.plan = wavePlan(1, settings.difficulty);
            g.spawnRemaining = 0;
            g.spawnTimer = 0;
            g.map = mapForWave(1);
            renderer.setMap(g.map);
            renderer.mapLabel = t(`map.${g.map.layout}`);
            $('sector-name').textContent = renderer.mapLabel;
            $('wave').innerHTML = 'TEST RANGE';
            sound.setMusicScene('waves');
        } else runtime.nextWave();
        runtime.updateHud();
        canvas.focus({ preventScroll: true });
        runtime.starting = false;
    }

    function applyLanguage() {
        setLocale(settings.language);
        document.documentElement.lang = settings.language;
        document.querySelectorAll('[data-i18n]').forEach((element) => {
            element.innerHTML = t(element.dataset.i18n);
        });
        document
            .querySelectorAll('[data-i18n-aria]')
            .forEach((element) => element.setAttribute('aria-label', t(element.dataset.i18nAria)));
        document.querySelectorAll('[data-difficulty]').forEach((button) => {
            button.textContent = t(`difficulty.${button.dataset.difficulty}`);
        });
        $('language').value = settings.language;
        $('language').setAttribute('aria-label', t('nav.language'));
        $('settings-open').setAttribute('aria-label', t('settings.label'));
        $('settings-open').title = t('settings.label');
        $('fullscreen').setAttribute('aria-label', t('settings.fullscreen'));
        $('fullscreen').title = t('settings.fullscreen');
        $('fullscreen-exit').textContent = t('frame.exit');
        $('sound-toggle').title = `${t(settings.muted ? 'nav.soundOn' : 'nav.soundOff')} (M)`;
        renderer.mapLabel = t(`map.${g.map.layout}`);
        $('sector-name').textContent = renderer.mapLabel;
        updateStateText();
        runtime.updateSettingsUI();
        runtime.updateHud();
    }

    function initialize() {
        new ResizeObserver(resize).observe(arena);
        resize();
        applyLanguage();
        requestAnimationFrame(runtime.frame);
    }

    return Object.assign(runtime, {
        newPlayer,
        readTestRange,
        applyStartingUpgrades,
        resize,
        clearInput,
        updateStateText,
        setState,
        focusPanel,
        announce,
        activateMenuMusic,
        start,
        applyLanguage,
        initialize
    });
}

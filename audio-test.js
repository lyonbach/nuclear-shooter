import { createAudioEngine, EFFECT_CLASSES } from './audio/index.js';
import { SOUND_DATA } from './audio/sound-data.js';

// Labels only: synthesis and defaults come directly from the production library.
const catalog = {
    shot: ['Gun shot', 'Weapons', 'Short cannon report with a sharp attack.'],
    enemy: ['Enemy shot', 'Weapons', 'Enemy gunfire, isolated from the battlefield.'],
    aa: ['Anti-aircraft shot', 'Weapons', 'The anti-aircraft firing sound.'],
    rocket: ['Rocket launch', 'Weapons', 'Launch snap followed by delayed engine ignition.'],
    missile: ['Missile launch', 'Weapons', 'Missile launch with a delayed propulsion layer.'],
    hit: ['Impact', 'Combat', 'A projectile striking its target.'],
    explode: ['Explosion', 'Combat', 'Layered blast, low-end body, and randomized debris.'],
    flare: ['Flare', 'Combat', 'Countermeasure deployment.'],
    dash: ['Dash', 'Combat', 'A short burst of acceleration.'],
    damage: ['Player damage', 'Combat', 'The cockpit damage cue.'],
    lowHealth: ['Low health', 'Signals', 'Low-health warning pulse.'],
    missileAlert: ['Missile warning', 'Signals', 'Incoming missile warning.'],
    pickup: ['Pickup', 'Signals', 'Collectible arpeggio.'],
    wave: ['New wave', 'Signals', 'The next enemy wave announcement.'],
    upgrade: ['Upgrade', 'Signals', 'Upgrade selection chime.'],
    alert: ['Alert', 'Signals', 'General tactical alert.'],
    ui: ['UI blip', 'Signals', 'A short interface confirmation.'],
    rotor: ['Helicopter rotor', 'Engine', 'Continuous rotor loop. Stop manually or press Escape.']
};
const $ = id => document.getElementById(id);
const { engine, rotor } = createAudioEngine();
let selected = 'shot', epoch = 0, burstTimer = null, analyser = null, samples = null;
let readiness = null, frame = null, peak = 0;
const pans = new Map();
const canvas = $('waveform'), pen = canvas.getContext('2d');
engine.configure({ volume: 0.35, music: false });
const current = () => engine.effect(selected);
const label = key => catalog[key]?.[0] || key;

function status(message, error = false) {
    $('status').textContent = message;
    $('status').dataset.error = String(error);
}
function stopAll(announce = true) {
    epoch++;
    clearTimeout(burstTimer);
    burstTimer = null;
    for (const effect of engine.effects.values()) effect.stop();
    syncTransport();
    if (announce) status('All sounds stopped.');
}
function syncTransport() {
    $('play').textContent = selected === 'rotor' ? (rotor.running ? 'Stop rotor' : 'Start rotor') : 'Play sound';
    $('burst').disabled = selected === 'rotor';
}
async function ready() {
    if (readiness) return readiness;
    readiness = (async () => {
        engine.init();
        if (!engine.ctx) throw new Error('Web Audio is unavailable in this browser.');
        await engine.resume();
        if (engine.ctx.state !== 'running') throw new Error('Audio is suspended. Click Play again to enable it.');
        if (!analyser) {
            analyser = engine.ctx.createAnalyser();
            analyser.fftSize = 2048;
            samples = new Float32Array(analyser.fftSize);
            engine.limiter.disconnect();
            engine.limiter.connect(analyser);
            analyser.connect(engine.ctx.destination);
        }
        $('sample-rate').textContent = `${(engine.ctx.sampleRate / 1000).toFixed(1)} kHz`;
    })();
    try { await readiness; } finally { readiness = null; }
}
function playOne(key = selected) {
    const effect = engine.effect(key);
    const voice = effect.play({ pan: pans.get(key) || 0 });
    syncTransport();
    return voice;
}
async function play() {
    const ticket = epoch, key = selected;
    try {
        await ready();
        if (ticket !== epoch) return;
        if (key === 'rotor' && rotor.running) { rotor.stop(); syncTransport(); status('Rotor stopped.'); return; }
        const voice = playOne(key);
        status(voice ? `${label(key)} playing${key === 'rotor' ? ' continuously' : ''}.` : 'Voice limit reached. Existing sounds are allowed to finish.');
    } catch (error) { status(error.message, true); }
}
async function burst() {
    if (selected === 'rotor') return;
    stopAll(false);
    const ticket = epoch, key = selected;
    try {
        await ready();
        if (ticket !== epoch) return;
        let attempted = 0, accepted = 0;
        const next = () => {
            if (ticket !== epoch) return;
            try {
                attempted++;
                if (playOne(key)) accepted++;
                status(`Burst ${attempted}/5 · ${accepted} started · ${attempted - accepted} blocked by voice limit.`);
                if (attempted < 5) burstTimer = setTimeout(next, 120);
            } catch (error) { stopAll(false); status(error.message, true); }
        };
        next();
    } catch (error) { status(error.message, true); }
}
function renderList() {
    const query = $('search').value.trim().toLowerCase();
    const keys = Object.keys(catalog).filter(key => `${label(key)} ${key} ${engine.effect(key).constructor.name}`.toLowerCase().includes(query));
    $('effect-list').replaceChildren();
    let group = '';
    for (const key of keys) {
        if (catalog[key][1] !== group) {
            group = catalog[key][1];
            const heading = document.createElement('h3');
            heading.className = 'group-title'; heading.textContent = group;
            $('effect-list').append(heading);
        }
        const button = document.createElement('button');
        button.className = 'effect-button'; button.dataset.effect = key;
        button.setAttribute('aria-pressed', String(key === selected));
        const name = document.createElement('span');
        name.textContent = key === 'rotor' ? 'LOOP' : '';
        button.append(document.createTextNode(label(key)), name);
        button.addEventListener('click', () => select(key));
        $('effect-list').append(button);
    }
    $('effect-count').textContent = `${keys.length} / ${EFFECT_CLASSES.length}`;
    $('no-results').hidden = keys.length > 0;
}
function select(key) {
    stopAll(false);
    selected = key;
    $('mobile-effect').value = key;
    const effect = current();
    $('effect-name').textContent = label(key);
    $('effect-class').textContent = `${effect.constructor.name} / ${key}`;
    $('effect-kind').textContent = key === 'rotor' ? 'LOOP' : 'ONE-SHOT';
    $('effect-description').textContent = catalog[key][2];
    $('randomize').checked = effect.randomize;
    $('spatial').checked = effect.spatial;
    $('max-voices').value = effect.maxVoices;
    $('pan').value = pans.get(key) || 0;
    $('rotor-controls').hidden = key !== 'rotor';
    syncPan();
    syncTransport();
    for (const button of $('effect-list').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.effect === key));
    $('parameters').replaceChildren();
    for (const [name, param] of Object.entries(effect.params)) {
        const row = document.createElement('tr');
        for (const value of [name, param.value, `±${Number((param.spread * 100).toFixed(2))}%`]) {
            const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
        }
        $('parameters').append(row);
    }
    $('parameter-count').textContent = `(${Object.keys(effect.params).length})`;
    status('Ready. Press Play to hear this effect.');
}
function syncPan() {
    const value = Number($('pan').value);
    pans.set(selected, value);
    $('pan').disabled = !current().spatial;
    $('pan-value').textContent = !current().spatial ? 'Centered (spatial off)' : value === 0 ? 'Center' : `${Math.round(Math.abs(value) * 100)}% ${value < 0 ? 'left' : 'right'}`;
}
function draw() {
    const w = canvas.width, h = canvas.height;
    pen.clearRect(0, 0, w, h);
    pen.strokeStyle = '#35402e'; pen.lineWidth = 1;
    pen.beginPath();
    for (let x = 0; x <= w; x += 80) { pen.moveTo(x, 0); pen.lineTo(x, h); }
    for (let y = 0; y <= h; y += 45) { pen.moveTo(0, y); pen.lineTo(w, y); }
    pen.stroke();
    peak = 0;
    if (analyser) analyser.getFloatTimeDomainData(samples);
    pen.strokeStyle = '#d9eb90'; pen.lineWidth = 2; pen.beginPath();
    for (let x = 0; x < w; x++) {
        const sample = samples ? samples[Math.floor(x * samples.length / w)] : 0;
        peak = Math.max(peak, Math.abs(sample));
        const y = h / 2 - sample * h * .45;
        if (x === 0) pen.moveTo(x, y); else pen.lineTo(x, y);
    }
    pen.stroke();
    $('voice-count').textContent = `${current().voiceCount} / ${current().maxVoices} voices`;
    $('context-state').textContent = engine.ctx ? `Audio ${engine.ctx.state}` : 'Audio idle';
    if (rotor.running) rotor.update({ speed: Number($('speed').value) });
    frame = requestAnimationFrame(draw);
}
$('play').addEventListener('click', play);
$('burst').addEventListener('click', burst);
$('stop-all').addEventListener('click', () => stopAll());
$('search').addEventListener('input', renderList);
$('mobile-effect').addEventListener('change', () => select($('mobile-effect').value));
$('randomize').addEventListener('change', () => { current().randomize = $('randomize').checked; });
$('spatial').addEventListener('change', () => { current().spatial = $('spatial').checked; syncPan(); });
$('pan').addEventListener('input', syncPan);
$('volume').addEventListener('input', () => {
    engine.configure({ volume: Number($('volume').value) / 100, music: false });
    $('volume-value').textContent = `${$('volume').value}%`;
});
$('speed').addEventListener('input', () => { $('speed-value').textContent = `${Math.round(Number($('speed').value) * 100)}%`; });
$('max-voices').addEventListener('change', () => {
    const value = Number($('max-voices').value);
    if (!Number.isInteger(value) || value < 1 || value > 32) {
        $('max-voices').value = current().maxVoices;
        status('Max voices must be a whole number from 1 to 32.', true);
        return;
    }
    stopAll(false);
    current().maxVoices = value;
    status(`Voice limit set to ${value} for this session.`);
});
$('reset').addEventListener('click', () => {
    Object.assign(current(), { randomize: true, spatial: SOUND_DATA[selected].spatial, maxVoices: SOUND_DATA[selected].maxVoices });
    pans.set(selected, 0);
    if (selected === 'rotor') { $('speed').value = .5; $('speed-value').textContent = '50%'; }
    select(selected); status('Effect defaults restored. Master volume is unchanged.');
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') stopAll(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(false); });
window.addEventListener('pagehide', () => {
    stopAll(false); cancelAnimationFrame(frame);
    // Suspend instead of closing so a back/forward-cache return can resume.
    engine.ctx?.suspend().catch(() => {});
});
window.addEventListener('pageshow', event => { if (event.persisted) draw(); });
// Read-only diagnostics for browser checks; never exposes the engine itself.
window.audioLabSnapshot = () => ({
    selected, context: engine.ctx?.state || 'idle', voices: engine.voices.size,
    randomize: current().randomize, spatial: current().spatial, maxVoices: current().maxVoices,
    pan: pans.get(selected) || 0, volume: engine.volume, rotor: rotor.running, peak,
    voicePans: [...current().voices].map(voice => voice.panner?.pan.value ?? 0)
});
for (const [key, [name]] of Object.entries(catalog)) {
    const option = document.createElement('option');
    option.value = key; option.textContent = name;
    $('mobile-effect').append(option);
}
renderList(); select(selected);
$('play').disabled = false;
draw();

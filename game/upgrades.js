import { clamp, UPGRADES } from '../core.js';
export function createUpgrades(runtime) {
    const { g, settings, sound, $, dialog, canvas, t, pad, clock, write, saveSettings } = runtime;

    function updateHud() {
        const p = g.player, percent = Math.ceil(p.health / p.maxHealth * 100), multiplier = Math.min(5, 1 + Math.floor(g.combo / 3));
        $('wave').innerHTML = `${t('hud.wave')} <b>${pad(g.wave, 2)}</b>`;
        $('health').textContent = percent;
        $('health-fill').style.width = `${percent}%`;
        $('health-fill').style.background = percent <= 25 ? '#ee9b6b' : '#dbea9b';
        $('hull-status').textContent = t(percent <= 25 ? 'hud.critical' : percent <= 60 ? 'hud.damaged' : 'hud.healthy');
        $('hull-status').style.color = percent <= 25 ? '#ee9b6b' : '';
        $('score').textContent = pad(g.score);
        $('best').textContent = pad(Math.max(g.best, g.score));
        $('hostiles').textContent = g.state === 'ready' ? t('hud.scanning') : `${g.enemies.length + g.spawnRemaining} ${t('hud.hostiles')}`;
        $('flight-time').textContent = `${t('flight.label')} ${clock(g.time)}`;
        $('dash-status').textContent = p.dashCooldown > 0 ? `${p.dashCooldown.toFixed(1)} s` : t('dash.ready');
        $('dash-fill').style.width = `${(1 - p.dashCooldown / (3.5 * Math.pow(.87, runtime.upgrades.engine || 0))) * 100}%`;
        $('dash-ability').classList.toggle('cooldown', p.dashCooldown > 0);
        $('rocket-status').textContent = `${p.rockets} / ${p.maxRockets}`;
        $('rocket-fill').style.width = `${p.rockets === p.maxRockets ? 100 : p.rocketTimer / runtime.rocketRecharge() * 100}%`;
        $('rocket-ability').classList.toggle('cooldown', p.rockets === 0);
        $('heat-status').textContent = p.overheated ? t('heat.cooling') : `${Math.round(p.heat * 100)}%`;
        $('heat-fill').style.width = `${p.heat * 100}%`;
        $('heat-ability').classList.toggle('overheated', p.overheated);
        $('heat-meter').setAttribute('aria-valuenow', String(Math.round(p.heat * 100)));
        $('heat-meter').setAttribute('aria-valuetext', p.overheated ? t('heat.cooling') : `${Math.round(p.heat * 100)}%`);
        $('touch-dash').disabled = p.dashCooldown > 0;
        $('touch-rocket').disabled = p.rockets === 0;
        $('touch-flare').hidden = settings.difficulty !== 'hard';
        $('touch-flare').disabled = p.flareCooldown > 0;
        $('combo').hidden = multiplier < 2;
        $('combo-value').textContent = `×${multiplier}`;
        const boss = g.enemies.find(e => e.type === 'boss');
        $('boss-hud').hidden = !boss || g.state === 'over';
        if (boss) $('boss-fill').style.width = `${clamp(boss.health / boss.maxHealth * 100, 0, 100)}%`;
    }

    function showUpgrades() {
        g.bullets = [];
        g.bannerTime = 0;
        $('announcement').classList.remove('visible');
        const available = UPGRADES.filter(u => (runtime.upgrades[u.id] || 0) < u.max && (u.id !== 'repair' || g.player.health < g.player.maxHealth * .8));
        runtime.choices = available.map(value => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).slice(0, 3).map(item => item.value);
        if (!runtime.choices.length) runtime.choices = [UPGRADES.find(u => u.id === 'repair')];
        $('upgrade-note').textContent = t('upgrade.note', { wave: g.wave });
        $('upgrade-cards').replaceChildren();
        runtime.choices.forEach((u, i) => {
            const button = document.createElement('button');
            button.className = 'upgrade-card';
            button.type = 'button';
            button.innerHTML = `<span>${u.icon}</span><kbd>${i + 1}</kbd><strong>${t(`upgrade.${u.id}.title`)}</strong><p>${t(`upgrade.${u.id}.description`)}</p><small>${t(`upgrade.${u.id}.detail`)} &nbsp;
             ↗</small>`;
            button.addEventListener('click', () => runtime.selectUpgrade(u.id));
            $('upgrade-cards').append(button);
        });
        runtime.setState('upgrade', 'upgrade-panel');
        sound.play('upgrade');
        requestAnimationFrame(() => $('upgrade-cards').firstElementChild?.focus({ preventScroll: true }));
        runtime.updateHud();
    }

    function selectUpgrade(id) {
        if (g.state !== 'upgrade' || dialog.open || !runtime.choices.some(c => c.id === id)) return;
        runtime.upgrades[id] = (runtime.upgrades[id] || 0) + 1;
        const p = g.player;
        if (id === 'armor') {
            p.maxHealth += 25;
            p.health = Math.min(p.maxHealth, p.health + 35);

        }
        if (id === 'repair') p.health = p.maxHealth;
        if (id === 'rockets') {
            p.maxRockets++;
            p.rockets = p.maxRockets;
            p.rocketTimer = 0;

        }
        p.invulnerable = 1;
        p.dashCooldown = 0;
        runtime.setState('playing');
        sound.play('ui');
        runtime.nextWave();
        canvas.focus({ preventScroll: true });
        runtime.updateHud();
    }

    function pause() {
        if (g.state !== 'playing') return;
        runtime.setState('paused', 'pause-panel');
        runtime.focusPanel('resume');

    }
    async function resume() {
        if (g.state !== 'paused' || dialog.open) return;
        await sound.init();
        runtime.setState('playing');
        canvas.focus({ preventScroll: true });
    }

    function endGame() {
        const previous = g.best;
        g.best = Math.max(g.best, g.score);
        write('blackout.best', g.best);
        runtime.explosion(g.player.x, g.player.y, 140);
        g.bannerTime = 0;
        $('announcement').classList.remove('visible');
        $('boss-hud').hidden = true;
        $('record-label').textContent = t(g.score > previous ? 'record.new' : 'record.again');
        $('result-score').textContent = g.score.toLocaleString(settings.language);
        $('result-wave').textContent = pad(g.wave, 2);
        $('result-kills').textContent = g.kills;
        $('result-time').textContent = clock(g.time);
        runtime.setState('over', 'over-panel');
        runtime.focusPanel('retry');
    }

    function updateSettingsUI() {
        $('volume').value = settings.volume * 100;
        $('volume-value').textContent = `${Math.round(settings.volume * 100)}%`;
        ['music', 'shake', 'effects'].forEach(id => $(id).checked = settings[id]);
        $('sound-toggle').setAttribute('aria-pressed', String(settings.muted));
        $('sound-toggle').setAttribute('aria-label', t(settings.muted ? 'nav.soundOn' : 'nav.soundOff'));
        $('sound-toggle').title = `${t(settings.muted ? 'nav.soundOn' : 'nav.soundOff')} (M)`;
        document.querySelectorAll('[data-difficulty]').forEach(button => {
            const selected = button.dataset.difficulty === settings.difficulty;
            button.classList.toggle('selected', selected);
            button.setAttribute('aria-pressed', String(selected));

        });
    }

    function toggleMute() {
        settings.muted = !settings.muted;
        sound.init();
        sound.configure();
        saveSettings();
        updateSettingsUI();
    }

    function openSettings() {
        runtime.settingsPaused = g.state === 'playing';
        if (runtime.settingsPaused) runtime.pause();
        dialog.showModal();
        sound.init();

    }
    function closeSettings() {
        dialog.close();
        if (runtime.settingsPaused) {
            runtime.settingsPaused = false;
            runtime.resume();

        }
    }
    return { updateHud, showUpgrades, selectUpgrade, pause, resume, endGame, updateSettingsUI, toggleMute, openSettings, closeSettings };
}

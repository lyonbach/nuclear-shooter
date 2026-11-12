import { TAU, enemyType, mapForWave, wavePlan, ENEMIES } from '../core.js';
export function createWaves(runtime) {
    const { g, settings, renderer, sound, $, pad, t } = runtime;
    const announce = (...args) => runtime.announce(...args);

    function nextWave() {
        g.wave++;
        g.plan = wavePlan(g.wave, settings.difficulty);
        g.spawnRemaining = g.plan.count;
        g.spawnIndex = 0;
        g.spawnTimer = 2.4;
        g.waveWait = -1;
        g.map = mapForWave(g.wave);
        g.decals = [];
        g.treadMarks = [];
        g.wreckSmoke = [];
        g.particles = g.particles.filter(particle => !particle.smoke);
        renderer.setMap(g.map);
        renderer.mapLabel = t(`map.${g.map.layout}`);
        $('sector-name').textContent = renderer.mapLabel;
        $('wave').innerHTML = `${t('hud.wave')} <b>${pad(g.wave, 2)}</b>`;
        announce(t(g.plan.boss ? 'wave.bossTag' : 'wave.enemyTag'), t(g.plan.boss ? 'wave.bossTitle' : 'wave.title', { wave: pad(g.wave, 2) }), `${renderer.mapLabel} · ${t(g.plan.boss ? 'wave.bossNote' : g.wave === 1 ? 'wave.firstNote' : 'wave.note')}`, 3.2);
        sound.play(g.plan.boss ? 'alert' : 'wave');
        if (g.plan.boss) runtime.spawnEnemy('boss');
        sound.setMusicScene(g.plan.boss ? 'boss' : 'waves');
    }

    function spawnEnemy(forced) {
        const { width: W, height: H } = g.world, p = g.player;
        let x, y;

        for (let attempt = 0;
            attempt < 8;
            attempt++) {
            const side = Math.floor(Math.random() * 4);
            x = side === 0 ? -45 : side === 1 ? W + 45 : 60 + Math.random() * (W - 120);
            y = side === 2 ? -45 : side === 3 ? H + 45 : 110 + Math.random() * (H - 170);
            if (Math.hypot(x - p.x, y - p.y) > (g.testRange?.distance ?? 300)) break;
        }

        const type = forced || enemyType(g.wave, g.spawnIndex++);
        const stats = ENEMIES[type], health = (stats.health + stats.healthPerWave * g.wave) * g.plan.health;
        const enemy = { x, y, type, health, maxHealth: health, speed: (stats.speed + Math.min(g.wave * stats.speedPerWave, stats.speedWaveCap)) * stats.speedMultiplier, points: stats.points, radius: stats.radius, angle: Math.atan2(p.y - y, p.x - x), turret: 0, cooldown: stats.initialCooldown + Math.random() * stats.initialRandom, charge: 0, hit: 0, seed: Math.random() * TAU };
        if (g.testRange) {
            enemy.health *= g.testRange.health;
            enemy.maxHealth = enemy.health;
        }
        g.enemies.push(enemy);
        return enemy;
    }
    return { nextWave, spawnEnemy };
}

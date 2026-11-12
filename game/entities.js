import { TAU } from '../core.js';

export function createEntities(runtime) {
    const { g, settings, sound } = runtime;

    function burst(x, y, color, count = 10, force = 1, smoke = false) {
        const limit = settings.effects ? 650 : 180, amount = settings.effects ? count : Math.ceil(count * .45);

        for (let i = 0;
            i < amount && g.particles.length < limit;
            i++) {
            const a = Math.random() * TAU, speed = (30 + Math.random() * 170) * force, life = smoke ? 1.1 + Math.random() : .15 + Math.random() * .5;

            g.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, maxLife: life, color, size: smoke ? 6 + Math.random() * 12 : 1 + Math.random() * 2.5, smoke });

        }
    }

    function fireSplinters(x, y, size) {
        const limit = settings.effects ? 650 : 180, amount = settings.effects ? Math.ceil(10 + size / 12) : Math.ceil(5 + size / 24);

        for (let i = 0;
            i < amount && g.particles.length < limit;
            i++) {
            const a = Math.random() * TAU, speed = (100 + Math.random() * 240) * size / 75, life = .16 + Math.random() * .28;

            g.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, maxLife: life, color: Math.random() < .45 ? '#fff0ad' : '#ff9b59', size: .8 + Math.random() * 1.7, fireSplinter: true });

        }
    }

    function explosion(x, y, size = 75) {
        g.explosions.push({ x, y, size, life: .65, maxLife: .65 });
        burst(x, y, '#f9c57f', 46, size / 65);
        burst(x, y, '#28342a', 16, .45, true);
        fireSplinters(x, y, size);

        g.shake = Math.max(g.shake, size / 6);
        sound.play('explode');

    }

    function float(text, x, y, color = '#e2eda9', big = false) {
        g.floaters.push({ text, x, y, life: 1.2, color, big });
    }

    function updateEffects(dt) {
        for (const burst of g.deathBursts) burst.delay -= dt;

        const pendingBursts = [];

        for (const burst of g.deathBursts) {
            if (burst.delay <= 0) explosion(burst.x, burst.y, burst.size);
            else pendingBursts.push(burst);

        }
        g.deathBursts = pendingBursts;

        for (const source of g.wreckSmoke) {
            source.life -= dt;
            source.timer -= dt;

            if (source.life > 0 && source.timer <= 0 && g.particles.length < (settings.effects ? 650 : 180)) {
                for (let i = 0; i < (settings.effects ? 2 : 1); i++) {
                    const life = 4.5 + Math.random() * 2;
                    g.particles.push({ x: source.x + (Math.random() - .5) * 16, y: source.y - 12, vx: (Math.random() - .5) * 16, vy: -22 - Math.random() * 28, life, maxLife: life, smoke: true, persistent: true, color: '#111812b8', size: 14 + Math.random() * 12 });
                }
                source.timer = settings.effects ? 0.32 : 0.6;

            }
        }
        g.wreckSmoke = g.wreckSmoke.filter(source => source.life > 0);

        for (const decal of g.decals) if (decal.burnTime > 0) decal.burnTime -= dt;

        for (const p of g.particles) {
            const drag = p.persistent ? 0.35 : p.smoke ? 1.5 : 3;

            const flareDrift = p.flare ? Math.sin(g.time * 15 + p.flarePhase) * p.flareWobble : 0;

            p.x += (p.vx + flareDrift) * dt;
            p.y += (p.vy + flareDrift * .55) * dt;
            p.vx *= Math.exp(-dt * drag);
            p.vy *= Math.exp(-dt * drag);
            p.life -= dt;

        }
        g.particles = g.particles.filter(p => p.life > 0);

        for (const e of g.explosions) e.life -= dt;
        g.explosions = g.explosions.filter(e => e.life > 0);

        for (const f of g.floaters) {
            f.y -= dt * 30;
            f.life -= dt;

        } g.floaters = g.floaters.filter(f => f.life > 0);

    }
    return { burst, fireSplinters, explosion, float, updateEffects };

}

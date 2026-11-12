import {
    TAU,
    clamp,
    distance,
    turn,
    segmentHitsCircle,
    ENEMIES,
    WEAPONS,
    ROCKET_IGNITION_DELAY
} from '../core.js';

import {
    FLARE_RANGE,
    FLARE_COOLDOWN,
    FLARE_DEFLECTION_CHANCE,
    LOW_HEALTH_ALARM_INTERVAL,
    MISSILE_ALARM_INTERVAL,
    PLAYER_ACCELERATION,
    PLAYER_BANK_RESPONSE,
    PLAYER_DECELERATION,
    PLAYER_TOUCH_TURN_RATE,
    PLAYER_TURN_RATE,
    PLAYER_CANNON_TURN_RATE,
    ROCKET_RAIL_FORWARD,
    ROCKET_RAIL_OFFSET,
    TANK_TRACK_HALF_WIDTH,
    GOLIATH_TRACK_HALF_WIDTH,
    TREAD_MARK_LIFETIME,
    TREAD_MARK_LIMIT,
    TREAD_MARK_SPACING
} from './constants.js';

export function createCombat(runtime) {
    const { g, settings, sound, keys, pointer, $, t } = runtime;
    const burst = (...args) => runtime.burst(...args),
        explosion = (...args) => runtime.explosion(...args),
        float = (...args) => runtime.float(...args);
    const positionalAudio = (source) => {
        const p = g.player,
            distanceToSource = distance(source, p);
        return {
            pan: clamp((source.x - p.x) / (g.world.width * 0.35), -1, 1),
            gain: clamp(1 - distanceToSource / (g.world.width * 0.7), 0.15, 1)
        };
    };

    function gun() {
        const p = g.player,
            w = WEAPONS.gun,
            a = p.cannonAngle + (Math.random() - 0.5) * w.spread,
            speed = w.speed;

        g.bullets.push({
            x: p.x + Math.cos(a) * 39,
            y: p.y + Math.sin(a) * 39,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed,
            life: w.life,
            friendly: true,
            damage: w.damage + (runtime.upgrades.damage || 0) * w.damagePerUpgrade,
            kind: 'gun'
        });

        p.cooldown = w.cooldown * Math.pow(w.cooldownUpgradeFactor, runtime.upgrades.fireRate || 0);
        p.muzzle = w.muzzleTime;

        p.heat = Math.min(1, p.heat + w.heatPerShot);

        if (p.heat >= 1) {
            p.overheated = true;
            float(t('heat.cooling'), p.x, p.y - 55, '#ffb586', true);
        }
        sound.play('shot', (p.x / g.world.width) * 1.4 - 0.7);
    }

    const rocketRecharge = () =>
        WEAPONS.rocket.rechargeTime *
        Math.pow(WEAPONS.rocket.rechargeUpgradeFactor, runtime.upgrades.rockets || 0);
    function launchRocket() {
        const p = g.player,
            w = WEAPONS.rocket;
        if (g.state !== 'playing' || !p.rockets || p.rocketCooldown > 0) return;

        let target = null,
            dist = Infinity;

        for (const e of g.enemies) {
            const d = distance(e, g.touch ? p : pointer);
            if (d < dist) {
                target = e;
                dist = d;
            }
        }
        const a = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.cannonAngle;

        const railAngle = a + Math.PI / 2,
            side = p.rocketSide;

        p.rocketSide *= -1;

        g.bullets.push({
            x:
                p.x +
                Math.cos(a) * ROCKET_RAIL_FORWARD +
                Math.cos(railAngle) * ROCKET_RAIL_OFFSET * side,
            y:
                p.y +
                Math.sin(a) * ROCKET_RAIL_FORWARD +
                Math.sin(railAngle) * ROCKET_RAIL_OFFSET * side,
            vx: Math.cos(a) * w.launchSpeed,
            vy: Math.sin(a) * w.launchSpeed,
            life: w.life,
            friendly: true,
            damage: w.damage + (runtime.upgrades.damage || 0) * w.damagePerUpgrade,
            kind: 'rocket',
            target,
            trail: 0,
            launchAngle: a,
            launchDelay: ROCKET_IGNITION_DELAY
        });

        p.rockets--;
        p.rocketCooldown = w.launchCooldown;
        sound.play('rocket');
        runtime.updateHud();
    }
    function dash() {
        const p = g.player;
        if (g.state !== 'playing' || p.dashCooldown > 0) return;

        const move = movement(),
            len = Math.hypot(move.x, move.y),
            a = len > 0.1 ? Math.atan2(move.y, move.x) : p.angle;

        p.vx = Math.cos(a) * 850;
        p.vy = Math.sin(a) * 850;
        p.dashTime = 0.22;
        p.invulnerable = 0.55;
        p.dashCooldown = 3.5 * Math.pow(0.87, runtime.upgrades.engine || 0);

        burst(p.x, p.y, '#b2c382', 12, 0.6);
        sound.play('dash');
    }
    function movement() {
        let x =
            Number(keys.has('KeyD') || keys.has('ArrowRight')) -
            Number(keys.has('KeyA') || keys.has('ArrowLeft')) +
            runtime.joystick.x;

        let y =
            Number(keys.has('KeyS') || keys.has('ArrowDown')) -
            Number(keys.has('KeyW') || keys.has('ArrowUp')) +
            runtime.joystick.y;

        const length = Math.hypot(x, y);
        if (length > 1) {
            x /= length;
            y /= length;
        }
        return { x, y };
    }
    function updateCamera(dt, instant = false) {
        const { width: W, height: H } = g.world,
            camera = g.camera,
            p = g.player;

        camera.zoom = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1.08;

        const x = clamp(p.x - W / (2 * camera.zoom), 0, W - W / camera.zoom),
            y = clamp(p.y - H / (2 * camera.zoom), 0, H - H / camera.zoom);

        const response = instant ? 1 : 1 - Math.exp(-3 * dt);

        camera.x = clamp(camera.x + (x - camera.x) * response, 0, W - W / camera.zoom);

        camera.y = clamp(camera.y + (y - camera.y) * response, 0, H - H / camera.zoom);

        if (pointer.screenX !== null) {
            pointer.x = camera.x + pointer.screenX / camera.zoom;
            pointer.y = camera.y + pointer.screenY / camera.zoom;
        }
    }
    function hitEnemy(e, damage) {
        if (e.health <= 0) return;

        e.health -= damage;
        e.hit = 0.12;
        burst(e.x, e.y, '#ebd99c', 4, 0.5);

        if (e.health <= 0) {
            g.kills++;
            g.combo = g.comboTimer > 0 ? g.combo + 1 : 1;
            g.comboTimer = 4;

            const multiplier = Math.min(5, 1 + Math.floor(g.combo / 3)),
                points = e.points * multiplier;
            g.score += points;

            float(
                `+${points}${multiplier > 1 ? ' ×' + multiplier : ''}`,
                e.x,
                e.y - 35,
                '#e0efa6',
                multiplier > 1
            );

            const stats = ENEMIES[e.type];

            explosion(e.x, e.y, stats.deathExplosion);

            if (e.type === 'boss') {
                for (let i = 0; i < 5; i++) {
                    const a = Math.random() * TAU,
                        distance = 10 + Math.random() * 38;

                    g.deathBursts.push({
                        x: e.x + Math.cos(a) * distance,
                        y: e.y + Math.sin(a) * distance,
                        size: 58 + Math.random() * 28,
                        delay: 0.1 + i * 0.12 + Math.random() * 0.05
                    });
                }
            }
            if (e.type === 'kamikaze' && distance(e, g.player) < stats.explosionRadius + 17)
                damagePlayer(stats.projectileDamage);

            if (!['drone', 'kamikaze', 'boss'].includes(e.type))
                g.wreckSmoke.push({ x: e.x, y: e.y, life: 18, timer: 0 });

            if (e.type === 'boss') sound.setMusicScene('waves');

            if (e.type !== 'drone' && e.type !== 'kamikaze') {
                g.decals.push({
                    x: e.x,
                    y: e.y,
                    angle: e.angle,
                    size: e.type === 'boss' ? 48 : 26,
                    wreck: true,
                    type: e.type,
                    scale: ENEMIES[e.type].scale,
                    turretAngle: (e.turret ?? e.angle) - e.angle,
                    burnTime: 18
                });
                if (g.decals.length > 55) g.decals.shift();
            }
            if (!g.testRange && (g.kills % 4 === 0 || e.type === 'boss'))
                g.pickups.push({
                    x: clamp(e.x, 40, g.world.width - 40),
                    y: clamp(e.y, 120, g.world.height - 60),
                    life: 25
                });
        } else sound.play('hit');
    }
    function damagePlayer(amount) {
        const p = g.player;
        if (p.invulnerable > 0 || g.state !== 'playing') return;

        p.health = Math.max(0, p.health - amount * g.plan.damage);
        p.invulnerable = 0.65;
        g.shake = 10;
        g.combo = 0;
        g.comboTimer = 0;

        burst(p.x, p.y, '#f5c78d', 14);
        sound.play('damage');

        $('damage-flash').classList.remove('hit');
        void $('damage-flash').offsetWidth;
        $('damage-flash').classList.add('hit');

        if (p.health <= 25 && p.health > 0)
            runtime.announce(t('hull.repairing'), t('supply.collect'), t('supply.note'), 1.8);

        if (p.health <= 0) {
            if (g.testRange) {
                p.health = p.maxHealth;
                p.invulnerable = 1;
                p.x = g.world.width * 0.43;
                p.y = g.world.height * 0.52;
            } else runtime.endGame();
        }
        runtime.updateHud();
    }
    function detonate(b) {
        explosion(b.x, b.y, 135);

        for (const e of g.enemies) {
            const d = distance(e, b);
            if (d < 135 + e.radius) hitEnemy(e, b.damage * (1 - clamp(d / 230, 0, 0.65)));
        }
        g.bullets.forEach((other) => {
            if (!other.friendly && distance(other, b) < 135) other.life = 0;
        });
    }
    function fireEnemy(e) {
        const a = e.turret,
            p = g.player,
            kind = e.type,
            stats = ENEMIES[kind];

        if (kind === 'aa') {
            if (!e.burstRemaining) e.burstRemaining = stats.shotCount;

            const angle = Math.random() * TAU,
                range =
                    e.burstRemaining === stats.shotCount
                        ? 0
                        : Math.sqrt(Math.random()) * stats.warningSpread;

            g.warnings.push({
                x: clamp(p.x + Math.cos(angle) * range, 0, g.world.width),
                y: clamp(p.y + Math.sin(angle) * range, 0, g.world.height),
                life: stats.warningDelay,
                radius: stats.explosionRadius,
                damage: stats.projectileDamage
            });

            e.burstRemaining--;

            e.cooldown = e.burstRemaining
                ? stats.burstInterval
                : stats.fireInterval + Math.random() * stats.fireRandom;
        } else {
            for (let i = 0; i < stats.shotCount; i++) {
                const angle = a + (i - (stats.shotCount - 1) / 2) * stats.spread,
                    speed =
                        stats.projectileSpeed +
                        Math.min(g.wave * stats.projectileSpeedPerWave, stats.projectileSpeedCap);

                g.bullets.push({
                    x: e.x + Math.cos(a) * 30,
                    y: e.y + Math.sin(a) * 30,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: stats.projectileLife,
                    friendly: false,
                    kind: kind === 'rocketSemi' ? 'enemyRocket' : 'shell',
                    damage: stats.projectileDamage,
                    turn: stats.rocketTurn,
                    acceleration: stats.rocketAcceleration,
                    maxSpeed: stats.rocketMaxSpeed,
                    trail: 0
                });
            }
            const multiplier = kind === 'rocketSemi' ? stats[`${settings.difficulty}Interval`] : 1;

            e.cooldown =
                (stats.fireInterval -
                    Math.min(g.wave * stats.fireWaveReduction, stats.fireWaveReductionCap) +
                    Math.random() * stats.fireRandom) *
                multiplier;
        }
        const audio = positionalAudio(e);

        burst(e.x + Math.cos(a) * 33, e.y + Math.sin(a) * 33, '#f0c185', 4, 0.3);
        sound.play(
            kind === 'rocketSemi' ? 'missile' : kind === 'aa' ? 'aa' : 'enemy',
            audio.pan,
            audio.gain
        );
    }
    function incomingMissile() {
        const p = g.player;
        let threat = null,
            nearest = FLARE_RANGE;

        for (const bullet of g.bullets) {
            if (bullet.kind !== 'enemyRocket' || bullet.life <= 0 || bullet.decoyed) continue;

            const d = distance(bullet, p),
                closing = bullet.vx * (p.x - bullet.x) + bullet.vy * (p.y - bullet.y) > 0;

            if (closing && d < nearest) {
                threat = bullet;
                nearest = d;
            }
        }
        return threat;
    }
    function deployFlares() {
        const p = g.player;

        if (g.state !== 'playing' || p.flareCooldown > 0) return false;

        p.flareCooldown = FLARE_COOLDOWN;

        for (const spread of [-0.3, 0, 0.3]) {
            const angle = p.angle + Math.PI + spread + (Math.random() - 0.5) * 0.24,
                life = 0.85;

            const speed = (130 + Math.random() * 70) * 3;

            g.particles.push({
                x: p.x + Math.cos(angle) * 25,
                y: p.y + Math.sin(angle) * 25,
                vx: p.vx + Math.cos(angle) * speed,
                vy: p.vy + Math.sin(angle) * speed,
                life,
                maxLife: life,
                color: '#ffc866',
                size: 5,
                flare: true,
                flarePhase: Math.random() * TAU,
                flareWobble: 35 + Math.random() * 40
            });
        }
        const missile = incomingMissile();

        if (missile && Math.random() < FLARE_DEFLECTION_CHANCE) {
            missile.decoyed = true;
            missile.decoyTimer = 0.85;

            missile.decoyX = p.x - Math.cos(p.angle) * 48;
            missile.decoyY = p.y - Math.sin(p.angle) * 48;
        }
        sound.play('flare');
        runtime.updateHud();

        return true;
    }
    function update(dt) {
        const p = g.player,
            W = g.world.width,
            H = g.world.height;
        g.time += dt;
        g.shake = Math.max(0, g.shake - dt * 35);

        p.cooldown -= dt;
        p.invulnerable -= dt;
        p.dashTime -= dt;
        p.dashCooldown = Math.max(0, p.dashCooldown - dt);
        p.flareCooldown = Math.max(0, p.flareCooldown - dt);
        p.lowHealthAlarm -= dt;
        p.missileAlarm -= dt;
        p.rocketCooldown -= dt;
        p.muzzle -= dt;

        const move = movement(),
            speed = 270 * Math.pow(1.12, runtime.upgrades.engine || 0),
            response =
                1 -
                Math.exp(
                    -(Math.hypot(move.x, move.y) > 0.01
                        ? PLAYER_ACCELERATION
                        : PLAYER_DECELERATION) * dt
                );

        if (p.dashTime <= 0) {
            p.vx += (move.x * speed - p.vx) * response;
            p.vy += (move.y * speed - p.vy) * response;
        }
        p.x = clamp(p.x + p.vx * dt, 34, W - 34);
        p.y = clamp(p.y + p.vy * dt, 104, H - 42);

        if ((p.x === 34 && p.vx < 0) || (p.x === W - 34 && p.vx > 0)) p.vx = 0;

        if ((p.y === 104 && p.vy < 0) || (p.y === H - 42 && p.vy > 0)) p.vy = 0;

        updateCamera(dt);

        let aimAngle;

        if (g.touch) {
            let nearest = null,
                near = Infinity;
            for (const e of g.enemies) {
                if (e.health <= 0) continue;
                const d = distance(p, e);
                if (d < near) {
                    nearest = e;
                    near = d;
                }
            }
            aimAngle = nearest
                ? Math.atan2(nearest.y - p.y, nearest.x - p.x)
                : Math.hypot(move.x, move.y) > 0.2
                  ? Math.atan2(move.y, move.x)
                  : p.angle;
        } else aimAngle = Math.atan2(pointer.y - p.y, pointer.x - p.x);

        p.angle = turn(
            p.angle,
            aimAngle,
            dt * (g.touch ? PLAYER_TOUCH_TURN_RATE : PLAYER_TURN_RATE)
        );

        p.cannonAngle = turn(p.cannonAngle, aimAngle, dt * PLAYER_CANNON_TURN_RATE);

        const forward = p.vx * Math.cos(p.angle) + p.vy * Math.sin(p.angle);

        const lateral = -p.vx * Math.sin(p.angle) + p.vy * Math.cos(p.angle);

        const tiltResponse = 1 - Math.exp(-PLAYER_BANK_RESPONSE * dt);

        p.bank += (clamp(lateral / 270, -1, 1) * 0.3 - p.bank) * tiltResponse;

        p.pitch += (clamp(forward / 270, -1, 1) * 0.2 - p.pitch) * tiltResponse;

        const firing = pointer.down || keys.has('Space');

        if (p.overheated || !firing) {
            p.heat = Math.max(0, p.heat - dt / WEAPONS.gun.coolTime);
            if (p.overheated && p.heat === 0) p.overheated = false;
        }
        if (firing && !p.overheated && p.cooldown <= 0) gun();

        if (p.rockets < p.maxRockets) {
            p.rocketTimer += dt;
            const delay = rocketRecharge();
            if (p.rocketTimer >= delay) {
                p.rockets++;
                p.rocketTimer = 0;
            }
        } else p.rocketTimer = 0;

        if (g.testRange) {
            if (g.enemies.length < g.testRange.maxActive) {
                g.spawnTimer -= dt;
                if (g.spawnTimer <= 0) {
                    runtime.spawnEnemy(g.testRange.enemy);
                    g.spawnTimer = g.testRange.interval;
                }
            }
        } else if (g.spawnRemaining > 0) {
            g.spawnTimer -= dt;
            if (g.spawnTimer <= 0) {
                runtime.spawnEnemy();
                g.spawnRemaining--;
                g.spawnTimer = g.plan.interval;
            }
        }
        for (const e of g.enemies) {
            if (e.health <= 0) continue;
            e.hit = Math.max(0, e.hit - dt);

            const stats = ENEMIES[e.type],
                a = Math.atan2(p.y - e.y, p.x - e.x),
                d = distance(e, p),
                stop = stats.stopDistance;

            let vx = 0,
                vy = 0;

            if (d > stop) {
                vx = Math.cos(a) * e.speed;
                vy = Math.sin(a) * e.speed;
            }
            if (stats.strafeSpeed) {
                vx +=
                    Math.cos(a + Math.PI / 2) * Math.sin(g.time * 1.3 + e.seed) * stats.strafeSpeed;
                vy +=
                    Math.sin(a + Math.PI / 2) * Math.sin(g.time * 1.3 + e.seed) * stats.strafeSpeed;
            }
            // Gentle separation keeps armor from stacking into one unreadable target.
            for (const other of g.enemies) {
                if (e === other || other.health <= 0) continue;
                const dist = distance(e, other),
                    min = e.radius + other.radius + 9;
                if (dist > 0 && dist < min) {
                    vx += ((e.x - other.x) / dist) * (min - dist) * 1.5;
                    vy += ((e.y - other.y) / dist) * (min - dist) * 1.5;
                }
            }
            e.x += vx * dt;
            e.y += vy * dt;

            const previousAngle = e.angle,
                heading = Math.hypot(vx, vy) > 3 ? Math.atan2(vy, vx) : a;

            e.angle = turn(e.angle, heading, dt * stats.turnRate);

            if (e.type !== 'drone' && e.type !== 'kamikaze') {
                const forwardDistance =
                    (vx * Math.cos(previousAngle) + vy * Math.sin(previousAngle)) * dt;

                const turnDistance =
                    Math.atan2(
                        Math.sin(e.angle - previousAngle),
                        Math.cos(e.angle - previousAngle)
                    ) * (e.type === 'boss' ? GOLIATH_TRACK_HALF_WIDTH : TANK_TRACK_HALF_WIDTH);

                const trackScale = e.type === 'boss' ? 1.8 : 1;

                const leftTrackDistance = forwardDistance + turnDistance,
                    rightTrackDistance = forwardDistance - turnDistance;

                e.leftTrackPhase = ((e.leftTrackPhase || 0) + leftTrackDistance / trackScale) % 6;

                e.rightTrackPhase =
                    ((e.rightTrackPhase || 0) + rightTrackDistance / trackScale) % 6;

                e.trackPhase = ((e.trackPhase || 0) + forwardDistance / trackScale) % 6;

                e.treadDistance =
                    (e.treadDistance || 0) +
                    Math.max(Math.abs(leftTrackDistance), Math.abs(rightTrackDistance));

                if (e.treadDistance >= TREAD_MARK_SPACING) {
                    e.treadDistance %= TREAD_MARK_SPACING;

                    const boss = e.type === 'boss';

                    g.treadMarks.push({
                        x: e.x,
                        y: e.y,
                        angle: e.angle,
                        life: TREAD_MARK_LIFETIME,
                        maxLife: TREAD_MARK_LIFETIME,
                        trackOffset: boss ? 36 : 18,
                        trackLength: boss ? 30 : 16,
                        trackWidth: boss ? 24 : 6
                    });

                    if (g.treadMarks.length > TREAD_MARK_LIMIT) g.treadMarks.shift();
                }
            }
            e.turret = turn(e.turret, a, dt * stats.turretRate);
            e.cooldown -= dt;
            e.charge = clamp(1 - e.cooldown / 0.7, 0, 1);

            if (
                e.type !== 'kamikaze' &&
                e.cooldown <= 0 &&
                e.x > 0 &&
                e.x < W &&
                e.y > 60 &&
                e.y < H
            )
                fireEnemy(e);

            if (distance(e, p) < e.radius + 22) {
                if (e.type === 'kamikaze') hitEnemy(e, e.health);
                else damagePlayer(stats.contactDamage);
            }
            if (g.state !== 'playing') return;
        }
        if (p.health <= p.maxHealth * 0.25) {
            if (p.lowHealthAlarm <= 0) {
                sound.play('lowHealth');
                p.lowHealthAlarm = LOW_HEALTH_ALARM_INTERVAL;
            }
        } else p.lowHealthAlarm = 0;

        const missileThreat = incomingMissile();

        if (missileThreat) {
            if (p.missileAlarm <= 0) {
                sound.play('missileAlert');
                p.missileAlarm = MISSILE_ALARM_INTERVAL;
            }
            if (settings.difficulty !== 'hard' && p.flareCooldown <= 0) deployFlares();
        } else p.missileAlarm = 0;

        for (const b of g.bullets) {
            if (b.life <= 0) continue;

            let stepDt = dt;

            if (b.kind === 'rocket' && b.launchDelay > 0) {
                const ejectionDt = Math.min(dt, b.launchDelay);

                b.launchDelay -= ejectionDt;

                b.x += b.vx * ejectionDt;
                b.y += b.vy * ejectionDt;
                b.life -= ejectionDt;

                if (b.launchDelay > 0) continue;

                stepDt -= ejectionDt;

                if (stepDt <= 0) continue;
            }
            const ox = b.x,
                oy = b.y;

            if (b.kind === 'rocket') {
                if (b.target?.health <= 0) b.target = g.enemies.find((e) => e.health > 0) || null;

                const speed = Math.min(
                    WEAPONS.rocket.maxSpeed,
                    Math.hypot(b.vx, b.vy) + WEAPONS.rocket.acceleration * stepDt
                );

                const a = b.target
                    ? turn(
                          Math.atan2(b.vy, b.vx),
                          Math.atan2(b.target.y - b.y, b.target.x - b.x),
                          stepDt * WEAPONS.rocket.turnRate
                      )
                    : Math.atan2(b.vy, b.vx);

                b.vx = Math.cos(a) * speed;
                b.vy = Math.sin(a) * speed;

                b.trail -= stepDt;
                if (b.trail <= 0) {
                    burst(b.x, b.y, '#c1b89b', 2, 0.12, true);
                    b.trail = 0.035;
                }
            } else if (b.kind === 'enemyRocket') {
                const speed = Math.min(
                    b.maxSpeed,
                    Math.hypot(b.vx, b.vy) + b.acceleration * stepDt
                );

                if (b.decoyed) {
                    b.decoyTimer -= stepDt;
                    if (b.decoyTimer <= 0) {
                        b.life = 0;
                        burst(b.x, b.y, '#ffc866', 5, 0.25);
                        continue;
                    }
                }
                const target = b.decoyed ? { x: b.decoyX, y: b.decoyY } : p;

                const a = turn(
                    Math.atan2(b.vy, b.vx),
                    Math.atan2(target.y - b.y, target.x - b.x),
                    stepDt * b.turn
                );

                b.vx = Math.cos(a) * speed;
                b.vy = Math.sin(a) * speed;

                b.trail -= stepDt;
                if (b.trail <= 0) {
                    burst(b.x, b.y, '#c1b89b', 1, 0.12, true);
                    b.trail = 0.035;
                }
            }
            b.x += b.vx * stepDt;
            b.y += b.vy * stepDt;
            b.life -= stepDt;

            if (b.friendly) {
                let target = null,
                    nearest = Infinity;

                for (const e of g.enemies)
                    if (
                        e.health > 0 &&
                        segmentHitsCircle(
                            ox,
                            oy,
                            b.x,
                            b.y,
                            e.x,
                            e.y,
                            e.radius + (b.kind === 'rocket' ? 8 : 2)
                        )
                    ) {
                        const d = Math.hypot(e.x - ox, e.y - oy);
                        if (d < nearest) {
                            target = e;
                            nearest = d;
                        }
                    }
                if (target) {
                    b.life = 0;
                    if (b.kind === 'rocket') detonate(b);
                    else hitEnemy(target, b.damage);
                } else if (b.kind === 'rocket' && b.life <= 0) detonate(b);
            } else if (segmentHitsCircle(ox, oy, b.x, b.y, p.x, p.y, 17)) {
                b.life = 0;
                damagePlayer(b.damage);
                if (g.state !== 'playing') return;
            }
            if (b.x < -90 || b.x > W + 90 || b.y < -90 || b.y > H + 90) b.life = 0;
        }
        g.bullets = g.bullets.filter((b) => b.life > 0);
        g.enemies = g.enemies.filter((e) => e.health > 0);

        for (const mark of g.treadMarks) mark.life -= dt;
        g.treadMarks = g.treadMarks.filter((mark) => mark.life > 0);

        for (const warning of g.warnings) {
            warning.life -= dt;

            if (warning.life <= 0) {
                explosion(warning.x, warning.y, warning.radius);
                if (distance(warning, p) < warning.radius + 17) damagePlayer(warning.damage);
                if (g.state !== 'playing') return;
            }
        }
        g.warnings = g.warnings.filter((warning) => warning.life > 0);

        g.pickups = g.pickups.filter((item) => {
            item.life -= dt;
            const d = distance(item, p);

            if (d < 90 && p.health < p.maxHealth) {
                item.x += (p.x - item.x) * dt * 4;
                item.y += (p.y - item.y) * dt * 4;
            }
            if (d < 28 && p.health < p.maxHealth) {
                p.health = Math.min(p.maxHealth, p.health + 30);
                float(`+30 ${t('upgrade.repair.detail')}`, p.x, p.y - 45);
                burst(item.x, item.y, '#dbea9b', 15);
                sound.play('pickup');
                return false;
            }
            return item.life > 0;
        });

        if (!g.testRange && !g.spawnRemaining && !g.enemies.length && !g.warnings.length) {
            if (g.waveWait < 0) {
                g.waveWait = 1.4;
                g.bullets = g.bullets.filter((b) => b.friendly);
                g.score += g.wave * 100;
                float(t('wave.cleared', { score: g.wave * 100 }), p.x, p.y - 65, '#e5f1ac', true);
            } else {
                g.waveWait -= dt;
                if (g.waveWait <= 0) {
                    runtime.showUpgrades();
                    return;
                }
            }
        }
        g.comboTimer -= dt;
        if (g.comboTimer <= 0) g.combo = 0;

        if (g.bannerTime > 0) {
            g.bannerTime -= dt;
            if (g.bannerTime <= 0) $('announcement').classList.remove('visible');
        }
        g.hudTimer -= dt;
        if (g.hudTimer <= 0) {
            runtime.updateHud();
            g.hudTimer = 0.08;
        }
    }
    return {
        gun,
        rocketRecharge,
        launchRocket,
        dash,
        movement,
        updateCamera,
        hitEnemy,
        damagePlayer,
        detonate,
        fireEnemy,
        incomingMissile,
        deployFlares,
        update
    };
}

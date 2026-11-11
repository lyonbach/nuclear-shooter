import { ENEMY_DATA } from './enemy-data.js';
import { LEVEL_DATA } from './level-data.js';
import { WEAPON_DATA } from './weapon-data.js';
export const ENEMIES = ENEMY_DATA;
export const MAPS = LEVEL_DATA;
export const WEAPONS = WEAPON_DATA;
export const ROCKET_IGNITION_DELAY = .3;
export const TAU = Math.PI * 2;
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a, b, t) => a + (b - a) * t;
export function turn(current, target, rate) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * clamp(rate, 0, 1);
}
export function segmentHitsCircle(ax, ay, bx, by, cx, cy, radius) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(ax + dx * t - cx, ay + dy * t - cy) <= radius;
}
export function wavePlan(wave, difficulty = 'normal') {
  const factor = { easy: 0.8, normal: 1, hard: 1.2 }[difficulty] || 1;
  const boss = wave % 5 === 0;
  return { count: boss ? 5 + Math.floor(wave / 2) : Math.round((4 + wave * 2) * factor),
    interval: Math.max(0.4, 1.6 - wave * 0.065), boss,
    health: 1 + Math.floor((wave - 1) / 5) * 0.18,
    damage: { easy: 0.7, normal: 1, hard: 1.3 }[difficulty] || 1 };
}
export function enemyType(wave, index) {
  for (const type of ['rocketSemi','aa','kamikaze','artillery','drone']) {
    const stats=ENEMIES[type];
    if (stats.spawnModulo && wave >= stats.spawnWave && index % stats.spawnModulo === stats.spawnRemainder) return type;
  }
  return 'tank';
}
export function seededRandom(seed = 73) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
export function mapForWave(wave) {
  return MAPS[(Math.max(1, wave)-1)%MAPS.length];
}
export const UPGRADES = [
  { id: 'damage', icon: '✳', title: 'Armor-Piercing Rounds', description: 'Cannon damage increased by 25%.', detail: '+25% DAMAGE', max: 4 },
  { id: 'fireRate', icon: '≋', title: 'Rapid Feed', description: 'Cannon fires 18% faster.', detail: '+18% FIRE RATE', max: 4 },
  { id: 'armor', icon: '⬡', title: 'Composite Armor', description: 'Maximum hull +25. Repairs 35 immediately.', detail: '+25 HULL', max: 4 },
  { id: 'engine', icon: '↗', title: 'Turbine Upgrade', description: 'Movement speed +12%. Dash recharges faster.', detail: '+12% SPEED', max: 3 },
  { id: 'rockets', icon: '⌁', title: 'Missile System', description: 'One extra rocket. Rockets recharge 20% faster.', detail: '+1 ROCKET CAPACITY', max: 3 },
  { id: 'repair', icon: '+', title: 'Field Repairs', description: 'Fully repairs the hull.', detail: 'FULL REPAIR', max: Infinity },
];

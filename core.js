import { ENEMY_DATA } from './enemy-data.js';
export const ENEMIES = ENEMY_DATA;
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
export const MAPS = [
  { name:'ÇÖL HATTI', layout:'desert', seed:7307, colors:['#b69362','#947952','#5a6046'], accent:'#e5bf76' },
  { name:'YEŞİL VADİ', layout:'valley', seed:12931, colors:['#557c66','#426e63','#294c50'], accent:'#83d2aa' },
  { name:'KIZIL BÖLGE', layout:'canyon', seed:26843, colors:['#b87559','#885552','#51485a'], accent:'#f1a984' },
];
export function mapForWave(wave) {
  return MAPS[(Math.max(1, wave)-1)%MAPS.length];
}
export const UPGRADES = [
  { id: 'damage', icon: '✳', title: 'Delici mühimmat', description: 'Top hasarı %25 artar.', detail: '+%25 HASAR', max: 4 },
  { id: 'fireRate', icon: '≋', title: 'Hızlı besleme', description: 'Top %18 daha hızlı ateş eder.', detail: '+%18 ATIŞ HIZI', max: 4 },
  { id: 'armor', icon: '⬡', title: 'Kompozit zırh', description: 'Azami gövde +25. Anında 35 onarım.', detail: '+25 GÖVDE', max: 4 },
  { id: 'engine', icon: '↗', title: 'Türbin yükseltmesi', description: 'Hareket hızı %12 artar. Kaçış daha çabuk dolar.', detail: '+%12 HIZ', max: 3 },
  { id: 'rockets', icon: '⌁', title: 'Füze sistemi', description: 'Bir ek roket. Roketler %20 daha çabuk dolar.', detail: '+1 ROKET KAPASİTESİ', max: 3 },
  { id: 'repair', icon: '+', title: 'Saha bakımı', description: 'Gövdeyi tamamen onarır.', detail: 'TAM ONARIM', max: Infinity },
];

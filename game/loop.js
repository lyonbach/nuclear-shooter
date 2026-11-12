export function createLoop(runtime) {
    const { g, sound, renderer } = runtime;
    function frame(time) {
        const dt = Math.min((time - (runtime.lastTime || time)) / 1000, .05); runtime.lastTime = time;
        if (!document.hidden) {
            if (g.state === 'playing') { g.visualTime += dt; runtime.update(dt); runtime.updateEffects(dt); }
            else if (g.state === 'ready' || g.state === 'over') { if (!matchMedia('(prefers-reduced-motion:reduce)').matches) g.visualTime += dt; runtime.updateEffects(dt); }
            sound.update(g.state === 'playing' ? Math.hypot(g.player.vx, g.player.vy) / 300 : 0, runtime.upgrades.engine || 0);
            renderer.draw(g, dt);
        }
        requestAnimationFrame(frame);
    }
    return { frame };
}

export function createInput(runtime) {
    const { g, settings, sound, $, canvas, dialog, keys, pointer, t } = runtime;

    $('settings-open').addEventListener('click', runtime.openSettings);
    $('settings-close').addEventListener('click', runtime.closeSettings);
    $('settings-done').addEventListener('click', runtime.closeSettings);

    dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        runtime.closeSettings();
    });

    $('volume').addEventListener('input', (event) => {
        settings.volume = event.target.value / 100;
        sound.init();
        sound.configure();
        runtime.saveSettings();
        runtime.updateSettingsUI();
    });

    for (const id of ['music', 'shake', 'effects'])
        $(id).addEventListener('change', () => {
            settings[id] = $(id).checked;
            sound.configure();
            runtime.saveSettings();
            if (id === 'effects') runtime.resize();
        });

    $('sound-toggle').addEventListener('click', runtime.toggleMute);

    $('fullscreen').addEventListener('click', async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.querySelector('.game-frame').requestFullscreen();
        } catch {
            runtime.announce(
                t('settings.fullscreen'),
                t('fullscreen.errorTitle'),
                t('fullscreen.errorNote'),
                3
            );
        }
    });

    $('fullscreen-exit').addEventListener('click', () => document.exitFullscreen());

    if (!document.fullscreenEnabled) $('fullscreen').hidden = true;

    $('language').addEventListener('change', (event) => {
        settings.language = event.target.value;
        runtime.saveSettings();
        runtime.applyLanguage();
    });

    document.addEventListener('pointerdown', runtime.activateMenuMusic, { once: true });
    document.addEventListener('keydown', runtime.activateMenuMusic, { once: true });
    document.querySelectorAll('[data-difficulty]').forEach((button) =>
        button.addEventListener('click', () => {
            settings.difficulty = button.dataset.difficulty;
            runtime.saveSettings();
            runtime.updateSettingsUI();
            runtime.updateHud();
            sound.init();
            sound.play('ui');
        })
    );

    for (const id of ['start', 'retry', 'restart'])
        $(id).addEventListener('click', () => runtime.start(g.testRange ? 'test' : 'operation'));
    $('test-range-open').addEventListener('click', () => {
        $('test-range').hidden = false;
        $('start').hidden = true;
        $('test-range-open').hidden = true;
        $('intro-panel').querySelector('.intro-note').hidden = true;
    });

    $('test-range-close').addEventListener('click', () => {
        $('test-range').hidden = true;
        $('start').hidden = false;
        $('test-range-open').hidden = false;
        $('intro-panel').querySelector('.intro-note').hidden = false;
    });

    $('test-range-start').addEventListener('click', () => runtime.start('test'));

    $('resume').addEventListener('click', runtime.resume);
    $('pause').addEventListener('click', runtime.pause);

    window.addEventListener('keydown', (event) => {
        if (dialog.open || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;

        const code = event.code;

        if (event.target.closest('button') && code === 'Space') return;

        if (
            ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code) &&
            g.state === 'playing'
        )
            event.preventDefault();

        if (event.repeat) return;

        if (code === 'Escape' || code === 'KeyP') {
            if (g.state === 'playing') runtime.pause();
            else if (g.state === 'paused') runtime.resume();
            return;
        }
        if (code === 'KeyM') {
            runtime.toggleMute();
            return;
        }
        if (g.state === 'upgrade' && /^Digit[123]$/.test(code)) {
            const choice = runtime.choices[Number(code.slice(-1)) - 1];
            if (choice) runtime.selectUpgrade(choice.id);
            return;
        }
        if (g.state !== 'playing') return;

        keys.add(code);
        if (code === 'ShiftLeft' || code === 'ShiftRight') runtime.dash();
        if (code === 'KeyE') runtime.launchRocket();
        if (code === 'KeyF' && settings.difficulty === 'hard') runtime.deployFlares();
    });

    window.addEventListener('keyup', (event) => keys.delete(event.code));

    window.addEventListener('blur', () => {
        runtime.clearInput();
        if (g.state === 'playing') runtime.pause();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            runtime.clearInput();
            if (g.state === 'playing') runtime.pause();
        }
    });

    function pointerPosition(event) {
        const rect = canvas.getBoundingClientRect();
        pointer.screenX = ((event.clientX - rect.left) / rect.width) * g.world.width;
        pointer.screenY = ((event.clientY - rect.top) / rect.height) * g.world.height;
        pointer.x = g.camera.x + pointer.screenX / g.camera.zoom;
        pointer.y = g.camera.y + pointer.screenY / g.camera.zoom;
    }
    canvas.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        g.touch = false;
        pointerPosition(event);
    });

    canvas.addEventListener('pointerdown', (event) => {
        if (g.state !== 'playing') return;

        if (event.pointerType === 'touch') {
            g.touch = true;
            return;
        }
        if (event.button === 0) {
            pointerPosition(event);
            pointer.down = true;
            runtime.gamePointer = event.pointerId;
            canvas.setPointerCapture(event.pointerId);
            canvas.focus({ preventScroll: true });
            sound.init();
        }
        if (event.button === 2) {
            event.preventDefault();
            runtime.launchRocket();
        }
    });

    const releaseCanvas = (event) => {
        if (event.pointerId === runtime.gamePointer) {
            pointer.down = false;
            runtime.gamePointer = null;
        }
    };

    canvas.addEventListener('pointerup', releaseCanvas);
    canvas.addEventListener('pointercancel', releaseCanvas);
    canvas.addEventListener('lostpointercapture', releaseCanvas);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    const stick = $('joystick');
    function moveStick(event) {
        const rect = stick.getBoundingClientRect(),
            dx = event.clientX - rect.left - rect.width / 2,
            dy = event.clientY - rect.top - rect.height / 2,
            length = Math.hypot(dx, dy),
            radius = rect.width * 0.35,
            factor = Math.min(1, radius / (length || 1));
        runtime.joystick.x = (dx * factor) / radius;
        runtime.joystick.y = (dy * factor) / radius;
        $('joystick-knob').style.transform = `translate(${dx * factor}px,${dy * factor}px)`;
    }
    stick.addEventListener('pointerdown', (event) => {
        if (g.state !== 'playing' || runtime.joystick.id !== null) return;
        event.preventDefault();
        g.touch = true;
        runtime.joystick.id = event.pointerId;
        stick.setPointerCapture(event.pointerId);
        moveStick(event);
    });

    stick.addEventListener('pointermove', (event) => {
        if (event.pointerId === runtime.joystick.id) moveStick(event);
    });

    const releaseStick = (event) => {
        if (event.pointerId === runtime.joystick.id) {
            runtime.joystick = { x: 0, y: 0, id: null };
            $('joystick-knob').style.transform = '';
        }
    };

    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
        stick.addEventListener(type, releaseStick);
    $('touch-fire').addEventListener('pointerdown', (event) => {
        if (g.state !== 'playing') return;
        event.preventDefault();
        g.touch = true;
        pointer.down = true;
        runtime.firePointer = event.pointerId;
        $('touch-fire').setPointerCapture(event.pointerId);
        sound.init();
    });

    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
        $('touch-fire').addEventListener(type, (event) => {
            if (event.pointerId === runtime.firePointer) {
                pointer.down = false;
                runtime.firePointer = null;
            }
        });

    $('touch-dash').addEventListener('pointerdown', (event) => {
        event.preventDefault();
        g.touch = true;
        runtime.dash();
    });

    $('touch-rocket').addEventListener('pointerdown', (event) => {
        event.preventDefault();
        g.touch = true;
        runtime.launchRocket();
    });

    $('touch-flare').addEventListener('pointerdown', (event) => {
        event.preventDefault();
        g.touch = true;
        if (settings.difficulty === 'hard') runtime.deployFlares();
    });

    return { pointerPosition };
}

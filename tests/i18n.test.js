import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { languages, setLocale, t, translations } from '../i18n.js';

test('English is the default locale', () => {
    assert.equal(t('intro.start'), 'START OPERATION <span>↗</span>');
});

test('every UI translation key is present in every supported language', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
    const keys = new Set([
        ...[...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map(([, key]) => key),
        ...[...game.matchAll(/\bt\(['"`]([^'"`$]+)['"`]/g)].map(([, key]) => key),
        ...[
            'status.ready',
            'status.playing',
            'status.paused',
            'status.upgrade',
            'status.over',
            'mission.ready',
            'mission.playing',
            'mission.paused',
            'mission.upgrade',
            'mission.over',
            'map.desert',
            'map.valley',
            'map.canyon',
            ...['damage', 'fireRate', 'armor', 'engine', 'rockets', 'repair'].flatMap((id) =>
                ['title', 'description', 'detail'].map((part) => `upgrade.${id}.${part}`)
            )
        ]
    ]);
    for (const [locale, name] of Object.entries(languages)) {
        const missing = [...keys].filter((key) => !translations[locale][key]);
        assert.deepEqual(missing, [], `${name} is missing: ${missing.join(', ')}`);
    }
    setLocale('en');
});

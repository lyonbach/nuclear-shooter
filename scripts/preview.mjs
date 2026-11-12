// Preview-only adaptation: leave the game's persisted settings source untouched.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(process.argv[2] || '/home/user/workspace/nuclear-shooter-preview');
if (out === root) throw new Error('Preview output must not overwrite the source folder');
await mkdir(out, { recursive: true });
for (const name of ['index.html','style.css','hud.css','sound']) {
    await cp(resolve(root,name),resolve(out,name),{recursive:true});
}
let bundle = await readFile(resolve(root,'blackout.js'),'utf8');
const adapter = `const previewValues=new Map();const previewStorage={getItem:key=>previewValues.get(key)??null,setItem:(key,value)=>previewValues.set(key,value)};\n`;
bundle = bundle.replace("'use strict';",`'use strict';\n${adapter}`).replaceAll('localStorage','previewStorage');
bundle = bundle
    .replace(/\$\('fullscreen'\)\.addEventListener\('click',async\(\)=>\{[\s\S]*?\n\}\);/, '')
    .replace("$('fullscreen-exit').addEventListener('click',()=>document.exitFullscreen());", '')
    .replace("if(!document.fullscreenEnabled)$('fullscreen').hidden=true;", "$('fullscreen').hidden=true;");
const notes = new Map([
    ['Settings and your high score are saved in this browser.','Preview: settings and high score last until this page is reloaded.'],
    ['Ayarların ve rekorun bu tarayıcıda saklanır.','Önizleme: ayarlar ve rekor sayfa yenilenene kadar saklanır.'],
    ['Einstellungen und Bestwert werden in diesem Browser gespeichert.','Vorschau: Einstellungen und Bestwert gelten bis zum Neuladen.'],
    ['Los ajustes y tu récord se guardan en este navegador.','Vista previa: ajustes y récord se conservan hasta recargar.'],
    ['Vos réglages et votre record sont enregistrés dans ce navigateur.','Aperçu : réglages et record conservés jusqu’au rechargement.']
]);
for (const [from,to] of notes) bundle = bundle.replaceAll(from,to);
await writeFile(resolve(out,'blackout.js'),bundle);
console.log(`Private preview files ready: ${out}`);

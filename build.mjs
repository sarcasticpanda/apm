import { mkdir, copyFile, rm } from 'node:fs/promises';
import { FONTS } from './fonts.mjs';

// Copies only public browser assets; source, tests, and config never reach the deployment.
const assets = ['index.html', 'styles.css', 'app.js', 'icons.js', 'favicon.svg', 'guides.json'];
await rm('.output/public', { recursive: true, force: true });
await mkdir('.output/public/fonts', { recursive: true });
for (const file of assets) await copyFile(file, `.output/public/${file}`);
for (const [file, source] of Object.entries(FONTS)) await copyFile(source, `.output/public/fonts/${file}`);
console.log('Built public assets in .output/public');

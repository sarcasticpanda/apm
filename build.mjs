import { mkdir, copyFile } from 'node:fs/promises';
const assets = ['index.html', 'styles.css', 'app.js', 'favicon.svg', 'guides.json'];
await mkdir('.output/public/vendor', { recursive: true });
await mkdir('vendor', { recursive: true });
for (const file of assets) await copyFile(file, `.output/public/${file}`);
for (const file of ['gsap.min.js', 'ScrollTrigger.min.js']) {
  await copyFile(`node_modules/gsap/dist/${file}`, `vendor/${file}`);
  await copyFile(`vendor/${file}`, `.output/public/vendor/${file}`);
}
console.log('Built public assets in .output/public');

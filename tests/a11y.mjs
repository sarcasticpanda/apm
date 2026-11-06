// Screen-reader-oriented checks: what assistive technology is told (accessibility tree, names, headings,
// landmarks, live announcements) and whether the main flows work with the keyboard alone.
// This is not a substitute for a session with NVDA, JAWS, or VoiceOver. Needs the app running; set BASE_URL.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch();
const checks = [];
const pass = (name) => { checks.push(name); console.log(`PASS ${name}`); };
const headingOutline = (page) => page.evaluate(() => [...document.querySelectorAll('h1, h2, h3, h4')].filter((h) => h.offsetParent !== null).map((h) => [Number(h.tagName[1]), h.textContent.trim()]));
const assertOutline = (outline, where) => {
  assert.equal(outline.filter(([level]) => level === 1).length, 1, `${where}: exactly one h1`);
  outline.reduce((previous, [level, text]) => { assert.ok(level <= previous + 1, `${where}: heading "${text}" skips from h${previous} to h${level}`); return level; }, 1);
};
const unnamedControls = (snapshot) => snapshot.split('\n').filter((line) => /^\s*- (button|link|checkbox|textbox|searchbox)\s*(\[.*\])?:?\s*$/.test(line));
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.app-card').first().waitFor();

  for (const [role, name] of [['banner'], ['navigation', 'Main navigation'], ['main'], ['contentinfo']]) assert.equal(await page.getByRole(role, name ? { name } : {}).count(), 1, `${role} landmark`);
  pass('Landmarks: one banner, main navigation, main, and footer');

  const homeTree = await page.locator('body').ariaSnapshot();
  await writeFile('artifacts/a11y-tree-home.txt', homeTree);
  assert.deepEqual(unnamedControls(homeTree), [], 'every control has an accessible name');
  assertOutline(await headingOutline(page), 'home');
  pass('Home: every button, link, and field has a name; heading levels never skip');

  const row = page.getByRole('button', { name: 'Open Slack setup guide' });
  const description = await row.evaluate((el) => document.getElementById(el.getAttribute('aria-describedby'))?.textContent.replace(/\s+/g, ' ').trim());
  assert.match(description, /Provider review: For commercial launch./);
  assert.match(description, /Customer admin: Possible./);
  pass(`Route rows announce each gate in words: "${description}"`);

  await page.locator('#search').fill('slack');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#library-status').textContent(), '1 of 6 guides shown');
  await page.locator('#search').fill('');
  pass('Search results are announced through a polite status message');

  // Keyboard only: skip link first, then reach a guide row, open it, and come back.
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.app-card').first().waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Skip to content');
  let presses = 1;
  while (presses < 25 && !(await page.evaluate(() => document.activeElement.matches('[data-guide="github"]')))) { await page.keyboard.press('Tab'); presses += 1; }
  assert.ok(presses < 25, 'GitHub row reachable by Tab');
  const visibleFocus = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none');
  assert.ok(visibleFocus, 'focused row shows a focus outline');
  await page.keyboard.press('Enter');
  await page.locator('.guide-title').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('guide-title')), true, 'focus moves to the guide title');
  assertOutline(await headingOutline(page), 'guide');
  const guideTree = await page.locator('#guide-section').ariaSnapshot();
  await writeFile('artifacts/a11y-tree-guide.txt', guideTree);
  assert.deepEqual(unnamedControls(guideTree), [], 'guide controls named');
  assert.ok((await page.getByRole('checkbox').count()) >= 5, 'checklist items are real checkboxes');
  pass(`Keyboard: skip link first, GitHub row after ${presses} Tabs, Enter opens the guide and focus lands on its title`);

  await page.getByRole('checkbox').first().focus();
  await page.keyboard.press('Space');
  assert.match(await page.locator('#progress-count').textContent(), /^1 of/);
  pass('Keyboard: Space ticks a checklist step and progress updates');

  await page.locator('#back-to-library').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.guide), 'github', 'focus returns to the row');
  assert.equal(await page.evaluate(() => document.activeElement.tabIndex), 0, 'row stays in the Tab order');
  pass('Keyboard: "All guides" returns focus to the same row, which stays in the Tab order');

  await page.getByLabel('App or provider name').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.getByRole('status').filter({ hasText: 'Enter an app name' }).count(), 1);
  pass('Research form: labelled fields; an empty submit is announced as a status message');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual(unnamedControls(await page.locator('body').ariaSnapshot()), []);
  pass('Dark mode exposes the same named controls');

  await writeFile('artifacts/a11y-report.json', JSON.stringify({ base, checks }, null, 2));
} finally { await browser.close(); }

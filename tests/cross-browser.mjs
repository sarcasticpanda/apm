// Core flows in Chromium, Firefox, and WebKit (Safari's engine). Needs the app running; set BASE_URL for a deployment.
// Research responses are replayed from a fixed draft so this suite never calls the AI service.
import { chromium, firefox, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const draft = {
  id: 'research-cross-browser', name: 'Example', domain: 'example.org', url: 'https://example.org/', researchedAt: '2026-11-05T00:00:00.000Z', mode: 'ai', oauthSupport: 'documented',
  summary: 'Register an OAuth app, then exchange the authorization code for a token.', difficulty: 'Medium · AI judgment from retrieved docs', setupEffort: 'Planning estimate (AI): 2 hours. Excludes provider waiting time.', approvalWait: 'No provider review requirement or waiting time was established from the retrieved pages.',
  steps: [1, 2, 3].map((n) => ({ title: `Step ${n}`, description: 'Configure the app.', owner: n === 3 ? 'You + provider' : 'You', sourceIds: ['S1'] })),
  requirements: [{ text: 'Register a redirect URI.', sourceIds: ['S1'] }], blockers: [], uncertainties: ['No OAuth app was registered.'], agentCan: ['Read public docs.'], humanMust: ['Register the app.'],
  sources: [{ id: 'S1', title: 'OAuth guide', url: 'https://example.org/docs/oauth', kind: 'OAuth documentation · read during this request' }], activity: [{ label: 'Read 1 public provider page', status: 'complete' }],
};
const results = [];
await mkdir('artifacts', { recursive: true });
for (const [label, engine] of [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]]) {
  const browser = await engine.launch();
  const errors = [];
  const passed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.app-card').first().waitFor();
    assert.equal(await page.locator('.app-card').count(), 3);
    passed.push('library');

    await page.locator('[data-guide="slack"]').click();
    await page.locator('.guide-title').waitFor();
    assert.equal(await page.locator('.gate').count(), 3);
    assert.match(await page.locator('.gate-required').innerText(), /commercial/i);
    await page.locator('#guide-content input[type=checkbox]').first().check();
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.guide-title').waitFor();
    assert.equal(await page.locator('#guide-content input[type=checkbox]').first().isChecked(), true);
    passed.push('guide, gates, saved progress');

    const before = page.url();
    await page.locator('#guide-content .inline-citation').first().click();
    await page.waitForTimeout(300);
    assert.equal(page.url(), before, 'citation click must not change the URL');
    assert.equal(await page.locator('#guide-section').isVisible(), true);
    passed.push('citation keeps URL');

    await page.goBack({ waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#guide-section').isVisible(), false, 'Back must close the guide');
    passed.push('browser Back closes guide');

    await page.route('**/api/research', (route) => route.fulfill({ json: draft }));
    await page.locator('#app-name').fill('Example');
    await page.locator('#generate-button').click();
    await page.locator('#generated-guide h2').waitFor();
    assert.match(await page.locator('#generated-guide').innerText(), /OAuth documentation found/);
    passed.push('generated guide renders');

    const sharedUrl = await page.evaluate(async () => {
      document.querySelector('#share-generated').click();
      for (let i = 0; i < 40; i += 1) {
        const field = document.querySelector('#generated-guide .share-feedback input');
        if (field) return field.value;
        if (/Link copied/.test(document.querySelector('#generated-guide .share-feedback').textContent)) return navigator.clipboard.readText().catch(() => '');
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return '';
    });
    if (sharedUrl) {
      const fresh = await browser.newPage();
      await fresh.goto(sharedUrl, { waitUntil: 'networkidle' });
      await fresh.locator('#generated-guide h2').waitFor();
      assert.match(await fresh.locator('#generated-guide').innerText(), /Shared research snapshot/i);
      const draftUrl = fresh.url();
      await fresh.locator('#generated-guide .inline-citation').first().click();
      await fresh.waitForTimeout(300);
      assert.equal(fresh.url(), draftUrl, 'citation click must keep the #draft= share payload');
      await fresh.close();
      passed.push('shared draft opens and keeps its link');
    } else passed.push('share link unavailable in this engine (clipboard); skipped reopen');

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    mobile.on('pageerror', (error) => errors.push(error.message));
    await mobile.goto(`${base}/?guide=google`, { waitUntil: 'networkidle' });
    await mobile.locator('.guide-title').waitFor();
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile overflow');
    passed.push('390px guide fits');
    assert.deepEqual(errors, []);
    results.push({ browser: label, ok: true, passed });
    console.log(`PASS ${label}: ${passed.join(' · ')}`);
  } catch (error) {
    results.push({ browser: label, ok: false, passed, error: error.message, errors });
    console.log(`FAIL ${label}: ${error.message}`);
  } finally { await browser.close(); }
}
await writeFile('artifacts/cross-browser-report.json', JSON.stringify({ base, results }, null, 2));
if (results.some((row) => !row.ok)) process.exit(1);

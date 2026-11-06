import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL || 'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:320,height:740},reducedMotion:'reduce'});
const page=await context.newPage();const checks=[];
try{
 await page.goto(base,{waitUntil:'networkidle'});await page.locator('.app-card').first().waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:'artifacts/minimum-mobile.png',scale:'css'});checks.push('320px mobile fits with reduced motion');
 await page.locator('[data-guide="google"]').click();await page.locator('.guide-title').waitFor();
 await page.emulateMedia({media:'print'});assert.equal(await page.locator('.topbar').isVisible(),false);assert.equal(await page.locator('.library').isVisible(),false);assert.equal(await page.locator('#guide-content').isVisible(),true);await page.pdf({path:'artifacts/google-print.pdf',format:'A4',printBackground:true});await page.emulateMedia({media:'screen'});checks.push('Print displays the selected guide and excludes homepage content');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw new Error('Denied');}},configurable:true}));
 await page.locator('#share-known').click();await page.locator('.share-feedback input').waitFor();assert.match(await page.locator('.share-feedback input').inputValue(),/guide=google/);checks.push('Clipboard permission failure gives selectable share URL');
 await page.goto(base,{waitUntil:'networkidle'});
 await page.route('**/api/research',route=>route.fulfill({status:502,json:{error:'Provider documentation is temporarily unavailable. Try again.'}}));
 await page.locator('#app-name').fill('Example');await page.locator('#generate-button').click();await page.locator('#research-status.error').waitFor();assert.equal(await page.locator('#generate-button').isEnabled(),true);checks.push('Research failure has clear error and retryable form');
 await page.unroute('**/api/research');await page.route('**/guides.json',route=>route.abort());await page.reload({waitUntil:'networkidle'});await page.locator('#retry-library').waitFor();await page.unroute('**/guides.json');await page.locator('#retry-library').click();await page.locator('.app-card').first().waitFor();assert.equal(await page.locator('.app-card').count(),6);checks.push('Library failure can recover through retry');
 for(const path of ['/server.mjs','/.env','/wrangler.jsonc','/research.mjs'])assert.equal((await page.request.get(base+path)).status(),404,path);
 const post=await page.request.post(base+'/api/research',{headers:{'content-type':'application/json'},data:{url:'http://127.0.0.1'}});assert.equal(post.status(),400);checks.push('Private files and private-address research rejected');
 await writeFile('artifacts/exploratory-report.json',JSON.stringify({base,checks},null,2));console.log(JSON.stringify(checks,null,2));
}finally{await browser.close();}

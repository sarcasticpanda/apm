// Probe the live research API with app names or websites and print what the agent found.
// Usage: node scripts/research-probe.mjs <baseUrl> '<json array of inputs>' [outDir]
//   e.g. node scripts/research-probe.mjs https://oauth-path.kadakchai-panda.workers.dev '[{"name":"Calendly"},{"url":"https://www.dropbox.com"}]'
import { mkdir, writeFile } from 'node:fs/promises';

const [base, raw, outDir] = process.argv.slice(2);
if (!base || !raw) { console.error('Usage: node scripts/research-probe.mjs <baseUrl> \'[{"name":"Calendly"}]\' [outDir]'); process.exit(1); }
const inputs = JSON.parse(raw);
if (outDir) await mkdir(outDir, { recursive: true });
for (const [index, input] of inputs.entries()) {
  if (index) await new Promise((resolve) => setTimeout(resolve, 11000)); // the API allows 6 requests a minute
  const started = Date.now();
  let body, status;
  try {
    const response = await fetch(`${base}/api/research`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(120000) });
    status = response.status;
    body = await response.json();
  } catch (error) { body = { error: error.message }; }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (outDir) await writeFile(`${outDir}/probe-${index + 1}.json`, JSON.stringify(body, null, 2));
  if (body.error) { console.log(`\n### ${JSON.stringify(input)} -> HTTP ${status} ${body.error} (${seconds}s)`); continue; }
  console.log(`\n### ${JSON.stringify(input)} -> ${body.name} @ ${body.domain} | ${body.mode} | ${body.oauthSupport} | ${seconds}s`);
  for (const s of body.sources) console.log(`   ${s.id} ${s.url}  (${s.kind})`);
  console.log(`   summary: ${body.summary.slice(0, 260)}`);
  console.log(`   effort: ${body.setupEffort} | complexity: ${body.difficulty}`);
  console.log(`   wait: ${body.approvalWait.slice(0, 200)}`);
  body.steps.forEach((step, i) => console.log(`   ${i + 1}. [${step.owner}] ${step.title} (${step.sourceIds.join(',')})`));
  for (const a of body.activity) console.log(`   - ${a.label}`);
}

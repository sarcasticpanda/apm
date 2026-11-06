import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const guides=JSON.parse(await readFile(new URL('../guides.json',import.meta.url),'utf8'));
test('curated guides have actionable next steps, bounded estimates, human handoffs, and valid evidence references',()=>{
 assert.equal(new Set(guides.map(g=>g.id)).size,guides.length);
 assert.ok(guides.length>=3);
 for(const g of guides){
  assert.ok(g.firstAction && g.estimateBasis && g.evidenceStatus && g.checkedAt,g.id);
  assert.ok(g.steps.length>=4 && g.handoffs.agent.length && g.handoffs.human.length && g.uncertainties.length,g.id);
  for(const [title,url] of g.sources){assert.ok(title);assert.equal(new URL(url).protocol,'https:');}
  assert.equal(g.sourceIdsByStep.length,g.steps.length);
  for(const ids of g.sourceIdsByStep)for(const id of ids)assert.ok(id>=1&&id<=g.sources.length,`${g.id} source ${id}`);
 }
});
test('every guide separates provider review, customer admin, and user consent with cited gates',()=>{
 for(const g of guides){
  assert.deepEqual(g.gates.map(gate=>gate.who),['Provider review','Customer admin','User consent'],g.id);
  for(const gate of g.gates){
   assert.ok(['none','possible','required','depends','always'].includes(gate.level),`${g.id} ${gate.level}`);
   assert.ok(gate.status && gate.note && gate.sourceIds.length,`${g.id} ${gate.who}`);
   for(const id of gate.sourceIds)assert.ok(id>=1&&id<=g.sources.length,`${g.id} gate source ${id}`);
  }
 }
 assert.equal(guides.find(g=>g.id==='github').gates[0].level,'none');
 assert.equal(guides.find(g=>g.id==='slack').gates[0].level,'required');
 assert.equal(guides.find(g=>g.id==='google').gates[0].level,'depends');
});
test('Slack guide distinguishes commercial review and non-guaranteed feedback windows',()=>{
 const slack=guides.find(g=>g.id==='slack');
 assert.match(slack.wait,/10 business days/);assert.match(slack.wait,/10 weeks/);
 assert.match(slack.summary,/commercial/i);assert.ok(slack.uncertainties.length>0);
});

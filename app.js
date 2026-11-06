const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const text = (value, max = 3000) => typeof value === 'string' ? value.slice(0, max) : '';
const list = (value, max = 20) => Array.isArray(value) ? value.slice(0, max) : [];
const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }
};
let guides = [];
let currentFilter = 'all';
let activeGuide = null;
let draft = null;
const appGrid = $('#app-grid');
const searchInput = $('#search');

function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
function dateLabel(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Kolkata'}) : 'Date unavailable';
}
function logo(guide) {
  return `<span class="app-logo ${['github','slack','google'].includes(guide.kind) ? guide.kind : 'custom'}" aria-hidden="true">${escapeHtml(guide.mark || guide.name.slice(0, 2))}</span>`;
}
function moveTo(element, focusTarget) {
  element.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'start' });
  if (focusTarget) { focusTarget.tabIndex = -1; focusTarget.focus({preventScroll:true}); }
}
function renderLibrary() {
  const query = searchInput.value.trim().toLowerCase();
  const matches = guides.filter(g => (currentFilter === 'all' || g.band === currentFilter) && `${g.name} ${g.tagline} ${g.summary}`.toLowerCase().includes(query));
  appGrid.innerHTML = matches.length ? matches.map(g => `
    <button class="app-card" type="button" data-guide="${escapeHtml(g.id)}" aria-label="Open ${escapeHtml(g.name)} setup guide">
      <span class="app-card-top"><span class="app-identity">${logo(g)}<span>${escapeHtml(g.name)}</span></span><span class="effort-label">${escapeHtml(g.effort)}</span></span>
      <span class="app-card-copy"><span class="tagline">${escapeHtml(g.tagline)}</span></span>
      <span class="app-stats"><span class="app-stat"><small>HANDS-ON WORK</small><strong>${escapeHtml(g.time)}</strong></span><span class="app-stat"><small>APPROVAL PATH</small><strong class="${g.band === 'light' ? 'stat-light' : 'stat-review'}">${escapeHtml(g.waitSummary || g.wait)}</strong></span></span>
      <span class="card-footer"><span class="card-evidence">${g.sources.length} official sources</span><span class="card-cta" aria-hidden="true">↗</span></span>
    </button>`).join('') : '<div class="empty-results"><strong>No matching guide yet.</strong><p>Try a different search, or research an app outside this library.</p><a class="text-link" href="#generate">Research another app ↗</a></div>';
  $$('[data-guide]', appGrid).forEach(button => button.addEventListener('click', () => openGuide(button.dataset.guide)));
}
function citations(ids, sources, prefix) {
  return list(ids).map(id => {
    const index = sources.findIndex((source, i) => String(source.id || i + 1) === String(id));
    return index < 0 ? '' : `<a class="inline-citation" href="#${prefix}-source-${index + 1}" aria-label="Read source ${index + 1}">[${index + 1}]</a>`;
  }).join(' ');
}
function sourcesMarkup(sources, prefix) {
  return sources.map((s, i) => `<li id="${prefix}-source-${i + 1}"><span class="source-number">${String(i + 1).padStart(2,'0')}</span><div><a href="${escapeHtml(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)} <span aria-hidden="true">↗</span></a><span class="source-kind">${escapeHtml(s.kind || 'Official page read')}${s.checkedAt ? ` · ${dateLabel(s.checkedAt)}` : ''}</span>${s.excerpt ? `<details class="source-excerpt"><summary>Read evidence excerpt</summary><p>${escapeHtml(s.excerpt)}</p></details>` : ''}</div></li>`).join('');
}
function bulletList(values) { return `<ul>${list(values).map(v=>`<li>${escapeHtml(v)}</li>`).join('')}</ul>`; }
function progressFor(id, count) {
  return list(storage.get(`oauthpath:${id}:steps`), count).filter(i=>Number.isInteger(i) && i >= 0 && i < count);
}
function stepList(steps, sources, prefix, id) {
  const completed = progressFor(id, steps.length);
  return `<ol class="steps">${steps.map((s,i)=>`<li class="step ${completed.includes(i)?'done':''}" data-index="${i}"><div class="step-body"><label><input type="checkbox" data-progress="${escapeHtml(id)}" value="${i}" ${completed.includes(i)?'checked':''}><span class="step-copy"><strong>${escapeHtml(s.title)}</strong><span>${escapeHtml(s.description)}</span></span></label>${citations(s.sourceIds,sources,prefix)}</div><span class="step-owner">${escapeHtml(s.owner || 'YOU')}</span></li>`).join('')}</ol>`;
}
function attachProgress(root, id, count) {
  const update = () => {
    const checks = $$('input[data-progress]',root);
    const done = checks.filter(c=>c.checked).map(c=>Number(c.value));
    storage.set(`oauthpath:${id}:steps`,done);
    checks.forEach(c=>c.closest('.step').classList.toggle('done',c.checked));
    const progress = $('#progress-count');
    if (root === $('#guide-content') && progress) {
      progress.textContent = `${done.length} of ${count} steps`;
      $('#progress-percent').textContent = `${Math.round(done.length/count*100)}%`;
      $('#progress-fill').style.width = `${done.length/count*100}%`;
    }
  };
  $$('input[data-progress]',root).forEach(c=>c.addEventListener('change',update));
}
function openGuide(id, updateUrl = true) {
  const g = guides.find(g=>g.id===id);
  if (!g) return;
  activeGuide = g;
  const sources = g.sources.map(([title,url,kind],i)=>({id:String(i+1),title,url,kind}));
  const steps = g.steps.map(([title,description,owner],i)=>({title,description,owner,sourceIds:g.sourceIdsByStep?.[i] || []}));
  const done = progressFor(id,steps.length);
  $('#guide-content').innerHTML = `
    <div class="guide-title-row">${logo(g)}<div><p class="eyebrow">OAUTH SETUP GUIDE</p><h2 class="guide-title">${escapeHtml(g.name)}</h2></div></div>
    <p class="guide-subtitle">${escapeHtml(g.summary)}</p>
    <div class="guide-metrics"><div class="guide-metric"><small>HANDS-ON WORK · ESTIMATE</small><strong>${escapeHtml(g.time)}</strong></div><div class="guide-metric"><small>APPROVAL & WAIT</small><strong>${escapeHtml(g.wait)}</strong></div><div class="guide-metric"><small>EFFORT</small><strong>${escapeHtml(g.effortLabel)}</strong></div></div>
    <div class="blocker next-step"><strong>Your first step</strong><p>${escapeHtml(g.firstAction)}</p></div>
    <section class="guide-block"><h3>Your setup path</h3><p>Follow the steps in order. Each source number opens the supporting documentation below.</p>${stepList(steps,sources,'guide',id)}</section>
    <section class="guide-block"><h3>If you hit a blocker</h3><div class="blocker"><p>${escapeHtml(g.blocker)}</p></div></section>
    <section class="guide-block"><h3>Who does what</h3><div class="handoff-grid"><div><h4>The agent can help</h4>${bulletList(g.handoffs?.agent)}</div><div><h4>You take over</h4>${bulletList(g.handoffs?.human)}</div></div>${g.handoffs?.provider?.length ? `<div class="provider-handoff"><strong>Provider or customer decision</strong>${bulletList(g.handoffs.provider)}</div>`:''}</section>
    <section class="guide-block"><h3>Scope and uncertainty</h3><p>${escapeHtml(g.caveat)}</p><p>${escapeHtml(g.estimateBasis)}</p>${bulletList(g.uncertainties)}</section>
    <section class="guide-block"><h3>Sources and checks</h3><p>Checked ${dateLabel(g.checkedAt)}. ${escapeHtml(g.evidenceStatus)}</p><ul class="source-list">${sourcesMarkup(sources,'guide')}</ul></section>`;
  $('#guide-rail').innerHTML = `<div class="rail-card"><p class="eyebrow">YOUR CHECKLIST</p><h3>One step closer.</h3><p>Progress stays in this browser. Sharing a guide doesn’t share your checklist.</p><div class="rail-progress"><span id="progress-count">${done.length} of ${steps.length} steps</span><span id="progress-percent">${Math.round(done.length/steps.length*100)}%</span></div><div class="progress-track"><div id="progress-fill" class="progress-fill" style="width:${done.length/steps.length*100}%"></div></div><div class="rail-links"><button class="share-guide" id="share-known"><span>Copy guide link</span><span aria-hidden="true">↗</span></button><button class="share-guide" id="download-known"><span>Download Markdown</span><span aria-hidden="true">↓</span></button><button class="share-guide" id="print-known"><span>Print / save as PDF</span><span aria-hidden="true">↗</span></button></div><p class="rail-note">${sources.length} official sources · checked ${dateLabel(g.checkedAt)}</p><div class="share-feedback" role="status" aria-live="polite"></div></div>`;
  $('#guide-section').hidden = false;
  $('#generated-guide').hidden = true;
  attachProgress($('#guide-content'),id,steps.length);
  $('#share-known').onclick = () => copyLink(new URL(`?guide=${encodeURIComponent(id)}`,location.href).href, $('#share-known'));
  $('#download-known').onclick = () => downloadMarkdown(g);
  $('#print-known').onclick = () => window.print();
  if(updateUrl) history.pushState(null,'',`?guide=${encodeURIComponent(id)}#guide-section`);
  moveTo($('#guide-section'),$('.guide-title'));
}
function markdownForKnown(g) {
  const lines = [`# ${g.name} OAuth setup`, '', g.summary, '', `**Hands-on estimate:** ${g.time}`, `**Approval:** ${g.wait}`, '', `**First step:** ${g.firstAction}`, '', '## Setup steps'];
  g.steps.forEach(([title,desc,owner],i)=>lines.push(`\n${i+1}. **${title}** (${owner})\n   ${desc}\n   ${(g.sourceIdsByStep?.[i] || []).map(n=>`[Source ${n}](${g.sources[n-1][1]})`).join(' · ')}`));
  lines.push('', '## If blocked',g.blocker,'','## Limits',g.caveat,g.estimateBasis,...g.uncertainties.map(v=>`- ${v}`),'','## Evidence',`Checked ${g.checkedAt}. ${g.evidenceStatus}`,...g.sources.map(([t,u])=>`- [${t}](${u})`));
  return lines.join('\n');
}
function downloadFile(name, content) {
  const url=URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadMarkdown(g) { downloadFile(`${g.id}-oauth-guide.md`,markdownForKnown(g)); }
async function copyLink(url, button) {
  const feedback=button.closest('.rail-card, .generated-guide')?.querySelector('.share-feedback');
  try {
    await navigator.clipboard.writeText(url);
    if(feedback) feedback.textContent='Link copied. Anyone with the link can read this guide.';
  } catch {
    if(feedback) {
      feedback.replaceChildren();
      const label=document.createElement('label'); label.textContent='Copy this share link:';
      const input=document.createElement('input'); input.type='text'; input.readOnly=true; input.value=url;
      label.append(input); feedback.append(label); input.focus(); input.select();
    }
  }
}
function normaliseResearch(raw) {
  if(!raw || typeof raw!=='object' || !text(raw.name) || !Array.isArray(raw.sources) || !Array.isArray(raw.steps)) throw new Error('This shared guide is incomplete or uses an older format. Please research the app again.');
  const sourceIds=new Set();
  const sources=list(raw.sources,8).map((s,i)=>({id:text(String(s.id || i+1),20),title:text(s.title,240),url:safeUrl(s.url),kind:text(s.kind,100),checkedAt:text(s.checkedAt,40),excerpt:text(s.excerpt,1200)})).filter(s=>s.url && s.title && !sourceIds.has(s.id) && sourceIds.add(s.id));
  const ids=(v)=>list(v,8).map(String).filter(id=>sourceIds.has(id));
  const textList=(v)=>list(v,12).map(v=>text(v,1000)).filter(Boolean);
  return {
    id: text(raw.id,100).replace(/[^a-zA-Z0-9_-]/g,'') || 'shared-guide', name:text(raw.name,100),domain:text(raw.domain,250),url:safeUrl(raw.url),researchedAt:text(raw.researchedAt,40),
    mode:raw.mode==='ai'?'ai':'evidence',oauthSupport:raw.oauthSupport==='documented'?'documented':'unconfirmed',
    summary:text(raw.summary),difficulty:text(raw.difficulty,300),setupEffort:text(raw.setupEffort,700),approvalWait:text(raw.approvalWait,700),
    steps:list(raw.steps,12).map(s=>({title:text(s.title,180),description:text(s.description,1500),owner:text(s.owner,90),sourceIds:ids(s.sourceIds)})),
    requirements:list(raw.requirements,12).map(s=>({text:text(s.text,1200),sourceIds:ids(s.sourceIds)})),
    blockers:list(raw.blockers,10).map(s=>({text:text(s.text,1200),nextAction:text(s.nextAction,1200),sourceIds:ids(s.sourceIds)})),
    uncertainties:textList(raw.uncertainties),agentCan:textList(raw.agentCan),humanMust:textList(raw.humanMust),sources,
    activity:list(raw.activity,15).map(a=>({label:text(a.label,300),status:text(a.status,40)}))
  };
}
function renderDraft(result, shared=false) {
  draft=normaliseResearch(result);
  const d=draft;
  const container=$('#generated-guide');
  container.innerHTML=`<div class="generated-guide-head"><div><p class="eyebrow">${shared?'SHARED RESEARCH SNAPSHOT':'LIVE RESEARCH RESULT'} · ${escapeHtml(d.domain)}</p><h2>${escapeHtml(d.name)} OAuth guide</h2></div><span class="draft-tag">${d.mode==='ai'?'AI-SYNTHESIZED DRAFT':'EXTRACTED EVIDENCE'}</span></div>
    <p class="guide-subtitle">${escapeHtml(d.summary)}</p>
    <div class="status-banner"><strong>${d.oauthSupport==='documented'?'OAuth documentation found':'OAuth support remains unconfirmed'}</strong><p>${shared?'This link contains a snapshot supplied by the person who shared it. It has not been independently rechecked on this device.':'The agent read public pages; it did not create a provider account, exchange a token, or submit for approval.'} ${d.mode==='evidence'?'AI synthesis was unavailable. These findings are extracted from retrieved pages; confirm the requirements before acting.':'Review cited claims against the official pages before relying on this draft.'}</p></div>
    <div class="guide-metrics"><div class="guide-metric"><small>SETUP EFFORT</small><strong>${escapeHtml(d.setupEffort || 'Not verified')}</strong></div><div class="guide-metric"><small>APPROVAL WAIT</small><strong>${escapeHtml(d.approvalWait || 'Not verified')}</strong></div><div class="guide-metric"><small>COMPLEXITY</small><strong>${escapeHtml(d.difficulty || 'Requires confirmation')}</strong></div></div>
    <div class="generated-grid"><section class="generated-panel"><h3>Setup path</h3>${stepList(d.steps,d.sources,'draft',d.id)}</section><section class="generated-panel"><h3>Requirements found</h3>${d.requirements.length?`<ul>${d.requirements.map(r=>`<li>${escapeHtml(r.text)} ${citations(r.sourceIds,d.sources,'draft')}</li>`).join('')}</ul>`:'<p>No provider-specific requirements were confirmed. Start with the linked documentation.</p>'}<h3>Blockers and next actions</h3>${d.blockers.map(b=>`<div class="blocker"><strong>${escapeHtml(b.text)}</strong><p>${escapeHtml(b.nextAction)} ${citations(b.sourceIds,d.sources,'draft')}</p></div>`).join('') || '<p>No specific approval blockers were confirmed.</p>'}</section>
    <section class="generated-panel"><h3>Who does what</h3><h4>The agent can help</h4>${bulletList(d.agentCan)}<h4>You take over</h4>${bulletList(d.humanMust)}</section><section class="generated-panel"><h3>What still needs checking</h3>${bulletList(d.uncertainties)}<h4>Research activity</h4><ul class="research-log">${d.activity.map(a=>`<li><span>${escapeHtml(a.label)}</span><small>${escapeHtml(a.status)}</small></li>`).join('')}</ul></section></div>
    <section class="guide-block"><h3>Evidence · ${d.sources.length} pages read</h3><p>Retrieved ${dateLabel(d.researchedAt)}. Read the original source for the full context; an excerpt alone may omit exceptions.</p><ul class="source-list">${sourcesMarkup(d.sources,'draft')}</ul></section>
    <div class="guide-actions"><button class="button button-dark generated-share" id="share-generated">Copy shareable guide ↗</button><button class="button generated-share" id="download-generated">Download Markdown ↓</button><button class="button generated-share" id="print-generated">Print / PDF ↗</button></div><div class="share-feedback" role="status" aria-live="polite"></div>`;
  container.hidden=false;
  $('#guide-section').hidden=true;
  attachProgress(container,d.id,d.steps.length);
  $('#share-generated').onclick=async()=>{
    const payload=await encodeDraft(d);
    const url=new URL(location.origin+location.pathname);url.hash=`draft=${payload}`;
    await copyLink(url.href,$('#share-generated'));
  };
  $('#download-generated').onclick=()=>{
    const content=[`# ${d.name} OAuth guide`,'',d.summary,`Mode: ${d.mode}. Researched ${d.researchedAt}.`,shared?'Shared snapshot; not independently rechecked.':'Draft; provider setup not attempted.','',`Setup: ${d.setupEffort}`,`Approval wait: ${d.approvalWait}`,'','## Steps',...d.steps.map((s,i)=>`${i+1}. **${s.title}** (${s.owner})\n   ${s.description}\n   Sources: ${s.sourceIds.join(', ')}`),'','## Requirements',...d.requirements.map(r=>`- ${r.text} [${r.sourceIds.join(', ')}]`),'','## Blockers',...d.blockers.map(b=>`- ${b.text} Next: ${b.nextAction}`),'','## Uncertainty',...d.uncertainties.map(v=>`- ${v}`),'','## Sources',...d.sources.map(s=>`- [${s.id}] [${s.title}](${s.url})`)].join('\n');
    downloadFile(`${d.name.replace(/[^a-z0-9]/gi,'-').toLowerCase()}-oauth-guide.md`,content);
  };
  $('#print-generated').onclick=()=>window.print();
  moveTo(container,$('h2',container));
}
async function encodeDraft(value) {
  const bytes=new TextEncoder().encode(JSON.stringify(value));
  let data=bytes;let format='u';
  if(typeof CompressionStream!=='undefined') {data=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());format='z';}
  let binary='';for(const byte of data)binary+=String.fromCharCode(byte);
  return format+btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function decodeDraft(value) {
  if(typeof value!=='string' || value.length>100000)throw new Error('This share link is too large. Ask for the Markdown guide instead.');
  const format=value[0];if(!['u','z'].includes(format))throw new Error('This share link uses an older format. Please research the app again.');
  const binary=atob(value.slice(1).replaceAll('-','+').replaceAll('_','/'));
  let bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  if(format==='z') {
    if(typeof DecompressionStream==='undefined')throw new Error('Use a current browser to open this compressed guide.');
    const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks=[];let total=0;
    while(true){const {done,value:chunk}=await reader.read();if(done)break;total+=chunk.length;if(total>100000){await reader.cancel();throw new Error('This shared guide exceeds the size limit.');}chunks.push(chunk);}
    bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  }
  if(bytes.length>100000)throw new Error('This shared guide exceeds the size limit.');
  return normaliseResearch(JSON.parse(new TextDecoder().decode(bytes)));
}
async function loadSharedState() {
  const params=new URLSearchParams(location.search);const hash=new URLSearchParams(location.hash.slice(1));
  if(hash.has('draft') || params.has('draft')) {
    try {renderDraft(await decodeDraft(hash.get('draft') || params.get('draft')),true);}
    catch(error){const el=$('#generated-guide');el.hidden=false;el.innerHTML=`<div class="status-banner error"><h2>Couldn’t open this guide</h2><p>${escapeHtml(error.message)}</p><a class="text-link" href="#generate">Research the app again ↗</a></div>`;moveTo(el,$('h2',el));}
  } else if(params.has('guide')) {
    if(guides.some(g=>g.id===params.get('guide')))openGuide(params.get('guide'),false);
    else {appGrid.insertAdjacentHTML('beforebegin','<p class="status-banner">That guide is not in this library. Choose a provider or research it below.</p>');}
  }
}
$$('.filter').forEach(button=>button.addEventListener('click',()=>{
  currentFilter=button.dataset.filter;
  $$('.filter').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  renderLibrary();
}));
searchInput.addEventListener('input',renderLibrary);
$('#back-to-library').onclick=()=>{
  $('#guide-section').hidden=true;history.pushState(null,'',location.pathname+'#library');moveTo($('#library'),$(`[data-guide="${activeGuide?.id}"]`));
};
$('#generate-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const status=$('#research-status');const button=$('#generate-button');
  let name=$('#app-name').value.trim();let url=$('#app-url').value.trim();
  status.hidden=false;status.classList.remove('error');
  if(!name && !url){status.classList.add('error');status.textContent='Enter an app name or its official website.';$('#app-name').focus();return;}
  if(!url && /^(https?:\/\/|[\w-]+\.[a-z]{2,}(\/|$))/i.test(name)){url=name;name='';}
  if(url && !/^https?:\/\//i.test(url))url=`https://${url}`;
  if(url && !safeUrl(url)){status.classList.add('error');status.textContent='Enter a public website such as https://linear.app.';return;}
  button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Researching documentation…';
  status.textContent='Finding official documentation, reading the pages, and checking the evidence. This can take up to 90 seconds.';
  $('#generated-guide').hidden=true;
  try {
    const response=await fetch('/api/research',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,url}),signal:AbortSignal.timeout(110000)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error || 'Research could not finish. Please try again.');
    renderDraft(result);
    status.textContent=`Read ${draft.sources.length} public page${draft.sources.length===1?'':'s'}. ${draft.mode==='ai'?'AI drafted a cited guide.':'Evidence summary ready; AI synthesis was unavailable.'}`;
    history.replaceState(null,'',location.pathname+'#generated-guide');
  } catch(error){status.classList.add('error');status.textContent=error.name==='TimeoutError'?'Research took too long. Try the direct OAuth documentation URL.':error.message || 'Could not reach the research service. Please try again.';}
  finally{button.disabled=false;button.removeAttribute('aria-busy');button.innerHTML='Research this app <span aria-hidden="true">↗</span>';}
});
async function initialise() {
  appGrid.innerHTML='<div class="empty-results" role="status">Loading the guide library…</div>';
  try{const response=await fetch('/guides.json');if(!response.ok)throw new Error();guides=await response.json();renderLibrary();await loadSharedState();}
  catch{appGrid.innerHTML='<div class="empty-results"><strong>The guide library couldn’t load.</strong><p>Check your connection and reload this page.</p><button class="button" id="retry-library">Try again</button></div>';$('#retry-library').onclick=initialise;}
}
initialise();
window.addEventListener('popstate',loadSharedState);
window.addEventListener('hashchange',()=>{if(location.hash.startsWith('#draft='))loadSharedState();});
document.addEventListener('keydown',event=>{if(event.key==='/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable){event.preventDefault();searchInput.focus();}});
window.addEventListener('load',()=>{
  if(!window.gsap || !window.ScrollTrigger || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  gsap.registerPlugin(ScrollTrigger);
  gsap.from('.hero-copy',{y:18,opacity:0,duration:.65,ease:'power2.out'});
  gsap.from('.hero-note',{y:18,opacity:0,duration:.6,delay:.12,ease:'power2.out'});
  gsap.utils.toArray('.process-row').forEach(row=>gsap.from(row,{y:14,scrollTrigger:{trigger:row,start:'top 94%',end:'top 70%',scrub:true}}));
});

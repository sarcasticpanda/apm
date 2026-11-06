const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const text = (value, max = 3000) => typeof value === 'string' ? value.slice(0, max) : '';
const list = (value, max = 20) => Array.isArray(value) ? value.slice(0, max) : [];
const storage = {
  get(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing can disable storage. */ } }
};
const icon = (name) => window.ICONS?.[name] || '';
let guides = [];
let currentFilter = 'all';
let activeGuide = null;
let draft = null;
let firstRender = true;
const appGrid = $('#app-grid');
const searchInput = $('#search');

function applyIcons(root = document) {
  $$('[data-icon]', root).forEach(el => { if (!el.firstElementChild) el.innerHTML = icon(el.dataset.icon); });
}
function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
function dateLabel(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'date unavailable';
}
const TONES = new Set(['github', 'slack', 'google', 'dropbox', 'microsoft', 'spotify']);
function logo(guide) {
  const tone = TONES.has(guide.id) ? guide.id : 'custom';
  return `<span class="app-logo tone-${tone}" aria-hidden="true">${escapeHtml(guide.mark || guide.name.slice(0, 2))}</span>`;
}
function moveTo(element, focusTarget) {
  element.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  if (focusTarget) {
    // Only make non-interactive targets (headings) focusable; giving a button tabIndex -1 would drop it from the Tab order.
    if (!focusTarget.matches('a[href], button, input, select, textarea, summary, [tabindex]')) focusTarget.tabIndex = -1;
    focusTarget.focus({ preventScroll: true });
  }
}
const GATE_LEVELS = { none: 'No gate found', possible: 'May apply', required: 'Required', depends: 'Depends on your setup', always: 'Every user' };
function routeStops(g) {
  const gates = list(g.gates, 3).filter(gate => gate && GATE_LEVELS[gate.level]);
  return [{ who: 'Register', level: 'start', status: 'Self-service' }, ...gates].map(stop => `<span class="stop stop-${stop.level}"><span class="gate-mark mark-${stop.level}" aria-hidden="true"></span><span class="stop-text"><span class="stop-label">${escapeHtml(stop.who)}</span><span class="visually-hidden">: </span><span class="stop-status">${escapeHtml(stop.status)}</span><span class="visually-hidden">. </span></span></span>`).join('');
}
function renderLibrary() {
  const query = searchInput.value.trim().toLowerCase();
  const matches = guides.filter(g => (currentFilter === 'all' || g.band === currentFilter) && `${g.name} ${g.tagline} ${g.summary} ${g.steps.map(s => s[0]).join(' ')}`.toLowerCase().includes(query));
  appGrid.classList.toggle('animate-routes', firstRender && !matchMedia('(prefers-reduced-motion: reduce)').matches);
  appGrid.innerHTML = matches.length ? matches.map((g, index) => {
    const band = g.band === 'light' ? 'light' : 'review';
    return `<button class="app-card band-${band}" type="button" data-guide="${escapeHtml(g.id)}" aria-label="Open ${escapeHtml(g.name)} setup guide" aria-describedby="route-${escapeHtml(g.id)}" style="--i:${index}">
      <span class="card-top">${logo(g)}<span class="effort-label">${escapeHtml(g.effort)}</span></span>
      <span class="card-name">${escapeHtml(g.name)}</span>
      <span class="tagline">${escapeHtml(g.tagline)}</span>
      <span class="route" id="route-${escapeHtml(g.id)}">${routeStops(g)}</span>
      <span class="card-stats"><span><small>Hands-on, our estimate</small><strong>${escapeHtml(g.time.split(' · ')[0])}</strong></span><span><small>Approval</small><strong class="stat-${band}">${escapeHtml(g.waitSummary || g.wait)}</strong></span></span>
      <span class="card-go" aria-hidden="true">Open the guide${icon('caret-right')}</span>
    </button>`;
  }).join('') : '<div class="empty-results"><strong>No matching guide yet.</strong><p>Try another search, or research the app from its public docs.</p><a class="button button-secondary" href="#generate">Research an app</a></div>';
  firstRender = false;
  $$('[data-guide]', appGrid).forEach(button => button.addEventListener('click', () => openGuide(button.dataset.guide)));
  $('#library-status').textContent = `${matches.length} of ${guides.length} guides shown`;
}
// Hero route explorer: tabs (one per provider) switch a vertical trail of that provider's gates.
let explorerId = 'slack';
function renderExplorer(focusTab = false, animate = true) {
  const tabs = $('#explorer-tabs'); const panel = $('#explorer-panel');
  if (!tabs || !panel || !guides.length) return;
  if (!guides.some(g => g.id === explorerId)) explorerId = guides[0].id;
  const g = guides.find(guide => guide.id === explorerId);
  tabs.innerHTML = guides.map(guide => `<button type="button" role="tab" class="explorer-tab" id="explore-tab-${escapeHtml(guide.id)}" data-explore="${escapeHtml(guide.id)}" aria-selected="${guide.id === explorerId}" aria-controls="explorer-panel" tabindex="${guide.id === explorerId ? 0 : -1}">${logo(guide)}<span>${escapeHtml(guide.name)}</span></button>`).join('');
  panel.setAttribute('aria-labelledby', `explore-tab-${g.id}`);
  const stops = [{ who: 'Register', level: 'start', status: 'Self-service', note: 'You create the app in the provider’s developer console and get a client ID.' }, ...list(g.gates, 3).filter(gate => gate && GATE_LEVELS[gate.level])];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  panel.innerHTML = `<ol class="trail${animate && !reduce ? ' animate-trail' : ''}">${stops.map((stop, i) => `<li class="trail-stop stop-${stop.level}" style="--i:${i}"><span class="gate-mark mark-${stop.level}" aria-hidden="true"></span><div class="trail-copy"><span class="trail-who">${escapeHtml(stop.who)}<span class="visually-hidden">: </span></span><strong class="trail-status">${escapeHtml(stop.status)}</strong><p>${escapeHtml(stop.note)}</p></div></li>`).join('')}</ol>
    <div class="explorer-foot"><dl><div><dt>Hands-on</dt><dd>${escapeHtml(g.time.split(' · ')[0])}</dd></div><div><dt>Approval</dt><dd>${escapeHtml(g.waitSummary || g.wait)}</dd></div></dl><button type="button" class="button button-lime button-small" data-open-guide="${escapeHtml(g.id)}">Open the ${escapeHtml(g.name)} guide</button></div>`;
  $$('[data-explore]', tabs).forEach(tab => {
    tab.addEventListener('click', () => { if (tab.dataset.explore !== explorerId) { explorerId = tab.dataset.explore; renderExplorer(true); } });
    tab.addEventListener('keydown', event => {
      const ids = guides.map(guide => guide.id); const at = ids.indexOf(explorerId);
      const next = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: ids.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      explorerId = ids[(next + ids.length) % ids.length];
      renderExplorer(true);
    });
  });
  $('[data-open-guide]', panel).addEventListener('click', () => openGuide(g.id));
  if (focusTab) $(`#explore-tab-${explorerId}`)?.focus();
}
function citations(ids, sources, prefix) {
  return list(ids).map(id => {
    const index = sources.findIndex((source, i) => String(source.id || i + 1) === String(id));
    return index < 0 ? '' : `<a class="inline-citation" href="#${prefix}-source-${index + 1}" aria-label="Read source ${index + 1}">[${index + 1}]</a>`;
  }).join(' ');
}
function sourcesMarkup(sources, prefix) {
  return sources.map((s, i) => `<li id="${prefix}-source-${i + 1}"><span class="source-number">${i + 1}</span><div><a href="${escapeHtml(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}${icon('arrow-up-right')}<span class="visually-hidden"> (opens in a new tab)</span></a><span class="source-kind">${escapeHtml(s.kind || 'Official page read')}${s.checkedAt ? `, checked ${dateLabel(s.checkedAt)}` : ''}</span>${s.excerpt ? `<details class="source-excerpt"><summary>Show excerpt</summary><p>${escapeHtml(s.excerpt)}</p></details>` : ''}</div></li>`).join('');
}
function bulletList(values) { return `<ul>${list(values).map(v => `<li>${escapeHtml(v)}</li>`).join('')}</ul>`; }
function ownerLabel(owner = 'You') {
  const value = String(owner || 'You');
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/^./, c => c.toUpperCase()).replace(/\b(slack|google|github)\b/g, m => ({ slack: 'Slack', google: 'Google', github: 'GitHub' })[m]);
}
function ownerClass(owner = '') {
  const value = String(owner).toLowerCase();
  if (/provider|slack|google|github|admin|customer|reviewer/.test(value)) return 'owner-external';
  return /agent/.test(value) ? 'owner-agent' : 'owner-you';
}
function gatesMarkup(gates, sources, prefix) {
  const rows = list(gates, 4).filter(gate => gate && GATE_LEVELS[gate.level]);
  if (!rows.length) return '';
  return `<section class="guide-block gates-block" aria-labelledby="${prefix}-gates-title"><h3 id="${prefix}-gates-title">Who has to say yes</h3><p>Provider review, customer administration, and user consent are separate decisions with separate owners. Plan for each one that applies.</p><div class="gates-panel"><ol class="gate-route">${rows.map(gate => `<li class="gate gate-${gate.level}"><span class="gate-mark mark-${gate.level}" aria-hidden="true"></span><span class="gate-who">${escapeHtml(gate.who)}<span class="visually-hidden">: </span></span><strong class="gate-status">${escapeHtml(gate.status)}<span class="visually-hidden">. </span></strong><p>${escapeHtml(gate.note)} ${citations(gate.sourceIds, sources, prefix)}</p></li>`).join('')}</ol></div></section>`;
}
function progressFor(id, count) {
  return list(storage.get(`oauthpath:${id}:steps`), count).filter(i => Number.isInteger(i) && i >= 0 && i < count);
}
function stepList(steps, sources, prefix, id) {
  const completed = progressFor(id, steps.length);
  return `<ol class="steps">${steps.map((s, i) => `<li class="step ${completed.includes(i) ? 'done' : ''}" data-index="${i}"><label class="step-check"><input type="checkbox" data-progress="${escapeHtml(id)}" value="${i}" ${completed.includes(i) ? 'checked' : ''}><span class="step-copy"><strong>${escapeHtml(s.title)}</strong><span>${escapeHtml(s.description)}</span></span></label><span class="step-meta"><span class="step-owner ${ownerClass(s.owner)}">${escapeHtml(ownerLabel(s.owner))}</span>${citations(s.sourceIds, sources, prefix)}</span></li>`).join('')}</ol>`;
}
function attachProgress(root, id, count) {
  const update = () => {
    const checks = $$('input[data-progress]', root);
    const done = checks.filter(c => c.checked).map(c => Number(c.value));
    storage.set(`oauthpath:${id}:steps`, done);
    checks.forEach(c => c.closest('.step').classList.toggle('done', c.checked));
    const progress = $('#progress-count');
    if (root === $('#guide-content') && progress) {
      progress.textContent = `${done.length} of ${count} steps`;
      $('#progress-percent').textContent = `${Math.round(done.length / count * 100)}%`;
      $('#progress-fill').style.width = `${done.length / count * 100}%`;
    }
  };
  $$('input[data-progress]', root).forEach(c => c.addEventListener('change', update));
}
function factsMarkup(rows) {
  return `<dl class="guide-facts">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
}
function openGuide(id, updateUrl = true) {
  const g = guides.find(g => g.id === id);
  if (!g) return;
  activeGuide = g;
  $('#missing-guide')?.remove();
  const sources = g.sources.map(([title, url, kind], i) => ({ id: String(i + 1), title, url, kind }));
  const steps = g.steps.map(([title, description, owner], i) => ({ title, description, owner, sourceIds: g.sourceIdsByStep?.[i] || [] }));
  const done = progressFor(id, steps.length);
  $('#guide-content').innerHTML = `
    <div class="guide-title-row">${logo(g)}<div><h2 class="guide-title">${escapeHtml(g.name)}</h2><p class="guide-kicker${g.band === 'light' ? ' kicker-light' : ''}">${escapeHtml(g.effort)}</p></div></div>
    <p class="guide-subtitle">${escapeHtml(g.summary)}</p>
    ${factsMarkup([['Hands-on work', g.time], ['Approval and wait', g.wait], ['Effort', g.effortLabel]])}
    <div class="callout callout-start"><strong>Start here</strong><p>${escapeHtml(g.firstAction)}</p></div>
    ${gatesMarkup(g.gates, sources, 'guide')}
    <section class="guide-block"><h3>Your setup path</h3><p>Work through the steps in order. Each number in brackets jumps to the page that supports the step.</p>${stepList(steps, sources, 'guide', id)}</section>
    <section class="guide-block"><h3>If you hit a blocker</h3><div class="callout callout-warn"><p>${escapeHtml(g.blocker)}</p></div></section>
    <section class="guide-block"><h3>Who does what</h3><div class="handoff-grid"><div><h4>The agent can help</h4>${bulletList(g.handoffs?.agent)}</div><div><h4>You take over</h4>${bulletList(g.handoffs?.human)}</div></div>${g.handoffs?.provider?.length ? `<div class="provider-handoff"><h4>Provider or customer decisions</h4>${bulletList(g.handoffs.provider)}</div>` : ''}</section>
    <section class="guide-block"><h3>Scope and uncertainty</h3><p>${escapeHtml(g.caveat)}</p><p>${escapeHtml(g.estimateBasis)}</p>${bulletList(g.uncertainties)}</section>
    <section class="guide-block"><h3>Sources</h3><p>Checked ${dateLabel(g.checkedAt)}. ${escapeHtml(g.evidenceStatus)}</p><ol class="source-list">${sourcesMarkup(sources, 'guide')}</ol></section>`;
  const percent = Math.round(done.length / steps.length * 100);
  $('#guide-rail').innerHTML = `<div class="rail-card"><h3>Your checklist</h3><p>Ticks are saved in this browser only. Sharing the guide doesn't share them.</p><div class="rail-progress"><span id="progress-count">${done.length} of ${steps.length} steps</span><span id="progress-percent">${percent}%</span></div><div class="progress-track" aria-hidden="true"><div id="progress-fill" class="progress-fill" style="width:${percent}%"></div></div><div class="rail-actions"><button class="rail-action" id="share-known" type="button">${icon('link-simple')}<span>Copy guide link</span></button><button class="rail-action" id="download-known" type="button">${icon('download-simple')}<span>Download Markdown</span></button><button class="rail-action" id="print-known" type="button">${icon('printer')}<span>Print or save PDF</span></button></div><p class="rail-note">${sources.length} official sources, checked ${dateLabel(g.checkedAt)}</p><div class="share-feedback" role="status" aria-live="polite"></div></div>`;
  $('#guide-section').hidden = false;
  $('#generated-guide').hidden = true;
  attachProgress($('#guide-content'), id, steps.length);
  $('#share-known').onclick = () => copyLink(new URL(`?guide=${encodeURIComponent(id)}`, location.href).href, $('#share-known'));
  $('#download-known').onclick = () => downloadMarkdown(g);
  $('#print-known').onclick = () => window.print();
  if (updateUrl) history.pushState(null, '', `?guide=${encodeURIComponent(id)}#guide-section`);
  moveTo($('#guide-section'), $('.guide-title'));
}
function markdownForKnown(g) {
  const lines = [`# ${g.name} OAuth setup`, '', g.summary, '', `**Hands-on estimate:** ${g.time}`, `**Approval:** ${g.wait}`, '', `**First step:** ${g.firstAction}`];
  if (g.gates?.length) lines.push('', '## Who has to say yes', ...g.gates.map(gate => `- **${gate.who}: ${gate.status}.** ${gate.note}`));
  lines.push('', '## Setup steps');
  g.steps.forEach(([title, desc, owner], i) => lines.push(`\n${i + 1}. **${title}** (${ownerLabel(owner)})\n   ${desc}\n   ${(g.sourceIdsByStep?.[i] || []).map(n => `[Source ${n}](${g.sources[n - 1][1]})`).join(', ')}`));
  lines.push('', '## If blocked', g.blocker, '', '## Limits', g.caveat, g.estimateBasis, ...g.uncertainties.map(v => `- ${v}`), '', '## Evidence', `Checked ${g.checkedAt}. ${g.evidenceStatus}`, ...g.sources.map(([t, u]) => `- [${t}](${u})`));
  return lines.join('\n');
}
function downloadFile(name, content) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadMarkdown(g) { downloadFile(`${g.id}-oauth-guide.md`, markdownForKnown(g)); }
async function copyLink(url, button) {
  const feedback = button.closest('.rail-card, .generated-guide')?.querySelector('.share-feedback');
  try {
    await navigator.clipboard.writeText(url);
    if (feedback) feedback.textContent = 'Link copied. Anyone with the link can read this guide.';
  } catch {
    if (feedback) {
      feedback.replaceChildren();
      const label = document.createElement('label'); label.textContent = 'Copy this share link:';
      const input = document.createElement('input'); input.type = 'text'; input.readOnly = true; input.value = url;
      label.append(input); feedback.append(label); input.focus(); input.select();
    }
  }
}
function normaliseResearch(raw) {
  if (!raw || typeof raw !== 'object' || !text(raw.name) || !Array.isArray(raw.sources) || !Array.isArray(raw.steps)) throw new Error('This shared guide is incomplete or uses an older format. Please research the app again.');
  const sourceIds = new Set();
  const sources = list(raw.sources, 8).map((s, i) => ({ id: text(String(s.id || i + 1), 20), title: text(s.title, 240), url: safeUrl(s.url), kind: text(s.kind, 100), checkedAt: text(s.checkedAt, 40), excerpt: text(s.excerpt, 1200) })).filter(s => s.url && s.title && !sourceIds.has(s.id) && sourceIds.add(s.id));
  const ids = (v) => list(v, 8).map(String).filter(id => sourceIds.has(id));
  const textList = (v) => list(v, 12).map(v => text(v, 1000)).filter(Boolean);
  return {
    // Namespace shared ids so a crafted link cannot write into a curated guide's saved checklist.
    id: ((id) => id.startsWith('research-') ? id : `shared-${id || 'guide'}`)(text(raw.id, 100).replace(/[^a-zA-Z0-9_-]/g, '')), name: text(raw.name, 100), domain: text(raw.domain, 250), url: safeUrl(raw.url), researchedAt: text(raw.researchedAt, 40),
    mode: raw.mode === 'ai' ? 'ai' : 'evidence', oauthSupport: raw.oauthSupport === 'documented' ? 'documented' : 'unconfirmed',
    summary: text(raw.summary), difficulty: text(raw.difficulty, 300), setupEffort: text(raw.setupEffort, 700), approvalWait: text(raw.approvalWait, 700),
    steps: list(raw.steps, 12).map(s => ({ title: text(s.title, 180), description: text(s.description, 1500), owner: text(s.owner, 90), sourceIds: ids(s.sourceIds) })),
    requirements: list(raw.requirements, 12).map(s => ({ text: text(s.text, 1200), sourceIds: ids(s.sourceIds) })),
    blockers: list(raw.blockers, 10).map(s => ({ text: text(s.text, 1200), nextAction: text(s.nextAction, 1200), sourceIds: ids(s.sourceIds) })),
    uncertainties: textList(raw.uncertainties), agentCan: textList(raw.agentCan), humanMust: textList(raw.humanMust), sources,
    activity: list(raw.activity, 15).map(a => ({ label: text(a.label, 300), status: text(a.status, 40) }))
  };
}
function renderDraft(result, shared = false) {
  draft = normaliseResearch(result);
  const d = draft;
  const container = $('#generated-guide');
  const documented = d.oauthSupport === 'documented';
  container.innerHTML = `<div class="generated-guide-head"><div><p class="draft-meta">${shared ? 'Shared research snapshot' : 'Live research result'}<span class="draft-domain">${escapeHtml(d.domain)}</span></p><h2>${escapeHtml(d.name)} OAuth guide</h2></div><span class="draft-tag mode-${d.mode}">${d.mode === 'ai' ? 'AI draft with citations' : 'Extracted evidence'}</span></div>
    <p class="guide-subtitle">${escapeHtml(d.summary)}</p>
    <div class="status-banner status-${d.oauthSupport}">${icon(documented ? 'check' : 'warning')}<div><strong>${documented ? 'OAuth documentation found. Review before relying on it.' : 'OAuth support is not confirmed'}</strong><p>${shared ? 'This link carries a snapshot from the person who shared it. It has not been rechecked on this device.' : 'The agent read public pages. It did not create a provider account, exchange a token, or submit for approval.'} ${d.mode === 'evidence' ? 'AI drafting was unavailable, so these findings are extracted from the pages read. Confirm them before acting.' : 'Check each cited claim against the official page before you rely on it.'}</p></div></div>
    ${factsMarkup([['Setup effort', d.setupEffort || 'Not verified'], ['Approval wait', d.approvalWait || 'Not verified'], ['Complexity', d.difficulty || 'Needs confirmation']])}
    <div class="generated-grid"><section class="generated-panel generated-steps"><h3>Setup path</h3>${stepList(d.steps, d.sources, 'draft', d.id)}</section><section class="generated-panel"><h3>Requirements found</h3>${d.requirements.length ? `<ul>${d.requirements.map(r => `<li>${escapeHtml(r.text)} ${citations(r.sourceIds, d.sources, 'draft')}</li>`).join('')}</ul>` : '<p>No provider-specific requirements were confirmed. Start with the linked documentation.</p>'}<h3>Blockers and next actions</h3>${d.blockers.map(b => `<div class="callout callout-warn"><strong>${escapeHtml(b.text)}</strong><p>${escapeHtml(b.nextAction)} ${citations(b.sourceIds, d.sources, 'draft')}</p></div>`).join('') || '<p>No specific approval blockers were confirmed.</p>'}</section>
    <section class="generated-panel"><h3>Who does what</h3><h4>The agent can help</h4>${bulletList(d.agentCan)}<h4>You take over</h4>${bulletList(d.humanMust)}</section><section class="generated-panel"><h3>What still needs checking</h3>${bulletList(d.uncertainties)}<h4>What the agent did</h4><ol class="research-log">${d.activity.map(a => `<li class="log-${a.status === 'complete' ? 'done' : 'open'}"><span>${escapeHtml(a.label)}</span></li>`).join('')}</ol></section></div>
    <section class="guide-block"><h3>Sources: ${d.sources.length} page${d.sources.length === 1 ? '' : 's'} read</h3><p>Retrieved ${dateLabel(d.researchedAt)}. Read the original page for full context; an excerpt can leave out exceptions.</p><ol class="source-list">${sourcesMarkup(d.sources, 'draft')}</ol></section>
    <div class="guide-actions"><button class="button button-primary generated-share" id="share-generated" type="button">${icon('link-simple')}Copy share link</button><button class="button button-secondary generated-share" id="download-generated" type="button">${icon('download-simple')}Download Markdown</button><button class="button button-secondary generated-share" id="print-generated" type="button">${icon('printer')}Print or save PDF</button></div><div class="share-feedback" role="status" aria-live="polite"></div>`;
  container.hidden = false;
  $('#guide-section').hidden = true;
  attachProgress(container, d.id, d.steps.length);
  $('#share-generated').onclick = async () => {
    const payload = await encodeDraft(d);
    const url = new URL(location.origin + location.pathname); url.hash = `draft=${payload}`;
    await copyLink(url.href, $('#share-generated'));
  };
  $('#download-generated').onclick = () => {
    const content = [`# ${d.name} OAuth guide`, '', d.summary, `Mode: ${d.mode}. Researched ${d.researchedAt}.`, shared ? 'Shared snapshot; not independently rechecked.' : 'Draft; provider setup not attempted.', '', `Setup: ${d.setupEffort}`, `Approval wait: ${d.approvalWait}`, '', '## Steps', ...d.steps.map((s, i) => `${i + 1}. **${s.title}** (${s.owner})\n   ${s.description}\n   Sources: ${s.sourceIds.join(', ')}`), '', '## Requirements', ...d.requirements.map(r => `- ${r.text} [${r.sourceIds.join(', ')}]`), '', '## Blockers', ...d.blockers.map(b => `- ${b.text} Next: ${b.nextAction}`), '', '## Uncertainty', ...d.uncertainties.map(v => `- ${v}`), '', '## Sources', ...d.sources.map(s => `- [${s.id}] [${s.title}](${s.url})`)].join('\n');
    downloadFile(`${d.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-oauth-guide.md`, content);
  };
  $('#print-generated').onclick = () => window.print();
  moveTo(container, $('h2', container));
}
async function encodeDraft(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let data = bytes; let format = 'u';
  if (typeof CompressionStream !== 'undefined') { data = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); format = 'z'; }
  let binary = ''; for (const byte of data) binary += String.fromCharCode(byte);
  return format + btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
async function decodeDraft(value) {
  if (typeof value !== 'string' || value.length > 100000) throw new Error('This share link is too large. Ask for the Markdown guide instead.');
  const format = value[0]; if (!['u', 'z'].includes(format)) throw new Error('This share link uses an older format. Please research the app again.');
  const binary = atob(value.slice(1).replaceAll('-', '+').replaceAll('_', '/'));
  let bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  if (format === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('Use a current browser to open this compressed guide.');
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = []; let total = 0;
    while (true) { const { done, value: chunk } = await reader.read(); if (done) break; total += chunk.length; if (total > 100000) { await reader.cancel(); throw new Error('This shared guide exceeds the size limit.'); } chunks.push(chunk); }
    bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  }
  if (bytes.length > 100000) throw new Error('This shared guide exceeds the size limit.');
  return normaliseResearch(JSON.parse(new TextDecoder().decode(bytes)));
}
async function loadSharedState() {
  // popstate can fire before guides.json arrives; initialise() calls this again once it has.
  if (!guides.length) return;
  const params = new URLSearchParams(location.search); const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has('draft') || params.has('draft')) {
    try { renderDraft(await decodeDraft(hash.get('draft') || params.get('draft')), true); }
    catch (error) { const el = $('#generated-guide'); el.hidden = false; el.innerHTML = `<div class="status-banner error">${icon('warning')}<div><h2>Couldn’t open this guide</h2><p>${escapeHtml(error.message)}</p><a class="text-link" href="#generate">Research the app again</a></div></div>`; moveTo(el, $('h2', el)); }
  } else if (params.has('guide')) {
    // In-page anchor clicks also fire popstate; don't re-render and scroll back to a guide that is already open.
    if (activeGuide?.id === params.get('guide') && !$('#guide-section').hidden) return;
    if (guides.some(g => g.id === params.get('guide'))) openGuide(params.get('guide'), false);
    else if (!$('#missing-guide')) { appGrid.insertAdjacentHTML('beforebegin', '<p class="status-banner" id="missing-guide">That guide is not in this library. Choose a provider or research it below.</p>'); }
  } else {
    $('#missing-guide')?.remove();
    if (!$('#guide-section').hidden) {
      // Browser Back from an open guide returns to the library instead of leaving a stale guide on screen.
      $('#guide-section').hidden = true;
      if (activeGuide) $(`[data-guide="${activeGuide.id}"]`)?.focus({ preventScroll: true });
    }
  }
}
$$('.filter').forEach(button => button.addEventListener('click', () => {
  currentFilter = button.dataset.filter;
  $$('.filter').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
  renderLibrary();
}));
searchInput.addEventListener('input', renderLibrary);
$('#back-to-library').onclick = () => {
  $('#guide-section').hidden = true; history.pushState(null, '', location.pathname + '#library'); moveTo($('#library'), $(`[data-guide="${activeGuide?.id}"]`));
};
function researchFailure(error) {
  if (error.name === 'TimeoutError') return 'Research took too long. Try the provider’s OAuth documentation URL instead.';
  // fetch() network failures are TypeErrors and non-JSON responses are SyntaxErrors; neither message helps a user.
  if (error instanceof TypeError || error instanceof SyntaxError || !error.message) return 'Could not reach the research service. Check your connection and try again.';
  return error.message;
}
$('#generate-form').addEventListener('submit', async event => {
  event.preventDefault();
  const status = $('#research-status'); const button = $('#generate-button');
  let name = $('#app-name').value.trim(); let url = $('#app-url').value.trim();
  status.hidden = false; status.classList.remove('error', 'loading');
  if (!name && !url) { status.classList.add('error'); status.textContent = 'Enter an app name or its official website.'; $('#app-name').focus(); return; }
  if (!url && /^(https?:\/\/|[\w-]+\.[a-z]{2,}(\/|$))/i.test(name)) { url = name; name = ''; }
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (url && !safeUrl(url)) { status.classList.add('error'); status.textContent = 'Enter a public website such as https://linear.app.'; return; }
  button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Researching…';
  status.classList.add('loading');
  status.innerHTML = `<div class="research-progress" aria-hidden="true"><span></span></div><p>Researching <strong>${escapeHtml(name || url)}</strong> from its public docs. <span class="elapsed" aria-hidden="true">0 s</span></p><p class="status-sub">Most apps finish in 15 to 35 seconds.</p>`;
  const started = Date.now();
  const timer = setInterval(() => { const el = $('.elapsed', status); if (el) el.textContent = `${Math.round((Date.now() - started) / 1000)} s`; }, 1000);
  $('#generated-guide').hidden = true;
  try {
    const response = await fetch('/api/research', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, url }), signal: AbortSignal.timeout(110000) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Research could not finish. Please try again.');
    renderDraft(result);
    status.classList.remove('loading');
    status.textContent = `Read ${draft.sources.length} public page${draft.sources.length === 1 ? '' : 's'} in ${Math.round((Date.now() - started) / 1000)} s. ${draft.mode === 'ai' ? 'The cited draft is below.' : 'AI drafting was unavailable, so the extracted evidence is below.'}`;
    history.replaceState(null, '', location.pathname + '#generated-guide');
  } catch (error) {
    status.classList.remove('loading');
    status.classList.add('error');
    status.textContent = researchFailure(error);
  } finally {
    clearInterval(timer);
    button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = 'Research this app';
  }
});
async function initialise() {
  appGrid.innerHTML = `<div class="route-skeleton" role="status"><span class="visually-hidden">Loading the guide library</span>${'<span class="skeleton-row"></span>'.repeat(6)}</div>`;
  try {
    const response = await fetch('/guides.json'); if (!response.ok) throw new Error();
    guides = await response.json(); renderLibrary(); renderExplorer(false, false); await loadSharedState();
  } catch {
    appGrid.innerHTML = '<div class="empty-results"><strong>The guide library couldn’t load.</strong><p>Check your connection, then try again.</p><button class="button button-secondary" id="retry-library" type="button">Try again</button></div>';
    $('#retry-library').onclick = initialise;
  }
}
applyIcons();
initialise();
window.addEventListener('popstate', loadSharedState);
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#draft=')) loadSharedState(); });
// Citations scroll to their source without a hash change, which would re-render a guide or drop a #draft= share payload.
document.addEventListener('click', event => {
  const link = event.target.closest?.('a.inline-citation');
  const target = link && document.getElementById(link.getAttribute('href').slice(1));
  if (!target) return;
  event.preventDefault();
  moveTo(target);
  target.querySelector('a')?.focus({ preventScroll: true });
  target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
});
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); searchInput.focus(); } });

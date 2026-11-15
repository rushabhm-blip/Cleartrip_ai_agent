// Markup for the Wishbox (Flow A) and the reveal + vote screen (Flow B). All text, prices, buttons and votes are live HTML.
import { state, transient, fmtRange } from './store.js';
import { esc, icon, isPhone } from './ui.js';
import { avatar } from './characters.js';
import { rupee } from './data.js';
import * as WB from './wishbox.js';
const { STICKERS, CATS, THEMES, DESTS } = WB;

const A = 'assets/wb/';
const SIZES = { box_empty: [820, 437], box_receiving: [820, 451], box_ready: [820, 422], pin: [120, 165], globe_india: [600, 607] };
const sticker = (key, cls = '', w = 64) => { const h = { beach: 326, cafe: 351, camping: 174, easy_hike: 262, heritage: 292, local_food: 251, photography: 219, slow_mornings: 171, train_trip: 197, waterfall: 199 }[key] || 260; return `<img class="${cls}" src="${A}${key}.webp" alt="" width="${w}" height="${Math.round(h * w / 300)}" loading="lazy" decoding="async">`; };
const nm = id => esc(state.travellers.find(t => t.id === id)?.name || 'Someone');
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const people = w => [w.owner, ...w.support];
const dateLine = () => `${fmtRange()} · ${plural(WB.nights(), 'night', 'nights')}`;
const tgtTxt = () => { const t = WB.target(); return t == null ? 'Add a budget to set the target' : `Plan within ${rupee(t)} per person`; };

// ------------------------------------------------------------------ shared pieces
function steps(cur) {
  const s = ['Wishes', 'Review', 'Shortlist', 'Reveal & vote'];
  return `<ol class="wb-steps" aria-label="Progress">${s.map((l, i) => `<li class="${i + 1 === cur ? 'is-cur' : i + 1 < cur ? 'is-done' : ''}" ${i + 1 === cur ? 'aria-current="step"' : ''}><b>${i + 1 < cur ? icon('check', '', 14) : i + 1}</b><span>${l}</span></li>`).join('')}</ol>`;
}
function whoBar() {
  const m = WB.me(), c = WB.isCoord();
  return `<p class="wb-who">${avatar(m, 28)} <span>Viewing as <b>${esc(m.name)}</b> · ${c ? 'coordinator' : 'member'}</span></p>`;
}
const rolePill = id => (id === WB.coord().id ? '<i class="pill">coordinator</i>' : '');

// ------------------------------------------------------------------ A0: budget
function budgetCard() {
  const m = WB.me(), v = WB.validateCap, draft = transient.wbCapDraft;
  const val = draft != null ? draft : String(m.cap);
  const slider = Math.min(30000, Math.max(3000, Number(String(val).replace(/\D/g, '')) || m.cap));
  const err = transient.wbCapErr || '';
  const priv = WB.capPrivacy(m.id);
  const t = WB.target(), miss = WB.missingCaps();
  const memberRows = WB.members().map(x => {
    const set = WB.capSet(x.id), vis = WB.capVisibleTo(m, x);
    return `<li>${avatar(x, 28)}<b>${esc(x.name)}</b>${rolePill(x.id)}<span class="${set ? '' : 'is-miss'}">${set ? (vis ? `Cap ${rupee(x.cap)}` : 'Cap kept private') : 'Budget missing'}</span></li>`;
  }).join('');
  return `<section class="card wb-budget" aria-labelledby="wbb-t">
    <img class="wb-wallet" src="${A}wallet.webp" alt="" width="96" height="90">
    <div class="wb-budget-main">
      <h2 id="wbb-t">Dates &amp; budget</h2>
      <p class="wb-dates">${icon('cal', '', 18)} <span>${dateLine()}</span> <button type="button" class="link-btn" data-act="wb-dates">Edit dates</button></p>
      <form data-form="wb-cap" novalidate class="wb-capform">
        <label for="wb-cap-in" class="wb-lbl">My budget · Maximum per person</label>
        <div class="wb-cap-row"><div class="money"><i>₹</i><input id="wb-cap-in" name="cap" type="text" inputmode="numeric" autocomplete="off" value="${esc(val)}" data-wb-cap aria-describedby="wb-cap-h wb-cap-e"></div>
          <input type="range" name="range" min="3000" max="30000" step="100" value="${slider}" data-wb-range aria-label="Maximum per person, slider" tabindex="0"></div>
        <p class="hint" id="wb-cap-h">Travel, stays and estimated meals included. This is a planning cap, not an amount collected or paid.</p>
        <p class="field-err" id="wb-cap-e" role="alert">${esc(err)}</p>
        <fieldset class="wb-priv"><legend>Who sees my exact cap?</legend>
          ${[['target', 'Only the group target (default)'], ['coord', 'The coordinator as well'], ['all', 'Everyone']].map(([k, l]) => `<label class="radio"><input type="radio" name="privacy" value="${k}" ${priv === k ? 'checked' : ''}> ${l}</label>`).join('')}</fieldset>
        <div class="wb-actions-row"><button type="button" class="btn btn-secondary" data-act="wb-cap-cancel">Cancel</button><button type="submit" class="btn btn-primary">Save my cap</button>${transient.wbCapSaved ? `<span class="wb-saved" role="status">${icon('check', '', 16)} Saved</span>` : ''}</div>
      </form>
      <div class="wb-target" role="status"><b>${tgtTxt()}</b><span>Based on the lowest submitted cap.${miss.length ? ` <em>${plural(miss.length, 'budget', 'budgets')} missing, so this target is provisional.</em>` : ''}</span></div>
      <ul class="wb-members">${memberRows}</ul>
    </div></section>`;
}

// ------------------------------------------------------------------ A1/A2: box, picker, board
function boxCard() {
  const w = WB.W(), n = w.wishes.length, all = n > 0 && WB.readyCount() === WB.members().length;
  const state_ = n === 0 ? 'box_empty' : all ? 'box_ready' : 'box_receiving';
  const [bw, bh] = SIZES[state_];
  const keys = [...new Set(w.wishes.filter(x => x.key).map(x => x.key))];
  const shown = keys.slice(0, 6), more = n - shown.length;
  const thumbs = shown.map((k, i) => `<span class="wb-thumb" data-thumb="${k}" style="--i:${i};--r:${[-4, 3, -2, 5, -3, 2][i % 6]}deg">${sticker(k, '', 64)}</span>`).join('');
  const tray = transient.wbMore ? STICKERS : STICKERS.filter(s => ['beach', 'heritage', 'cafe', 'easy_hike', 'local_food', 'photography'].includes(s.key));
  return `<section class="wb-stage" aria-label="The Wishbox">
    <p class="wb-hint">Drag a sticker into the box to add a wish</p>
    <figure class="wb-box ${n ? '' : 'is-empty'}" id="wb-box" style="--ar:${bw}/${bh}" aria-label="${n === 0 ? 'Empty box' : `Box with ${plural(n, 'wish', 'wishes')}`}${all ? ', everyone ready' : ''}">
      <img class="wb-boxart" src="${A}${state_}.webp" alt="" width="${bw}" height="${bh}" decoding="async">
      <div class="wb-cavity">${n === 0 ? `<p class="wb-empty"><b>Add the first wish</b></p>` : `<div class="wb-thumbs">${thumbs}${n > shown.length ? `<span class="wb-more">+${Math.max(more, 0)} more</span>` : ''}</div>`}</div>
    </figure>
    <ul class="wb-tray" aria-label="Stickers">${tray.map(s => `<li><button type="button" class="wb-sticker" data-act="wb-sticker" data-key="${s.key}" aria-label="Add ${s.label} to the box. Drag it into the box, or press Enter.">${sticker(s.key, '', 56)}<span>${s.label.replace('Local cafés', 'Cafés').replace('Easy hikes', 'Hikes').replace('Beach time', 'Beach').replace('Slow mornings', 'Slow mornings')}</span></button></li>`).join('')}
      <li><button type="button" class="wb-sticker wb-moreb" data-act="wb-more" aria-expanded="${!!transient.wbMore}"><span class="wb-plus" aria-hidden="true">${icon(transient.wbMore ? 'up' : 'plus', '', 26)}</span><span>${transient.wbMore ? 'Fewer' : 'More'}</span></button></li></ul>
    <form data-form="wb-write" class="wb-write" novalidate><label for="wb-write-in" class="sr-only">Write your own wish</label>
      <div class="wb-write-row"><input id="wb-write-in" name="text" type="text" maxlength="80" autocomplete="off" placeholder="Write your own wish..." value="${esc(transient.wbWriteText || '')}" data-wb-write aria-describedby="wb-write-e"><button class="wb-add" type="submit" aria-label="Add wish">${icon('plus', '', 22)}</button></div>
      <p class="field-err" id="wb-write-e" role="alert">${esc(transient.wbWriteErr || '')}</p></form>
  </section>`;
}
function wishCard(x) {
  const m = WB.me(), mine = x.owner === m.id, ppl = people(x), meIn = ppl.includes(m.id);
  const editing = transient.wbEdit === x.id;
  const e = transient.wbEditErr && transient.wbEditErr.id === x.id ? transient.wbEditErr.msg : '';
  const th = THEMES[WB.themeOf(x)];
  return `<li class="wb-wish ${transient.wbFlash === x.id ? 'is-new' : ''} ${x.priority === 'must' ? 'is-must' : ''}" data-wish="${x.id}">
    <div class="wb-wish-art">${x.key ? sticker(x.key, '', 72) : `<span class="wb-custom">${icon('pencil', '', 26)}</span>`}</div>
    <div class="wb-wish-body">
      ${editing ? `<form data-form="wb-edit" data-id="${x.id}" class="wb-edit" novalidate><label class="sr-only" for="we-${x.id}">Wish title</label><input id="we-${x.id}" name="text" type="text" maxlength="80" value="${esc(x.text)}" autocomplete="off"><button class="btn btn-primary btn-sm" type="submit">Save</button><button class="btn btn-secondary btn-sm" type="button" data-act="wb-edit-cancel">Cancel</button></form>${e ? `<p class="field-err" role="alert">${esc(e)}</p>` : ''}` : `<h4>${esc(x.text)}</h4>`}
      <p class="wb-meta">Added by <b>${nm(x.owner)}</b> · <span title="${esc(ppl.map(i => state.travellers.find(t => t.id === i)?.name).join(', '))}">${plural(ppl.length, 'person', 'people')}</span>${ppl.length > 1 ? `: ${ppl.map(nm).join(', ')}` : ''}</p>
      <p class="wb-tags"><i class="tag">${esc(th)}</i> <i class="tag ${x.priority === 'must' ? 'tag-must' : ''}">${x.priority === 'must' ? 'Must-have' : 'Nice-to-have'}</i></p>
      <div class="wb-wish-actions">
        ${mine ? '' : `<button type="button" class="btn btn-secondary btn-sm wb-heart" data-act="wb-support" data-id="${x.id}" aria-pressed="${meIn}">${icon('check', '', 14)} ${meIn ? 'You want this too' : 'I want this too'}</button>`}
        ${mine ? `<button type="button" class="btn btn-ghost btn-sm" data-act="wb-edit-open" data-id="${x.id}" aria-label="Edit title of ${esc(x.text)}">${icon('pencil', '', 14)} Edit</button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="wb-priority" data-id="${x.id}" aria-pressed="${x.priority === 'must'}">${x.priority === 'must' ? 'Make nice-to-have' : 'Make must-have'}</button>
          <button type="button" class="btn btn-ghost-danger btn-sm" data-act="wb-remove" data-id="${x.id}" aria-label="Remove ${esc(x.text)}">${icon('trash', '', 14)} Remove</button>` : ''}
      </div></div></li>`;
}
function boardCard() {
  const w = WB.W(), m = WB.me();
  const clar = w.clar.filter(c => c.to === m.id);
  const hist = w.history.slice(-5).reverse();
  return `<section class="card wb-board" aria-labelledby="wbw-t">
    <div class="wb-board-h"><h2 id="wbw-t">Wishes in the box <span class="count">${w.wishes.length}</span></h2>
      <button type="button" class="link-btn" data-act="wb-undo" ${w.history.length ? '' : 'disabled'}>${icon('undo', '', 16)} Undo last change</button></div>
    ${clar.map(c => `<div class="banner banner-info" role="status">${icon('info', '', 18)} <span><b>${nm(c.by)}</b> asked: ${esc(c.text)}</span> <button class="link-btn" data-act="wb-clar-dismiss" data-id="${c.id}">Done</button></div>`).join('')}
    ${w.wishes.length ? `<ul class="wb-wishes">${w.wishes.map(wishCard).join('')}</ul>` : `<p class="wb-none">No wishes yet. Pick a sticker above, or write one.</p>`}
    ${hist.length ? `<details class="wb-hist"><summary>Recent changes</summary><ol>${hist.map(h => `<li>${esc(h.label)}</li>`).join('')}</ol></details>` : ''}
  </section>`;
}
// ------------------------------------------------------------------ A4/A5: coordinator review
function readiness() {
  return `<ul class="wb-ready-list">${WB.members().map(x => {
    const st = WB.readyState(x.id), set = WB.capSet(x.id);
    return `<li>${avatar(x, 28)}<b>${esc(x.name)}</b>${rolePill(x.id)}<span class="st st-${st}">${st === 'ready' ? 'Ready' : st === 'updated' ? 'Updated, ready again?' : 'Still adding'}</span>${set ? '' : '<span class="st st-miss">Budget missing</span>'}</li>`;
  }).join('')}</ul>`;
}
function aiBlock() {
  const w = WB.W(), ai = w.ai;
  const stepsL = ['Reading wishes', 'Checking limits', 'Suggesting matches'];
  if (ai.status === 'running') return `<div class="wb-ai"><img src="${A}ai_grouping.webp" alt="" width="64" height="58"><div><p class="wb-sim">Simulation: no live search is run.</p>
    <ol class="wb-aisteps" aria-live="polite">${stepsL.map((l, i) => `<li class="${i < ai.step ? 'is-done' : i === ai.step ? 'is-now' : ''}">${i < ai.step ? icon('check', '', 14) : i === ai.step ? icon('hourglass', '', 14) : ''} ${l}${i === ai.step ? '…' : ''}</li>`).join('')}</ol>
    <button class="btn btn-secondary btn-sm" data-act="wb-ai-cancel">Cancel</button></div></div>`;
  if (ai.status === 'failed') return `<div class="banner banner-warn-soft" role="alert">${icon('alert', '', 18)} <span><b>Grouping did not finish.</b> All ${w.wishes.length} wishes are safe.</span> <button class="btn btn-secondary btn-sm" data-act="wb-ai">Try again</button></div>`;
  return `<div class="wb-ai"><img src="${A}ai_grouping.webp" alt="" width="64" height="58"><div><p>Group related wishes into themes. Unusual wishes are kept, and nothing is deleted.</p><button class="btn btn-primary" data-act="wb-ai" ${w.wishes.length ? '' : 'disabled'}>${icon('sparkle', '', 18)} Group wishes with AI</button>${ai.status === 'done' ? '<span class="wb-sim">Grouped. Run again after changes.</span>' : ''}</div></div>`;
}
function analysisBlock() {
  const w = WB.W(); if (w.ai.status !== 'done') return '';
  const a = WB.analyse(), M = WB.members().length;
  const themes = a.themes.map(th => `<section class="wb-theme ${transient.wbCluster ? 'is-in' : ''}"><h4>${th.label} <small>${th.people.length} of ${M} ${M === 1 ? 'member' : 'members'}</small>${th.minority ? '<i class="tag">minority request, kept</i>' : ''}</h4>
    <ul>${th.wishes.map((x, i) => `<li style="--i:${i}"><span class="who">${nm(x.owner)}${x.support.length ? ' +' + x.support.map(nm).join(', ') : ''}</span> ${esc(x.text)} ${x.priority === 'must' ? '<i class="tag tag-must">Must-have</i>' : ''}
      <span class="wb-adj"><label class="sr-only" for="adj-${x.id}">Move ${esc(x.text)} to another theme</label><select id="adj-${x.id}" data-act="wb-theme" data-id="${x.id}"><option value="__auto" ${w.adjust[x.id] ? '' : 'selected'}>Auto</option>${Object.entries(THEMES).map(([k, l]) => `<option value="${k}" ${w.adjust[x.id] === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      ${x.owner === WB.me().id ? '' : `<button class="link-btn" data-act="wb-clarify" data-id="${x.id}">Ask ${nm(x.owner)} to clarify</button>`}</span></li>`).join('')}</ul></section>`).join('');
  const list = (title, items, empty, cls = '') => `<div class="wb-sum ${cls}"><h4>${title}</h4>${items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`}</div>`;
  return `<div class="wb-analysis">${themes}
    ${list('Agreed interests', a.agreed.map(t => `${t.label}: ${t.people.length} of ${M} members`), `Nothing is shared by at least ${a.need} members yet.`)}
    ${list('Must-haves', a.musts.map(x => `${esc(x.text)} · ${nm(x.owner)}`), 'No must-haves marked.')}
    ${list('Conflicts', a.conflicts.map(esc), 'No conflicts found.', a.conflicts.length ? 'is-warn' : '')}
    ${list('Missing inputs', a.missing.map(esc), 'Nothing missing.', a.missing.length ? 'is-warn' : '')}</div>`;
}
function proposalCard(it, idx, last) {
  const p = WB.proposal(it.id), d = p.d, w = WB.W();
  const rej = transient.wbReject === d.id, rerr = transient.wbRejectErr && transient.wbRejectErr.dest === d.id ? transient.wbRejectErr.msg : '';
  return `<li class="wb-prop ${it.include ? '' : 'is-off'}"><img src="${A}${d.art}.webp" alt="" width="72" height="${d.art === 'coorg' ? 78 : 72}" loading="lazy">
    <div class="wb-prop-b"><h4>${d.name} <small>${d.region}</small></h4>
      <p class="wb-price"><b>${rupee(d.price)}</b> per person ${p.over ? `<i class="tag tag-over">${rupee(p.over)} above target</i>` : '<i class="tag tag-ok">Within target</i>'}</p>
      <p class="wb-line"><b>Matches ${p.hit.length}:</b> ${p.hit.length ? p.hit.map(x => esc(x.text)).join(', ') : 'none'}</p>
      <p class="wb-line"><b>Missed ${p.miss.length}:</b> ${p.miss.length ? p.miss.map(x => esc(x.text)).join(', ') : 'none'}. <span class="muted">${d.gap}</span></p>
      <p class="wb-line muted">${d.fit}</p>
      <div class="wb-prop-ctl">
        <label class="radio"><input type="checkbox" data-act="wb-draft-include" data-dest="${d.id}" ${it.include ? 'checked' : ''}> Include</label>
        ${p.over ? `<label class="radio"><input type="checkbox" data-act="wb-draft-stretch" data-dest="${d.id}" ${it.stretch ? 'checked' : ''}> Stretch option for discussion</label>` : ''}
        <button class="btn btn-ghost btn-sm" data-act="wb-draft-move" data-dest="${d.id}" data-dir="up" ${idx === 0 ? 'disabled' : ''} aria-label="Move ${d.name} up">${icon('up', '', 14)}</button>
        <button class="btn btn-ghost btn-sm" data-act="wb-draft-move" data-dest="${d.id}" data-dir="down" ${last ? 'disabled' : ''} aria-label="Move ${d.name} down">${icon('down', '', 14)}</button>
        <button class="btn btn-ghost-danger btn-sm" data-act="wb-reject-open" data-dest="${d.id}">Exclude…</button></div>
      ${rej ? `<form data-form="wb-reject" data-dest="${d.id}" class="wb-reject" novalidate><label for="rj-${d.id}" class="sr-only">Reason for excluding ${d.name}</label><input id="rj-${d.id}" name="reason" type="text" placeholder="Reason, for example: too far for this trip" maxlength="100"><button class="btn btn-primary btn-sm" type="submit">Exclude</button><button class="btn btn-secondary btn-sm" type="button" data-act="wb-reject-cancel">Cancel</button>${rerr ? `<p class="field-err" role="alert">${esc(rerr)}</p>` : ''}</form>` : ''}
    </div></li>`;
}
function shortlistBlock() {
  const w = WB.W(), dr = WB.ensureDraft(), issues = WB.publishIssues(), pub = w.published;
  const a = WB.analyse();
  const exc = Object.entries(w.excluded);
  const same = pub && JSON.stringify(pub.items.map(i => [i.id, i.stretch])) === JSON.stringify(dr.items.filter(i => i.include).map(i => [i.id, !!i.stretch]));
  return `<section class="wb-short" aria-labelledby="wbs-t"><h3 id="wbs-t">Shortlist <small>draft</small></h3>
    <p class="muted">AI helps assess options. It does not choose the trip. Estimates are rough and sample-only.</p>
    ${a.missing.length ? `<div class="banner banner-warn-soft" role="status">${icon('alert', '', 18)} <span><b>Before publishing:</b> ${a.missing.map(esc).join(' ')}</span></div>` : ''}
    <ol class="wb-props">${dr.items.map((it, i) => proposalCard(it, i, i === dr.items.length - 1)).join('')}</ol>
    ${exc.length ? `<div class="wb-sum"><h4>Excluded</h4><ul>${exc.map(([k, r]) => `<li>${destById(k)}: ${esc(r)} <button class="link-btn" data-act="wb-restore" data-dest="${k}">Restore</button></li>`).join('')}</ul></div>` : ''}
    ${issues.length ? `<ul class="wb-issues" role="status">${issues.map(i => `<li>${icon('info', '', 14)} ${esc(i)}</li>`).join('')}</ul>` : ''}
    <button class="btn btn-primary" data-act="wb-publish" ${issues.length ? 'aria-disabled="true"' : ''}>Publish shortlist${pub ? ` (new version v${w.version + 1})` : ''}</button>
    ${pub ? `<p class="wb-pubstate" role="status"><b>Published v${pub.version}</b> by ${nm(pub.by)} · ${same ? 'matches the draft' : 'the draft has unpublished changes'}. <button class="link-btn" data-act="wb-reveal-open">Open reveal &amp; vote</button></p>` : '<p class="wb-pubstate muted">Nothing published yet. Members cannot reveal or vote until you publish.</p>'}
  </section>`;
}
const destById = id => WB.destById(id).name;
function reviewPanel() {
  const c = WB.isCoord(), pub = WB.published();
  if (!c) return `<section class="card wb-review is-readonly" aria-labelledby="wbr-t"><h2 id="wbr-t">Coordinator review</h2>
    <p>Only <b>${nm(WB.coord().id)}</b> can group wishes and publish the shortlist. You can keep adding and supporting wishes.</p>
    <h3>Who is ready</h3>${readiness()}
    ${pub ? `<div class="banner banner-ok" role="status">${icon('check', '', 18)} <span>Shortlist v${pub.version} is published.</span> <button class="btn btn-primary btn-sm" data-act="wb-reveal-open">Reveal &amp; vote</button></div>` : '<p class="muted">The shortlist has not been published yet.</p>'}
  </section>`;
  return `<section class="card wb-review" aria-labelledby="wbr-t"><h2 id="wbr-t">Coordinator review</h2>
    <h3>Who is ready</h3>${readiness()}
    <p class="wb-tg"><b>${tgtTxt()}</b></p>
    <h3>Group wishes</h3>${aiBlock()}${analysisBlock()}
    ${shortlistBlock()}</section>`;
}

const capLabel = () => { const m = WB.me(); return `Up to ${rupee(m.cap)} / person`; };
export function budgetForm() { return budgetCard(); }
export function wishboxHtml() {
  const m = WB.me(), st = WB.readyState(m.id), n = WB.members().length, pub = WB.published();
  if (transient.wbView === 'review') return `<div class="wb wb-review-page" data-wb>
    <header class="wb-top"><button type="button" class="wb-round" data-act="wb-view" data-v="board" aria-label="Back to the Wishbox">${icon('back', '', 22)}</button><h1>Coordinator review</h1><span class="wb-me">${avatar(m, 40)}</span></header>
    <div class="wb-reviewwrap">${reviewPanel()}</div></div>`;
  return `<div class="wb" data-wb>
    <header class="wb-top"><button type="button" class="wb-round" data-act="wb-back" aria-label="Back to group">${icon('back', '', 22)}</button><h1>Your Wishbox</h1><span class="wb-me" title="Viewing as ${esc(m.name)}">${avatar(m, 40)}</span></header>
    <div class="wb-pills"><button type="button" class="wb-pill" data-act="wb-dates">${icon('cal', '', 20)}<span>${fmtRange()}</span>${icon('down', '', 18)}</button>
      <button type="button" class="wb-pill" data-act="wb-budget">${icon('rupee', '', 20)}<span>${capLabel()}</span>${icon('down', '', 18)}</button></div>
    <p class="wb-target-line" role="status">${tgtTxt()}${WB.missingCaps().length ? ` · ${plural(WB.missingCaps().length, 'budget', 'budgets')} missing` : ''}</p>
    ${boxCard()}
    <div class="wb-done"><button class="btn btn-primary btn-lg" data-act="wb-ready" aria-pressed="${st === 'ready'}">${st === 'ready' ? 'Ready. Tap to keep editing' : 'Done adding'}</button>
      <p class="wb-doneinfo">${WB.readyCount()} of ${n} ready${st === 'updated' ? ' · you changed something, please confirm again' : ''}</p>
      <button type="button" class="link-btn" data-act="wb-view" data-v="review">${pub ? 'Shortlist published. ' : ''}${WB.isCoord() ? 'Review and group wishes' : 'See coordinator review'} ${icon('right', '', 16)}</button></div>
    ${boardCard()}</div>`;
}
// ------------------------------------------------------------------ Flow B: reveal and vote
// Pin anchor: orthographic projection of the destination's latitude/longitude onto the supplied globe image (approximate demo reference).
const G = { lat0: 20.5, lon0: 79.5, cx: .5, cy: .5, R: .44 };
function pinPos(d) {
  const r = Math.PI / 180, la = d.lat * r, lo = (d.lon - G.lon0) * r, la0 = G.lat0 * r;
  const x = Math.cos(la) * Math.sin(lo), y = Math.cos(la0) * Math.sin(la) - Math.sin(la0) * Math.cos(la) * Math.cos(lo);
  return { x: (G.cx + G.R * x) * 100, y: (G.cy - G.R * y) * 100 };
}
function candidateCard(it, i) {
  const p = WB.proposal(it.id), d = p.d, m = WB.me(), w = WB.W(), pub = w.published;
  const pick = (w.picks[m.id] || {})[d.id], fresh = WB.ballotFresh(m.id), sub = fresh ? w.ballots[m.id].votes[d.id] : null, cur = fresh ? sub : pick;
  const selected = transient.rvFocus === d.id;
  const t = WB.tally()[d.id];
  const stale = !!w.ballots[m.id] && !fresh;
  return `<li class="rv-card ${selected ? 'is-focus' : ''}" style="--i:${i}" data-dest="${d.id}">
    <img src="${A}${d.art}.webp" alt="" width="92" height="${d.art === 'coorg' ? 100 : 92}" loading="lazy">
    <div class="rv-card-b"><h3>${d.name} <small>${d.region}</small></h3>
      <p class="wb-price"><b>${rupee(d.price)}</b> per person ${p.over ? `<i class="tag tag-over">${rupee(p.over)} above target</i>` : '<i class="tag tag-ok">Within target</i>'} ${it.stretch ? '<i class="tag">Stretch option</i>' : ''}</p>
      <p class="wb-line"><b>Matches ${p.hit.length} of ${w.wishes.length}:</b> ${p.hit.length ? p.hit.slice(0, 5).map(x => esc(x.text)).join(', ') + (p.hit.length > 5 ? ` and ${p.hit.length - 5} more` : '') : 'none'}</p>
      <p class="wb-line muted">${d.fit} ${d.gap}</p>
      <div class="rv-vote" role="group" aria-label="Your vote for ${d.name}">
        <button class="btn rv-like ${cur === 'like' ? 'is-on' : ''}" data-act="wb-vote" data-dest="${d.id}" data-v="like" aria-pressed="${cur === 'like'}" ${fresh ? 'disabled' : ''}><img src="${A}like.webp" alt="" width="22" height="18"> Like</button>
        <button class="btn rv-pass ${cur === 'pass' ? 'is-on' : ''}" data-act="wb-vote" data-dest="${d.id}" data-v="pass" aria-pressed="${cur === 'pass'}" ${fresh ? 'disabled' : ''}><img src="${A}pass.webp" alt="" width="20" height="20"> Pass</button>
        <button class="link-btn" data-act="wb-vote-clear" data-dest="${d.id}" ${cur && !fresh ? '' : 'disabled'}>Clear</button>
        <button class="link-btn" data-act="wb-focus-dest" data-dest="${d.id}">Show on globe</button></div>
      ${fresh && t ? `<p class="rv-tally" role="status">${plural(t.like, 'like', 'likes')} · ${plural(t.pass, 'pass', 'passes')} so far. Likes are interest, not budget approval.</p>` : ''}
      ${stale ? '<p class="wb-line"><i class="tag tag-over">Needs review</i> The shortlist changed after you voted.</p>' : ''}
    </div></li>`;
}
function resultBlock() {
  const w = WB.W(), pub = w.published, M = WB.members().length, m = WB.me(), c = WB.isCoord();
  const t = WB.tally(), subN = WB.submittedCount();
  const rows = pub.items.map(i => ({ id: i.id, like: t[i.id].like, pass: t[i.id].pass }));
  const maxLike = Math.max(...rows.map(r => r.like)), top = rows.filter(r => r.like === maxLike && maxLike > 0);
  const allIn = subN === M;
  let verdict = '';
  if (!allIn) verdict = `${subN} of ${M} members have submitted. Results can still change.`;
  else if (maxLike === 0) verdict = 'Nobody liked any option. Revisit the wishes and revise the shortlist.';
  else if (top.length > 1) verdict = `It is a tie between ${top.map(r => destById(r.id)).join(' and ')}. The coordinator selects one and the group confirms.`;
  else verdict = `${destById(top[0].id)} leads with ${plural(maxLike, 'like', 'likes')}.`;
  const sel = w.selected && pub.items.some(i => i.id === w.selected.dest) ? w.selected.dest : null;
  const conflict = id => {
    const below = WB.belowCap(id), un = WB.unresolved(id), d = WB.destById(id);
    if (!below.length) return `<p class="rv-ok">${icon('check', '', 14)} ${rupee(d.price)} is within everyone's cap.</p>`;
    const c0 = WB.W().consent[id] || {};
    return `<div class="rv-conf"><p><b>${rupee(d.price)} is above the cap of ${below.map((x, k) => (WB.capVisibleTo(m, x) ? esc(x.name) : `member ${k + 1}`)).join(', ')}.</b> Popularity does not override a cap. Each of them must accept it for this trip or raise their own cap.</p>
      <ul>${below.map((x, k) => { const vis = WB.capVisibleTo(m, x); return `<li>${vis ? avatar(x, 24) : ''} ${vis ? esc(x.name) : `Member ${k + 1} (cap kept private)`}: ${c0[x.id] ? '<i class="tag tag-ok">Accepted</i>' : '<i class="tag tag-over">Not resolved</i>'}</li>`; }).join('')}</ul>
      ${below.some(x => x.id === m.id) ? `<button class="btn btn-secondary btn-sm" data-act="wb-consent" data-dest="${id}" aria-pressed="${!!c0[m.id]}">${c0[m.id] ? 'Withdraw my acceptance' : `I accept ${rupee(d.price)} for this trip`}</button>` : ''}
      ${un.length ? `<p class="muted">${plural(un.length, 'member still needs', 'members still need')} to resolve this.</p>` : ''}</div>`;
  };
  return `<section class="card rv-result" aria-labelledby="rvr-t"><h2 id="rvr-t">Group result</h2>
    <p class="rv-sub">${subN} of ${M} submitted · ${verdict}</p>
    <ul class="rv-rows">${rows.map(r => { const d = WB.destById(r.id); return `<li><b>${d.name}</b> <span>${plural(r.like, 'like', 'likes')} · ${plural(r.pass, 'pass', 'passes')}</span> ${d.price > (WB.target() ?? Infinity) ? `<i class="tag tag-over">${rupee(d.price - WB.target())} above target</i>` : ''}</li>`; }).join('')}</ul>
    ${c ? `<h3>Coordinator decision</h3>
      <div class="rv-pick" role="group" aria-label="Choose the destination">${pub.items.map(i => `<button class="btn ${sel === i.id ? 'btn-primary' : 'btn-secondary'}" data-act="wb-select" data-dest="${i.id}" aria-pressed="${sel === i.id}">${destById(i.id)}</button>`).join('')}</div>
      ${sel ? conflict(sel) : '<p class="muted">Choose one option to check budgets and confirm.</p>'}
      <div class="rv-cta"><button class="btn btn-primary" data-act="wb-confirm" ${sel && !WB.unresolved(sel).length ? '' : 'aria-disabled="true"'}>Confirm ${sel ? destById(sel) : 'destination'} and start planning</button>
      ${allIn && maxLike === 0 ? '<button class="btn btn-secondary" data-act="wb-revise">Revise wishes &amp; shortlist</button>' : ''}</div>
      <p class="muted">Nothing is booked or paid. Your wishes stay in the Wishbox.</p>`
      : `<p class="muted">The coordinator (${nm(WB.coord().id)}) reviews the votes and confirms the destination.</p>
      ${sel ? `<p><b>${destById(sel)}</b> is selected for confirmation.</p>${conflict(sel)}` : ''}`}
  </section>`;
}
export function revealHtml() {
  const w = WB.W(), pub = w.published;
  if (!pub) return `<div class="wb"><header class="wb-head"><button class="link-btn" data-act="wb-reveal-back">${icon('back', '', 18)} Back to Wishbox</button><h1>Reveal</h1></header><p class="wb-none">The coordinator has not published a shortlist yet.</p></div>`;
  const ph = WB.rv().phase, m = WB.me(), M = WB.members().length;
  const ready = ph === 'ready', running = ['lift', 'spin', 'settle', 'reveal'].includes(ph);
  const first = pub.items[0], focusId = transient.rvFocus && pub.items.some(i => i.id === transient.rvFocus) ? transient.rvFocus : first.id;
  const fd = WB.destById(focusId), pos = pinPos(fd);
  const showCards = ph === 'reveal' || ph === 'vote';
  const myFresh = WB.ballotFresh(m.id), picks = Object.keys(w.picks[m.id] || {}).length;
  const stale = w.ballots[m.id] && !myFresh;
  return `<div class="wb rv rv-${ph}" data-rv>
    <header class="wb-head"><button type="button" class="link-btn" data-act="wb-reveal-back">${icon('back', '', 18)} Back to Wishbox</button>
      <h1>${ready ? 'Ready to reveal' : 'Where could we go?'}</h1>
      <p>${M} ${M === 1 ? 'traveller' : 'travellers'} · ${dateLine()} · ${tgtTxt()}</p>${steps(4)}${whoBar()}</header>
    <div class="rv-stage ${ph === 'vote' ? 'is-small' : ''}">
      <div class="rv-globewrap"><div class="rv-shadow" aria-hidden="true"></div>
        <div class="rv-globe"><img class="rv-globeimg" src="${A}globe_india.webp" alt="" width="600" height="607" decoding="async">
          ${ph === 'settle' || ph === 'reveal' || ph === 'vote' ? `<span class="rv-pin" style="left:${pos.x.toFixed(2)}%;top:${pos.y.toFixed(2)}%"><img src="${A}pin.webp" alt="" width="34" height="47"></span>` : ''}</div>
        ${ph === 'reveal' || ph === 'vote' ? `<p class="rv-pinlabel" role="status"><b>${fd.name}</b> <small>approximate planning reference</small></p>` : ''}</div>
      <div class="rv-ctl">${ready ? `<p>The coordinator published a shortlist of ${pub.items.length} options. ${esc(destById(first.id))} is first in their list. The globe does not choose.</p>
        <div class="rv-btns"><button class="btn btn-primary btn-lg" data-act="wb-reveal-start">Reveal destinations</button><button class="btn btn-secondary btn-lg" data-act="wb-reveal-skip">Skip animation</button></div>`
        : running ? `<p role="status">Revealing…</p><button class="btn btn-secondary" data-act="wb-reveal-skip">Skip animation</button>`
        : `<button class="btn btn-secondary btn-sm" data-act="wb-reveal-replay">${icon('undo', '', 14)} Replay reveal</button><span class="muted">Replaying never changes votes.</span>`}</div></div>
    ${showCards ? `<ol class="rv-cards">${pub.items.map((it, i) => candidateCard(it, i)).join('')}</ol>
      <div class="rv-submit"><div><b>${WB.submittedCount()} of ${M} submitted</b><span>${stale ? 'The shortlist changed. Please review and submit again.' : myFresh ? 'Your choices are submitted. You can edit and resubmit.' : picks ? `${picks} of ${pub.items.length} chosen. Missing is not the same as Pass.` : 'Like or Pass each destination, then submit.'}</span></div>
        ${myFresh ? '<button class="btn btn-secondary" data-act="wb-edit-ballot">Edit my choices</button>' : `<button class="btn btn-primary" data-act="wb-submit">Submit my choices</button>`}</div>
      ${myFresh ? resultBlock() : '<p class="muted rv-hide">Tallies appear after you submit, so nobody copies a majority.</p>'}` : ''}
  </div>`;
}

// "Find me a place": preferences -> matching (stylised globe) -> three destination cards.
// Matching is a LOCAL DEMO matcher over a small sample dataset. Prices are illustrative estimates, not live inventory.
import { state, transient, notify, setTrip, fmtRange } from './store.js';
import { esc, icon, reduced, announce, toast } from './ui.js';
import { rupee } from './data.js';

// ------------------------------------------------------------------ sample data
export const CITIES = {
  Bengaluru: [12.97, 77.59], Hyderabad: [17.38, 78.48], Chennai: [13.08, 80.27],
  Pune: [18.52, 73.86], Mumbai: [19.07, 72.88], Delhi: [28.61, 77.21],
};
export const INTERESTS = [
  { k: 'nature', label: 'Nature', ic: 'mountain' }, { k: 'food', label: 'Local food', ic: 'utensils' },
  { k: 'relaxed', label: 'Relaxed', ic: 'bed' }, { k: 'beaches', label: 'Beaches', ic: 'palm' },
  { k: 'heritage', label: 'Heritage', ic: 'temple' },
];
// stay = per person per night (shared room); food = per person per day; sc = how well the place suits each interest (0-1)
const PLACES = [
  { id: 'hampi', name: 'Hampi', lat: 15.335, lon: 76.46, stay: 1500, food: 900, min: 2, img: 'hampi_photo.webp', line: 'Heritage & slow mornings',
    sc: { nature: .5, food: .6, relaxed: .7, beaches: 0, heritage: 1 }, full: true },
  { id: 'gokarna', name: 'Gokarna', lat: 14.55, lon: 74.32, stay: 1700, food: 900, min: 2, img: 'gokarna_card.webp', line: 'Coast & local food',
    sc: { nature: .7, food: .8, relaxed: 1, beaches: 1, heritage: .2 } },
  { id: 'coorg', name: 'Coorg', lat: 12.42, lon: 75.74, stay: 2000, food: 900, min: 2, img: 'coorg_card.webp', line: 'Nature & coffee',
    sc: { nature: 1, food: .8, relaxed: .9, beaches: 0, heritage: .1 } },
  { id: 'goa', name: 'Goa', lat: 15.5, lon: 73.83, stay: 2400, food: 1100, min: 2, img: 'city_goa.jpg', line: 'Beaches & food',
    sc: { nature: .4, food: 1, relaxed: .6, beaches: 1, heritage: .5 } },
  { id: 'mysuru', name: 'Mysuru', lat: 12.3, lon: 76.64, stay: 1600, food: 850, min: 2, art: 'heritage', line: 'Palaces & street food',
    sc: { nature: .3, food: .8, relaxed: .5, beaches: 0, heritage: 1 } },
  { id: 'chikmagalur', name: 'Chikmagalur', lat: 13.32, lon: 75.77, stay: 1900, food: 850, min: 2, art: 'waterfall', line: 'Coffee hills & quiet',
    sc: { nature: 1, food: .6, relaxed: 1, beaches: 0, heritage: .1 } },
];
export const placeById = id => PLACES.find(p => p.id === id);
const km = (a, b) => { const r = x => x * Math.PI / 180, dLa = r(b[0] - a[0]), dLo = r(b[1] - a[1]); const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLo / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** One-way door-to-door hours and return cost per person. Road/rail up to ~650 road-km, otherwise a flight (flat estimate). */
export function travel(city, p) {
  const road = km(CITIES[city], [p.lat, p.lon]) * 1.2;
  if (road > 650) return { mode: 'flight', hours: 4.5, cost: 6200 };
  return { mode: 'road or rail', hours: Math.round(road / 55 * 10) / 10, cost: Math.max(900, Math.round((1570 + road * 2.38) / 100) * 100) };
}
export const nightsOf = (s, e) => Math.round((new Date(e + 'T00:00:00') - new Date(s + 'T00:00:00')) / 864e5);
/** Per-person estimate = return travel + shared-room stay + food and local costs. */
export function estimate(city, p, nights) { const t = travel(city, p); return Math.round((t.cost + p.stay * nights + p.food * (nights + 1)) / 100) * 100; }
const limitHours = (nights, relaxed) => (nights <= 2 ? 6.5 : nights === 3 ? 10 : 12) * (relaxed ? .9 : 1);

/** Filter on feasibility first (dates, travel time, budget, at least one chosen interest), then rank by interest and pace. */
export function match(f) {
  const nights = nightsOf(f.start, f.end), relaxed = f.interests.includes('relaxed');
  const rows = PLACES.map(p => {
    const tr = travel(f.from, p), est = estimate(f.from, p, nights), lim = limitHours(nights, relaxed);
    const hit = f.interests.filter(k => p.sc[k] >= .5);
    const fails = [];
    if (nights < p.min) fails.push('nights');
    if (tr.hours > lim) fails.push('time');
    if (est > f.budget) fails.push('budget');
    if (f.interests.length && !hit.length) fails.push('interest');
    const cover = f.interests.length ? f.interests.reduce((s, k) => s + p.sc[k], 0) / f.interests.length : .5;
    const score = cover * .7 + (1 - tr.hours / lim) * (relaxed ? .2 : .1) + Math.max(0, 1 - est / f.budget) * .1;
    return { p, tr, est, lim, hit, fails, score, nights };
  });
  const ok = rows.filter(r => !r.fails.length).sort((a, b) => b.score - a.score).slice(0, 3);
  if (ok.length) return { results: ok, nights };
  // nothing qualifies: say which single change would help most
  const near = rows.filter(r => r.fails.length === 1).sort((a, b) => b.score - a.score)[0];
  let hint = 'Try a different departure city or add another interest.';
  if (near) {
    const n = near.p.name, x = near.fails[0];
    if (x === 'budget') hint = `${n} fits your dates and interests at about ${rupee(near.est)} per person. Raising the budget to ${rupee(near.est)} would show it.`;
    else if (x === 'time') hint = `${n} suits you but is about ${near.tr.hours} h each way. Adding a night would make it workable.`;
    else if (x === 'nights') hint = `${n} needs at least ${near.p.min} nights. Extend your dates by a day.`;
    else hint = `${n} fits your budget and dates. Adding an interest it suits would show it.`;
  }
  return { results: [], nights, hint, near: near && near.fails[0] === 'budget' ? { budget: near.est } : null };
}
const why = r => {
  const lab = k => INTERESTS.find(i => i.k === k).label.toLowerCase();
  const top = r.hit.map(lab);
  const miss = r.p.sc && Object.keys(r.p.sc).filter(k => state.trip.interests?.includes(k) && r.p.sc[k] < .5).map(lab);
  const a = top.length ? `Good for ${top.slice(0, 2).join(' and ')}` : 'Fits your dates and budget';
  return `${a}. About ${r.tr.hours} h each way${miss.length ? `; little for ${miss[0]}` : ''}.`;
};

// ------------------------------------------------------------------ flow state (memory only)
const D = () => (transient.disc ||= { phase: 'prefs', form: null, err: {}, results: null, depth: 0 });
let reqId = 0, timers = [], P = null, startAt = 0;
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
const after = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

function initForm() {
  const t = state.trip;
  return { from: t.from || 'Bengaluru', start: t.start, end: t.end, budget: t.budget, interests: [...(t.interests || ['nature', 'food', 'relaxed'])] };
}
function validate(f) {
  const e = {}, n = nightsOf(f.start, f.end);
  if (!f.start || !f.end || Number.isNaN(n)) e.dates = 'Choose both dates.';
  else if (n < 1) e.dates = 'The end date must be after the start date.';
  else if (n > 14) e.dates = 'Trips here are 1 to 14 nights.';
  if (!(f.budget >= 3000)) e.budget = 'Enter at least ₹3,000 per person.';
  else if (f.budget > 200000) e.budget = 'Enter a budget up to ₹2,00,000.';
  return e;
}

// ------------------------------------------------------------------ globe: two aligned layers, soft crossfade between 8 generated poses
const FRAMES = Array.from({ length: 8 }, (_, i) => `assets/globe/globe-0${i + 1}.webp`);
let preloaded = false;
function preload() { if (preloaded) return; preloaded = true; [...FRAMES, 'assets/globe/doodles.webp'].forEach(s => { const i = new Image(); i.decoding = 'async'; i.src = s; i.decode && i.decode().catch(() => {}); }); }
const el = id => document.getElementById(id);
const segMs = (i, stopping) => { if (!stopping) return 210; const r = (8 - i) % 8; return r === 1 ? 450 : r === 2 ? 300 : 210; };
function setFrame(a, b, i, mix) {
  const A = FRAMES[i], B = FRAMES[(i + 1) % 8];
  if (a.dataset.f !== String(i)) { a.src = A; a.dataset.f = String(i); b.src = B; }
  b.style.opacity = String(mix);
}
function spinStart() {
  spinStop();
  P = { i: 0, t: performance.now(), stopping: false, done: null, raf: 0 };
  const tick = now => {
    if (!P) return;
    const a = el('dc-ga'), b = el('dc-gb'); if (!a || !b) { P = null; return; }
    let d = segMs(P.i, P.stopping), p = (now - P.t) / d;
    while (p >= 1) {
      P.i = (P.i + 1) % 8; P.t += d;
      if (P.stopping && P.i === 0) { setFrame(a, b, 0, 0); const cb = P.done; P = null; cb && cb(); return; }
      d = segMs(P.i, P.stopping); p = (now - P.t) / d;
    }
    const k = Math.min(1, p / .85); setFrame(a, b, P.i, k * k * (3 - 2 * k));
    P.raf = requestAnimationFrame(tick);
  };
  P.raf = requestAnimationFrame(tick);
}
function spinStop() { if (P) { cancelAnimationFrame(P.raf); P = null; } }
/** Ease to the India-facing view, then call back. */
function spinRest(cb) {
  if (!P || document.hidden) { spinStop(); cb(); return; }   // a hidden tab never gates the results
  P.stopping = true; P.done = cb;
}
document.addEventListener('visibilitychange', () => {
  if (!P) return;
  if (document.hidden) { cancelAnimationFrame(P.raf); if (P.stopping) { const cb = P.done; P = null; cb && cb(); } }
  else { const keep = P; P = null; spinStart(); if (P) { P.i = keep.i; P.stopping = keep.stopping; P.done = keep.done; } }
});

// ------------------------------------------------------------------ transitions
function push(phase) { try { history.pushState({ dc: phase }, ''); D().depth = phase === 'prefs' ? 1 : 2; } catch {} }
function go(phase, opts = {}) {
  const d = D(); d.phase = phase; d.focusH = true; notify();
  if (opts.top !== false) window.scrollTo(0, 0);
}
function cancelRun() { reqId++; clearTimers(); spinStop(); D().running = false; }
function leave() {
  cancelRun(); const d = D(), n = d.depth; transient.disc = null;
  state.stage = 'setup'; notify(); window.scrollTo(0, 0);
  if (n > 0) { try { history.go(-n); } catch {} }
}
function open() {
  transient.disc = null; const d = D(); d.form = initForm(); d.focusH = true; preload();
  state.stage = 'discover'; push('prefs'); notify(); window.scrollTo(0, 0);
}
function run() {
  const d = D(), f = d.form, e = validate(f); d.err = e;
  if (Object.keys(e).length) { notify(); const first = document.querySelector('.dc-form [aria-invalid="true"]'); first && first.focus(); announce(Object.values(e)[0]); return; }
  setTrip({ start: f.start, end: f.end, budget: f.budget, from: f.from, interests: [...f.interests] });   // shared trip state is the source of truth
  const id = ++reqId; clearTimers(); d.running = true; d.results = null; d.failed = false; d.spinAt = 0;
  go('matching');
  // the result is computed from the inputs right away; the spin is decoration and never gates it
  let out = null, failed = false;
  try { if (transient.dcFail) { transient.dcFail = false; throw new Error('demo failure'); } out = match(f); } catch { failed = true; }
  startAt = performance.now();
  const finish = () => {
    if (id !== reqId) return;
    d.running = false; spinStop();
    if (failed) { d.failed = true; go('error'); return; }
    d.out = out; d.results = out.results; push('results'); go('results', { top: false });
    announce(out.results.length ? `${out.results.length} places found.` : 'No places fit these preferences.');
  };
  if (reduced()) { finish(); return; }
  after(() => { if (id === reqId) spinRest(finish); }, failed ? 700 : 2200);
  after(() => { if (id === reqId && d.running) { failed = true; spinRest(finish); } }, 12000);   // never an endless globe
}
function skip() { const d = D(); if (d.phase !== 'matching') return; const id = reqId; clearTimers(); spinStop(); d.skipped = true; let out = null, failed = false; try { out = match(d.form); } catch { failed = true; } d.running = false; if (failed) { d.failed = true; go('error'); } else { d.out = out; d.results = out.results; push('results'); go('results', { top: false }); } void id; }

// ------------------------------------------------------------------ markup
const FIELD = (id, label, inner, err) => `<div class="dc-f ${err ? 'has-err' : ''}"><label class="dc-l" for="${id}">${label}</label>${inner}${err ? `<p class="dc-err" id="${id}-e" role="alert">${esc(err)}</p>` : ''}</div>`;
function prefsHtml() {
  const d = D(), f = d.form, e = d.err, n = state.travellers.length;
  return `<section class="dc dc-prefs" aria-labelledby="dc-h">
    <button type="button" class="dc-back" data-act="dc-back">${icon('left', '', 18)} Back</button>
    <h1 id="dc-h" tabindex="-1">Find your next getaway</h1><p class="dc-sub">Tell us what matters to you.</p>
    <form class="dc-form" data-form="dc-find" novalidate>
      <div class="dc-grid">
        ${FIELD('dc-from', 'Leaving from', `<span class="dc-sel">${icon('pin', '', 20)}<select id="dc-from" data-dc="from">${Object.keys(CITIES).map(c => `<option ${c === f.from ? 'selected' : ''}>${c}</option>`).join('')}</select>${icon('down', '', 18)}</span>`)}
        ${FIELD('dc-start', 'Dates', `<span class="dc-dates"><input id="dc-start" type="date" data-dc="start" value="${f.start}" aria-label="Start date" ${e.dates ? 'aria-invalid="true" aria-describedby="dc-start-e"' : ''}><i aria-hidden="true">to</i><input id="dc-end" type="date" data-dc="end" value="${f.end}" min="${f.start}" aria-label="End date" ${e.dates ? 'aria-invalid="true"' : ''}></span>`, e.dates)}
        ${FIELD('dc-budget', 'Budget per person', `<span class="dc-num">${icon('rupee', '', 20)}<input id="dc-budget" type="number" inputmode="numeric" min="3000" step="500" value="${f.budget}" data-dc="budget" ${e.budget ? 'aria-invalid="true" aria-describedby="dc-budget-e"' : ''}><small>Transport + stay + food</small></span>`, e.budget)}
        ${FIELD('dc-trav', 'Travellers', `<span class="dc-ro">${icon('users', '', 20)}<span id="dc-trav">${n} ${n === 1 ? 'traveller' : 'travellers'}</span><small>From your crew</small></span>`)}
      </div>
      <fieldset class="dc-mood"><legend>What are you in the mood for?</legend>
        <div class="dc-chips">${INTERESTS.map(i => { const on = f.interests.includes(i.k); return `<button type="button" class="dc-chip ${on ? 'is-on' : ''}" data-act="dc-interest" data-k="${i.k}" aria-pressed="${on}">${icon(i.ic, '', 22)}<span>${i.label}</span>${on ? icon('check', '', 18) : ''}</button>`; }).join('')}</div></fieldset>
      <div class="dc-cta"><button class="btn btn-primary btn-lg dc-go" type="submit">Find me a place</button></div>
    </form></section>`;
}
const globe = (cls = '') => `<div class="dc-globe ${cls}" aria-hidden="true">
  <img class="dc-doodles" id="dc-doodles" src="assets/globe/doodles.webp" alt="" onerror="this.remove()">
  <img class="dc-g" id="dc-ga" src="${FRAMES[0]}" alt="" data-f="0" width="640" height="640"><img class="dc-g dc-gb" id="dc-gb" src="${FRAMES[1]}" alt="" width="640" height="640">
  ${cls.includes('is-rest') ? '<img class="dc-pin" src="assets/wb/pin.webp" alt="" width="30" height="41">' : ''}</div>`;
function matchingHtml() {
  return `<section class="dc dc-match" aria-labelledby="dc-h"><h1 id="dc-h" tabindex="-1" class="sr-only">Finding your place</h1>
    ${globe('is-in')}
    <p class="dc-status" aria-live="polite">Matching your preferences with our sample destinations…</p>
    <div class="dc-acts"><button type="button" class="btn btn-secondary" data-act="dc-skip">Skip animation</button><button type="button" class="link-btn" data-act="dc-cancel">Cancel</button></div></section>`;
}
const cardImg = p => p.img
  ? `<img src="assets/img/${p.img}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'dc-noimg',textContent:'${esc(p.name)}'}))">`
  : `<span class="dc-art"><img src="assets/wb/${p.art}.webp" alt="" loading="lazy"></span>`;
function resultsHtml() {
  const d = D(), out = d.out || { results: [] }, f = d.form;
  const cards = out.results.map((r, i) => `<li class="dc-card" style="--i:${i}"><div class="dc-ci">${cardImg(r.p)}</div>
      <div class="dc-cb"><h2 class="dc-cn">${r.p.name}</h2><p class="dc-cl">${r.p.line}</p><p class="dc-cw">${esc(why(r))}</p>
      <p class="dc-cp">Est. ${rupee(r.est)} <span>/ person</span></p>
      ${r.p.full ? '' : '<p class="dc-cd">Full itinerary and inventory are only built for Hampi in this demo.</p>'}
      <button class="dc-choose" data-act="dc-choose" data-id="${r.p.id}" aria-label="Choose ${r.p.name}">Choose ${r.p.name} ${icon('fwd', '', 18)}</button></div></li>`).join('');
  const empty = `<div class="dc-empty" role="status"><h2>No place fits these preferences yet.</h2><p>${esc(out.hint || '')}</p><p class="dc-keep">Your preferences are saved.</p>
      <div class="dc-acts">${out.near ? `<button class="btn btn-primary" data-act="dc-raise" data-b="${out.near.budget}">Set budget to ${rupee(out.near.budget)}</button>` : ''}<button class="btn btn-secondary" data-act="dc-edit">Edit preferences</button></div></div>`;
  return `<section class="dc dc-res" aria-labelledby="dc-h">
    <button type="button" class="dc-back dc-edit" data-act="dc-edit">${icon('left', '', 18)} Edit preferences</button>
    <h1 id="dc-h" tabindex="-1" class="sr-only">Places that fit</h1>
    ${globe('is-rest is-up')}
    ${out.results.length ? `<ul class="dc-cards" data-n="${out.results.length}">${cards}</ul>
      <p class="dc-note">Sample estimates for ${out.nights} nights from ${esc(f.from)}: return travel + shared-room stay + food. Not live prices; availability is not checked.</p>` : empty}</section>`;
}
function errorHtml() {
  return `<section class="dc dc-errp" aria-labelledby="dc-h"><h1 id="dc-h" tabindex="-1">We couldn’t finish matching.</h1>
    <p class="dc-sub">Your preferences are saved. Nothing was changed.</p>
    <div class="dc-acts"><button class="btn btn-primary" data-act="dc-retry">Try again</button><button class="btn btn-secondary" data-act="dc-edit">Back to preferences</button></div></section>`;
}
export function html() {
  const d = D();
  if (!d.form) d.form = initForm();
  return d.phase === 'matching' ? matchingHtml() : d.phase === 'results' ? resultsHtml() : d.phase === 'error' ? errorHtml() : prefsHtml();
}
export const entryLink = () => `<span class="dc-entry"><span>Not sure?</span> <button type="button" class="dc-link" data-act="dc-open">Find me a place <span aria-hidden="true">&rarr;</span></button></span>`;

// ------------------------------------------------------------------ actions
export const actions = {
  'dc-open': open,
  'dc-back': leave,
  'dc-interest': el => { const f = D().form, k = el.dataset.k; f.interests = f.interests.includes(k) ? f.interests.filter(x => x !== k) : [...f.interests, k]; notify(); document.querySelector(`.dc-chip[data-k="${k}"]`)?.focus(); },
  'dc-skip': skip, 'dc-cancel': () => { cancelRun(); go('prefs', { top: false }); try { history.replaceState({ dc: 'prefs' }, ''); } catch {} },
  'dc-edit': () => { const d = D(); if (d.depth > 1) { try { history.back(); return; } catch {} } go('prefs'); },
  'dc-retry': run,
  'dc-demo-fail': () => { transient.dcFail = true; transient.demoOpen = false; notify(); toast('The next match will fail once.', { ms: 2500 }); },
  'dc-raise': el => { D().form.budget = +el.dataset.b; run(); },
  'dc-choose': el => {
    const p = placeById(el.dataset.id); if (!p) return;
    const d = D(), n = d.depth; cancelRun(); transient.disc = null;
    setTrip({ dest: p.name });   // dates, budget, interests and travellers stay as they were
    state.stage = 'setup'; notify(); window.scrollTo(0, 0);
    if (n > 0) { try { history.go(-n); } catch {} }
    toast(p.full ? `${p.name} is set. Press Plan my trip when you're ready.` : `${p.name} is set. This demo can only build a full itinerary for Hampi, so planning here is a sample.`, { ms: 6000 });
  },
};
export function onSubmit(kind) { if (kind === 'dc-find') { run(); return true; } return false; }
// text/date/select inputs update the draft without re-rendering (so typing is never interrupted)
const read = e => {
  const t = e.target; if (!t.matches || !t.matches('[data-dc]') || state.stage !== 'discover') return;
  const f = D().form, k = t.dataset.dc;
  if (k === 'budget') f.budget = t.value === '' ? NaN : +t.value; else f[k] = t.value;
  if (k === 'start' && f.end <= f.start && f.start) { const n = new Date(f.start + 'T00:00:00'); n.setDate(n.getDate() + 3); f.end = n.toISOString().slice(0, 10); if (e.type === 'change') notify(); }
  if (D().err[k === 'start' || k === 'end' ? 'dates' : k]) { delete D().err[k === 'start' || k === 'end' ? 'dates' : k]; if (e.type === 'change') notify(); }
};
document.addEventListener('input', read); document.addEventListener('change', read);
window.addEventListener('popstate', e => {
  if (state.stage !== 'discover') return;
  const s = e.state && e.state.dc, d = D();
  if (!s) { leaveFromPop(); return; }
  if (s === 'prefs') { cancelRun(); d.depth = 1; go('prefs', { top: false }); }
  else if (s === 'results' && d.out) { d.depth = 2; go('results', { top: false }); }
});
function leaveFromPop() { cancelRun(); transient.disc = null; state.stage = 'setup'; notify(); window.scrollTo(0, 0); }

/** After every render: keep the spin attached to the new DOM, and move focus to the new heading (not on every update). */
export function afterRender() {
  if (state.stage !== 'discover') { if (P) spinStop(); return; }
  const d = D();
  if (d.phase === 'matching') {
    if (!reduced() && d.running && !P && !d.skipped) spinStart();
    if (reduced()) { const g = el('dc-ga'); g && (g.dataset.f = '0'); }
  } else if (P) spinStop();
  if (d.focusH) { d.focusH = false; const h = document.getElementById('dc-h'); h && h.focus({ preventScroll: true }); }
}
/** QA fixtures: ?jump=discover | discover-results */
export function jump(j) {
  open(); const d = D();
  if (j === 'discover-results') { d.out = match(d.form); d.results = d.out.results; d.phase = 'results'; push('results'); }
}
export { fmtRange };

// Group Wishbox (Flow A) and destination reveal + vote (Flow B): data, derived state, mutations and actions.
// Everything shown in the UI is derived from `state.wb`. AI grouping, collaboration and inventory are labelled simulations.
import { state, transient, notify, later, cancelTimers, acting, nameOf, traveller, fmtRange, updateTraveller, setTrip, pushMessage } from './store.js';
import { toast, announce, reduced, closeOverlay, openOverlay, updateOverlayBody, overlayOpen, isPhone } from './ui.js';
import { rupee } from './data.js';

// ------------------------------------------------------------------ static data
export const STICKERS = [
  { key: 'beach',         label: 'Beach time',     cat: 'Nature',    theme: 'beach' },
  { key: 'heritage',      label: 'Heritage',       cat: 'Culture',   theme: 'culture' },
  { key: 'cafe',          label: 'Local cafés',    cat: 'Food',      theme: 'food' },
  { key: 'easy_hike',     label: 'Easy hikes',     cat: 'Adventure', theme: 'adventure' },
  { key: 'slow_mornings', label: 'Slow mornings',  cat: 'Nature',    theme: 'nature' },
  { key: 'local_food',    label: 'Local food',     cat: 'Food',      theme: 'food' },
  { key: 'photography',   label: 'Photography',    cat: 'Culture',   theme: 'culture' },
  { key: 'camping',       label: 'Camping',        cat: 'Adventure', theme: 'adventure' },
  { key: 'waterfall',     label: 'Waterfalls',     cat: 'Nature',    theme: 'nature' },
  { key: 'train_trip',    label: 'Train journeys', cat: 'Adventure', theme: 'culture' },
];
export const CATS = ['All', 'Nature', 'Food', 'Culture', 'Adventure'];
export const THEMES = {
  culture: 'Heritage & culture', nature: 'Nature & slow days', food: 'Food & cafés',
  beach: 'Beach time', adventure: 'Outdoors & adventure', other: 'Other requests',
};
// Demo destination pool (planning references, not geographic data). Prices are rough per-person estimates.
export const DESTS = [
  { id: 'hampi',   name: 'Hampi',   region: 'Karnataka', price: 10200, art: 'heritage', lat: 15.335, lon: 76.460,
    tags: ['heritage', 'photography', 'slow_mornings', 'local_food', 'easy_hike', 'cafe'], themes: ['culture', 'food', 'nature', 'adventure'],
    fit: '3 nights fit 14–17 Nov with short local transfers.', gap: 'No beach.' },
  { id: 'gokarna', name: 'Gokarna', region: 'Karnataka coast', price: 11400, art: 'beach', lat: 14.55, lon: 74.32,
    tags: ['beach', 'cafe', 'slow_mornings', 'local_food', 'photography', 'easy_hike'], themes: ['beach', 'food', 'nature', 'adventure'],
    fit: '3 nights fit 14–17 Nov; the road trip takes most of one day.', gap: 'Little heritage.' },
  { id: 'coorg',   name: 'Coorg',   region: 'Karnataka hills', price: 11800, art: 'coorg', lat: 12.42, lon: 75.74,
    tags: ['waterfall', 'camping', 'cafe', 'easy_hike', 'slow_mornings', 'photography', 'local_food'], themes: ['nature', 'food', 'adventure'],
    fit: '3 nights fit 14–17 Nov; hill roads add travel time.', gap: 'No beach and no heritage.' },
];
export const destById = id => DESTS.find(d => d.id === id);

const KEYWORDS = [
  ['beach', /beach|sea|sand|surf|swim|coast|island/i], ['food', /food|eat|cafe|café|coffee|biryani|dosa|thali|restaurant|chai|bake/i],
  ['culture', /temple|fort|histor|museum|heritage|palace|ruin|art|photo/i], ['adventure', /hike|trek|camp|raft|ride|cycle|climb|train|scooter/i],
  ['nature', /waterfall|forest|hill|lake|river|sunrise|sunset|mountain|garden|quiet|slow|relax/i],
];

// ------------------------------------------------------------------ state
export function defaultWb() {
  return {
    nextWish: 1, wishes: [], rev: {}, ready: {}, capSet: {}, capPrivacy: {}, history: [], clar: [],
    ai: { status: 'idle', step: 0, result: null }, adjust: {}, excluded: {},
    draft: null, published: null, version: 0, ballots: {}, picks: {}, consent: {}, selected: null, revealSeen: false, failNext: false, lastDates: '',
  };
}
let normalised = false;
const wb = () => {
  if (!state.wb) state.wb = defaultWb();
  if (!normalised) { normalised = true; if (state.wb.ai && state.wb.ai.status === 'running') state.wb.ai = { status: 'idle', step: 0, result: null }; }   // an interrupted run never survives a refresh
  return state.wb;
};
export const W = () => wb();
export const members = () => state.travellers;
export const coord = () => state.travellers.find(t => t.role === 'organiser') || state.travellers[0];
export const me = () => acting();
export const isCoord = () => me().id === coord().id;
const people = w => [w.owner, ...w.support];
const personName = id => nameOf(id) || 'Someone';

export function themeOf(w) {
  const a = wb().adjust[w.id];
  if (a) return a;
  const st = STICKERS.find(s => s.key === w.key);
  if (st) return st.theme;
  const k = KEYWORDS.find(([, re]) => re.test(w.text));
  return k ? k[0] : 'other';
}
export const matches = (w, d) => (w.key ? d.tags.includes(w.key) : d.themes.includes(themeOf(w)));

// ---- budget ----
export function capSet(id) { const m = wb().capSet; if (id in m) return m[id]; return state.travellers.findIndex(t => t.id === id) < 3; }
export const capPrivacy = id => wb().capPrivacy[id] || 'target';
export function target() { const v = members().filter(t => capSet(t.id)).map(t => t.cap); return v.length ? Math.min(...v) : null; }
export const missingCaps = () => members().filter(t => !capSet(t.id));
export function capVisibleTo(viewer, m) {
  if (viewer.id === m.id) return true;
  const p = capPrivacy(m.id);
  return p === 'all' || (p === 'coord' && viewer.id === coord().id);
}
export function validateCap(raw) {
  const s = String(raw ?? '').replace(/[₹,\s]/g, '');
  if (s === '') return { err: 'Enter a maximum per person.' };
  if (!/^-?\d+$/.test(s)) return { err: 'Use whole rupees only, for example 10200.' };
  const n = Number(s);
  if (n <= 0) return { err: 'The maximum must be more than ₹0.' };
  if (n < 1000) return { err: 'Enter at least ₹1,000.' };
  if (n > 500000) return { err: 'Enter ₹5,00,000 or less.' };
  return { value: n };
}
export const nights = () => Math.max(0, Math.round((new Date(state.trip.end) - new Date(state.trip.start)) / 86400000));

// ---- readiness ----
export const readyState = id => { const w = wb(); return w.ready[id] != null && w.ready[id] === (w.rev[id] || 0) ? 'ready' : w.ready[id] != null ? 'updated' : 'writing'; };
export const readyCount = () => members().filter(t => readyState(t.id) === 'ready').length;
function touch(id) { const w = wb(); w.rev[id] = (w.rev[id] || 0) + 1; }
function snapshot(label) { const w = wb(); w.history.push({ label, wishes: JSON.stringify(w.wishes), at: Date.now() }); if (w.history.length > 30) w.history.shift(); }

// ------------------------------------------------------------------ AI grouping (derived, deterministic)
export function analyse() {
  const w = wb(), M = members().length, t = target();
  const by = {};
  for (const x of w.wishes) (by[themeOf(x)] ||= []).push(x);
  const themes = Object.keys(THEMES).filter(k => by[k]).map(k => {
    const ws = by[k], ppl = [...new Set(ws.flatMap(people))];
    return { id: k, label: THEMES[k], wishes: ws, people: ppl, minority: ppl.length === 1 && M > 1 };
  });
  const need = M === 1 ? 1 : Math.max(2, Math.ceil(M / 2));
  const agreed = themes.filter(x => x.people.length >= need && x.id !== 'other');
  const musts = w.wishes.filter(x => x.priority === 'must');
  const conflicts = [];
  for (const m of musts) {
    const hits = DESTS.filter(d => matches(m, d) && !w.excluded[d.id]);
    const within = hits.filter(d => t == null || d.price <= t);
    if (!hits.length) conflicts.push(`Must-have “${m.text}” (${personName(m.owner)}) is not matched by any option in this demo.`);
    else if (!within.length) conflicts.push(`Must-have “${m.text}” (${personName(m.owner)}) only fits options above ₹${(t || 0).toLocaleString('en-IN')}: ${hits.map(d => `${d.name} (+${rupee(d.price - t)})`).join(', ')}.`);
  }
  const first = DESTS.find(d => !w.excluded[d.id]);
  const beach = w.wishes.find(x => x.key === 'beach' || themeOf(x) === 'beach');
  if (beach && first && !matches(beach, first)) conflicts.push(`${[...new Set(people(beach))].length} ${people(beach).length === 1 ? 'person wants' : 'people want'} beach time, but ${first.name} has no beach.`);
  const missing = [];
  missingCaps().forEach(m => missing.push(`${m.name} has not set a budget.`));
  members().filter(m => readyState(m.id) !== 'ready').forEach(m => missing.push(`${m.name} is ${readyState(m.id) === 'updated' ? 'updating' : 'still adding'} wishes.`));
  members().filter(m => !w.wishes.some(x => people(x).includes(m.id))).forEach(m => missing.push(`${m.name} has no wishes yet.`));
  return { themes, agreed, musts, conflicts, missing, need };
}

// ------------------------------------------------------------------ shortlist
export function proposal(id) {
  const d = destById(id), w = wb(), t = target();
  const hit = w.wishes.filter(x => matches(x, d)), miss = w.wishes.filter(x => !matches(x, d));
  return { d, hit, miss, over: t != null && d.price > t ? d.price - t : 0, price: d.price };
}
export function ensureDraft() {
  const w = wb();
  if (!w.draft) w.draft = { items: DESTS.filter(d => !w.excluded[d.id]).map(d => ({ id: d.id, include: true, stretch: false })) };
  w.draft.items = w.draft.items.filter(i => !w.excluded[i.id]);
  return w.draft;
}
export function publishIssues() {
  const dr = ensureDraft(), inc = dr.items.filter(i => i.include), out = [];
  if (inc.length < 2) out.push('Include at least 2 destinations.');
  if (inc.length > 3) out.push('Include at most 3 destinations.');
  inc.forEach(i => { const p = proposal(i.id); if (p.over && !i.stretch) out.push(`${p.d.name} is ${rupee(p.over)} above target: mark it as a stretch option or remove it.`); });
  return out;
}
export const published = () => wb().published;
export const myBallot = () => wb().ballots[me().id];
export const ballotFresh = id => { const b = wb().ballots[id]; return !!b && !!wb().published && b.version === wb().published.version; };
export const submittedCount = () => members().filter(m => ballotFresh(m.id)).length;
export function tally() {
  const w = wb(), p = w.published, out = {};
  if (!p) return out;
  for (const it of p.items) out[it.id] = { like: 0, pass: 0 };
  members().forEach(m => { if (!ballotFresh(m.id)) return; for (const [d, v] of Object.entries(w.ballots[m.id].votes)) if (out[d]) out[d][v]++; });
  return out;
}
export function belowCap(destId) { const d = destById(destId); return members().filter(m => capSet(m.id) && m.cap < d.price); }
export function unresolved(destId) { const c = wb().consent[destId] || {}; return belowCap(destId).filter(m => !c[m.id]); }

// ------------------------------------------------------------------ actions
const afterMutation = (msg) => { notify(); if (msg) announce(msg); };
function addWish(w0) { const w = wb(); const id = 'w' + w.nextWish++; w.wishes.push({ priority: 'nice', support: [], ...w0, id }); return id; }

function addSticker(key, from) {
  const w = wb(), st = STICKERS.find(s => s.key === key), m = me();
  const dup = w.wishes.find(x => x.key === key);
  if (dup) {
    if (people(dup).includes(m.id)) { toast(`“${dup.text}” is already in the box with your name on it.`, { ms: 3000 }); return; }
    snapshot(`Joined “${dup.text}”`); dup.support.push(m.id); touch(m.id);
    transient.wbFlash = dup.id;
    afterMutation(`${dup.text} was already in the box. You joined ${personName(dup.owner)}'s wish; your name is added.`);
    toast(`Joined ${personName(dup.owner)}'s “${dup.text}”. Your name is added.`, { action: 'Undo', onAction: undo, ms: 6000 });
    return;
  }
  snapshot(`Added “${st.label}”`);
  const id = addWish({ key, cat: st.cat, text: st.label, owner: m.id });
  touch(m.id); transient.wbFly = { id, from }; transient.wbFlash = id;
  afterMutation(`${st.label} added to the box.`);
  toast(`Added “${st.label}”.`, { action: 'Undo', onAction: undo, ms: 6000 });
}
export function undo() {
  const w = wb(), h = w.history.pop();
  if (!h) { toast('Nothing to undo.', { ms: 2000 }); return; }
  w.wishes = JSON.parse(h.wishes); touch(me().id);
  afterMutation(`Undid: ${h.label}.`);
}
/** Drag a sticker out of the box: remove my wish, or just my name if I only joined someone else's. */
function pullOut(key) {
  const w = wb(), x = w.wishes.find(v => v.key === key), m = me();
  if (!x) return;
  if (x.owner === m.id) { removeWish(x.id); return; }
  if (x.support.includes(m.id)) {
    snapshot(`Left “${x.text}”`); x.support = x.support.filter(i => i !== m.id); touch(m.id);
    afterMutation(`Removed your name from ${x.text}.`);
    toast(`Took your name off “${x.text}”. It stays in the box for ${personName(x.owner)}.`, { action: 'Undo', onAction: undo, ms: 6000 });
    return;
  }
  toast(`“${x.text}” was added by ${personName(x.owner)}. Only they can take it out.`, { ms: 3500 });
}
function removeWish(id) {
  const w = wb(), x = w.wishes.find(v => v.id === id), m = me();
  if (!x || x.owner !== m.id) return;
  snapshot(`Removed “${x.text}”`);
  if (x.support.length) {          // other members' support is never deleted: ownership passes to the first supporter
    const next = x.support.shift(); x.owner = next;
    toast(`Removed your part of “${x.text}”. ${personName(next)} still wants it, so it stays and is now theirs.`, { action: 'Undo', onAction: undo, ms: 7000 });
  } else {
    w.wishes = w.wishes.filter(v => v.id !== id);
    toast(`Removed “${x.text}”.`, { action: 'Undo', onAction: undo, ms: 6000 });
  }
  touch(m.id); afterMutation(`${x.text} removed.`);
}

export function onSubmit(kind, fd, form) {
  const w = wb(), m = me();
  if (kind === 'wb-write') {
    const text = (fd.get('text') || '').toString().trim().replace(/\s+/g, ' ');
    if (!text) { transient.wbWriteErr = 'Write a wish first.'; notify(); return true; }
    if (text.length > 80) { transient.wbWriteErr = 'Keep it to 80 characters or fewer.'; notify(); return true; }
    transient.wbWriteErr = ''; transient.wbWriteText = '';
    const dup = w.wishes.find(x => x.text.toLowerCase() === text.toLowerCase());
    const pri = fd.get('priority') === 'must' ? 'must' : 'nice';
    if (dup) {
      if (!people(dup).includes(m.id)) { snapshot(`Joined “${dup.text}”`); dup.support.push(m.id); touch(m.id); toast(`“${dup.text}” already exists. You joined it; your name is added.`, { action: 'Undo', onAction: undo }); }
      else toast(`“${dup.text}” is already yours.`, { ms: 2500 });
      afterMutation(); return true;
    }
    snapshot(`Wrote “${text}”`);
    const id = addWish({ key: null, cat: 'Custom', text, owner: m.id, priority: pri });
    touch(m.id); transient.wbFlash = id; afterMutation(`Wish added: ${text}.`);
    toast(`Added “${text}”.`, { action: 'Undo', onAction: undo });
    return true;
  }
  if (kind === 'wb-edit') {
    const id = form.dataset.id, x = w.wishes.find(v => v.id === id);
    const text = (fd.get('text') || '').toString().trim().replace(/\s+/g, ' ');
    if (!x || x.owner !== m.id) return true;
    if (!text || text.length > 80) { transient.wbEditErr = { id, msg: text ? 'Keep it to 80 characters or fewer.' : 'A wish needs a title.' }; notify(); return true; }
    snapshot(`Renamed “${x.text}”`); x.text = text; transient.wbEdit = null; transient.wbEditErr = null; touch(m.id); afterMutation('Wish renamed.');
    return true;
  }
  if (kind === 'wb-cap') {
    if (transient.wbCapCancel) { transient.wbCapCancel = false; return true; }
    const r = validateCap(fd.get('cap'));
    if (r.err) { transient.wbCapErr = r.err; transient.wbCapDraft = String(fd.get('cap') || ''); if (overlayOpen()) import('./wbviews.js').then(V => updateOverlayBody(V.budgetForm())); else notify(); return true; }
    const priv = ['target', 'coord', 'all'].includes(fd.get('privacy')) ? fd.get('privacy') : 'target';
    updateTraveller(m.id, { cap: r.value });
    w.capSet[m.id] = true; w.capPrivacy[m.id] = priv; touch(m.id);
    transient.wbCapErr = ''; transient.wbCapDraft = null; transient.wbCapSaved = Date.now(); if (overlayOpen()) closeOverlay();
    afterMutation(`${m.name}'s planning cap saved. Group target is ${rupee(target())} per person.`);
    setTimeout(() => { transient.wbCapSaved = 0; notify(); }, 1800);
    return true;
  }
  if (kind === 'wb-reject') {
    const d = form.dataset.dest, reason = (fd.get('reason') || '').toString().trim();
    if (!isCoord()) return true;
    if (!reason) { transient.wbRejectErr = { dest: d, msg: 'Add a reason so the group can see why.' }; notify(); return true; }
    w.excluded[d] = reason; w.draft = null; transient.wbReject = null; transient.wbRejectErr = null;
    afterMutation(`${destById(d).name} excluded: ${reason}`);
    return true;
  }
  return false;
}

// ---- AI grouping mock: three labelled stages, cancellable, failure keeps every wish ----
function runAI() {
  const w = wb();
  if (!isCoord()) return;
  if (!w.wishes.length) { toast('Add at least one wish first.', { ms: 3000 }); return; }
  cancelTimers();
  w.ai = { status: 'running', step: 0, result: null };
  announce('Grouping started: reading wishes.');
  notify();
  later(() => { w.ai.step = 1; notify(); }, 800);
  later(() => { w.ai.step = 2; notify(); }, 1600);
  later(() => {
    if (w.failNext) { w.failNext = false; w.ai = { status: 'failed', step: 0, result: null }; announce('Grouping failed. Your wishes are safe. You can try again.'); notify(); return; }
    w.ai = { status: 'done', step: 3, result: { at: Date.now(), count: w.wishes.length } };
    transient.wbCluster = true;
    announce('Wishes grouped into themes.');
    notify();
  }, 2500);
}
function cancelAI() { cancelTimers(); const w = wb(); w.ai = { status: 'idle', step: 0, result: null }; announce('Grouping cancelled. Nothing was changed.'); notify(); }

// ---- reveal timeline (B0-B5). Timers are run-bound, so leaving the screen cancels them. ----
export const rv = () => (transient.rv ||= { phase: wb().revealSeen ? 'vote' : 'ready' });
function revealPhase(p) { transient.rv = { phase: p }; notify(); }
function startReveal() {
  const p = wb().published; if (!p) return;
  cancelTimers();
  if (reduced()) { wb().revealSeen = true; revealPhase('vote'); announce(`${destById(p.items[0].id).name} is the first option. Voting is open.`); return; }
  revealPhase('lift');
  later(() => revealPhase('spin'), 300);
  later(() => revealPhase('settle'), 1200);
  later(() => revealPhase('reveal'), 1900);
  later(() => { wb().revealSeen = true; revealPhase('vote'); announce(`${destById(p.items[0].id).name} is the first option. Voting is open.`); }, 2300);
}
function skipReveal() { cancelTimers(); wb().revealSeen = true; revealPhase('vote'); announce('Animation skipped. Voting is open.'); }

export const actions = {
  'wb-open': () => { cancelTimers(); state.stage = 'wishbox'; state.resume = null; transient.rv = null; transient.wbView = 'board'; notify(); window.scrollTo(0, 0); },
  'wb-back': () => { cancelTimers(); wb().ai.status === 'running' && (wb().ai = { status: 'idle', step: 0, result: null }); state.stage = 'setup'; state.ui.mtab = 'plan'; notify(); window.scrollTo(0, 0); },
  'wb-view': el => { transient.wbView = el.dataset.v; notify(); window.scrollTo(0, 0); },
  'wb-more': () => { transient.wbMore = !transient.wbMore; notify(); },
  'wb-budget': el => { import('./wbviews.js').then(V => { transient.wbCapEl = el; openOverlay({ kind: isPhone() ? 'sheet' : 'dialog', title: 'My budget', body: V.budgetForm() }); }); },
  // Pointer users drag a sticker into the box. Keyboard and screen-reader users press Enter/Space (a click with detail 0) to add it.
  'wb-sticker': (el, e) => {
    if (e && e.detail > 0) { if (!dragMoved) toast('Drag the sticker into the box to add it.', { ms: 2200 }); return; }
    const r = document.getElementById('wb-box')?.getBoundingClientRect() || el.getBoundingClientRect(); addSticker(el.dataset.key, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  },
  'wb-focus-picker': () => { document.querySelector('.wb-sticker')?.focus(); },
  'wb-support': el => {
    const w = wb(), x = w.wishes.find(v => v.id === el.dataset.id), m = me(); if (!x || x.owner === m.id) return;
    snapshot(`${people(x).includes(m.id) ? 'Withdrew support for' : 'Supported'} “${x.text}”`);
    const i = x.support.indexOf(m.id); if (i >= 0) x.support.splice(i, 1); else x.support.push(m.id);
    touch(m.id); afterMutation(`${i >= 0 ? 'Removed your support from' : 'You want'} ${x.text}. ${people(x).length} ${people(x).length === 1 ? 'person' : 'people'}.`);
  },
  'wb-remove': el => removeWish(el.dataset.id),
  'wb-edit-open': el => { transient.wbEdit = el.dataset.id; transient.wbEditErr = null; notify(); setTimeout(() => document.querySelector('.wb-edit input')?.focus(), 20); },
  'wb-edit-cancel': () => { transient.wbEdit = null; transient.wbEditErr = null; notify(); },
  'wb-priority': el => {
    const x = wb().wishes.find(v => v.id === el.dataset.id); if (!x || x.owner !== me().id) return;
    snapshot(`Changed priority of “${x.text}”`); x.priority = x.priority === 'must' ? 'nice' : 'must'; touch(me().id);
    afterMutation(`${x.text} is now ${x.priority === 'must' ? 'a must-have' : 'nice-to-have'}.`);
  },
  'wb-undo': () => undo(),
  'wb-ready': () => {
    const w = wb(), m = me();
    if (readyState(m.id) === 'ready') { delete w.ready[m.id]; afterMutation('Marked not ready. You can keep editing.'); return; }
    w.ready[m.id] = w.rev[m.id] || 0; afterMutation(`${m.name} marked their wishes ready. ${readyCount()} of ${members().length} ready.`);
  },
  'wb-cap-cancel': () => { if (overlayOpen()) closeOverlay(); transient.wbCapCancel = true; transient.wbCapDraft = null; transient.wbCapErr = ''; transient.wbCapCancel = false; notify(); announce('Budget unchanged.'); },
  'wb-dates': (el) => { import('./overlays.js').then(O => O.showCapsule('dates', el)); },
  'wb-clar-dismiss': el => { const w = wb(); w.clar = w.clar.filter(c => c.id !== el.dataset.id); notify(); },
  // coordinator
  'wb-ai': () => runAI(),
  'wb-ai-cancel': () => cancelAI(),
  'wb-theme': el => {   // coordinator moves one wish to a theme (reversible)
    if (!isCoord()) return;
    const w = wb(), id = el.dataset.id; const v = el.value;
    if (v === '__auto') delete w.adjust[id]; else w.adjust[id] = v;
    notify(); announce('Grouping adjusted.');
  },
  'wb-clarify': el => {
    if (!isCoord()) return;
    const w = wb(), x = w.wishes.find(v => v.id === el.dataset.id); if (!x) return;
    if (w.clar.some(c => c.wish === x.id)) { toast('You already asked about this wish.', { ms: 2500 }); return; }
    w.clar.push({ id: 'c' + Date.now(), wish: x.id, to: x.owner, by: me().id, text: `Can you say more about “${x.text}”?` });
    afterMutation(`Asked ${personName(x.owner)} to clarify.`);
  },
  'wb-reject-open': el => { if (!isCoord()) return; transient.wbReject = el.dataset.dest; transient.wbRejectErr = null; notify(); setTimeout(() => document.querySelector('.wb-reject input')?.focus(), 20); },
  'wb-reject-cancel': () => { transient.wbReject = null; transient.wbRejectErr = null; notify(); },
  'wb-restore': el => { if (!isCoord()) return; const w = wb(); delete w.excluded[el.dataset.dest]; w.draft = null; notify(); announce('Option restored to the draft.'); },
  'wb-draft-include': el => { if (!isCoord()) return; const it = ensureDraft().items.find(i => i.id === el.dataset.dest); if (it) { it.include = !it.include; notify(); } },
  'wb-draft-stretch': el => { if (!isCoord()) return; const it = ensureDraft().items.find(i => i.id === el.dataset.dest); if (it) { it.stretch = !it.stretch; notify(); } },
  'wb-draft-move': el => {
    if (!isCoord()) return;
    const items = ensureDraft().items, i = items.findIndex(v => v.id === el.dataset.dest), j = i + (el.dataset.dir === 'up' ? -1 : 1);
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]]; notify(); announce(`${destById(items[j].id).name} moved ${el.dataset.dir}.`);
  },
  'wb-publish': () => {
    if (!isCoord()) return;
    const issues = publishIssues();
    if (issues.length) { toast(issues[0], { ms: 4500 }); return; }
    const w = wb(), inc = ensureDraft().items.filter(i => i.include);
    w.version += 1;
    w.published = { version: w.version, by: coord().id, at: Date.now(), items: inc.map(i => ({ id: i.id, stretch: !!i.stretch, price: destById(i.id).price })) };
    if (w.selected && !inc.some(i => i.id === w.selected.dest)) w.selected = null;
    w.revealSeen = false; transient.rv = null;
    cancelTimers();
    afterMutation(`Shortlist version ${w.version} published with ${inc.length} options. Any earlier votes need review.`);
    toast(`Shortlist v${w.version} published. Members can now reveal and vote.`, { ms: 4500 });
  },
  // reveal and vote
  'wb-reveal-open': () => { if (!wb().published) return; cancelTimers(); state.stage = 'reveal'; transient.rv = null; notify(); window.scrollTo(0, 0); },
  'wb-reveal-back': () => { cancelTimers(); state.stage = 'wishbox'; notify(); window.scrollTo(0, 0); },
  'wb-reveal-start': () => startReveal(),
  'wb-reveal-skip': () => skipReveal(),
  'wb-reveal-replay': () => { transient.rv = { phase: 'ready' }; startReveal(); },
  'wb-focus-dest': el => { transient.rvFocus = el.dataset.dest; notify(); },
  'wb-vote': el => {
    const w = wb(), m = me(), d = el.dataset.dest, v = el.dataset.v;
    const cur = (w.picks[m.id] ||= {});
    if (cur[d] === v) delete cur[d]; else cur[d] = v;
    transient.rvFocus = d; notify(); announce(`${destById(d).name}: ${cur[d] ? (cur[d] === 'like' ? 'liked' : 'passed') : 'cleared'}.`);
  },
  'wb-vote-clear': el => { const w = wb(), m = me(); delete (w.picks[m.id] ||= {})[el.dataset.dest]; notify(); announce(`${destById(el.dataset.dest).name}: cleared.`); },
  'wb-submit': () => {
    const w = wb(), m = me(), p = w.published; if (!p) return;
    const votes = { ...(w.picks[m.id] || {}) };
    for (const k of Object.keys(votes)) if (!p.items.some(i => i.id === k)) delete votes[k];
    if (!Object.keys(votes).length) { toast('Choose Like or Pass for at least one destination first.', { ms: 3500 }); return; }
    w.ballots[m.id] = { version: p.version, votes, at: Date.now() };
    afterMutation(`${m.name} submitted choices for shortlist version ${p.version}. ${submittedCount()} of ${members().length} members have submitted.`);
  },
  'wb-edit-ballot': () => { const w = wb(), m = me(); if (w.ballots[m.id]) { w.picks[m.id] = { ...w.ballots[m.id].votes }; delete w.ballots[m.id]; notify(); announce('You can edit your choices and submit again.'); } },
  'wb-consent': el => {
    const w = wb(), m = me(), d = el.dataset.dest;
    (w.consent[d] ||= {})[m.id] = !(w.consent[d] || {})[m.id];
    notify(); announce(w.consent[d][m.id] ? `${m.name} accepts ${destById(d).name} above their cap for this trip.` : 'Consent withdrawn.');
  },
  'wb-select': el => { if (!isCoord()) return; wb().selected = { dest: el.dataset.dest, version: wb().published.version }; notify(); announce(`${destById(el.dataset.dest).name} selected for confirmation.`); },
  'wb-unselect': () => { if (!isCoord()) return; wb().selected = null; notify(); },
  'wb-revise': () => { if (!isCoord()) return; state.stage = 'wishbox'; wb().draft = null; transient.wbView = 'review'; notify(); window.scrollTo(0, 0); toast('Back at the wishes. Revise the shortlist and publish a new version.', { ms: 4500 }); },
  'wb-confirm': () => {
    if (!isCoord()) return;
    const w = wb(), s = w.selected; if (!s) return;
    if (unresolved(s.dest).length) { toast('Resolve the budget conflicts first.', { ms: 3500 }); return; }
    const d = destById(s.dest), t = target();
    cancelTimers();
    setTrip({ dest: d.name, budget: Math.max(1000, Math.min(...[...members().filter(m => capSet(m.id)).map(m => m.cap), Math.max(t || d.price, d.price)])) });
    const wishList = w.wishes.map(x => x.text).join(', ');
    pushMessage({ from: 'ai', text: `You chose ${d.name}. I'm carrying your wishes forward (${wishList || 'none yet'}) with everyone's caps and the dates ${fmtRange()}.` });
    state.stage = 'setup'; state.ui.mtab = 'plan'; notify(); window.scrollTo(0, 0);
    toast(`${d.name} chosen. Continue with Plan my trip.`, { ms: 5000 });
  },
  // demo helpers (Demo menu only)
  'wb-demo-seed': el => {
    const w = wb(), n = Number(el.dataset.n || 10), ms = members(), keys = STICKERS.map(s => s.key);
    snapshot(`Seeded ${n} sample wishes`);
    const extra = ['Sunset by the river', 'A quiet bookshop', 'Street food walk', 'Sunrise over the rocks', 'Try a coracle ride', 'Local weaving shop', 'Stargazing night', 'Slow chai breaks', 'Old bazaar stroll', 'Boat ride at dusk', 'A day with no plan', 'Filter coffee tasting'];
    for (let i = 0; i < n; i++) {
      const owner = ms[i % ms.length].id;
      if (i < keys.length && !w.wishes.some(x => x.key === keys[i])) { const st = STICKERS[i]; addWish({ key: st.key, cat: st.cat, text: st.label, owner, priority: i % 4 === 0 ? 'must' : 'nice', support: i % 3 === 0 ? [ms[(i + 1) % ms.length].id].filter(x => x !== owner) : [] }); }
      else addWish({ key: null, cat: 'Custom', text: extra[i % extra.length] + (i >= extra.length ? ` ${i}` : ''), owner });
    }
    ms.forEach(m => touch(m.id)); notify(); toast(`${n} sample wishes added.`, { action: 'Undo', onAction: undo });
  },
  'wb-demo-fail': () => { wb().failNext = true; toast('The next AI grouping will fail once, keeping all wishes.', { ms: 3500 }); },
  'wb-demo-clearcap': () => { const m = me(); wb().capSet[m.id] = false; touch(m.id); notify(); toast(`${m.name}'s cap cleared: budget missing.`, { ms: 3000 }); },
  'wb-demo-reset': () => { state.wb = defaultWb(); transient.rv = null; cancelTimers(); notify(); toast('Wishbox cleared.', { ms: 2500 }); },
};
export function onInput(e) {
  const t = e.target;
  if (t.matches('[data-wb-cap]')) { transient.wbCapDraft = t.value; const r = document.querySelector('[data-wb-range]'); const n = Number(String(t.value).replace(/[₹,\s]/g, '')); if (r && n >= Number(r.min) && n <= Number(r.max)) r.value = n; }
  else if (t.matches('[data-wb-range]')) { transient.wbCapDraft = t.value; const f = document.querySelector('[data-wb-cap]'); if (f) f.value = t.value; }
  else if (t.matches('[data-wb-write]')) transient.wbWriteText = t.value;
}
export function onTripChanged() { const w = wb(), d = `${state.trip.start}|${state.trip.end}`; if (w.lastDates && w.lastDates !== d) touch(me().id); w.lastDates = d; }
export function entryCard(slim = false) {
  const p = wb().published;
  if (slim) return `<section class="wb-entry wb-entry-slim" aria-labelledby="wbe-t"><div class="wbe-mini" aria-hidden="true"><span class="wbe-tile wbe-t1"><img src="assets/wb/beach.webp" alt="" width="64" height="70"></span><span class="wbe-tile wbe-t2"><img src="assets/wb/waterfall.webp" alt="" width="66" height="44"></span><span class="wbe-box"><img src="assets/wb/box_empty.webp" alt="" width="220" height="117"><b>Wishbox</b></span></div><div class="wbe-copy"><h2 id="wbe-t">Still deciding together?</h2><div class="wbe-actions"><button class="wbe-cta" data-act="wb-open">${p ? 'Open the Wishbox' : 'Create a Wishbox'} <span aria-hidden="true">&rarr;</span></button>${p ? '<button class="wbe-cta wbe-sub" data-act="wb-reveal-open">Reveal &amp; vote</button>' : ''}</div></div></section>`;
  return `<section class="wb-entry" aria-labelledby="wbe-t">
    <div class="wbe-copy"><h2 id="wbe-t">Different ideas?<br>Put them together.</h2>
      <p>Everyone adds a wish. Find a trip that fits your group.</p>
      <div class="wbe-actions"><button class="wbe-cta" data-act="wb-open">${p ? 'Open the Wishbox' : 'Create a Wishbox'} <span aria-hidden="true">&rarr;</span></button>${p ? '<button class="wbe-cta wbe-sub" data-act="wb-reveal-open">Reveal &amp; vote</button>' : ''}</div></div>
    <div class="wbe-art" aria-hidden="true">
      <span class="wbe-tile wbe-t1"><img src="assets/wb/beach.webp" alt="" width="64" height="70"></span>
      <span class="wbe-tile wbe-t2"><img src="assets/wb/waterfall.webp" alt="" width="66" height="44"></span>
      <svg class="wbe-arrows" viewBox="0 0 120 50" fill="none" stroke="#B8643C" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4q2 22 14 30M28 32l7 4-1-8"/><path d="M96 6q-4 20-20 28M84 34l-8 2 4-7"/></svg>
      <span class="wbe-box"><img src="assets/wb/box_empty.webp" alt="" width="220" height="117"><b>Wishbox</b></span>
      <svg class="wbe-spark" viewBox="0 0 30 30" fill="none" stroke="#E2531C" stroke-width="2.4" stroke-linecap="round"><path d="M4 8l7 3M2 16l8 0M6 24l7-4"/></svg></div></section>`;
}
/** After each render: fly the new sticker from the picker into the box (280-360ms), give the box a 1-2% squash, then settle. */
export function afterRender() {
  const fly = transient.wbFly;
  if (fly) {
    transient.wbFly = null;
    const target = document.querySelector(`[data-wish="${fly.id}"] .wb-wish-art img`), box = document.getElementById('wb-box');
    if (target && fly.from && !reduced()) {
      const r = target.getBoundingClientRect(), dx = fly.from.x - (r.left + r.width / 2), dy = fly.from.y - (r.top + r.height / 2);
      target.animate([
        { transform: `translate(${dx}px,${dy}px) scale(.92)`, opacity: 0, offset: 0 },
        { transform: `translate(${dx * .45}px,${dy * .45 - 18}px) scale(1.03)`, opacity: 1, offset: .35 },
        { transform: 'none', opacity: 1 },
      ], { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' });
      if (box) box.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.985)', offset: .4 }, { transform: 'scaleY(1)' }], { duration: 300, delay: 300, easing: 'ease-out' });
    }
  }
  transient.wbFlash = null; transient.wbCluster = false;
}
/** QA fixtures for ?jump=wishbox|review|shortlist|reveal|vote (not shown in the UI). */
export function jump(j) {
  const w = wb(), ms = members();
  actions['wb-demo-seed']({ dataset: { n: '8' } });
  w.wishes.forEach((x, i) => { if (i % 2 === 0) x.support = ms.map(m => m.id).filter(id => id !== x.owner).slice(0, 1 + (i % 2)); });
  ms.forEach(m => { w.ready[m.id] = w.rev[m.id] || 0; });
  w.history = [];
  state.stage = 'wishbox'; transient.wbView = 'board';
  if (j === 'wishbox') return;
  w.ai = { status: 'done', step: 3, result: { at: Date.now(), count: w.wishes.length } }; transient.wbView = 'review';
  if (j === 'review') return;
  ensureDraft(); w.draft.items.forEach(i => { if (proposal(i.id).over) i.stretch = true; });
  if (j === 'shortlist') return;
  w.version = 1; w.published = { version: 1, by: coord().id, at: Date.now(), items: w.draft.items.filter(i => i.include).map(i => ({ id: i.id, stretch: i.stretch, price: destById(i.id).price })) };
  state.stage = 'reveal'; transient.rv = { phase: 'ready' };
  if (j === 'reveal') return;
  w.revealSeen = true; transient.rv = { phase: 'vote' };
  w.picks[ms[0].id] = { hampi: 'like', gokarna: 'pass', coorg: 'pass' };
  w.ballots[ms[0].id] = { version: 1, votes: { hampi: 'like', gokarna: 'pass', coorg: 'pass' }, at: Date.now() };
  if (ms[1]) w.ballots[ms[1].id] = { version: 1, votes: { hampi: 'like', gokarna: 'like', coorg: 'pass' }, at: Date.now() };
  w.selected = { dest: 'gokarna', version: 1 };
}
// ---- drag a sticker into the box (pointer events; works for mouse, touch and pen) ----
let dragMoved = false;
(function initDrag() {
  let d = null;
  const box = () => document.getElementById('wb-box');
  const over = (x, y) => { const b = box(); if (!b) return false; const r = b.getBoundingClientRect(); return x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8; };
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest && e.target.closest('.wb-sticker, .wb-thumb');
    if (!el || e.button > 0) return;
    const out = el.classList.contains('wb-thumb');
    d = { el, out, key: out ? el.dataset.thumb : el.dataset.key, x0: e.clientX, y0: e.clientY, ghost: null, id: e.pointerId };
    dragMoved = false;
  });
  document.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
      const img = d.el.querySelector('img'); if (!img) { d = null; return; }
      const g = img.cloneNode(); g.className = 'wb-ghost'; g.style.width = img.getBoundingClientRect().width * 1.25 + 'px';
      document.body.appendChild(g); d.ghost = g; dragMoved = true; d.el.classList.add('is-dragging');
      try { d.el.setPointerCapture(e.pointerId); } catch {}
    }
    d.ghost.style.transform = `translate(${e.clientX}px,${e.clientY}px) translate(-50%,-50%) rotate(-4deg)`;
    const inside = over(e.clientX, e.clientY);
    box()?.classList.toggle('is-over', !d.out && inside);
    box()?.classList.toggle('is-pulling', d.out && !inside);
  });
  const end = (e, cancel) => {
    if (!d || e.pointerId !== d.id) return;
    const { ghost, key, el, out } = d; d = null;
    box()?.classList.remove('is-over', 'is-pulling'); el.classList.remove('is-dragging');
    if (!ghost) return;
    if (out) {
      if (!cancel && !over(e.clientX, e.clientY)) { ghost.remove(); pullOut(key); }
      else if (reduced()) ghost.remove();
      else { const r = el.getBoundingClientRect(); ghost.animate([{}, { transform: `translate(${r.left + r.width / 2}px,${r.top + r.height / 2}px) translate(-50%,-50%)`, opacity: .2 }], { duration: 200, easing: 'ease-out' }).onfinish = () => ghost.remove(); }
      setTimeout(() => { dragMoved = false; }, 50);
      return;
    }
    const ok = !cancel && over(e.clientX, e.clientY);
    if (ok) { ghost.remove(); addSticker(key, { x: e.clientX, y: e.clientY }); }
    else if (reduced()) ghost.remove();
    else { const r = el.getBoundingClientRect(); ghost.animate([{}, { transform: `translate(${r.left + r.width / 2}px,${r.top + r.height / 2}px) translate(-50%,-50%)`, opacity: .2 }], { duration: 200, easing: 'ease-out' }).onfinish = () => ghost.remove(); }
    setTimeout(() => { dragMoved = false; }, 50);
  };
  document.addEventListener('pointerup', e => end(e, false));
  document.addEventListener('pointercancel', e => end(e, true));
})();
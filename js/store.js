// Single source of truth. Totals are always derived from the ledger, never mutated separately.
import {
  DEMO, FRIEND_SLOTS, DEFAULT_CAP, STAYS, MEAL_PRICES, BUS, LOCAL_BASE,
  SCOOTY, DAYS, ANJANADRI, LUNCH_HOURS, BUFFER_HOURS, COPY, VIBES, rupee
} from './data.js';

import { arrange, canAdd } from './looks.js';

const KEY = 'ct-planner-v2';
const listeners = new Set();

function defaultPlan() {
  return {
    stay: 'riverside',
    scooty: false,
    anj: 2,                                   // Anjanadri Hill sits on Day 2 until moved
    meals: {
      1: { lunch:true, dinner:true },
      2: { lunch:true, dinner:true },
      3: { lunch:true, dinner:true },
      4: { lunch:true, dinner:false },
    },
    bump: null,                               // price-change branch: {stay, night, amount}
  };
}

function defaultState() {
  return {
    v: 2,
    stage: 'home',                            // home | setup | chat | building | plan | checkout | handoff
    travellers: [{ id:'t1', name:'You', style:'male', ident:1, cap:DEFAULT_CAP, role:'organiser', status:'joined' }],
    nextId: 2,
    trip: { dest: DEMO.destination, start: DEMO.start, end: DEMO.end, budget: 12000 },
    messages: [],
    vibe: null,
    plan: null,
    planVersion: 0,
    sharedVersion: null,
    approvals: {},                            // travellerId -> plan version approved
    history: [],                              // [{label, plan, version}]
    shareLog: [],                             // [{version, perPerson}] for "cost change since the last version"
    ui: { selectedDay: 2, panel: { type:'day' }, mtab: 'plan', actingAs: 't1', reduced: false, detailsOpen: false, group: false, kept: {}, draft: '' },
    recovery: null,                           // {type:'price'|'nomatch'|'error', ...}
    resume: null,                             // stage to return to when re-entering the planner from the host home
    wb: null,                                 // group Wishbox + reveal state (created lazily by wishbox.js)
  };
}

export let state = load();

function load() {
  // A refresh always starts a fresh session: nothing is restored from an earlier visit.
  try { localStorage.removeItem(KEY); } catch {}
  return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (s.v !== 2) return defaultState();
    // Interrupted generation never survives a refresh
    if (s.stage === 'building') s.stage = s.plan ? 'plan' : 'chat';
    const out = Object.assign(defaultState(), s, { ui: Object.assign(defaultState().ui, s.ui) });
    out.travellers.forEach(t => { delete t.tone; delete t.side; });
    arrange(out.travellers);
    return out;
  } catch { return defaultState(); }
}
function persist() { /* intentionally in-memory only: a refresh resets the demo */ }

// ---- Non-persisted, transient state ----
export const transient = {
  build: null,           // {step, runId}
  typing: false,
  pending: null,         // {type, day, draft, base}  one draft editor at a time
  newBadge: false,
  inviteTarget: null,
  joinAnim: null,        // id of a just-added traveller for the shoulder animation
  highlight: null,       // {key, until}
  lastUndo: null,
  failNext: false,
};

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
let queued = false;
export function notify() {
  persist();
  if (queued) return; queued = true;
  queueMicrotask(() => { queued = false; listeners.forEach(f => f()); });
}
export function commit(fn) { fn(state); notify(); }

// ---- Timers for mock adapters: cancelled on navigate, retry and reset so stale responses never win ----
let runId = 0;
const timers = new Set();
export function later(fn, ms) {
  const my = runId;
  const id = setTimeout(() => { timers.delete(id); if (my === runId) fn(); }, ms);
  timers.add(id);
  return id;
}
export function cancelTimers() { runId++; timers.forEach(clearTimeout); timers.clear(); transient.typing = false; transient.build = null; }

// ---------------------------------------------------------------- selectors
export const party = () => state.travellers.length;
export const lowestCap = () => Math.min(...state.travellers.map(t => t.cap));
export const planningTarget = () => Math.min(state.trip.budget, lowestCap());
export const traveller = id => state.travellers.find(t => t.id === id);
export const nameOf = id => (traveller(id) || { name:'Someone' }).name;
export const acting = () => traveller(state.ui.actingAs) || state.travellers[0];

export function stayNight(plan, n) {
  const s = STAYS[plan.stay];
  let p = s.nights[n - 1];
  if (plan.bump && plan.bump.stay === plan.stay && plan.bump.night === n) p += plan.bump.amount;
  return p;
}

// Ledger: one row per priced item. Kinds: 'checkout' (bookable sample items) or 'local'/'meal' (estimates outside checkout).
export function ledger(plan = state.plan) {
  if (!plan) return null;
  const days = [1, 2, 3, 4].map(n => {
    const transport = [];
    if (n === 1) transport.push({ id:'bus-out', label:'Outbound night bus', sub:'14 Nov · To Hampi', amount:BUS.outbound, kind:'checkout' });
    if (n === 2) transport.push(plan.scooty
      ? { id:'local2', label:'Scooty rental', sub:'Sample partner · 1 rider per vehicle', amount:SCOOTY.price, kind:'local', scooty:true }
      : { id:'local2', label:'Local autos', sub:'Estimated', amount:LOCAL_BASE[2], kind:'local' });
    else transport.push({ id:'local'+n, label:'Local transport', sub:'Estimated', amount:LOCAL_BASE[n], kind:'local' });
    if (n === 4) transport.push({ id:'bus-ret', label:'Return bus', sub:'17 Nov · From Hampi', amount:BUS.ret, kind:'checkout' });
    const stay = n <= 3 ? [{ id:'stay'+n, label:STAYS[plan.stay].name, sub:`Night ${n}`, amount:stayNight(plan, n), kind:'checkout' }] : [];
    const meals = [];
    const prices = MEAL_PRICES[n];
    if (plan.meals[n].lunch && prices.lunch) meals.push({ id:'lunch'+n, label:'Lunch', amount:prices.lunch, kind:'meal' });
    if (plan.meals[n].dinner && prices.dinner) meals.push({ id:'dinner'+n, label:'Dinner', amount:prices.dinner, kind:'meal' });
    const sum = a => a.reduce((x, r) => x + r.amount, 0);
    return { n, transport, stay, meals, tTransport:sum(transport), tStay:sum(stay), tMeals:sum(meals), total:sum(transport) + sum(stay) + sum(meals) };
  });
  const sum = k => days.reduce((a, d) => a + d[k], 0);
  const perPerson = days.reduce((a, d) => a + d.total, 0);
  const checkoutRows = days.flatMap(d => [...d.transport, ...d.stay]).filter(r => r.kind === 'checkout');
  const outsideTransport = days.flatMap(d => d.transport).filter(r => r.kind === 'local').reduce((a, r) => a + r.amount, 0);
  return {
    days, transport:sum('tTransport'), stay:sum('tStay'), meals:sum('tMeals'), perPerson,
    group: perPerson * party(),
    checkoutRows, checkoutPerPerson: checkoutRows.reduce((a, r) => a + r.amount, 0),
    outsideTransport, outsideMeals: sum('tMeals'),
  };
}
export const totals = () => ledger(state.plan);
export const perPerson = () => (state.plan ? ledger().perPerson : 0);
export function breaches(plan = state.plan) {
  if (!plan) return [];
  const pp = ledger(plan).perPerson;
  return state.travellers.filter(t => pp > t.cap).map(t => ({ id:t.id, name:t.name, cap:t.cap, excess:pp - t.cap }));
}

// ---- Time model ----
const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const clock = m => { m = Math.round(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

export function dayStops(plan, n) {
  const base = DAYS[n - 1].stops.slice();
  if (n === plan.anj) base.push(ANJANADRI);
  return base;
}
export function dayTiming(plan, n) {
  const d = DAYS[n - 1];
  const factor = plan.scooty && n === 2 ? SCOOTY.travelFactor : 1;
  const lunchOn = !!plan.meals[n].lunch;
  const stops = dayStops(plan, n);
  let t = toMin(d.start);
  const items = [];
  let sights = 0, travel = 0, lunchDone = !lunchOn;
  const placeLunch = () => { const s = Math.max(t, 12.75 * 60); if (s > t) items.push({ kind:'free', label:'Free time', start:t, end:s }); items.push({ kind:'lunch', label:'Lunch', start:s, end:s + 60 }); t = s + 60; lunchDone = true; };
  for (const s of stops) {
    const tr = s.travel * factor * 60;
    if (!lunchDone && t + tr >= 12.75 * 60 && s.id !== 'virupaksha') placeLunch();
    if (tr > 0) { items.push({ kind:'travel', label:'Travel', start:t, end:t + tr }); t += tr; travel += tr / 60; }
    items.push({ kind:'stop', id:s.id, label:s.name, part:s.part, start:t, end:t + s.sights * 60 });
    t += s.sights * 60; sights += s.sights;
  }
  if (!lunchDone) placeLunch();
  const lunch = lunchOn ? LUNCH_HOURS : 0;
  const planned = sights + travel + lunch + BUFFER_HOURS;
  const available = d.available;
  const dayEnd = toMin(d.start) + available * 60 + (lunch ? 0 : 0);
  return {
    n, items, sights, travel, lunch, buffer: BUFFER_HOURS, planned, available,
    over: Math.max(0, planned - available), spare: Math.max(0, available - planned), fits: planned <= available + 1e-9,
    dayEnd,
  };
}

// ---------------------------------------------------------------- draft helpers (one draft editor at a time)
export function baseFor(type, day) {
  const p = state.plan;
  if (type === 'meals') return { ...p.meals[day] };
  if (type === 'transport') return { scooty: p.scooty };
  if (type === 'stay') return { stay: p.stay };
  return {};
}
export function isDirty() {
  const p = transient.pending; if (!p) return false;
  return JSON.stringify(baseFor(p.type, p.day)) !== JSON.stringify(p.draft);
}

// ---------------------------------------------------------------- history / versions
const clone = o => JSON.parse(JSON.stringify(o));
export function mutatePlan(label, fn) {
  state.history.push({ label, plan: clone(state.plan), version: state.planVersion });
  if (state.history.length > 30) state.history.shift();
  fn(state.plan);
  state.planVersion++;
  notify();
}
export function undoLast() {
  const h = state.history.pop();
  if (!h) return false;
  state.plan = h.plan; state.planVersion++;
  notify();
  return h.label;
}
export function bumpVersion() { state.planVersion++; }

export const planStatus = () => (state.sharedVersion === state.planVersion ? 'shared' : 'draft');
export const isApproved = id => planStatus() === 'shared' && state.approvals[id] === state.planVersion;
export const approvedCount = () => state.travellers.filter(t => isApproved(t.id)).length;
export const allApproved = () => state.travellers.length > 0 && state.travellers.every(t => isApproved(t.id));
export function canBook() {
  return state.stage === 'plan' && !!state.plan && allApproved() && breaches().length === 0 &&
         !transient.pending && !(state.recovery && state.recovery.type === 'price' && !state.recovery.resolved);
}
export function bookBlockers() {
  const r = [];
  if (planStatus() !== 'shared') r.push('Share the latest draft with the group.');
  else if (!allApproved()) r.push(`${state.travellers.length - approvedCount()} member${state.travellers.length - approvedCount() === 1 ? '' : 's'} still to approve the latest version.`);
  const b = breaches();
  if (b.length) r.push(b.map(x => `Over ${x.name}'s cap by ${rupee(x.excess)}.`).join(' '));
  if (transient.pending) r.push('Apply or cancel the edit in progress.');
  if (state.recovery && state.recovery.type === 'price' && !state.recovery.resolved) r.push('Resolve the price change.');
  return r;
}

// ---------------------------------------------------------------- travellers
export function validateName(name, exceptId) {
  const n = (name || '').trim();
  if (n.length > 24) return 'Use 24 characters or fewer.';
  if (n && state.travellers.some(t => t.id !== exceptId && t.name.toLowerCase() === n.toLowerCase())) return 'That name is already in the group.';
  return '';
}
// Visual roles/identities are derived from the ordered list (see looks.js); this keeps each traveller's sticky ident current.
export function syncLooks() { arrange(state.travellers); }
export function addTraveller({ name, style }) {
  // every character must stay distinct: use the other gender if this one is exhausted, and refuse if neither fits
  if (!canAdd(state.travellers, style)) { const alt = style === 'female' ? 'male' : 'female'; if (canAdd(state.travellers, alt)) style = alt; else return null; }
  const idx = state.travellers.length - 1;          // friend index
  const slot = FRIEND_SLOTS[idx];
  const id = 't' + state.nextId++;
  const t = { id, name:(name || '').trim() || `Friend ${state.travellers.length + 1}`, style, cap: slot ? slot.cap : DEFAULT_CAP, role:'friend', status:'not_joined' };
  state.travellers.push(t);
  syncLooks();
  transient.joinAnim = id;
  if (state.plan) { bumpVersion(); }
  state.messages.push({ id:'m' + Date.now() + Math.random(), from:'system', text:`${t.name} was added to the group. Adding a name does not invite them.` });
  notify();
  return t;
}
export function updateTraveller(id, patch) {
  const t = traveller(id); if (!t) return;
  const capChanged = patch.cap != null && patch.cap !== t.cap;
  Object.assign(t, patch);
  syncLooks();
  if (capChanged && state.plan) bumpVersion();       // caps are material; nicknames and illustrations are not
  notify();
}
export function removeTraveller(id) {
  const t = traveller(id); if (!t || t.role === 'organiser') return;
  state.travellers = state.travellers.filter(x => x.id !== id);
  syncLooks();
  delete state.approvals[id];
  if (state.ui.actingAs === id) state.ui.actingAs = state.travellers[0].id;
  if (state.plan) bumpVersion();
  state.messages.push({ id:'m' + Date.now() + Math.random(), from:'system', text:`${t.name} was removed from the group.` });
  notify();
}
export function inviteReady(id) { const t = traveller(id); if (t && t.status === 'not_joined') { t.status = 'invite_ready'; } transient.inviteTarget = id; notify(); }
export function joinAs(id) { const t = traveller(id); if (!t) return; t.status = 'joined'; transient.inviteTarget = null; state.messages.push({ id:'m' + Date.now() + Math.random(), from:'system', text:`${t.name} joined the plan. Joining is not approval.` }); notify(); }

// ---------------------------------------------------------------- trip inputs
export function validateTrip(field, value) {
  if (field === 'budget') {
    const n = Number(String(value).replace(/[₹,\s]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return 'Enter an amount above ₹0.';
    if (!Number.isInteger(n)) return 'Use whole rupees.';
    return '';
  }
  if (field === 'dates') {
    const [s, e] = value; if (!s || !e) return 'Choose both dates.';
    if (new Date(e) <= new Date(s)) return 'The end date must be after the start date.';
    return '';
  }
  if (field === 'dest') { if (!String(value).trim()) return 'Enter a destination.'; return ''; }
  return '';
}
export function setTrip(patch) { Object.assign(state.trip, patch); if (state.plan) bumpVersion(); notify(); }
export const isSupportedTrip = () =>
  state.trip.dest.trim().toLowerCase() === DEMO.destination.toLowerCase() && state.trip.start === DEMO.start && state.trip.end === DEMO.end;
export function fmtRange(start = state.trip.start, end = state.trip.end) {
  const a = new Date(start + 'T00:00:00'), b = new Date(end + 'T00:00:00');
  const mon = d => d.toLocaleDateString('en-GB', { month:'short' });
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${mon(a)}`;
  return `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)}`;
}

// ---------------------------------------------------------------- messages
let mid = 1;
export function pushMessage(m) { state.messages.push(Object.assign({ id:'m' + (mid++) + '-' + Date.now(), ts: Date.now() }, m)); notify(); }
export function aiSay(text, extra = {}, delay = 800) {
  transient.typing = true; notify();
  later(() => { transient.typing = false; pushMessage(Object.assign({ from:'ai', text }, extra)); }, delay);
}

// ---------------------------------------------------------------- planning flow (mock AI adapter)
export function beginSetup() { cancelTimers(); state.stage = state.stage === 'home' ? 'setup' : state.stage; if (!state.messages.length) pushMessage({ from:'ai', text:COPY.aiIntro }); notify(); }

export function submitRequest({ echo = true } = {}) {
  cancelTimers();
  const { dest, budget } = state.trip;
  state.stage = 'chat'; state.recovery = null; state.vibe = null;
  const dates = fmtRange();
  if (echo) pushMessage({ from:'t1', text:`${dest}, ${dates}. Around ${rupee(budget)} each.` });
  else pushMessage({ from:'t1', text:'Explore the Hampi demo.' });
  if (!isSupportedTrip()) {
    later(() => aiSay(COPY.unsupported(dest, dates), { kind:'unsupported' }, 700), 400);
    return;
  }
  const low = state.travellers.reduce((a, t) => (t.cap < a.cap ? t : a));
  const delay = low.cap < budget && low.id !== 't1';
  later(() => {
    if (delay) pushMessage({ from:low.id, text:`My max is ${rupee(low.cap)}.` });
    later(() => aiSay(COPY.gotTarget(planningTarget()), { kind:'target', target:planningTarget() }, 800), delay ? 500 : 100);
    later(() => aiSay(COPY.askVibe, { kind:'vibe' }, 500), delay ? 2000 : 1200);
  }, 500);
}
export function chooseVibe(id) {
  const v = VIBES.find(x => x.id === id); if (!v) return;
  state.vibe = id;
  pushMessage({ from:'t1', text: id === 'heritage' ? 'Heritage & sunrise sounds good.' : `${v.label} sounds good.` });
  if (id !== 'heritage') {
    later(() => aiSay('This demo only has a heritage plan for Hampi, so I will build that one. Your choice is kept in the chat.', {}, 700), 300);
    later(startBuild, 2200);
  } else later(startBuild, 400);
}

export function startBuild() {
  cancelTimers();
  state.stage = 'building'; state.recovery = null;
  const myRun = runId;
  transient.build = { step:0 };
  state.ui.mtab = 'chat';
  notify();
  const steps = COPY.planningStatus.length;
  const target = planningTarget();
  const fail = transient.failNext;
  for (let i = 1; i <= steps; i++) {
    later(() => {
      if (fail && i === 3) { failBuild(); return; }
      transient.build = { step:i }; notify();
      if (i === steps) later(() => finishBuild(target), 450);
    }, i * 850);
  }
}
function finishBuild(target) {
  if (state.plan && target >= 10200) {
    // A retry never overwrites saved work or duplicates the "plan ready" message.
    state.stage = 'plan'; state.ui.mtab = 'plan'; transient.build = null;
    if (!state.messages.some(m => m.kind === 'retry-ok' && m.version === state.planVersion)) pushMessage({ from:'ai', kind:'retry-ok', version:state.planVersion, text:'Your saved plan is up to date. Nothing changed.' });
    notify(); return;
  }
  if (target < 10200) {
    state.stage = state.plan ? 'plan' : 'chat';
    state.recovery = { type:'nomatch', requested:target, closest:10200 };
    transient.build = null;
    pushMessage({ from:'ai', text:`I tried rearranging stays, travel and activities, but no complete plan fits ${rupee(target)} per person yet. The closest option is ₹10,200 per person, which is ${rupee(10200 - target)} higher than your budget.`, kind:'nomatch' });
    state.ui.mtab = 'plan';
    notify(); return;
  }
  state.plan = defaultPlan();
  state.planVersion++; state.sharedVersion = null; state.approvals = {}; state.history = [];
  state.stage = 'plan'; state.ui.selectedDay = 2; state.ui.panel = { type:'day' }; state.ui.mtab = 'plan';
  transient.build = null; transient.revealPlan = true;
  const pp = ledger().perPerson;
  const over = breaches();
  pushMessage({ from:'ai', kind:'plan-ready', text: over.length
    ? `Your Hampi plan is ready. It's ${rupee(pp - lowestCap())} above ${over[0].name}'s cap. I've found a cheaper stay if you'd like to swap.`
    : 'Your Hampi plan is ready. It fits everyone\'s budget.' });
  notify();
}
export function failBuild() {
  cancelTimers();
  transient.failNext = false;
  state.recovery = { type:'error' };
  state.stage = state.plan ? 'plan' : 'chat';
  state.ui.mtab = 'plan';
  notify();
}
export function cancelBuild() {
  cancelTimers();
  state.stage = state.plan ? 'plan' : 'chat';
  pushMessage({ from:'ai', text:'Planning stopped. Your trip details are saved. Pick a vibe when you are ready.', kind:'vibe' });
  notify();
}
export function retryBuild() { state.recovery = null; transient.failNext = false; startBuild(); }

// ---------------------------------------------------------------- sharing and approvals
export function share() {
  state.sharedVersion = state.planVersion;
  state.shareLog = state.shareLog || [];
  if (!state.shareLog.some(x => x.version === state.planVersion)) state.shareLog.push({ version: state.planVersion, perPerson: ledger().perPerson });
  pushMessage({ from:'t1', text: `I've shared the draft plan (version ${state.planVersion}). Please review and approve.` });
  notify();
}
export function approve(id) {
  const t = traveller(id); if (!t) return { ok:false, reason:'Unknown traveller' };
  if (planStatus() !== 'shared') return { ok:false, reason:'Share the draft first.' };
  const pp = ledger().perPerson;
  if (pp > t.cap) return { ok:false, reason:`${t.name} can't approve while the plan is ${rupee(pp - t.cap)} over their cap of ${rupee(t.cap)}.` };
  state.approvals[id] = state.planVersion;
  pushMessage({ from:id, text:'Approved.' });
  notify();
  return { ok:true };
}

// ---------------------------------------------------------------- recovery triggers (demo controls)
export function triggerPrice() {
  if (!state.plan) return false;
  const night = 2;
  state.plan.bump = { stay: state.plan.stay, night, amount: 150, accepted: false };
  state.recovery = { type:'price', stay: state.plan.stay, night, amount: 150, resolved:false };
  state.planVersion++;
  state.ui.panel = { type:'price' }; state.ui.mtab = 'plan';
  pushMessage({ from:'ai', kind:'price', text:'One update before checkout: a stay price has changed. Please review and choose how to proceed.' });
  notify(); return true;
}
export function triggerNoMatch() {
  state.recovery = { type:'nomatch', requested:9500, closest:10200 };
  state.ui.mtab = 'plan';
  if (state.stage === 'home' || state.stage === 'setup') state.stage = 'chat';
  pushMessage({ from:'t1', text:'Reduce to ₹9,500 per person.' });
  pushMessage({ from:'ai', kind:'nomatch', text:'I tried rearranging stays, travel and activities, but no complete plan fits ₹9,500 per person yet. The closest option is ₹10,200 per person, which is ₹700 higher than your budget.' });
  notify();
}
export function triggerError() {
  cancelTimers();
  if (state.stage === 'home' || state.stage === 'setup') state.stage = 'chat';
  failBuild();
}

export function resetAll() {
  cancelTimers();
  transient.pending = null; transient.joinAnim = null; transient.inviteTarget = null; transient.failNext = false;
  const keepReduced = state.ui.reduced;
  state = defaultState();
  state.ui.reduced = keepReduced;
  notify();
  return state;
}
export function resetOptionalChanges() {
  if (!state.plan) return;
  mutatePlan('Reset optional edits', p => { p.scooty = false; for (const d of [1, 2, 3, 4]) { p.meals[d].lunch = true; p.meals[d].dinner = d !== 4; } });
}
export function setState(s) { state = s; }

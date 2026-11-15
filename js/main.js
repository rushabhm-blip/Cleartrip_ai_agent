// App controller: render, delegated events, actions, edit drafts, chat handling and demo controls.
import * as S from './store.js';
import {
  state, transient, subscribe, notify, traveller, party, acting, ledger, perPerson, breaches, planStatus, isApproved,
  allApproved, canBook, validateName, validateTrip, setTrip, fmtRange, mutatePlan, undoLast, aiSay, pushMessage, later,
} from './store.js';
import { esc, icon, isPhone, isTablet, announce, toast, clearToast, closeOverlay, updateOverlayBody, overlayOpen, openOverlay, applyMotionPref, reduced, selectorFor } from './ui.js';
import { renderGroup, playLeave } from './characters.js';
import * as V from './views.js';
import * as P from './plan.js';
import * as O from './overlays.js';
import * as WB from './wishbox.js';
import { wishboxHtml, revealHtml } from './wbviews.js';
import { rupee, COPY, DEMO, SCOOTY } from './data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = document.getElementById('app');

// =========================================================== layout builders
function chatColumn(kind) {
  // kind: 'setup' | 'wide' | 'plan'
  const msgs = V.messagesHtml();
  let top = '', foot = '';
  if (kind === 'setup') top = V.chatHeader({ invite:false }) + `<p class="chat-sub">${party() > 1 ? 'Plan together with your travel group.' : 'Tell Cleartrip AI where you want to go.'}</p>`;
  if (kind === 'wide') top = V.chatHeader() + V.travellerChips() + V.requestBar();
  if (kind === 'plan') { top = P.planChatHeader(); foot = P.quickActions(); }
  const ph = kind === 'plan' ? 'Ask about your trip…' : state.stage === 'building' ? 'Add a preference…' : 'Add a preference or ask a question…';
  const building = state.stage === 'building' ? V.buildingCard() : '';
  return `<aside class="col-chat col-chat-${kind}" aria-label="Chat">
    <div class="chat-top">${top}</div>
    <div class="chat-scroll" id="chat-scroll" role="log" aria-label="Conversation">${msgs}${building}</div>
    <button class="new-msg" id="new-msg" hidden data-act="scroll-chat">New message ${icon('down', '', 16)}</button>
    <div class="chat-foot">${foot}${V.composerHtml(ph)}</div>
  </aside>`;
}
function mseg(lbl2 = 'Plan') {
  const t = state.ui.mtab;
  const dot = state.stage === 'building' ? '<i class="dot"></i>' : '';
  return `<div class="mseg" role="tablist" aria-label="Chat or plan"><button role="tab" aria-selected="${t === 'chat'}" class="${t === 'chat' ? 'is-on' : ''}" data-act="set-mtab" data-v="chat">Chat</button><button role="tab" aria-selected="${t === 'plan'}" class="${t === 'plan' ? 'is-on' : ''}" data-act="set-mtab" data-v="plan">${lbl2} ${dot}</button></div>`;
}
function demoHtml() {
  const open = transient.demoOpen;
  return `<div class="demo ${open ? 'is-open' : ''}">
    <button class="demo-btn" data-act="demo-toggle" aria-expanded="${open}" aria-controls="demo-panel">${icon('settings', '', 16)} Demo</button>
    <div class="demo-panel" id="demo-panel" ${open ? '' : 'hidden'} role="group" aria-label="Demo controls">
      <h2>Demo controls</h2><p>For testing only. Not part of the customer UI.</p>
      <fieldset><legend>Act as traveller</legend>${state.travellers.map(t => `<label class="radio"><input type="radio" name="actas" value="${t.id}" data-demo-act ${state.ui.actingAs === t.id ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')}</fieldset>
      <button class="dm" data-act="demo-reset-optional">Main journey reset (undo optional edits)</button>
      <button class="dm" data-act="demo-price" ${state.plan ? '' : 'disabled'}>Trigger price change</button>
      <button class="dm" data-act="demo-nomatch">Trigger no results</button>
      <button class="dm" data-act="demo-error">Trigger connection failure</button>
      <label class="radio"><input type="checkbox" data-demo-reduce ${state.ui.reduced ? 'checked' : ''}> Reduced motion</label>
      ${(state.stage === 'wishbox' || state.stage === 'reveal') ? `<fieldset><legend>Wishbox testing</legend><button class="dm" data-act="wb-demo-seed" data-n="3">Add 3 sample wishes</button><button class="dm" data-act="wb-demo-seed" data-n="10">Add 10 sample wishes</button><button class="dm" data-act="wb-demo-seed" data-n="20">Add 20 sample wishes</button><button class="dm" data-act="wb-demo-fail">Make AI grouping fail once</button><button class="dm" data-act="wb-demo-clearcap">Clear this member's cap</button><button class="dm danger" data-act="wb-demo-reset">Clear Wishbox</button></fieldset>` : ''}
      <button class="dm danger" data-act="demo-reset">Reset demo…</button></div></div>`;
}

function buildApp() {
  const phone = isPhone();
  const compact = phone || isTablet();     // chat becomes a Chat/Plan switch below 1024px
  const st = state.stage;
  const hdr = phone ? V.phoneBar({ back: st !== 'home' }) : V.hostHeader();
  if (st === 'home') return `<div class="shell">${hdr}<main id="main" class="home-main">${phone ? V.homePhone() : V.homeWeb()}</main>${phone ? V.bottomNav('home') : ''}</div>${demoHtml()}`;

  if (st === 'wishbox' || st === 'reveal') return `<div class="shell shell-wb">${hdr}<main id="main" class="planner wb-page" data-stage="${st}">${st === 'wishbox' ? wishboxHtml() : revealHtml()}</main></div>${demoHtml()}`;

  const title = compact ? `<div class="pl-head"><h1>Trip planner</h1>${mseg(st === 'setup' ? 'Plan' : 'Plan')}</div>` : '';
  let body = '';
  if (st === 'setup') {
    if (!compact) body = V.setupDesktop(); else {
    const chat = chatColumn('setup');
    const work = `<section class="col-work" aria-label="Group and trip">${V.setupWork()}</section><aside class="col-ph" aria-hidden="false">${V.emptyPlan()}</aside>`;
    body = state.ui.mtab === 'chat' ? chat : `<div class="work-only">${work}</div>`; }
  } else if (st === 'chat' || st === 'building') {
    const chat = chatColumn('wide');
    const pane = `<section class="col-pane" aria-label="Your plan">${recoveryPane() || V.widePlanPane()}</section>`;
    body = compact ? (state.ui.mtab === 'chat' ? chat : pane) : `<div class="layout layout-wide">${chat}${pane}</div>`;
  } else {
    const chat = chatColumn('plan');
    const rp = recoveryPane();
    const ws = rp || (st === 'checkout' ? P.checkoutHtml() : st === 'handoff' ? P.handoffHtml() : P.workspaceHtml());
    const pane = `<section class="col-ws ${rp ? 'is-recovery' : ''} ${st !== 'plan' ? 'is-co' : ''}" aria-label="Plan workspace">${ws}</section>`;
    body = compact ? (state.ui.mtab === 'chat' ? chat : pane) : `<div class="layout layout-plan">${chat}${pane}</div>`;
  }
  return `<div class="shell shell-${st}">${hdr}${title}<main id="main" class="planner" data-stage="${st}">${body}</main></div>${demoHtml()}`;
}
function recoveryPane() {
  const r = state.recovery;
  if (!r) return '';
  if (r.type === 'nomatch') return P.noMatchHtml();
  if (r.type === 'error') return P.errorHtml();
  return '';
}

// =========================================================== render
let lastStage = null, lastBp = '', prevAmts = {}, prevMsgCount = 0;
const bp = () => (isPhone() ? 'p' : isTablet() ? 't' : 'w');

function captureFocus() {
  const a = document.activeElement;
  if (!a || !app.contains(a)) return null;
  const sel = selectorFor(a);
  if (!sel) return null;
  const info = { sel };
  if (a.tagName === 'TEXTAREA') { info.s = a.selectionStart; info.e = a.selectionEnd; }
  return info;
}
function restoreFocus(f) {
  if (!f) return;
  const n = $(f.sel);
  if (n) { n.focus({ preventScroll:true }); if (f.s != null) try { n.setSelectionRange(f.s, f.e); } catch {} }
}

function render() {
  WB.onTripChanged();
  const focus = captureFocus();
  const chat = $('#chat-scroll');
  const near = chat ? chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80 : true;
  const sc = { ws: $('.ws-scroll')?.scrollTop || 0, chat: chat ? chat.scrollTop : 0, win: window.scrollY, work: $('.setup-work')?.scrollTop || 0, pane: $('.col-pane')?.scrollTop || 0 };
  if (chat) { transient.chatScroll = chat.scrollTop; transient.chatNear = near; }
  const stageChanged = lastStage !== null && lastStage !== state.stage;
  const bpChanged = lastBp && lastBp !== bp();
  app.innerHTML = buildApp();
  if (stageChanged || bpChanged) { const m = $('#main'); if (m && !reduced()) { m.classList.add('enter'); } }
  const nc = $('#chat-scroll');
  const count = state.messages.length + (transient.typing ? 1 : 0) + (state.stage === 'building' ? 1 : 0);
  if (nc) {
    if (!chat && !stageChanged && !bpChanged) {
      // the chat panel was hidden (Chat/Plan switch): restore where the reader was
      nc.scrollTop = transient.chatNear === false ? (transient.chatScroll || 0) : nc.scrollHeight;
    } else if (stageChanged || bpChanged || near || prevMsgCount === 0) nc.scrollTop = nc.scrollHeight;
    else { nc.scrollTop = sc.chat; if (count > prevMsgCount) { const p = $('#new-msg'); if (p) p.hidden = false; } }
  }
  prevMsgCount = count;
  const wsEl = $('.ws-scroll'); if (wsEl && !stageChanged) wsEl.scrollTop = sc.ws;
  if (!stageChanged) { const pn = $('.col-pane'); if (pn) pn.scrollTop = sc.pane; }
  mountGroup();
  WB.afterRender();
  restoreFocus(focus);
  animateAmounts();
  lastStage = state.stage; lastBp = bp();
  if (state.stage === 'plan' && !transient.routeSeen) setTimeout(() => { transient.routeSeen = true; }, 50);
  if (!reduced()) {
    const last = state.messages[state.messages.length - 1];
    if (last && last.from === 'ai' && last.id !== transient.lastAnnounced) { transient.lastAnnounced = last.id; announce(last.text); }
  }
}
function mountGroup() {
  const m = $('#cg-mount');
  if (!m) return;
  const id = transient.joinAnim; transient.joinAnim = null;
  renderGroup(m, state.travellers, { animateId: id, joined: true });
  if (id) {
    announce(`${S.nameOf(id)} joined the group.`);
    if (party() > 4) setTimeout(() => { const g = $(`[data-act="edit-traveller"][data-id="${id}"]`, m); g && g.scrollIntoView({ inline:'center', block:'nearest', behavior: reduced() ? 'auto' : 'smooth' }); }, 60);
  }
}
function animateAmounts() {
  const now = {};
  for (const el of $$('.amt')) {
    const k = el.dataset.amt, v = el.dataset.v;
    now[k] = v;
    if (prevAmts[k] != null && prevAmts[k] !== v && !reduced()) {
      el.classList.add('amt-flip');
      if (el.classList.contains('cell')) el.classList.add('amt-hl');
    }
  }
  prevAmts = now;
}
subscribe(() => {
  render();
  if (overlayOpen() && transient.sheetType) { /* sheet body refresh is handled where drafts change */ }
});

// =========================================================== draft editor helpers
const baseFor = S.baseFor, isDirty = S.isDirty;
const LABELS = { meals:'meals', transport:'local transport', stay:'stay', timefix:'the timing fix' };
function guard(next) {
  if (transient.pending && isDirty()) { O.showUnsaved(LABELS[transient.pending.type]); transient.afterGuard = next; return false; }
  clearPending(); next(); return true;
}
function clearPending() {
  transient.pending = null;
  if (overlayOpen() && transient.sheetType) { transient.sheetType = null; closeOverlay(true); }
}
function startEdit(type, day) {
  const d = day || state.ui.selectedDay;
  if (type === 'stay' || type === 'meals' || type === 'transport' || type === 'timefix') {
    transient.pending = { type, day: d, draft: baseFor(type, d), dirty: false };
    if (type === 'stay') { /* stay changes affect all nights */ }
  }
  state.ui.panel = { type, day: d };
  state.ui.selectedDay = d;
  if (isPhone()) openSheet(type);
  else { notify(); focusPanel(); }
}
function openSheet(type) {
  transient.sheetType = type;
  const box = openOverlay({ kind:'sheet', title: P.SHEET_TYPES[type], body: P.panelBody(type), labelledBy:'sh-title', wide:true, onClose: () => { if (transient.sheetType) { transient.sheetType = null; transient.pending = null; if (state.ui.panel.type !== 'day') state.ui.panel = { type:'day' }; notify(); } } });
  notify();
}
function refreshSheet(keep) {
  if (isPhone() && transient.sheetType) {
    updateOverlayBody(P.panelBody(transient.sheetType));
    if (keep) { const n = $(keep); n && n.focus({ preventScroll:true }); }
  } else { notify(); if (keep) setTimeout(() => { const n = $(keep); n && n.focus({ preventScroll:true }); }, 0); }
}
function focusPanel() { setTimeout(() => { const h = $('#rp-h'); if (h) { h.focus({ preventScroll:true }); h.scrollIntoView({ block:'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } }, 30); }
function closeEditor(focusSel) {
  transient.pending = null; state.ui.panel = { type:'day' };
  if (overlayOpen() && transient.sheetType) { transient.sheetType = null; closeOverlay(true); }
  notify();
  setTimeout(() => { const n = focusSel && $(focusSel); if (n) n.focus({ preventScroll:true }); }, 50);
}
function applied(label, undoLabel, focusSel) {
  closeEditor(focusSel);
  toast(label, { action:'Undo', onAction: () => doUndo() });
}
function doUndo() {
  if (transient.pending) { toast('Apply or cancel the edit in progress first.'); return; }
  const l = undoLast();
  if (l) { toast(`Undone: ${l}`); announce(`Undone: ${l}`); }
}

// =========================================================== chat handling
function sendChat(text) {
  const t = text.trim(); if (!t) return;
  state.ui.draft = '';
  pushMessage({ from: acting().id, text: t });
  const low = t.toLowerCase();
  if (state.stage === 'setup') { aiSay('Add your friends and set the trip above, then press Plan my trip. I\'ll ask a couple of quick questions.', {}, 700); return; }
  if (/heritage|sunrise/.test(low) && state.stage === 'chat' && !state.vibe) { S.chooseVibe('heritage'); return; }
  if (/hills|chill/.test(low) && state.stage === 'chat' && !state.vibe) { S.chooseVibe('hills'); return; }
  if (/beach/.test(low) && state.stage === 'chat' && !state.vibe) { S.chooseVibe('beach'); return; }
  const m = low.match(/(\d[\d,]{3,})/);
  if (m && /reduce|budget|under|max|cap|spend/.test(low)) {
    const n = Number(m[1].replace(/,/g, ''));
    if (n > 0) {
      setTrip({ budget: n });
      if (n < 10200) { aiSay(`I'll try ${rupee(n)} per person.`, {}, 500); later(() => S.startBuild(), 1300); }
      else aiSay(`Noted: ${rupee(n)} per person. Your saved plan stays as it is. Press Plan my trip to re-plan if you want.`, {}, 600);
      return;
    }
  }
  if (state.stage === 'plan' && state.plan) {
    if (/cheap|save|less/.test(low)) { aiSay('I found a cheaper stay. Here is the comparison. Nothing changes until you apply it.', {}, 700); later(() => startEdit('stay'), 800); return; }
    if (/scooty|scooter|bike/.test(low)) { aiSay('Here is the Day 2 scooty option with cost and time. Nothing changes until you add it.', {}, 700); later(() => startEdit('transport', 2), 800); return; }
    if (/day 2|crowd|packed|too much|comfortable/.test(low)) { aiSay('Day 2 has 11 h planned and 8 h 30 m available. I can move Anjanadri Hill to Day 3. Here is the preview.', {}, 700); later(() => startEdit('timefix', 2), 800); return; }
    if (/dinner|lunch|meal/.test(low)) { aiSay('Here are the meals for this day. Breakfast is already included in the stay.', {}, 700); later(() => startEdit('meals'), 800); return; }
    if (/why/.test(low)) { aiSay('Here are my reasons and the trade-off.', {}, 600); later(() => openWhy(), 700); return; }
  }
  aiSay(COPY.help, {}, 700);
}
function openWhy() { guard(() => { state.ui.panel = { type:'why' }; if (isPhone()) openSheet('why'); else { notify(); focusPanel(); } }); }

// =========================================================== actions
const A = {
  'host-stub': () => toast('That part of Cleartrip is not included in this prototype.', { ms: 2500 }),
  'go-home': () => { if (state.stage !== 'home') { state.resume = state.stage; } state.stage = 'home'; S.cancelTimers(); notify(); window.scrollTo(0, 0); },
  'planner-back': () => A['go-home'](),
  'open-planner': () => {
    const target = state.resume && state.resume !== 'home' ? state.resume : 'setup';
    state.stage = target; state.resume = null;
    if (target === 'setup' && !state.messages.length) pushMessage({ from:'ai', text: COPY.aiIntro });
    state.ui.mtab = target === 'setup' ? 'plan' : state.plan ? 'plan' : 'chat';
    notify(); window.scrollTo(0, 0);
  },
  'set-mtab': el => { state.ui.mtab = el.dataset.v; notify(); },
  'add-friend': () => O.showAddFriend(),
  'edit-traveller': el => O.showEditTraveller(el.dataset.id),
  'ask-remove': el => O.showConfirmRemove(el.dataset.id),
  'confirm-remove': async el => {
    const id = el.dataset.id; const name = S.nameOf(id);
    closeOverlay(true);
    const mount = $('#cg-mount');
    if (mount) await playLeave(mount, id);
    S.removeTraveller(id);
    announce(`${name} was removed from the group.`);
  },
  'open-invite': () => O.showInvite(),
  'invite-preview': el => { S.inviteReady(el.dataset.id); updateOverlayBody(O.inviteBody()); },
  'join-as': el => { const id = el.dataset.id; S.joinAs(id); updateOverlayBody(O.inviteBody()); announce(`${S.nameOf(id)} joined the plan. Joining is not approval.`); },
  'copy-link': async () => {
    const link = `https://cleartrip.example/plan/${DEMO.destination.toLowerCase()}-${(state.planVersion || 1)}-demo`;
    const out = $('#copy-res');
    try { await navigator.clipboard.writeText(link); out.innerHTML = `<span class="ok">${icon('check', '', 16)} Link copied</span>`; announce('Link copied'); }
    catch { out.innerHTML = `<label class="field"><span>Copy didn't work. Select this link and copy it yourself.</span><input readonly value="${link}" onfocus="this.select()" data-autofocus></label>`; announce('Copy failed. A selectable link is shown instead.'); const i = out.querySelector('input'); i && i.focus(); i && i.select(); }
  },
  'edit-capsule': el => O.showCapsule(el.dataset.field, el),
  'assist-chip': el => { sendChat(el.dataset.text); },
  'plan-trip': () => {
    if (transient.notes && transient.notes.trim()) { pushMessage({ from: 't1', text: transient.notes.trim() }); transient.notes = ''; }
    const e = $('#cap-err');
    const t = state.trip;
    const errs = [validateTrip('dest', t.dest), validateTrip('dates', [t.start, t.end]), validateTrip('budget', t.budget)].filter(Boolean);
    if (errs.length) { if (e) e.textContent = errs[0]; return; }
    S.submitRequest(); state.ui.mtab = 'chat'; notify();
  },
  'use-demo': () => { S.setTrip({ dest:DEMO.destination, start:DEMO.start, end:DEMO.end }); S.submitRequest({ echo:false }); },
  'choose-vibe': el => S.chooseVibe(el.dataset.id),
  'cancel-build': () => { S.cancelBuild(); state.ui.mtab = 'chat'; notify(); },
  'retry-build': () => { S.retryBuild(); },
  'edit-trip': () => { S.cancelTimers(); state.recovery = null; state.stage = 'setup'; state.ui.mtab = 'plan'; notify(); },
  'scroll-chat': () => { const c = $('#chat-scroll'); if (c) c.scrollTop = c.scrollHeight; const p = $('#new-msg'); if (p) p.hidden = true; },
  'toggle-details': () => { state.ui.detailsOpen = !state.ui.detailsOpen; notify(); },
  'set-group': el => { state.ui.group = el.dataset.v === '1'; notify(); },
  'dismiss-share': () => { transient.shareBanner = false; notify(); },

  // ---- plan navigation and editors ----
  'select-day': el => {
    const day = +el.dataset.day;
    if (day === state.ui.selectedDay && state.ui.panel.type === 'day') return;
    guard(() => { state.ui.selectedDay = day; state.ui.panel = { type:'day' }; notify(); if (isPhone()) setTimeout(() => $(`.stop[data-day="${day}"]`)?.scrollIntoView({ inline:'nearest', block:'nearest', behavior:'auto' }), 0); });
  },
  'back-to-day': () => guard(() => { state.ui.panel = { type:'day' }; notify(); }),
  'open-expense': el => { const kind = el.dataset.kind, day = +el.dataset.day || state.ui.selectedDay; guard(() => startEdit(kind, day)); },
  'why-plan': () => openWhy(),
  'qa-cheaper': () => { pushMessage({ from: acting().id, text:'Make it cheaper' }); aiSay('Here is a cheaper stay and what it does to the total. Nothing changes until you apply it.', {}, 600); later(() => guard(() => startEdit('stay')), 700); },
  'qa-day2': () => { pushMessage({ from: acting().id, text:'Explain Day 2' }); const t = S.dayTiming(state.plan, 2); aiSay(t.fits ? `Day 2 fits: ${hmTxt(t.planned)} planned of ${hmTxt(t.available)} available.` : `Day 2 needs ${hmTxt(t.planned)} but only ${hmTxt(t.available)} are available once lunch and a buffer are set aside. I can move Anjanadri Hill to Day 3.`, {}, 600); later(() => guard(() => { state.ui.selectedDay = 2; state.ui.panel = { type:'day' }; notify(); focusPanel(); }), 700); },
  'keep-anyway': el => { state.ui.kept = state.ui.kept || {}; state.ui.kept[+el.dataset.day] = true; notify(); toast('Kept as is. The day stays marked as overpacked.', { ms: 3000 }); },
  'pick-stay': el => { transient.pending.draft = { stay: el.dataset.v }; refreshSheet(`[data-act="pick-stay"][data-v="${el.dataset.v}"]`); },
  'pick-transport': el => { transient.pending.draft = { scooty: el.dataset.v === 'scooty' }; refreshSheet(`[data-act="pick-transport"][data-v="${el.dataset.v}"]`); },
  'cancel-edit': () => closeEditor('.exp.is-sel, .stop.is-on'),
  'apply-timefix': () => { mutatePlan('Move Anjanadri Hill to Day 3', p => { p.anj = 3; }); applied('Moved to Day 3. Day 2 now fits.', '', '.stop.is-on'); announce('Anjanadri Hill moved to Day 3. Day 2 now takes 7 hours 45 minutes with 45 minutes spare.'); },
  'apply-stay': () => {
    const v = transient.pending.draft.stay;
    mutatePlan('Change stay', p => { p.stay = v; });
    if (state.recovery && state.recovery.type === 'price' && state.recovery.stay !== v) { state.recovery = null; }
    applied(`Stay updated to ${v === 'boulder' ? 'Boulder View' : 'Riverside Courtyard'}. All 3 nights changed.`, '', '.stop.is-on');
  },
  'apply-meals': () => { const p0 = transient.pending; const d = p0.day, draft = p0.draft; mutatePlan('Change meals', p => { p.meals[d] = { ...draft }; }); applied('Meals updated.', '', '.stop.is-on'); },
  'apply-transport': () => { const sc = transient.pending.draft.scooty; mutatePlan(sc ? 'Add scooty for Day 2' : 'Use local autos on Day 2', p => { p.scooty = sc; }); applied(sc ? 'Scooty added for Day 2.' : 'Back to local autos on Day 2.', '', '.stop.is-on'); },
  'undo-last': () => doUndo(),
  'unsaved-apply': () => {
    closeOverlay(true);
    const p = transient.pending; const map = { stay:'apply-stay', meals:'apply-meals', transport:'apply-transport', timefix:'apply-timefix' };
    const next = transient.afterGuard; transient.afterGuard = null;
    A[map[p.type]](); if (next) next();
  },
  'unsaved-discard': () => { closeOverlay(true); const next = transient.afterGuard; transient.afterGuard = null; clearPending(); state.ui.panel = { type:'day' }; if (next) next(); else notify(); },
  'unsaved-keep': () => { closeOverlay(true); transient.afterGuard = null; setTimeout(() => $('#rp-h, .ov-title')?.focus(), 30); },

  // ---- sharing and approvals ----
  'share': () => { S.share(); transient.shareBanner = true; state.ui.panel = { type:'approvals' }; if (isPhone()) { state.ui.panel = { type:'approvals' }; } notify(); announce('Plan shared. Approvals are pending.'); focusPanel(); },
  'share-approve': () => { S.share(); const r = S.approve(acting().id); transient.shareBanner = true; state.ui.panel = { type:'approvals' }; notify(); if (!r.ok) toast(r.reason, { ms: 4000 }); focusPanel(); },
  'open-approvals': () => guard(() => { state.ui.panel = { type:'approvals' }; notify(); focusPanel(); }),
  'approve-me': () => {
    const r = S.approve(acting().id);
    if (!r.ok) { toast(r.reason, { ms: 4500 }); return; }
    announce(`${acting().name} approved version ${state.planVersion}.`);
    if (allApproved() && breaches().length === 0) { state.ui.panel = { type:'final' }; announce('Everyone approved. Review and book is now available.'); }
    notify();
  },
  'review-book': () => {
    if (!canBook()) { toast(S.bookBlockers()[0] || 'Waiting for group approval.', { ms: 3500 }); return; }
    state.stage = 'checkout'; state.ui.mtab = 'plan'; notify(); window.scrollTo(0, 0);
  },
  'back-to-plan': () => { state.stage = 'plan'; if (state.recovery && state.recovery.type !== 'price') state.recovery = null; state.ui.mtab = 'plan'; notify(); },
  'to-handoff': () => { state.stage = 'handoff'; notify(); window.scrollTo(0, 0); },
  'open-placeholder': () => O.showCheckoutPlaceholder(),
  'close-placeholder': () => { closeOverlay(); state.stage = 'plan'; notify(); },

  // ---- recovery ----
  'price-alt': () => guard(() => startEdit('stay')),
  'price-review': () => { state.recovery.resolved = true; notify(); announce('New price accepted. The group must approve again before checkout.'); toast('New price accepted. Share the update for fresh approval.', { ms: 4500 }); },
  'nm-budget': () => { setTrip({ budget:10200 }); const had = !!state.plan; state.recovery = null; if (had) { state.stage = 'plan'; state.ui.mtab = 'plan'; notify(); toast('Budget set to ₹10,200. Your saved plan is unchanged.'); } else { S.startBuild(); } },
  'nm-dates': () => toast('This demo has sample plans for 14–17 Nov 2026 only. Nothing was changed.', { ms: 4000 }),
  'nm-prefs': () => { state.recovery = null; state.stage = state.plan ? 'plan' : 'chat'; if (!state.plan) pushMessage({ from:'ai', kind:'vibe', text:'Choose a trip vibe or change your trip details above.' }); state.ui.mtab = 'chat'; notify(); },

  // ---- demo controls ----
  'demo-toggle': () => { transient.demoOpen = !transient.demoOpen; notify(); },
  'demo-reset-optional': () => { if (!state.plan) return toast('Build a plan first.'); closeEditor(); S.resetOptionalChanges(); toast('Optional edits reset for the main walkthrough.'); },
  'demo-price': () => { if (!S.triggerPrice()) return; transient.demoOpen = false; if (isPhone()) openSheet('price'); else focusPanel(); },
  'demo-nomatch': () => { transient.demoOpen = false; S.triggerNoMatch(); },
  'demo-error': () => { transient.demoOpen = false; S.triggerError(); },
  'demo-reset': () => O.showConfirmReset(),
  'confirm-reset': () => { closeOverlay(true); clearToast(); S.resetAll(); lastStage = null; prevAmts = {}; transient.routeSeen = false; notify(); toast('Demo reset.'); },
};
Object.assign(A, WB.actions);
const hmTxt = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' m' : ''}`; };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.tagName === 'SELECT') return;
  if (el.closest('.ov') === null && overlayOpen() && el.closest('#app')) return;     // background is inert while an overlay is open
  const f = A[el.dataset.act];
  if (!f) return;
  if (el.tagName === 'A') e.preventDefault();
  f(el, e);
});

document.addEventListener('change', e => { const el = e.target.closest('select[data-act]'); if (el && A[el.dataset.act]) A[el.dataset.act](el, e); });
document.addEventListener('input', WB.onInput);
document.addEventListener('input', e => { if (e.target.matches('[data-notes]')) transient.notes = e.target.value; });

// forms ------------------------------------------------------------
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  const kind = f.dataset.form;
  const fd = new FormData(f);
  if (kind.startsWith('wb-') && WB.onSubmit(kind, fd, f)) return;
  if (kind === 'chat') { const ta = f.querySelector('textarea'); const v = ta.value; ta.value = ''; autosize(ta); sendChat(v); return; }
  if (kind === 'add-friend') {
    const name = (fd.get('name') || '').toString().trim(), style = fd.get('style') || 'male';
    const err = validateName(name);
    if (err) { O.showAddFriend({ name, style }, err); return; }
    closeOverlay();
    S.addTraveller({ name, style });
    return;
  }
  if (kind === 'edit-traveller') {
    const id = f.dataset.id; const t = traveller(id);
    const name = (fd.get('name') || '').toString().trim() || t.name, style = fd.get('style') || t.style;
    const capRaw = (fd.get('cap') || '').toString();
    const errs = {};
    const ne = validateName(name, id); if (ne) errs.name = ne;
    const ce = validateTrip('budget', capRaw); if (ce) errs.cap = ce;
    if (errs.name || errs.cap) { O.showEditTraveller(id, { name, style, cap:capRaw }, errs); return; }
    const toneChanged = style !== t.style;
    closeOverlay();
    S.updateTraveller(id, { name, style, cap: Number(capRaw.replace(/[₹,\s]/g, '')), });
    announce(`${name} updated.`);
    return;
  }
  if (kind === 'capsule') {
    const field = f.dataset.field;
    let err = '';
    if (field === 'dest') { const v = (fd.get('dest') || '').toString().trim(); err = validateTrip('dest', v); if (!err) { closeOverlay(); setTrip({ dest:v }); return; } }
    if (field === 'dates') { const s = fd.get('start'), en = fd.get('end'); err = validateTrip('dates', [s, en]); if (!err) { closeOverlay(); setTrip({ start:s, end:en }); return; } }
    if (field === 'budget') { const raw = (fd.get('budget') || '').toString(); err = validateTrip('budget', raw); if (!err) { closeOverlay(); setTrip({ budget:Number(raw.replace(/[₹,\s]/g, '')) }); return; } }
    const el = document.getElementById('cap-e'); if (el) el.textContent = err;
    const inp = f.querySelector('input'); inp && inp.setAttribute('aria-invalid', 'true');
  }
});
document.addEventListener('change', e => {
  const m = e.target.closest('[data-meal]');
  if (m && transient.pending) { transient.pending.draft = { ...transient.pending.draft, [m.dataset.meal]: m.checked }; transient.pending.dirty = isDirty(); refreshSheet(`[data-meal="${m.dataset.meal}"]`); return; }
  if (e.target.matches('[data-demo-act]')) { state.ui.actingAs = e.target.value; notify(); announce(`Now acting as ${acting().name}.`); return; }
  if (e.target.matches('[data-demo-reduce]')) { state.ui.reduced = e.target.checked; applyMotionPref(state.ui.reduced); notify(); return; }
  if (e.target.matches('.chars input[type=radio]')) { $$('.char-opt', e.target.closest('.chars')).forEach(l => l.classList.toggle('is-on', l.contains(e.target))); }
});
document.addEventListener('input', e => {
  if (e.target.matches('[data-draft]')) { state.ui.draft = e.target.value; try { localStorage.setItem('ct-planner-v2', JSON.stringify(state)); } catch {} autosize(e.target); }
});
function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; }
document.addEventListener('keydown', e => {
  if (e.target.matches && e.target.matches('textarea[data-draft]') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); return; }
  const stop = e.target.closest && e.target.closest('.stop');
  if (stop && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    const stops = $$('.stop'); const i = stops.indexOf(stop);
    let n = i;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = Math.max(0, i - 1);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = Math.min(stops.length - 1, i + 1);
    if (e.key === 'Home') n = 0; if (e.key === 'End') n = stops.length - 1;
    e.preventDefault(); stops[n].focus();
  }
  if (e.key === 'Escape' && transient.demoOpen && !overlayOpen()) { transient.demoOpen = false; notify(); }
});

// responsive: rebuild when crossing breakpoints and drop overlays that no longer fit
let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (lastBp && lastBp !== bp()) { if (overlayOpen()) { transient.sheetType = null; closeOverlay(true); } render(); } }, 120); });

// boot -------------------------------------------------------------
// Testing aid: ?jump=<state> loads a journey state directly (used for screenshots and QA; not shown in the UI).
function jumpTo(j) {
  const reset = S.resetAll; reset();
  const add = (name, style) => S.addTraveller({ name, style: style || 'male' });
  transient.joinAnim = null;
  const joinAll = () => state.travellers.forEach(t => { t.status = 'joined'; });
  if (j === 'home') return;
  if (j === 'solo') { state.stage = 'setup'; state.ui.mtab = 'plan'; return; }
  add('Srikant'); add('Prathmesh'); joinAll(); transient.joinAnim = null;
  state.messages = [];
  state.stage = 'setup'; state.ui.mtab = 'plan';
  if (['wishbox', 'review', 'shortlist', 'reveal', 'vote'].includes(j)) return WB.jump(j);
  if (j === 'setup') return;
  state.messages = [{ id:'a1', from:'ai', text:COPY.aiIntro, ts:Date.now() }, { id:'a2', from:'t1', text:'Hampi, 14–17 Nov. Around ₹12,000 each.', ts:Date.now() }, { id:'a3', from:'t3', text:'My max is ₹10,200.', ts:Date.now() }, { id:'a4', from:'ai', kind:'target', target:10200, text:COPY.gotTarget(10200), ts:Date.now() }, { id:'a5', from:'ai', kind:'vibe', text:COPY.askVibe, ts:Date.now() }];
  state.stage = 'chat'; state.ui.mtab = 'chat';
  if (j === 'chat') return;
  if (j === 'building') { state.messages.push({ id:'a6', from:'t1', text:'Heritage & sunrise sounds good.', ts:Date.now() }); state.vibe = 'heritage'; S.startBuild(); state.ui.mtab = 'chat'; transient.build = { step:2 }; S.cancelTimers(); state.stage = 'building'; transient.build = { step:2 }; return; }
  state.vibe = 'heritage';
  state.messages.push({ id:'a6', from:'t1', text:'Heritage & sunrise sounds good.', ts:Date.now() });
  S.startBuild(); S.cancelTimers();
  // build the plan directly
  state.plan = { stay:'riverside', scooty:false, anj:2, meals:{ 1:{lunch:true,dinner:true}, 2:{lunch:true,dinner:true}, 3:{lunch:true,dinner:true}, 4:{lunch:true,dinner:false} }, bump:null };
  state.planVersion = 1; state.stage = 'plan'; state.ui.mtab = 'plan'; state.ui.selectedDay = 2; state.ui.panel = { type:'day' };
  state.messages.push({ id:'a7', from:'ai', kind:'plan-ready', text:"Your Hampi plan is ready. It's ₹300 above Prathmesh's cap. I've found a cheaper stay if you'd like to swap.", ts:Date.now() });
  transient.build = null; transient.routeSeen = true;
  const edit = (t, d) => { transient.pending = { type:t, day:d || 2, draft:baseFor(t, d || 2), dirty:false }; state.ui.panel = { type:t, day:d || 2 }; };
  if (j === 'plan') return;
  if (j === 'why') { state.ui.panel = { type:'why' }; return; }
  if (j === 'timefix') return edit('timefix');
  if (j === 'meals') { edit('meals'); transient.pending.draft = { lunch:true, dinner:false }; return; }
  if (j === 'transport') { edit('transport'); transient.pending.draft = { scooty:true }; return; }
  if (j === 'stay') { edit('stay'); transient.pending.draft = { stay:'boulder' }; return; }
  state.plan.anj = 3;
  if (j === 'moved') return;
  state.plan.stay = 'boulder'; state.planVersion = 3;
  if (j === 'swapped') { state.sharedVersion = null; return; }
  S.share(); state.ui.panel = { type:'approvals' };
  if (j === 'shared') { state.plan.stay = 'riverside'; state.planVersion = 2; state.sharedVersion = 2; state.shareLog = [{ version:2, perPerson:10500 }]; state.ui.panel = { type:'approvals' }; state.approvals = { t1:2 }; return; }
  state.approvals = { t1:3 };
  if (j === 'approving') return;
  state.approvals = { t1:3, t2:3, t3:3 }; state.ui.panel = { type:'final' };
  if (j === 'approved') return;
  state.stage = 'checkout'; if (j === 'checkout') return;
  state.stage = 'handoff'; if (j === 'handoff') return;
  state.stage = 'plan'; state.ui.panel = { type:'day' };
  if (j === 'price') { S.triggerPrice(); state.ui.panel = { type:'price' }; return; }
  if (j === 'nomatch') { S.triggerNoMatch(); return; }
  if (j === 'error') { S.triggerError(); return; }
}
const jump = new URLSearchParams(location.search).get('jump');
if (jump) { jumpTo(jump); notify(); }
applyMotionPref(state.ui.reduced);
if (state.stage === 'building' && !jump) state.stage = state.plan ? 'plan' : 'chat';
render();
window.__app = { state, S, A, jump: j => { jumpTo(j); notify(); } };   // debugging / QA aid

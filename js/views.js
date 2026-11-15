// Host shell, home entry, setup (group + trip composer), chat and building views. Pure HTML builders; events are delegated in main.js.
import { state, transient, traveller, party, planningTarget, lowestCap, fmtRange, perPerson, breaches, isApproved, planStatus } from './store.js';
import { esc, icon, isPhone } from './ui.js';
import { avatar } from './characters.js';
import { canAdd } from './looks.js';
import { entryCard } from './wishbox.js';
import { entryLink } from './discover.js';
import { img, VIBES, COPY, rupee } from './data.js';

const fmtTime = ts => ts ? new Date(ts).toLocaleTimeString('en-IN', { hour:'numeric', minute:'2-digit' }).toUpperCase() : '';

// ------------------------------------------------------------------ host chrome
export const logo = () => `<a class="logo" href="#" data-act="go-home" aria-label="Cleartrip home">cleartrip</a>`;

export function hostHeader() {
  const inPlanner = state.stage !== 'home';
  return `<header class="host"><div class="host-in">
    ${logo()}
    <nav class="host-tabs" aria-label="Cleartrip services">
      <button class="htab ${inPlanner ? '' : 'is-on'}" data-act="host-stub">${icon('plane')}<span>Flights</span></button>
      <button class="htab" data-act="host-stub">${icon('bed')}<span>Hotels</span></button>
      <button class="htab" data-act="host-stub">${icon('bus')}<span>Buses</span></button>
      <button class="htab" data-act="host-stub">${icon('palm')}<span>Holidays</span></button>
      <button class="htab htab-ai ${inPlanner ? 'is-on' : ''}" data-act="open-planner" ${inPlanner ? 'aria-current="page"' : ''}>${icon('sparkle')}<span>Trip planner</span><b class="new-badge">NEW</b></button>
    </nav>
    <nav class="host-util" aria-label="Account">
      <button class="hutil" data-act="host-stub">${icon('tag')}<span>Offers</span></button>
      <button class="hutil" data-act="host-stub">${icon('case')}<span>Business</span></button>
      <button class="hutil" data-act="host-stub">${icon('cal')}<span>My Trips</span></button>
      <button class="hutil" data-act="host-stub">${icon('help')}<span>Support</span></button>
      <button class="hprofile" data-act="host-stub" aria-label="Account">${icon('user')}</button>
    </nav>
  </div></header>`;
}

export function phoneBar({ back = false, title = '' } = {}) {
  return `<header class="pbar">
    ${back ? `<button class="icon-btn" data-act="planner-back" aria-label="Back to Cleartrip home">${icon('back', '', 22)}</button>` : ''}
    ${logo()}
    <span class="pbar-sp"></span>
    ${back ? '' : `<button class="icon-btn pbar-user" data-act="host-stub" aria-label="Account">${icon('user')}</button>`}
  </header>`;
}

export function bottomNav(active = 'home') {
  const it = (k, ic, l) => `<button class="bn-i ${active === k ? 'is-on' : ''}" data-act="${k === 'planner' ? 'open-planner' : k === 'home' ? 'go-home' : 'host-stub'}" ${active === k ? 'aria-current="page"' : ''}>${icon(ic, '', 22)}<span>${l}</span></button>`;
  return `<nav class="bnav" aria-label="Cleartrip">${it('home', 'home', 'Home')}${it('offers', 'tag', 'Offers')}${it('planner', 'sparkle', 'Trip planner')}${it('trips', 'case', 'My Trips')}${it('support', 'headset', 'Support')}</nav>`;
}

// ------------------------------------------------------------------ home
export function homeWeb() {
  return `<div class="home-web">
    <div class="home-wrap">
      <h1 class="home-h1">Book Domestic &amp; International<br>Flight Tickets</h1>
      <div class="home-opts"><div class="seg2"><button class="is-on" data-act="host-stub">One way</button><button data-act="host-stub">Round trip</button></div><span class="home-pax">${icon('user')} 1 Adult, Economy ${icon('down', '', 16)}</span></div>
      <div class="search-card" role="group" aria-label="Flight search (not part of this prototype)">
        <div class="sf"><span>${icon('pin')}</span><div><small>From</small><b>Bengaluru (BLR)</b></div></div>
        <button class="swap" data-act="host-stub" aria-label="Swap">${icon('arrowup', '', 18)}</button>
        <div class="sf"><span>${icon('pin')}</span><div><small>To</small><b>Goa (GOI)</b></div></div>
        <div class="sf"><span>${icon('cal')}</span><div><small>Departure</small><b>20 Nov, Thu</b></div></div>
        <div class="sf"><span>${icon('cal')}</span><div><small>Return</small><b class="muted">Add return date</b></div></div>
        <button class="btn btn-primary" data-act="host-stub">Search flights</button>
      </div>
      <div class="entry-card" data-hero>
        <span class="entry-ic">${icon('sparkle', '', 24)}</span>
        <div class="entry-t"><b>Trip planner <i class="new-badge">NEW</i></b><span>One conversation for travel, stays and your group's budget.</span></div>
        <button class="btn btn-primary" data-act="open-planner">Plan with AI ${icon('fwd', '', 18)}</button>
      </div>
      <section class="dest" aria-labelledby="pd"><h2 id="pd">Popular destinations</h2><p class="sub">Handpicked places for your next trip</p>
        <div class="dest-grid">${[['city_goa', 'Goa', 'Beaches · Nightlife · Relaxation'], ['city_delhi', 'Delhi', 'History · Food · Culture'], ['city_mumbai', 'Mumbai', 'City life · Shopping · Heritage'], ['city_jaipur', 'Jaipur', 'Palaces · Heritage · Culture']].map(([i, n, s]) => `<button class="dest-card" data-act="host-stub"><img src="${img(i)}" alt="" loading="lazy"><span class="dest-b"><b>${n}</b><small>${s}</small></span>${icon('right', '', 18)}</button>`).join('')}</div>
      </section>
      <p class="foot-note">Proposed integration for a concept prototype. Entry placement is a proposal, not a claim about the current Cleartrip app. ${esc('Demo plan · sample prices')}</p>
    </div></div>`;
}
export function homePhone() {
  const svc = [['svc_flights', 'Flights'], ['svc_hotels', 'Hotels'], ['svc_buses', 'Buses'], ['svc_holidays', 'Holidays']];
  return `<div class="home-phone">
    <h1 class="hp-h1">Where are you headed?</h1>
    <div class="svc-grid">${svc.map(([i, n]) => `<button class="svc" data-act="host-stub"><img src="${img(i)}" alt=""><b>${n}</b></button>`).join('')}</div>
    <button class="entry-card entry-phone" data-act="open-planner" data-hero>
      <span class="entry-ic">${icon('sparkle', '', 26)}</span>
      <span class="entry-t"><b>Trip planner <i class="new-badge">NEW</i></b><span>One plan for travel, stays and your budget.</span><em>Plan with AI ${icon('fwd', '', 18)}</em></span>
    </button>
    <h2 class="hp-h2">Offers for your next trip</h2>
    <div class="promo"><img src="${img('promo_places')}" alt=""><div class="promo-t"><b>Discover<br>new places</b><span>Plan your next getaway with Cleartrip.</span></div></div>
    <p class="foot-note">Proposed integration. ${esc('Demo plan · sample prices')}</p>
  </div>`;
}

// ------------------------------------------------------------------ small shared parts
export function capsule(field, label, value, { editable = true, accent = false } = {}) {
  return editable
    ? `<button class="cap ${accent ? 'cap-accent' : ''}" data-act="edit-capsule" data-field="${field}" aria-label="${esc(label)}: ${esc(value)}. Edit" aria-haspopup="dialog">${esc(value)} ${icon('down', '', 16)}</button>`
    : `<span class="cap cap-static">${esc(value)}</span>`;
}
export function stepper(step = 1) {
  const s = ['Group', 'Route', 'Stay', 'Plan'];
  return `<ol class="stepper" aria-label="Planning progress">${s.map((l, i) => `<li class="${i + 1 === step ? 'is-on' : i + 1 < step ? 'is-done' : ''}" ${i + 1 === step ? 'aria-current="step"' : ''}><span class="st-n">${i + 1}</span><span class="st-l">${l}</span></li>`).join('')}</ol>`;
}
export function travellerChips({ withCount = true } = {}) {
  const joined = state.travellers.filter(t => t.status === 'joined').length;
  return `<div class="trav-row">${state.travellers.map(t => `<span class="trav">${avatar(t, 40)}<b>${esc(t.name)}</b></span>`).join('')}
    ${withCount ? `<span class="trav-count">${icon('users', '', 18)} ${party()} traveller${party() === 1 ? '' : 's'} · ${joined === party() ? 'All joined' : `${joined} of ${party()} joined`}</span>` : ''}</div>`;
}

// ------------------------------------------------------------------ chat
function aiAvatar() { return `<span class="ai-av" aria-hidden="true">${icon('sparkle', '', 18)}</span>`; }
export function messageHtml(m, i, list) {
  if (m.from === 'system') return `<div class="msg-sys">${esc(m.text)}</div>`;
  const isAi = m.from === 'ai';
  const t = isAi ? null : traveller(m.from);
  const name = isAi ? 'AI planner' : (t ? t.name : 'Someone');
  const lastVibeIdx = list.map(x => x.kind).lastIndexOf('vibe');
  let extra = '';
  if (isAi && m.kind === 'target') extra = `<div class="chip-note">${icon('info', '', 16)} Planning target: ${rupee(m.target)} / person</div>`;
  if (isAi && m.kind === 'vibe' && i === lastVibeIdx && !state.vibe && state.stage !== 'building' && state.stage !== 'plan') {
    extra = `<div class="vibe-q"><h3>${COPY.askVibe}</h3><div class="vibes" role="group" aria-label="Trip vibe">${VIBES.map(v => `<button class="vibe" data-act="choose-vibe" data-id="${v.id}">${icon(v.icon, '', 20)}<span>${v.label}</span></button>`).join('')}</div><p class="hint">${COPY.vibeHint}</p></div>`;
  }
  if (isAi && m.kind === 'unsupported' && i === list.length - 1) {
    extra = `<div class="msg-actions"><button class="btn btn-primary btn-sm" data-act="use-demo">Explore the Hampi demo</button><button class="btn btn-secondary btn-sm" data-act="edit-capsule" data-field="dest">Adjust my request</button></div>`;
  }
  if (isAi && m.kind === 'plan-ready' && state.stage === 'plan' && i === list.length - 1) {
    extra = `<div class="msg-actions"><button class="btn btn-secondary btn-sm" data-act="why-plan">Why this plan?</button></div>`;
  }
  const mine = m.from === 't1';
  const activeVibe = isAi && m.kind === 'vibe' && extra.includes('vibe-q');
  return `<article class="msg ${isAi ? 'msg-ai' : ''} ${mine ? 'msg-me' : ''}" aria-label="${esc(name)}: ${esc(m.text)}">
    ${isAi ? aiAvatar() : avatar(t || { name:'?', tone:'srikant' }, 36)}
    <div class="msg-b"><div class="msg-n"><b>${esc(name)}</b>${m.ts ? `<time>${fmtTime(m.ts)}</time>` : ''}</div>${activeVibe ? '' : `<div class="bubble">${esc(m.text)}</div>`}${extra}</div></article>`;
}
export function messagesHtml() {
  const list = state.messages;
  const typing = transient.typing ? `<div class="msg msg-ai"><span class="ai-av" aria-hidden="true">${icon('sparkle', '', 18)}</span><div class="msg-b"><div class="bubble typing" role="status" aria-label="AI planner is typing"><i></i><i></i><i></i></div></div></div>` : '';
  return list.map((m, i) => messageHtml(m, i, list)).join('') + typing;
}
export function composerHtml(placeholder = 'Add a preference or ask a question…') {
  return `<form class="composer" data-form="chat" autocomplete="off">
    <label class="sr-only" for="chat-input">Message</label>
    <textarea id="chat-input" rows="1" placeholder="${esc(placeholder)}" data-draft enterkeyhint="send">${esc(state.ui.draft || '')}</textarea>
    <button class="send" type="submit" aria-label="Send message">${icon('send', '', 20)}</button></form>`;
}

// ------------------------------------------------------------------ setup (group + composer)
export function groupCard() {
  const joined = state.travellers.filter(t => t.status === 'joined').length;
  const full = !canAdd(state.travellers, 'male') && !canAdd(state.travellers, 'female');
  return `<section class="card group-card" aria-labelledby="gc-t">
    <div class="gc-top"><h2 id="gc-t" class="sr-only">Your group</h2>
      <div class="gc-polaroid" aria-hidden="false"><i class="gc-sheet" aria-hidden="true"></i>
        <div class="gc-pcard"><div class="gc-scene" id="cg-mount" data-mount="group"></div><p class="gc-cap" aria-hidden="true">${esc(state.trip.dest)}, together</p>
          <svg class="gc-stamp" viewBox="0 0 120 120" aria-hidden="true"><g fill="none" stroke="#E2531C" stroke-width="3"><circle cx="60" cy="60" r="55"/><circle cx="60" cy="60" r="47" stroke-width="1.5"/><path d="M50 52h20l-2-8H52zM53 44l2-8h10l2 8M47 52h26M44 76q4-4 8 0t8 0 8 0 8 0M44 83q4-4 8 0t8 0 8 0 8 0" stroke-linecap="round" stroke-linejoin="round"/></g><text x="60" y="68" text-anchor="middle" font-family="Inter,sans-serif" font-weight="800" font-size="17" letter-spacing="2" fill="#E2531C">${esc(state.trip.dest.toUpperCase().slice(0, 9))}</text></svg></div>
        <i class="gc-tape" aria-hidden="true"></i>
        <svg class="gc-spark" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4q2 12 6 14t10 2q-10 3-12 6t-4 10q-2-9-5-12t-11-4q9-2 12-6t4-10z" fill="none" stroke="#E2531C" stroke-width="2" stroke-linejoin="round"/><path d="M6 6l3 3M3 12l4 1M10 2l1 4" stroke="#E2531C" stroke-width="1.5" stroke-linecap="round"/></svg></div>
      <div class="gc-actions"><button class="btn btn-secondary" data-act="add-friend" ${full ? 'disabled aria-describedby="gc-full"' : ''}>${icon('plus', '', 18)} Add traveller</button>
      ${party() > 1 ? `<button class="btn btn-ghost" data-act="open-invite">${icon('userplus', '', 18)} Invite</button>` : ''}</div>
      <p class="gc-status" aria-live="polite">${full ? '<span id="gc-full">This demo has distinct characters for up to 8 travellers, so the group is full.</span> ' : ''}${party() === 1 ? 'Just you so far. Add the friends travelling with you.' : joined === party() ? 'Joined' : `${joined} of ${party()} joined · naming someone does not invite them`}</p>
    </div></section>`;
}
export function composerCard() {
  const t = state.trip;
  return `<section class="card compose-card" aria-labelledby="cc-t">
    <h2 id="cc-t">Let's plan your getaway</h2><p class="dc-compact">${entryLink()}</p>
    <p class="sentence" id="sentence">Take us to ${capsule('dest', 'Destination', t.dest)} from ${capsule('dates', 'Dates', fmtRange())} with ${capsule('budget', 'Budget per person', `${rupee(t.budget)} / person`, { accent:true })} to spend.</p>
    <div class="capsule-err" id="cap-err" role="alert"></div>
    <button class="btn btn-primary btn-block btn-lg" data-act="plan-trip">${icon('sparkle', '', 20)} Plan my trip</button>
  </section>`;
}
export function emptyPlan() {
  return `<section class="empty-plan" aria-live="polite"><img src="${img('map_empty')}" alt=""><h2>Your plan will appear here.</h2><p>Travel · Stays · Day-by-day plan</p></section>`;
}
export function setupWork() {
  return `<div class="setup-work">${stepper(1)}${groupCard()}${composerCard()}${entryCard()}</div>`;
}

// ------------------------------------------------------------------ chat/building (wide) screens
export function chatHeader({ invite = true } = {}) {
  return `<div class="chat-h"><h1 class="chat-title">${party() > 1 ? 'Plan together' : 'Plan your trip'}</h1>${invite && party() > 1 ? `<button class="link-btn" data-act="open-invite">${icon('userplus', '', 18)} Invite</button>` : ''}</div>`;
}
export function requestBar() {
  const t = state.trip;
  const ed = state.stage === 'chat';
  return `<div class="req"><b>Original request:</b>${capsule('dest', 'Destination', t.dest, { editable:ed })}${capsule('dates', 'Dates', fmtRange(), { editable:ed })}${capsule('budget', 'Budget per person', `${rupee(t.budget)} / person`, { editable:ed })}</div>`;
}
export function buildingCard() {
  const step = (transient.build && transient.build.step) || 0;
  const steps = COPY.planningStatus;
  return `<div class="building" role="status" aria-live="polite">
    <div class="b-head">${aiAvatar()}<div><h2>I'm putting your ${esc(state.trip.dest)} trip together.</h2><p>Checking what fits your time and ${party() > 1 ? "everyone's" : 'your'} budget.</p></div></div>
    <div class="chip-note chip-target">${icon('target', '', 16)} Planning target: ${rupee(planningTarget())}/person</div>
    <ol class="steps">${steps.map((s, i) => {
      const st = i < step ? 'done' : i === step ? 'run' : 'wait';
      const label = i === 3 ? `Checking the ${rupee(planningTarget())} budget target` : s;
      return `<li class="step ${st}"><span class="step-i" aria-hidden="true">${st === 'done' ? icon('check', '', 14) : ''}</span><span>${esc(label)}</span><span class="sr-only">${st === 'done' ? 'completed' : st === 'run' ? 'in progress' : 'pending'}</span></li>`;
    }).join('')}</ol>
    <p class="sim-note">Sample search counts are simulated.</p>
    <div class="b-foot"><span>You'll review the plan before anything is booked.</span><button class="link-btn" data-act="cancel-build">Stop planning</button></div></div>`;
}
export function skeletonPlan() {
  return `<section class="plan-skel" aria-label="Assembling your day-by-day plan" aria-busy="true">
    <h2>Assembling your <b>day-by-day</b> plan</h2>
    ${[0, 1, 2, 3, 4].map(i => `<div class="sk-row ${i === 0 ? 'sk-first' : ''}"><span class="sk-c"></span><span class="sk-l"><i></i><i></i></span></div>`).join('')}
  </section>`;
}
export function planStatusChip() {
  if (state.stage === 'building') return `<span class="status-chip is-building"><i class="dot"></i> Building…</span>`;
  if (state.stage === 'plan') return `<span class="status-chip">${icon('sparkle', '', 16)} ${planStatus() === 'shared' ? 'Shared draft' : 'Draft plan'}</span>`;
  return `<span class="status-chip">${icon('sparkle', '', 16)} Awaiting preferences</span>`;
}
export function widePlanPane() {
  const building = state.stage === 'building';
  return `<div class="wp-h"><h2>Your plan</h2>${planStatusChip()}</div>${building ? skeletonPlan() : `<div class="wp-empty"><img src="${img('map_empty')}" alt=""><h3>A little more about your trip</h3><p>Choose a vibe to start building your plan.</p><p class="trio">Travel · Stays · Day-by-day plan</p></div>`}`;
}

// ------------------------------------------------------------------ desktop setup: crew | getaway form | planning assistant
const field = (f, label, value, ic, extra = '') => `<div class="s2-f"><div class="s2-lr"><span class="s2-l" id="s2l-${f}">${label}</span>${extra}</div><button type="button" class="s2-field" data-act="edit-capsule" data-field="${f}" aria-labelledby="s2l-${f}" aria-haspopup="dialog">${icon(ic, '', 20)}<span>${esc(value)}</span>${icon('down', '', 18)}</button></div>`;
export function setupDesktop() {
  const t = state.trip, n = party();
  const msgs = messagesHtml();
  return `<div class="s2">
    <header class="s2-head"><div><h1>Your trip, your way.</h1><p>Go solo or bring friends. Let&rsquo;s plan.</p></div>${stepper(1)}</header>
    <div class="s2-grid">
      <section class="s2-card" aria-label="Group and trip">
        <div class="s2-crew"><h2>Your travel crew</h2><p class="s2-sub">${n} traveller${n === 1 ? '' : 's'}</p>${groupCard()}</div>
        <div class="s2-plan"><h2>Let's plan your getaway</h2>
          ${field('dest', 'Destination', t.dest, 'pin', entryLink())}
          ${entryCard(true)}
          <div class="s2-two">${field('dates', 'Dates', fmtRange(), 'cal')}${field('budget', 'Budget per person', rupee(t.budget), 'rupee')}</div>
          <div class="s2-f"><label class="s2-l" for="s2-notes">Anything we should know?</label><textarea id="s2-notes" rows="3" placeholder="A relaxed pace, local food, or must-see places..." data-notes>${esc(transient.notes || '')}</textarea></div>
          <div class="capsule-err" id="cap-err" role="alert"></div>
          <button class="btn btn-primary btn-block btn-lg" data-act="plan-trip">${icon('sparkle', '', 20)} Plan my trip</button>
          <p class="s2-hint">You can review and change every detail.</p></div>
      </section>
      <aside class="s2-assist col-chat" aria-label="Planning assistant">
        <div class="s2-ah"><span class="ai-av" aria-hidden="true">${icon('sparkle', '', 22)}</span><div><h2>Planning assistant</h2><p>Here when you need a hand</p></div></div>
        <div class="chat-scroll" id="chat-scroll" role="log" aria-label="Conversation">${msgs}</div>
        <div class="s2-chips" role="group" aria-label="Quick requests">${[['Keep it relaxed', 'user'], ['Find local experiences', 'tag'], ['Help with my budget', 'rupee']].map(([l, ic]) => `<button type="button" class="s2-chip" data-act="assist-chip" data-text="${esc(l)}">${icon(ic, '', 20)}<span>${l}</span></button>`).join('')}</div>
        <div class="chat-foot">${composerHtml('Ask or add a preference...')}</div>
      </aside>
    </div></div>`;
}
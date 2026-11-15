// Plan workspace: header, budget, connected day route, ONE contextual Review & edit panel, approvals, checkout, recovery.
import {
  state, transient, traveller, party, lowestCap, planningTarget, ledger, perPerson, breaches, dayTiming, clock,
  planStatus, isApproved, approvedCount, allApproved, canBook, bookBlockers, fmtRange, acting, stayNight, isDirty,
} from './store.js';
import { esc, icon, isPhone } from './ui.js';
import { avatar } from './characters.js';
import {
  img, DAYS, STAYS, PICKS, WHY, MEAL_PRICES, SCOOTY, NIGHT_LABELS, LOCAL_BASE, ANJANADRI, rupee, hm, hmShort,
} from './data.js';
import { messagesHtml, composerHtml, travellerChips, chatHeader } from './views.js';

const clonePlan = p => JSON.parse(JSON.stringify(p));
export const amt = (key, v, cls = '') => `<span class="amt ${cls}" data-amt="${key}" data-v="${v}">${rupee(v)}</span>`;
const money = v => (state.ui.group ? v * party() : v);

// ---------------------------------------------------------------- left column in the plan stage
export function planChatHeader() {
  return `<div class="pc-h"><h1 class="pc-t">${icon('sparkle', 'accent', 22)} <span>${party() > 1 ? 'Plan together' : 'Plan your trip'}<small>with Cleartrip AI</small></span></h1></div>
    <div class="pc-avs">${state.travellers.map(t => `<span class="pc-av">${avatar(t, 44)}<small>${esc(t.name)}</small></span>`).join('')}</div>`;
}
export function quickActions() {
  const open = state.ui.detailsOpen;
  return `<div class="pc-checked"><button class="disclose" data-act="toggle-details" aria-expanded="${open}">${icon('check', '', 18)} <span>Checked 14 stays · 3 buses · opening hours</span>${icon('down', 'chev', 18)}</button>
      <div class="disclose-body" ${open ? '' : 'hidden'}>Sample checks only. These counts come from a mock adapter, not live inventory.</div></div>
    <div class="qa-list">
      <button class="qa" data-act="qa-cheaper">${icon('rupee', '', 20)}<span>Make it cheaper</span>${icon('right', '', 18)}</button>
      <button class="qa" data-act="qa-day2">${icon('cal', '', 20)}<span>Explain Day 2</span>${icon('right', '', 18)}</button>
      <button class="qa" data-act="why-plan">${icon('info', '', 20)}<span>Why this plan?</span>${icon('right', '', 18)}</button>
    </div>`;
}

// ---------------------------------------------------------------- workspace header + budget
function membersStrip() {
  const shared = planStatus() === 'shared';
  return `<div class="ws-members">${state.travellers.map(t => {
    const ap = isApproved(t.id);
    const over = ledger() && perPerson() > t.cap;
    const mark = ap ? 'is-ap' : over ? 'is-over' : '';
    return `<span class="ws-m ${mark}">${avatar(t, 32)}<b>${esc(t.name)}</b>${shared ? `<i class="m-state">${ap ? 'Approved' : over ? 'Over cap' : 'Waiting'}</i>` : ''}</span>`;
  }).join('')}</div>`;
}
function wsHeader() {
  const L = ledger();
  const pp = L.perPerson;
  const shared = planStatus() === 'shared';
  const statusTxt = allApproved() ? 'Everyone approved' : shared ? `Shared draft · v${state.planVersion}` : 'Draft plan · No booking done';
  const statusIc = allApproved() ? 'check' : 'file';
  return `<header class="ws-h">
    <div class="ws-title">
      <h1>${esc(state.trip.dest)}, ${fmtRange()} <span class="ws-pill">${party()} traveller${party() === 1 ? '' : 's'}</span></h1>
      <div class="ws-meta">${membersStrip()}<span class="status-chip ${allApproved() ? 'is-ok' : ''}">${icon(statusIc, '', 16)} ${statusTxt}</span></div>
    </div>
    <div class="ws-price"><div class="big">${amt('total', money(pp))}</div><span class="per">${state.ui.group ? `group total · ${party()} travellers` : 'per person'}</span>
      <div class="seg2" role="group" aria-label="Show prices"><button class="${state.ui.group ? '' : 'is-on'}" data-act="set-group" data-v="0" aria-pressed="${!state.ui.group}">Per person</button><button class="${state.ui.group ? 'is-on' : ''}" data-act="set-group" data-v="1" aria-pressed="${state.ui.group}">Group</button></div></div>
  </header>`;
}
function budgetBanner() {
  const b = breaches();
  const pp = perPerson();
  const target = planningTarget();
  if (b.length) {
    const w = b[0];
    return `<div class="banner banner-warn" role="group" aria-label="Budget"><span class="bn-ic">${icon('target', '', 22)}</span>
      <div class="bn-t"><span>Budget target: ${rupee(target)}</span><b>${rupee(w.excess)} above ${esc(w.name)}'s budget</b>${b.length > 1 ? `<small>${b.length} travellers are over their caps</small>` : ''}</div>
      <button class="link-strong" data-act="open-expense" data-kind="stay" data-day="${state.ui.selectedDay}">See cheaper stay ${icon('fwd', '', 16)}</button></div>`;
  }
  return `<div class="banner banner-ok" role="group" aria-label="Budget"><span class="bn-ic">${icon('check', '', 22)}</span><div class="bn-t"><span>Budget target: ${rupee(target)}</span><b>Within everyone's budget · ${rupee(pp)} per person</b></div></div>`;
}
function costStrip() {
  const L = ledger();
  return `<div class="cost-strip" role="group" aria-label="Cost summary">
    <div class="cs main"><span>Trip cost</span><b>${amt('cs-total', money(L.perPerson), 'cell')}</b><small>${state.ui.group ? 'group' : 'per person'}</small></div>
    <div class="cs"><span>Stay</span><b>${amt('cs-stay', money(L.stay), 'cell')}</b></div>
    <div class="cs"><span>Transport</span><b>${amt('cs-tr', money(L.transport), 'cell')}</b></div>
    <div class="cs"><span>Meals</span><b>${amt('cs-meals', money(L.meals), 'cell')}</b></div>
    <div class="cs grp"><span>Group total</span><b>${amt('cs-group', L.group, 'cell')}</b><small>${party()} travellers</small></div></div>`;
}

// ---------------------------------------------------------------- route (day navigator, not a geographic map)
const ROUTE_WEB = { w:1000, h:224, pts:[[130, 92], [378, 126], [628, 98], [872, 130]] };
const ROUTE_PH = { w:360, h:262, pts:[[72, 58], [276, 62], [112, 160], [268, 186]] };
function pathFor(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
    const h = (x2 - x1) / 2;
    d += ` C${x1 + h},${y1} ${x2 - h},${y2} ${x2},${y2}`;
  }
  return d;
}
export function routeHtml() {
  const phone = isPhone();
  const R = phone ? ROUTE_PH : ROUTE_WEB;
  const L = ledger();
  const sel = state.ui.selectedDay;
  const reveal = !transient.routeSeen;
  const stops = DAYS.map((d, i) => {
    const [x, y] = R.pts[i];
    const t = dayTiming(state.plan, d.n);
    return `<button class="stop ${d.n === sel ? 'is-on' : ''} ${reveal ? 'reveal' : ''}" style="left:${(x / R.w) * 100}%;top:${(y / R.h) * 100}%;--i:${i}" data-act="select-day" data-day="${d.n}"
      ${d.n === sel ? 'aria-current="true"' : ''} aria-label="Day ${d.n}, ${d.short}, ${rupee(money(L.days[i].total))}${state.ui.group ? ' for the group' : ' per person'}${t.fits ? '' : ', overpacked'}">
      ${d.n === sel ? '<span class="sel-tag">Selected</span>' : ''}
      ${phone ? '' : `<img class="thumb" src="${img(d.img)}" alt="">`}
      <span class="ring"><i></i></span>
      <span class="lab"><b>Day ${d.n}</b><small>${d.short}</small>${amt('r' + d.n, money(L.days[i].total), 'cell')}${t.fits ? '' : `<em class="lab-warn">${icon('alert', '', 12)} Overpacked</em>`}</span></button>`;
  }).join('');
  return `<section class="route-sec" aria-labelledby="rt-h">
    <div class="rt-top"><div><h2 id="rt-h">Your trip, day by day</h2><p class="sub">Select a day to explore its plan</p></div>
      <button class="link-btn" data-act="why-plan">Why this plan? ${icon('down', '', 16)}</button></div>
    <div class="route ${reveal ? 'drawing' : ''}" data-route role="group" aria-label="Day navigator: four stops, Day 1 to Day 4. Not a map.">
      <img class="route-bg" src="${img('hampi_pano')}" alt="">
      <svg class="route-svg" viewBox="0 0 ${R.w} ${R.h}" aria-hidden="true" focusable="false"><path class="route-base" d="${pathFor(R.pts)}"/><path class="route-line" pathLength="1" d="${pathFor(R.pts)}"/></svg>
      ${stops}
    </div></section>`;
}

// ---------------------------------------------------------------- panels
const DAYTAG = { Bookable:'tag-b', Estimated:'tag-e', 'Partly bookable':'tag-b' };
const tagFor = (rows) => rows.some(r => r.kind === 'checkout') ? (rows.every(r => r.kind === 'checkout') ? 'Bookable' : 'Partly bookable') : 'Estimated';

function barFor(t) {
  const max = Math.max(t.available, t.planned);
  const pct = x => (x / max) * 100;
  const mk = (cls, v, lab) => v > 0 ? `<i class="seg-${cls}" style="width:${pct(v)}%" title="${lab}"></i>` : '';
  return `<div class="tbar" role="img" aria-label="${hm(t.planned)} planned of ${hm(t.available)} available">${mk('s', t.sights, 'Sights')}${mk('t', t.travel, 'Travel')}${mk('m', t.lunch, 'Lunch')}${mk('b', t.buffer, 'Buffer')}${t.over ? `<i class="seg-o" style="width:${pct(t.over)}%" title="Over"></i>` : ''}<i class="avail-mark" style="left:${pct(t.available)}%" aria-hidden="true"></i></div>`;
}

export function dayPanel(n = state.ui.selectedDay) {
  const d = DAYS[n - 1];
  const L = ledger().days[n - 1];
  const t = dayTiming(state.plan, n);
  const moved = n === 3 && state.plan.anj === 3;
  const pendingType = transient.pending && transient.pending.type;
  const selKind = pendingType ? ({ meals:'meals', transport:'transport', stay:'stay' }[pendingType]) : null;
  const dayEnd = clock(DAYS[n - 1].start.split(':').reduce((a, v, i) => a + (i ? +v : +v * 60), 0) + d.available * 60);
  const items = t.items.filter(i => i.kind === 'stop' || i.kind === 'lunch');
  const alert = t.fits
    ? `<div class="alert alert-ok" role="status">${icon('check', '', 20)}<div><b>Fits · ${hm(t.planned)} planned / ${hm(t.available)} available</b><span>${t.spare > 0 ? `${hm(t.spare)} spare.` : 'No spare time.'}${moved ? ' Anjanadri Hill was moved here from Day 2.' : ''}</span></div></div>`
    : `<div class="alert alert-warn" role="alert">${icon('alert', '', 20)}<div><b>Overpacked · ${hm(t.planned)} planned / ${hm(t.available)} available</b><span>Move one stop to keep the day comfortable.</span></div>
        <div class="alert-act">${n === 2 && state.plan.anj === 2 ? `<button class="btn btn-secondary" data-act="open-expense" data-kind="timefix" data-day="2">Move Anjanadri to Day 3</button>` : ''}${state.ui.kept && state.ui.kept[n] ? '<span class="chip-s">Kept as is</span>' : `<button class="link-btn" data-act="keep-anyway" data-day="${n}">Keep anyway</button>`}</div></div>`;
  const exp = (kind, ic, label, amount, rows, key) => `<button class="exp ${selKind === kind && state.ui.panel.day === n ? 'is-sel' : ''}" data-act="open-expense" data-kind="${kind}" data-day="${n}" aria-pressed="${selKind === kind && state.ui.panel.day === n}">
      <span class="exp-i">${icon(ic, '', 22)}</span><span class="exp-b"><b>${label}</b>${amt(key, money(amount), 'cell')}<em class="tag ${DAYTAG[rows] || 'tag-e'}">${rows}</em></span>${icon('right', 'exp-c', 18)}</button>`;
  const stayRows = L.stay.length ? 'Bookable' : 'Estimated';
  return `
    <div class="rp-hero"><img src="${img(d.img)}" alt=""><div class="rp-hero-b">
      <div class="rp-top"><h2 id="rp-h" tabindex="-1">Day ${n} · ${d.title}</h2><div class="rp-tot">Total ${amt('day' + n, money(L.total), 'cell')}</div></div>
      <p class="rp-date">${icon('cal', '', 18)} ${d.date}</p>
      ${alert}
      ${moved || (n === 2 && state.plan.anj === 3) ? `<div class="moved-note" role="status">${icon('route', '', 16)} ${n === 2 ? 'Moved to Day 3: Anjanadri Hill' : 'Moved from Day 2: Anjanadri Hill'}<button class="link-btn" data-act="undo-last">Undo</button></div>` : ''}
    </div></div>
    <div class="rp-grid">
      <div class="rp-col"><h3>Budget breakdown</h3><div class="exp-list">
        ${exp('transport', 'bus', 'Transport', L.tTransport, tagFor(L.transport), 'tr' + n)}
        ${L.stay.length ? exp('stay', 'bed', 'Stay', L.tStay, stayRows, 'st' + n) : `<div class="exp exp-off"><span class="exp-i">${icon('bed', '', 22)}</span><span class="exp-b"><b>Stay</b><span class="muted">Check out in the morning</span></span></div>`}
        ${exp('meals', 'utensils', 'Meals', L.tMeals, 'Estimated', 'ml' + n)}</div></div>
      <div class="rp-col"><h3>Estimated timings</h3>${barFor(t)}
        <ul class="timings">${items.map(i => {
          const late = i.kind === 'stop' && i.end / 60 > (DAYS[n - 1].start.split(':').reduce((a, v, k) => a + (k ? +v / 60 : +v), 0) + d.available);
          return `<li class="${late ? 'is-late' : ''}"><time>${clock(i.start)}–${clock(i.end)}</time><span>${i.kind === 'lunch' ? 'Lunch' : esc(i.label)}</span>${late ? `<em>${icon('alert', '', 14)} Past ${dayEnd}</em>` : ''}</li>`;
        }).join('')}</ul>
        <p class="tm-sum">${hm(t.sights)} sights · ${hm(t.travel)} travel${t.lunch ? ' · 1 h lunch' : ''} · 30 m buffer</p>
      </div>
    </div>
    <p class="rp-foot">${esc('Demo plan · sample prices')}. Local transport and meals are estimates and are not booked.</p>`;
}

export function whyPanel() {
  const b = breaches();
  const alt = STAYS.boulder;
  const saves = ledger().stay - alt.nights.reduce((a, x) => a + x, 0);
  const open = state.ui.detailsOpen;
  return `
    <div class="rp-top"><h2 id="rp-h" tabindex="-1">Why this plan</h2></div>
    <div class="rp-grid why">
      <ul class="why-list">${WHY.map(w => `<li>${icon(w.icon, '', 22)}<span>${w.text}</span></li>`).join('')}</ul>
      <div class="why-side">
        <div class="tradeoff"><b>Trade-off</b><span>${b.length ? `${rupee(b[0].excess)} above ${esc(b[0].name)}'s ${rupee(b[0].cap)} cap.` : 'Within every traveller\'s cap.'}</span></div>
        ${state.plan.stay === 'riverside' ? `<div class="alt-card"><b>Alternative: ${alt.name}</b><span class="pill-note">Save ${rupee(saves)}/person</span><button class="btn btn-secondary btn-block" data-act="open-expense" data-kind="stay" data-day="${state.ui.selectedDay}">Compare stays</button></div>` : ''}
      </div>
    </div>
    <button class="disclose block" data-act="toggle-details" aria-expanded="${open}">${icon('check', '', 18)} <span>Checked 14 stays · 3 buses · opening hours</span><em>Sample checks</em>${icon('down', 'chev', 18)}</button>
    <div class="disclose-body" ${open ? '' : 'hidden'}>Counts are simulated by a mock adapter. No live inventory is queried.</div>
    <div class="rp-actions"><button class="link-btn" data-act="back-to-day">${icon('back', '', 18)} Back to plan</button></div>`;
}

function timeInner(title, t, kind) {
  return `<div class="tf-h"><h3>${title}</h3>${kind === 'before' ? '<span class="chip-s">Proposed change, not applied</span>' : ''}</div>
    <p class="tf-big"><b>${hm(t.planned)}</b> planned / ${hm(t.available)} available</p>
    ${barFor(t)}
    <p class="tf-res ${t.over ? 'is-over' : ''}">${t.over ? `<b>Overflow +${hm(t.over)}</b>` : `<b>Spare ${hm(t.spare)}</b>`}</p>`;
}
export function timefixPanel() {
  const before = dayTiming(state.plan, 2);
  const alt = clonePlan(state.plan); alt.anj = 3;
  const after = dayTiming(alt, 2), d3 = dayTiming(alt, 3);
  const L0 = ledger(state.plan).perPerson, L1 = ledger(alt).perPerson;
  const list = before.items.filter(i => i.kind === 'stop' || i.kind === 'lunch');
  return `
    <div class="rp-top"><h2 id="rp-h" tabindex="-1">Make Day 2 comfortable.</h2><span class="cost-chip">${icon('receipt', '', 18)} ${L0 === L1 ? 'Cost unchanged' : 'Cost changes'} <b>${rupee(L1)}</b> / person</span></div>
    <p class="sub">Move Anjanadri Hill from Day 2 to Day 3 to balance the plan and keep it relaxed.</p>
    <div class="tf-grid">
      <div class="tf-col before">${timeInner('Before (Day 2)', before, 'before')}
        <details class="tf-det" open><summary>${icon('clock', '', 16)} Day 2 timeline (current)</summary>
        <ul class="timings">${list.map(i => `<li><time>${clock(i.start)}–${clock(i.end)}</time><span>${i.kind === 'lunch' ? 'Lunch' : esc(i.label)}</span></li>`).join('')}</ul></details></div>
      <div class="tf-arrow" aria-hidden="true">${icon('fwd', '', 22)}</div>
      <div class="tf-col after">${timeInner('After (Day 2)', after, 'after')}
        <div class="tf-break" aria-label="Breakdown after change"><h4>${icon('clock', '', 16)} Breakdown (after change)</h4>
          <dl><div><dt>${icon('camera', '', 16)} Sights</dt><dd>${hm(after.sights)}</dd></div><div><dt>${icon('route', '', 16)} Travel</dt><dd>${hm(after.travel)}</dd></div><div><dt>${icon('utensils', '', 16)} Lunch</dt><dd>${hm(after.lunch)}</dd></div><div><dt>${icon('hourglass', '', 16)} Buffer</dt><dd>${hm(after.buffer)}</dd></div></dl></div></div>
    </div>
    <div class="tf-move"><span>${icon('fwd', '', 18)} <b>Move:</b> Anjanadri Hill from Day 2 to Day 3</span><span>${icon('cal', '', 18)} <b>Day 3</b> (after change): ${hm(d3.planned)} · ${d3.fits ? 'Fits' : 'Overpacked'}</span></div>
    <div class="rp-actions"><button class="btn btn-primary" data-act="apply-timefix" data-autofocus>Apply change</button><button class="btn btn-secondary" data-act="cancel-edit">Keep original plan</button><span class="undo-note">${icon('undo', '', 16)} You can undo this change after applying.</span></div>`;
}

export function mealsPanel() {
  const p = transient.pending;
  const n = p.day;
  const base = state.plan;
  const draftPlan = clonePlan(base); draftPlan.meals[n] = { ...p.draft };
  const L0 = ledger(base), L1 = ledger(draftPlan);
  const pr = MEAL_PRICES[n];
  const row = (k, label) => {
    if (!pr[k]) return `<div class="meal off"><span class="cb off"></span><div><b>${label}</b><small>Not planned on this day</small></div><span class="muted">—</span></div>`;
    const on = p.draft[k];
    return `<label class="meal ${on ? 'on' : ''}"><input type="checkbox" data-meal="${k}" ${on ? 'checked' : ''}><span class="cb">${on ? icon('check', '', 16) : ''}</span><div><b>${label}</b><small>Estimated</small></div><span class="meal-p">${rupee(pr[k])}<small>Estimated</small></span></label>`;
  };
  const cmp = (label, a, b, sub) => `<div class="cmp-r"><div><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="cmp-v"><span>${rupee(a)}<small>Current</small></span>${icon('fwd', '', 16)}<span>${rupee(b)}<small>Proposed</small></span></div></div>`;
  return `
    <div class="rp-top"><h2 id="rp-h" tabindex="-1">Review meals</h2></div><p class="sub">Per-person estimates · Day ${n}</p>
    <div class="meals">
      <div class="meal locked"><span class="cb locked">${icon('lock', '', 14)}</span><div><b>Breakfast</b><small>Included in stay</small></div><span class="chip-s">Included in stay</span></div>
      ${row('lunch', 'Lunch')}${row('dinner', 'Dinner')}
    </div>
    <div class="cmp">${cmp('Current meal total', L0.days[n - 1].tMeals, L1.days[n - 1].tMeals)}${cmp(`Current Day ${n} total`, L0.days[n - 1].total, L1.days[n - 1].total)}${cmp('Current full-trip total', L0.perPerson, L1.perPerson, 'PER PERSON')}</div>
    <div class="rp-actions"><span class="muted">Optional branch · draft not applied</span><span class="sp"></span><button class="btn btn-secondary" data-act="cancel-edit">Cancel</button><button class="btn btn-primary" data-act="apply-meals" ${isDirty() ? '' : 'disabled'}>Apply meal changes</button></div>`;
}

export function transportPanel() {
  const p = transient.pending;
  const n = p.day;
  const base = state.plan;
  const draftPlan = clonePlan(base); draftPlan.scooty = p.draft.scooty;
  const L0 = ledger(base), L1 = ledger(draftPlan);
  const tBase = dayTiming(base, 2), tDraft = dayTiming(draftPlan, 2);
  if (n !== 2) {
    const L = L0.days[n - 1];
    return `<div class="rp-top"><h2 id="rp-h" tabindex="-1">Day ${n}: Transport</h2></div>
      <ul class="plain-list">${L.transport.map(r => `<li><span>${esc(r.label)}<small>${esc(r.sub)}</small></span><b>${rupee(r.amount)}</b><em class="tag ${r.kind === 'checkout' ? 'tag-b' : 'tag-e'}">${r.kind === 'checkout' ? 'Bookable' : 'Estimated'}</em></li>`).join('')}</ul>
      <p class="sub">A scooty comparison is available for Day 2 only.</p>
      <div class="rp-actions"><button class="btn btn-secondary" data-act="cancel-edit">Close</button></div>`;
  }
  const sc = p.draft.scooty;
  const travelBase = tBase.travel * 60, travelDraft = tDraft.travel * 60;
  return `
    <div class="rp-top"><h2 id="rp-h" tabindex="-1">Day 2: Local picks &amp; scooty option</h2><span class="chip-s">Optional edit; main journey can skip.</span></div>
    <p class="route-text"><b>Route:</b> Virupaksha Temple → Hampi Bazaar → Vittala Temple → Mango Tree (meal stop) → Anjanadri Hill</p>
    <h3>Transport review <small>(for Day 2)</small></h3>
    <div class="opt-grid" role="radiogroup" aria-label="Day 2 local transport">
      <button class="opt ${!sc ? 'is-sel' : ''}" role="radio" aria-checked="${!sc}" data-act="pick-transport" data-v="autos"><img src="${img('icon_auto')}" alt=""><span><b>Local autos ${!sc ? '(current)' : ''}</b><em>${rupee(LOCAL_BASE[2])} / person (estimated)</em><span class="tt">Travel time: ${hm(tBase.travel)} (estimated)</span></span>${!sc ? icon('check', 'opt-chk', 20) : ''}</button>
      <button class="opt ${sc ? 'is-sel' : ''}" role="radio" aria-checked="${sc}" data-act="pick-transport" data-v="scooty"><img src="${img('icon_scooty')}" alt=""><span><b>Scooty rental (alternative)</b><em>${rupee(SCOOTY.price)} / day per vehicle</em><span class="meta2">Sample partner · Not bookable</span>
        <ul class="bul"><li>1 rider per vehicle assumed</li><li>Helmet included</li><li>Valid driving licence required</li><li>Availability unverified</li></ul></span>${sc ? icon('check', 'opt-chk', 20) : ''}</button>
    </div>
    <div class="sum3"><div><small>Day 2 total ${sc ? '(proposed)' : '(current)'}</small><b>${rupee(L1.days[1].total)}</b></div><div><small>Trip total ${sc ? '(proposed)' : '(current)'}</small><b>${rupee(L1.perPerson)}</b></div><div><small>Save</small><b>${rupee(L0.perPerson - L1.perPerson)}</b></div>
      <div class="sum3-n"><b>Only Day 2 affected.</b><span>Travel time: about ${Math.round(travelDraft + 1e-6)} min${sc ? ` (estimated, ${Math.round((1 - SCOOTY.travelFactor) * 100)}% less)` : ' (estimated)'}</span></div></div>
    <div class="rp-actions"><button class="btn btn-primary" data-act="apply-transport" ${isDirty() ? '' : 'disabled'}>${sc ? 'Add for Day 2' : 'Keep local autos'}</button><button class="btn btn-secondary" data-act="cancel-edit">Cancel</button></div>
    <h3>Local picks for Day 2</h3>
    <div class="picks">${PICKS.map(k => `<div class="pick"><img src="${img(k.img)}" alt=""><span><b>${k.title} · ${k.kind}</b><small>${k.note}</small></span></div>`).join('')}</div>`;
}

export function stayPanel() {
  const p = transient.pending;
  const base = state.plan;
  const draftPlan = clonePlan(base); draftPlan.stay = p.draft.stay;
  const L0 = ledger(base), L1 = ledger(draftPlan);
  const night = (s, i) => stayNight({ ...base, stay:s }, i + 1);
  const total = s => [0, 1, 2].reduce((a, i) => a + night(s, i), 0);
  const card = s => {
    const S = STAYS[s];
    const cur = base.stay === s;
    const sel = p.draft.stay === s;
    const diff = total(base.stay) - total(s);
    return `<button class="stay ${sel ? 'is-sel' : ''}" role="radio" aria-checked="${sel}" data-act="pick-stay" data-v="${s}">
      <img src="${img(S.img)}" alt=""><span class="stay-b"><b>${S.name}</b><em class="tag ${cur ? 'tag-cur' : 'tag-alt'}">${cur ? 'Current' : 'Alternative'}</em>
      <span class="am">${icon('info', '', 14)} Wi-Fi · Breakfast included</span>
      <span class="stay-p"><b>${rupee(total(s))} per person</b><small>Total for 3 nights</small></span>
      ${!cur && diff > 0 ? `<span class="pill-note">Save ${rupee(diff)} per person</span>` : ''}${!cur && diff < 0 ? `<span class="pill-note neutral">${rupee(-diff)} more per person</span>` : ''}</span>${sel ? icon('check', 'opt-chk', 20) : ''}</button>`;
  };
  const brk = s => `<div class="brk"><h4>${STAYS[s].name} · 3-night breakdown</h4><dl>${NIGHT_LABELS.map((l, i) => `<div><dt>${l.replace(' (Night', ' (Night')}</dt><dd>${rupee(night(s, i))}</dd></div>`).join('')}<div class="brk-t"><dt>Total per person</dt><dd>${rupee(total(s))}</dd></div></dl></div>`;
  const fits = breaches(draftPlan).length === 0;
  const same = p.draft.stay === base.stay;
  const label = `Use ${STAYS[p.draft.stay].name}`;
  return `
    <div class="rp-top"><h2 id="rp-h" tabindex="-1">Review &amp; edit Stays for 3 nights</h2></div><p class="sub">Compare a cheaper stay and see the impact on your trip cost.</p>
    <div class="stay-grid" role="radiogroup" aria-label="Stay options">${card('riverside')}${card('boulder')}</div>
    <div class="brk-grid">${brk('riverside')}${brk('boulder')}</div>
    <div class="estimate">${icon('check', '', 22)}<div><b>${same ? 'Current' : 'New'} trip estimate: ${rupee(L1.perPerson)} per person</b><span>${same ? 'No change yet.' : fits ? `If we swap to ${STAYS[p.draft.stay].name}, the trip fits everyone's budget (${rupee(lowestCap())}).` : `Still ${rupee(breaches(draftPlan)[0].excess)} over ${esc(breaches(draftPlan)[0].name)}'s cap.`}</span></div></div>
    <div class="rp-actions"><span class="note-i">${icon('info', '', 16)} Updates all 3 nights; nothing booked.</span><span class="sp"></span><button class="btn btn-secondary" data-act="cancel-edit">Cancel</button><button class="btn btn-primary" data-act="apply-stay" ${same ? 'disabled' : ''}>${label}</button></div>`;
}

// ---- approvals ----
export function approvalsPanel() {
  const pp = perPerson();
  const shared = planStatus() === 'shared';
  const log = state.shareLog || [];
  const last = log[log.length - 1], prev = log[log.length - 2];
  const delta = last && prev ? last.perPerson - prev.perPerson : null;
  const me = acting();
  const rows = state.travellers.map(t => {
    const ap = isApproved(t.id);
    const over = pp > t.cap;
    let status, cls = '';
    if (!shared) { status = `<span class="st st-n">Not shared yet</span>`; }
    else if (ap) { status = `<span class="st st-ap">${icon('check', '', 14)} Approved</span>`; }
    else if (over) { status = `<span class="st st-over">${icon('alert', '', 14)} Over by ${rupee(pp - t.cap)}</span>`; cls = 'over'; }
    else if ((state.approvals[t.id] || 0) > 0) { status = `<span class="st st-w">${icon('clock', '', 14)} Review updated plan</span>`; }
    else { status = `<span class="st st-w">${icon('clock', '', 14)} Waiting</span>`; }
    const canAct = shared && t.id === me.id && !ap;
    return `<li class="ap-row ${cls}">${avatar(t, 40)}<div class="ap-n"><b>${esc(t.name)}${t.id === me.id ? ' <i class="you-tag">viewing as</i>' : ''}</b><small>${over ? `Over by ${rupee(pp - t.cap)} · ` : ''}Cap ${rupee(t.cap)}${t.status !== 'joined' ? ' · not joined yet' : ''}</small></div>${status}
      ${canAct ? `<button class="btn btn-primary btn-sm" data-act="approve-me" ${over ? 'aria-describedby="ap-cap-note"' : ''}>Approve this version</button>` : ''}</li>`;
  }).join('');
  const myOver = pp > me.cap;
  return `
    <div class="rp-top"><h2 id="rp-h" tabindex="-1">Group approvals</h2><span class="status-chip">${shared ? `Shared draft · v${state.planVersion}` : 'Draft, not shared'}</span></div>
    <p class="sub">${shared ? `Reviewing version ${state.planVersion} · ${rupee(pp)} per person${delta != null ? ` · ${delta === 0 ? 'no cost change' : `${delta < 0 ? '−' : '+'}${rupee(Math.abs(delta))} since the last shared version`}` : ''}. Joining a plan is not approving it.` : 'Sharing sends this version for review. It does not approve on anyone\'s behalf.'}</p>
    <ul class="ap-list">${rows}</ul>
    ${myOver && shared ? `<p id="ap-cap-note" class="inline-warn" role="alert">${icon('alert', '', 16)} ${esc(me.name)} can't approve while the plan is over their cap. <button class="link-btn" data-act="edit-traveller" data-id="${me.id}">Edit cap</button></p>` : ''}
    ${breaches().length && !myOver ? `<div class="ai-sug">${icon('sparkle', 'accent', 22)}<div><b>AI suggestion</b><span>Swap to Boulder View to save ₹300/person.</span></div><button class="btn btn-primary btn-sm" data-act="open-expense" data-kind="stay" data-day="${state.ui.selectedDay}">Review change</button></div>` : ''}
    <div class="rp-actions">
      ${planStatus() !== 'shared' ? `<button class="btn btn-primary" data-act="share">${icon('share', '', 18)} Share with group</button><button class="btn btn-secondary" data-act="share-approve">Share and approve my plan</button>` : `<button class="btn btn-secondary" data-act="back-to-day">Back to day plan</button>`}
      <span class="undo-note">${icon('info', '', 16)} Any change to the itinerary, price, dates, party size or a cap asks the group to approve again.</span></div>`;
}

export function finalPanel() {
  const L = ledger();
  return `
    <div class="rp-top"><h2 id="rp-h" tabindex="-1">${esc(state.trip.dest)} trip · Final plan</h2><span class="status-chip is-ok">${icon('check', '', 16)} Everyone approved</span></div>
    <div class="fin-ap">${state.travellers.map(t => `<div>${avatar(t, 48)}<b>${esc(t.name)}</b><small>Approved</small><small>Cap: ${rupee(t.cap)}</small></div>`).join('')}</div>
    <div class="fin-sum"><div><b class="big">${amt('fin-pp', L.perPerson)}</b> <span>/ person</span><p>Group total: ${amt('fin-g', L.group)} (${party()} travellers)</p></div>
      <div class="fin-note"><b>Final plan</b><span>After timing fix, Day 2 and Day 3 fit in the plan. Four-day sequence retained.</span></div></div>
    <div class="fin-days">${DAYS.map((d, i) => `<div><b>Day ${d.n}</b><small>${d.date}</small><span>${d.summary}</span><b>${rupee(L.days[i].total)}</b></div>`).join('')}</div>
    <div class="fin-cost"><div><h4>Cost summary (per person)</h4><dl><div><dt>${icon('bus', '', 16)} Transport</dt><dd>${rupee(L.transport)}</dd></div><div><dt>${icon('bed', '', 16)} Stays</dt><dd>${rupee(L.stay)}</dd></div><div><dt>${icon('utensils', '', 16)} Meals</dt><dd>${rupee(L.meals)}</dd></div><div class="t"><dt>Total per person</dt><dd>${rupee(L.perPerson)}</dd></div></dl></div>
      <div class="fin-bk">${icon('info', '', 20)}<div><b>Bookable vs estimates</b><span>Only intercity buses and the stay proceed to checkout; local transport and meals remain estimates.</span></div></div></div>
    <div class="rp-actions"><button class="btn btn-secondary" data-act="back-to-day">Edit plan</button><button class="btn btn-primary" data-act="review-book">Review &amp; book now</button><span class="undo-note">Changes will ask the group to approve again.</span></div>`;
}

export function pricePanel() {
  const r = state.recovery;
  const stay = STAYS[r.stay];
  const L = ledger();
  const b = breaches();
  const from = stay.nights[r.night - 1], to = from + r.amount;
  const pp = L.perPerson;
  return `
    <div class="rp-top"><h2 id="rp-h" tabindex="-1">A stay price changed.</h2></div>
    <p class="sub">The price for one night at ${stay.name} has increased.</p>
    <div class="pc-card"><img src="${img(stay.img)}" alt=""><div><b>${stay.name}</b><small>1 night · ${NIGHT_LABELS[r.night - 1].replace(/ \(Night.*/, '')}</small></div>
      <div class="pc-v"><s>${rupee(from)}</s> ${icon('fwd', '', 16)} <b>${rupee(to)}</b> <small>/ person</small><span class="pill-note neutral">+ ${rupee(r.amount)} / person</span></div></div>
    <dl class="pc-sum"><div><dt>Full trip (per person)</dt><dd><s>${rupee(pp - r.amount)}</s> ${icon('fwd', '', 14)} <b>${rupee(pp)}</b></dd></div><div><dt>Group increase (${party()} travellers)</dt><dd><b>+ ${rupee(r.amount * party())}</b></dd></div></dl>
    ${b.length ? b.map(x => `<div class="alert alert-warn" role="alert">${icon('alert', '', 20)}<div><b>${rupee(x.excess)} above ${esc(x.name)}'s cap (${rupee(x.cap)} per person).</b></div></div>`).join('') : `<div class="alert alert-ok" role="status">${icon('check', '', 20)}<div><b>Still within everyone's cap.</b></div></div>`}
    <div class="ai-sug">${icon('sparkle', 'accent', 22)}<div><b>Cleartrip AI suggests</b><span>Compare another stay or adjust your plan to stay within the group cap.</span></div></div>
    <div class="rp-actions"><button class="btn btn-primary" data-act="price-alt">Find an alternative</button><button class="btn btn-secondary" data-act="price-review">${r.resolved ? 'Price accepted' : 'Review new price'}</button><span class="undo-note">${icon('info', '', 16)} Changes require group approval before checkout.</span></div>`;
}

// ---------------------------------------------------------------- panel router
export function reviewPanel() {
  let t = state.ui.panel.type;
  if (isPhone() && SHEET_TYPES[t]) t = 'day';           // on phones, detailed editors live in the bottom sheet
  let body;
  if (state.recovery && state.recovery.type === 'price' && t === 'price') body = pricePanel();
  else if (t === 'why') body = whyPanel();
  else if (t === 'approvals') body = approvalsPanel();
  else if (t === 'final') body = finalPanel();
  else if (transient.pending && t === 'timefix') body = timefixPanel();
  else if (transient.pending && t === 'meals') body = mealsPanel();
  else if (transient.pending && t === 'transport') body = transportPanel();
  else if (transient.pending && t === 'stay') body = stayPanel();
  else body = dayPanel(state.ui.selectedDay);
  return `<section class="rp" id="rp" aria-labelledby="rp-h">${body}</section>`;
}
// Panels that open in a bottom sheet on phones (title for the sheet header)
export const SHEET_TYPES = { why:'Why this plan', timefix:'Make Day 2 comfortable', meals:'Review meals', transport:'Transport & local picks', stay:'Review & edit stays', price:'A stay price changed' };
export function panelBody(type) {
  return ({ why: whyPanel, timefix: timefixPanel, meals: mealsPanel, transport: transportPanel, stay: stayPanel, price: pricePanel })[type]();
}

// ---------------------------------------------------------------- sticky bar
export function stickyBar() {
  const L = ledger();
  const ok = canBook();
  const blockers = bookBlockers();
  const shared = planStatus() === 'shared';
  return `<div class="sticky" role="region" aria-label="Plan actions">
    <div class="stk-tot"><span>Total</span><b>${amt('stk', L.perPerson)}</b><small>per person</small></div>
    <div class="stk-act">
      ${shared ? `<button class="btn btn-secondary" data-act="open-approvals">${icon('users', '', 18)} Approvals ${approvedCount()}/${party()}</button>` : `<button class="btn btn-primary" data-act="share">${icon('share', '', 18)} Share with group</button>`}
      <button class="btn ${ok ? 'btn-primary' : 'btn-disabled'}" data-act="review-book" ${ok ? '' : 'aria-disabled="true"'} aria-describedby="book-why">${icon('lock', '', 18)} Review &amp; book</button>
    </div>
    <p class="stk-why" id="book-why">${ok ? 'Everyone approved this version.' : esc(blockers[0] || 'Waiting for group approval')}</p>
  </div>`;
}

// ---------------------------------------------------------------- whole workspace (plan stage)
export function workspaceHtml() {
  const bannerShared = transient.shareBanner;
  return `<div class="ws-scroll" id="ws-scroll">
    ${wsHeader()}
    ${bannerShared ? `<div class="banner banner-info" role="status">${icon('check', '', 20)}<div class="bn-t"><b>Plan shared</b><span>Your draft plan (version ${state.planVersion}) has been shared with ${state.travellers.filter(t => t.role !== 'organiser').map(t => esc(t.name)).join(' and ') || 'the group'}. It does not approve on their behalf.</span></div><button class="icon-btn" data-act="dismiss-share" aria-label="Dismiss">${icon('close', '', 18)}</button></div>` : ''}
    ${budgetBanner()}
    ${costStrip()}
    ${routeHtml()}
    ${isPhone() && transient.pending ? '' : ''}
    ${reviewPanel()}
  </div>${stickyBar()}`;
}

// ---------------------------------------------------------------- checkout review and handoff
const BUSIMG = ['bus_night', 'bus_temple', 'bus_rocks', 'bus_day'];
export function checkoutHtml() {
  const L = ledger();
  const rows = L.checkoutRows.filter((r, i, a) => !(r.id.startsWith('stay') && a.findIndex(x => x.id.startsWith('stay')) !== i));
  const stayTotal = L.days.reduce((a, d) => a + d.tStay, 0);
  const bookItems = [
    { icon:'bus', title:'Outbound night bus', sub:'14 Nov · To Hampi', amount:1200 },
    { icon:'bed', title:STAYS[state.plan.stay].name, sub:`3 nights · 14–17 Nov`, amount:stayTotal },
    { icon:'bus', title:'Return bus', sub:'17 Nov · From Hampi', amount:1200 },
  ];
  const sub = L.checkoutPerPerson;
  return `<div class="ws-scroll co">
    <header class="ws-h"><div class="ws-title"><h1>Review &amp; book: ${esc(state.trip.dest)}</h1><div class="ws-meta"><span>${fmtRange()} 2026 · ${party()} travellers</span><span class="status-chip is-ok">${icon('check', '', 16)} Everyone approved</span></div></div><div class="co-avs">${state.travellers.map(t => avatar(t, 40)).join('')}</div></header>
    <section class="co-route" aria-label="4-day route at a glance"><b>4-day route at a glance</b><div class="co-tiles">${DAYS.map((d, i) => `<div><img src="${img(BUSIMG[i])}" alt=""><b>Day ${d.n} · ${d.short}</b><small>${['Overnight bus to Hampi', 'Hampi ruins & Virupaksha Temple', 'Boulders & viewpoints', 'Return bus to home'][i]}</small></div>`).join('')}</div></section>
    <div class="co-grid">
      <section class="co-card" aria-labelledby="co1"><h2 id="co1">What you'll book now <small>(Checkout items)</small></h2><p class="sub">These will be booked together on Cleartrip.</p>
        <ul class="co-list">${bookItems.map(i => `<li>${icon(i.icon, '', 22)}<span><b>${esc(i.title)}</b><small>${i.sub}</small></span><em>${rupee(i.amount)} / person</em></li>`).join('')}</ul>
        <div class="co-sub"><span>Bookable subtotal</span><b>${rupee(sub)} / person</b></div>
        <div class="co-grp"><span>Group checkout estimate (${party()} travellers)</span><b>${rupee(sub * party())}</b></div></section>
      <section class="co-card" aria-labelledby="co2"><h2 id="co2">Not booked here <small>(Estimated separately)</small></h2><p class="sub">Plan costs you'll arrange on your own during the trip.</p>
        <ul class="co-list"><li>${icon('bus', '', 22)}<span><b>Local transport (auto / cab)</b></span><em>~${rupee(L.outsideTransport)} / person</em></li><li>${icon('utensils', '', 22)}<span><b>Meals</b></span><em>~${rupee(L.outsideMeals)} / person</em></li></ul>
        <div class="co-sub"><span>Estimated total (not booked here)</span><b>~${rupee(L.outsideTransport + L.outsideMeals)} / person</b></div></section>
    </div>
    <div class="co-total"><div><b>Total plan estimate</b><small>(per person)</small></div><b class="big">${amt('co-total', L.perPerson)} <span>/ person</span></b></div>
    <p class="note-i">${icon('info', '', 18)} Final availability, taxes and prices are confirmed in Cleartrip checkout. The total trip estimate is not the amount in checkout.</p>
    <div class="rp-actions"><button class="btn btn-secondary" data-act="back-to-plan">Back to plan</button><button class="btn btn-primary" data-act="to-handoff">Continue to Cleartrip checkout</button></div>
  </div>`;
}
export function handoffHtml() {
  const L = ledger();
  return `<div class="ws-scroll co handoff">
    <header class="ho-h"><span class="ho-ic">${icon('fwd', '', 24)}</span><div><h1>Your plan is ready for checkout.</h1><p>Continue with traveller details and payment in Cleartrip's existing checkout.</p></div></header>
    <div class="ho-meta">${icon('cal', '', 20)} ${party()} travellers · ${esc(state.trip.dest)} · ${fmtRange()} 2026</div>
    <div class="co-grid">
      <section class="co-card"><h2>Items in checkout</h2><ul class="co-list"><li>${icon('bus', '', 22)}<span><b>2 bus journeys</b><small>To Hampi and back</small></span></li><li>${icon('bed', '', 22)}<span><b>3-night stay</b><small>${STAYS[state.plan.stay].name}</small></span></li></ul>
        <div class="co-sub"><span>Estimated group checkout subtotal</span><b>${rupee(L.checkoutPerPerson * party())}</b></div><small class="muted">${rupee(L.checkoutPerPerson)}/person</small></section>
      <section class="co-card"><h2>Your ${esc(state.trip.dest)} plan <small>(4 days)</small></h2><ul class="ho-days">${DAYS.map(d => `<li><img src="${img(d.img)}" alt=""><span><b>Day ${d.n} · ${d.short}</b><small>${d.summary}</small></span></li>`).join('')}</ul></section>
    </div>
    <div class="note-i">${icon('info', '', 18)} Local transport and meals remain planning estimates.</div>
    <div class="banner banner-warn-soft" role="status">${icon('alert', '', 20)}<b>No booking or payment has been made.</b></div>
    <div class="rp-actions"><button class="btn btn-primary" data-act="open-placeholder">Continue to checkout</button><button class="btn btn-secondary" data-act="back-to-plan">Return to saved plan</button></div>
    <p class="foot-note">Prototype ends here. Existing Cleartrip checkout follows.</p>
  </div>`;
}

// ---------------------------------------------------------------- recovery screens
export function noMatchHtml() {
  const r = state.recovery;
  const hasPlan = !!state.plan;
  const L = hasPlan ? ledger() : null;
  return `<div class="ws-scroll recovery">
    <div class="rc-saved">${hasPlan ? `<img src="${img('hampi_thumb')}" alt=""><div><b>${esc(state.trip.dest)}</b><small>${fmtRange()} 2026 · ${party()} travellers · 4 days</small></div><span class="chip-s">Saved plan: ${rupee(L.perPerson)} per person</span><button class="btn btn-secondary btn-sm" data-act="back-to-plan">Return to saved plan</button>` : `<div><b>${esc(state.trip.dest)}</b><small>${fmtRange()} 2026 · ${party()} travellers</small></div>`}</div>
    <div class="rc-card">
      <img class="rc-img" src="${img('hampi_ruins')}" alt="">
      <h1>No complete plan fits ${rupee(r.requested)} yet.</h1>
      <p>Closest sample option is ${rupee(r.closest)} per person.</p>
      <span class="chip-s gap-chip">Gap: ${rupee(r.closest - r.requested)}</span>
      <div class="rc-opts">
        <button class="rc-opt is-primary" data-act="nm-budget"><span>${icon('arrowup', '', 22)}</span><div><b>Increase budget to ${rupee(r.closest)}</b><small>Use the closest complete plan for this trip</small></div>${icon('right', '', 18)}</button>
        <button class="rc-opt" data-act="nm-dates"><span>${icon('cal', '', 22)}</span><div><b>Try nearby dates</b><small>Check plans around ${fmtRange()} 2026</small></div>${icon('right', '', 18)}</button>
        <button class="rc-opt" data-act="nm-prefs"><span>${icon('sliders', '', 22)}</span><div><b>Edit preferences</b><small>Adjust stays, activities or travel options</small></div>${icon('right', '', 18)}</button>
      </div>
      ${hasPlan ? `<div class="rc-saved-note">${icon('check', '', 20)} <span>Your current plan is saved at <b>${rupee(L.perPerson)}</b> per person.</span><button class="btn btn-primary btn-sm" data-act="back-to-plan">Return to saved plan</button></div>` : ''}
      <p class="foot-note">Sample availability. Your saved plan is never overwritten by a failed search.</p>
    </div></div>`;
}
export function errorHtml() {
  return `<div class="ws-scroll recovery">
    <div class="rc-card err">
      <div class="err-h"><span class="err-ic">${icon('alert', '', 28)}</span><div><h1>We couldn't finish your plan.</h1><p>Your trip details and group are saved. Try again when you're ready.</p></div></div>
      <div class="err-chips"><span class="chip-s">${icon('pin', '', 16)} ${esc(state.trip.dest)}</span><span class="chip-s">${icon('cal', '', 16)} ${fmtRange()} 2026</span><span class="chip-s">${icon('users', '', 16)} ${party()} traveller${party() === 1 ? '' : 's'}</span><span class="chip-s">${icon('rupee', '', 16)} ${rupee(state.trip.budget)} target per person</span></div>
      <div class="err-av">${state.travellers.map(t => `<span>${avatar(t, 64)}<b>${esc(t.name)}</b></span>`).join('')}</div>
      <div class="rp-actions"><button class="btn btn-primary" data-act="retry-build" data-autofocus>Try again</button><button class="btn btn-secondary" data-act="edit-trip">Edit trip details</button></div>
      <button class="disclose block" data-act="toggle-details" aria-expanded="${state.ui.detailsOpen}">${icon('check', '', 18)} <span>Last check: travel times</span>${icon('down', 'chev', 18)}</button>
      <div class="disclose-body" ${state.ui.detailsOpen ? '' : 'hidden'}>This was the last step completed before the connection dropped. Nothing was booked.</div>
      <img class="err-pano" src="${img('hampi_pano')}" alt="">
      <p class="foot-note">Facing issues? Get help from <a href="#" data-act="host-stub">Cleartrip support</a>.</p>
    </div></div>`;
}

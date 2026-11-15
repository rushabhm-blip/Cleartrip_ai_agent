// Dialog / sheet content. One overlay at a time (managed in ui.js). On phones these are bottom sheets.
import { state, transient, traveller, party, fmtRange, validateName, nameOf } from './store.js';
import { esc, icon, openOverlay, isPhone, getOverlayBox } from './ui.js';
import { avatar } from './characters.js';
import { canAdd, canRestyle } from './looks.js';
import { rupee } from './data.js';

const kind = () => (isPhone() ? 'sheet' : 'dialog');

function charChoice(name, value, label, checked, look, disabled = false) {
  return `<label class="char-opt ${checked ? 'is-on' : ''} ${disabled ? 'is-off' : ''}"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
    ${avatar({ name:label, ...look }, 56)}<span>${label}</span><span class="char-chk">${icon('check', '', 14)}</span></label>`;
}


export function showAddFriend(draft = { name:'', style:'male' }, err = '') {
  const okM = canAdd(state.travellers, 'male'), okF = canAdd(state.travellers, 'female');
  const style = (draft.style === 'male' ? okM : okF) ? draft.style : (okM ? 'male' : 'female');
  const body = `<form data-form="add-friend" novalidate>
    <fieldset class="chars"><legend class="sr-only">Character style</legend>
      ${charChoice('style', 'male', 'Male character', style === 'male', { style:'male', role:'friend', ident:1 }, !okM)}
      ${charChoice('style', 'female', 'Female character', style === 'female', { style:'female', role:'friend', ident:1 }, !okF)}
    </fieldset>
    <p class="hint">Character choice is an illustration preference only. It is not collected for booking.${!okM || !okF ? ` Every traveller gets a different character and there are only 4 ${!okM ? 'male' : 'female'} ones, so all of them are already in this group.` : ''}</p>
    <label class="field"><span>Friend's name <small>(optional)</small></span>
      <input name="name" type="text" maxlength="40" value="${esc(draft.name)}" placeholder="Friend ${state.travellers.length + 1}" autocomplete="off" aria-describedby="nm-h nm-e" data-autofocus></label>
    <p class="hint" id="nm-h">A nickname is fine. Leave blank to use "Friend ${state.travellers.length + 1}". You can rename them later.</p>
    <p class="field-err" id="nm-e" role="alert">${esc(err)}</p>
    <div class="ov-actions"><button type="button" class="btn btn-secondary" data-ov-close>Cancel</button><button type="submit" class="btn btn-primary">Add friend</button></div></form>`;
  openOverlay({ kind:kind(), title:'Add a friend', body });
}

export function showEditTraveller(id, draft, err = {}) {
  const t = traveller(id); if (!t) return;
  const d = draft || { name:t.name, style:t.style, cap:String(t.cap) };
  const org = t.role === 'organiser';
  const body = `<form data-form="edit-traveller" data-id="${id}" novalidate>
    <fieldset class="chars"><legend class="sr-only">Character style</legend>
      ${charChoice('style', 'male', 'Male character', d.style === 'male', { style:'male', role:t.role, ident:t.ident }, t.style !== 'male' && !canRestyle(state.travellers, id, 'male'))}
      ${charChoice('style', 'female', 'Female character', d.style === 'female', { style:'female', role:t.role, ident:t.ident }, t.style !== 'female' && !canRestyle(state.travellers, id, 'female'))}
    </fieldset>
    <label class="field"><span>Name or nickname</span><input name="name" type="text" maxlength="40" value="${esc(d.name)}" aria-describedby="en-e" data-autofocus></label>
    <p class="field-err" id="en-e" role="alert">${esc(err.name || '')}</p>
    <label class="field"><span>Budget cap per person (₹)</span><input name="cap" type="text" inputmode="numeric" value="${esc(d.cap)}" aria-describedby="ec-h ec-e"></label>
    <p class="hint" id="ec-h">The lowest cap in the group becomes the planning target. Changing a cap asks the group to approve again.</p>
    <p class="field-err" id="ec-e" role="alert">${esc(err.cap || '')}</p>
    <div class="ov-actions">${org ? '' : `<button type="button" class="btn btn-ghost-danger" data-act="ask-remove" data-id="${id}">${icon('trash', '', 18)} Remove</button>`}<span class="sp"></span><button type="button" class="btn btn-secondary" data-ov-close>Cancel</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
  openOverlay({ kind:kind(), title:`Edit ${t.name}`, body });
}

export function showConfirmRemove(id) {
  const t = traveller(id); if (!t) return;
  const body = `<p>Remove <b>${esc(t.name)}</b> from this trip?</p>
    <ul class="bul"><li>Group costs recalculate for ${party() - 1} traveller${party() - 1 === 1 ? '' : 's'}.</li>${state.plan ? '<li>Any earlier approvals no longer apply. The group will review the updated plan again.</li>' : ''}<li>This does not cancel anything they may have booked elsewhere. Nothing is booked here.</li></ul>
    <div class="ov-actions"><button class="btn btn-secondary" data-ov-close data-autofocus>Keep ${esc(t.name)}</button><button class="btn btn-danger" data-act="confirm-remove" data-id="${id}">Remove ${esc(t.name)}</button></div>`;
  openOverlay({ kind:kind(), title:'Remove from group?', body });
}

export function inviteBody() {
  const rows = state.travellers.map(t => {
    const org = t.role === 'organiser';
    const st = org ? 'Organiser' : t.status === 'joined' ? 'Joined' : t.status === 'invite_ready' ? 'Invite link ready (not sent)' : 'Not joined';
    return `<li class="inv-row">${avatar(t, 48)}<div><b>${esc(t.name)}</b><small class="st-${t.status}">${st}</small></div>
      ${org || t.status === 'joined' ? '' : `<button class="btn btn-secondary btn-sm" data-act="invite-preview" data-id="${t.id}" aria-label="Invite ${esc(t.name)}">Invite</button>`}</li>`;
  }).join('');
  const target = transient.inviteTarget ? traveller(transient.inviteTarget) : null;
  return `<div class="inv-grid"><div class="inv-art" aria-hidden="true"><img src="assets/img/chariot_big.jpg" alt=""></div><div class="inv-main">
    <p class="sub">Invite your travel group to collaborate on this ${esc(state.trip.dest)} trip. Adding a character is not inviting a friend.</p>
    <ul class="inv-list">${rows}</ul>
    <button class="btn btn-secondary btn-block" data-act="copy-link">${icon('link', '', 18)} Copy invite link</button>
    <div id="copy-res" class="copy-res" role="status"></div>
    ${target && target.status !== 'joined' ? `<section class="preview" aria-label="Recipient preview"><small>Recipient preview</small>
      <div class="pv-b">${avatar(target, 48)}<div><b>Joining as ${esc(target.name)}</b><span>You've been invited to the ${esc(state.trip.dest)} trip (${fmtRange()}).</span></div></div>
      <button class="btn btn-primary btn-block" data-act="join-as" data-id="${target.id}">Join plan</button>
      <p class="hint">Preview friend joining: in this local prototype you act as that friend and claim the existing character. No invitation is sent.</p></section>` : ''}
    <p class="hint">${icon('info', '', 14)} Names are for planning; booking details come later. Joining a plan is not approval of its costs.</p></div></div>`;
}
export function showInvite() { openOverlay({ kind:kind(), title:'Bring your friends into the plan.', body:inviteBody(), wide:true }); }

// ---- trip capsules ----
export function capsuleBody(field, draft, err = '') {
  let input = '';
  if (field === 'dest') {
    input = `<label class="field"><span>Destination</span><input name="dest" list="dests" type="text" value="${esc(draft.dest)}" aria-describedby="cap-h cap-e" data-autofocus autocomplete="off"></label>
      <datalist id="dests"><option value="Hampi"></option></datalist>
      <p class="hint" id="cap-h">This demo has sample inventory for Hampi only. Other places keep your request and offer the Hampi demo.</p>`;
  } else if (field === 'dates') {
    input = `<div class="field-row"><label class="field"><span>Start</span><input name="start" type="date" value="${esc(draft.start)}" aria-describedby="cap-e" data-autofocus></label>
      <label class="field"><span>End</span><input name="end" type="date" value="${esc(draft.end)}" aria-describedby="cap-e"></label></div>
      <p class="hint" id="cap-h">The scenario dates are 14–17 Nov 2026. They stay usable even if those dates are in the past.</p>`;
  } else {
    input = `<label class="field"><span>Budget per person (₹)</span><div class="money"><i>₹</i><input name="budget" type="text" inputmode="numeric" value="${esc(draft.budget)}" aria-describedby="cap-h cap-e" data-autofocus></div></label>
      <p class="hint" id="cap-h">Your preference. The lowest cap in the group becomes the planning target. This never changes a property's price.</p>`;
  }
  return `<form data-form="capsule" data-field="${field}" novalidate>${input}<p class="field-err" id="cap-e" role="alert">${esc(err)}</p>
    <div class="ov-actions"><button type="button" class="btn btn-secondary" data-ov-close>Cancel</button><button type="submit" class="btn btn-primary">Apply</button></div></form>`;
}
const CAP_TITLES = { dest:'Destination', dates:'Dates', budget:'Budget per person (₹)' };
export function showCapsule(field, anchor) {
  const d = { dest:state.trip.dest, start:state.trip.start, end:state.trip.end, budget:String(state.trip.budget) };
  const phone = isPhone();
  const box = openOverlay({ kind: phone ? 'sheet' : 'popover', title:CAP_TITLES[field], body:capsuleBody(field, d), labelledBy:'cap-title' });
  if (!phone && anchor) {
    const r = anchor.getBoundingClientRect();
    const w = Math.min(380, window.innerWidth - 24);
    box.style.width = w + 'px';
    box.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left)) + 'px';
    box.style.top = Math.min(window.innerHeight - 280, r.bottom + 8) + 'px';
  }
  anchor && anchor.classList.add('is-open');
  return box;
}

// ---- confirmations ----
export function showConfirmReset(onYes) {
  const body = `<p>This clears the group, trip details, plan, approvals and history stored in this browser.</p>
    <div class="ov-actions"><button class="btn btn-secondary" data-ov-close data-autofocus>Keep my work</button><button class="btn btn-danger" data-act="confirm-reset">Reset demo</button></div>`;
  openOverlay({ kind:kind(), title:'Reset the demo?', body });
}
export function showUnsaved(label) {
  const body = `<p>You have an unapplied change${label ? ` to <b>${esc(label)}</b>` : ''}. What would you like to do?</p>
    <div class="ov-actions stack"><button class="btn btn-primary" data-act="unsaved-apply" data-autofocus>Apply</button><button class="btn btn-secondary" data-act="unsaved-discard">Discard</button><button class="btn btn-ghost" data-act="unsaved-keep">Keep editing</button></div>`;
  openOverlay({ kind:kind(), title:'Unsaved changes', body, dismissable:false });
}
export function showCheckoutPlaceholder() {
  const body = `<p>This is a labelled placeholder. Traveller details and payment continue in Cleartrip's existing checkout, which is not part of this prototype.</p>
    <div class="banner banner-warn-soft" role="status">${icon('alert', '', 20)}<b>No booking or payment has been made.</b></div>
    <div class="ov-actions"><button class="btn btn-primary" data-act="close-placeholder" data-autofocus>Return to saved plan</button></div>`;
  openOverlay({ kind:kind(), title:'Checkout placeholder', body });
}

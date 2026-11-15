// Small UI toolkit: icons, escaping, announcements, toasts and the single overlay manager.

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const P = {
  plane:'<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  bed:'<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
  bus:'<path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  palm:'<path d="M13 8c0-2.8-2.2-5-5-5 .6 2 2 3.2 3.600 3.800M13 8c1-2.600 3.800-3.800 6.500-2.800-1.500 1.700-3.500 2.200-5 2M13 8c2.800.2 5.200 2.400 5.400 5.300-2.100-.6-3.800-1.400-5-3M13 8c-2.600.4-4.600 2.700-4.400 5.400 1.700-1 3.200-1.300 4.400-.9M13 8v13M9 21h8"/>',
  sparkle:'<path d="M12 3l1.9 5.1L19 10l-5.100 1.900L12 17l-1.900-5.100L5 10l5.100-1.900zM19 15l.8 2.200L22 18l-2.200.8L19 21l-.8-2.200L16 18l2.200-.8z"/>',
  tag:'<path d="M20.6 13.4 13.4 20.600a2 2 0 0 1-2.800 0L3 13V3h10l7.600 7.600a2 2 0 0 1 0 2.800z"/><circle cx="7.500" cy="7.500" r="1"/>',
  case:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.500 9a2.500 2.500 0 1 1 3.500 2.300c-.7.400-1 1-1 1.700M12 17h.01"/>',
  headset:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v5H5a1 1 0 0 1-1-1zM20 14h-3v5h2a1 1 0 0 0 1-1z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.400 3.600-7 8-7s8 2.600 8 7"/>',
  users:'<circle cx="9" cy="8" r="3.500"/><path d="M2 20c0-3.600 3-6 7-6s7 2.400 7 6M16 4.500a3.500 3.500 0 0 1 0 7M18 14.500c2.400.700 4 2.600 4 5.500"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  rupee:'<path d="M6 4h12M6 9h12M6 4c5 0 7 1.500 7 5s-2 5-7 5l8 6"/>',
  back:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
  fwd:'<path d="M5 12h14M12 5l7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  up:'<path d="m18 15-6-6-6 6"/>',
  right:'<path d="m9 6 6 6-6 6"/>',
  left:'<path d="m15 6-6 6 6 6"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.500.500l3-3a5 5 0 0 0-7-7l-1.700 1.700M14 11a5 5 0 0 0-7.500-.500l-3 3a5 5 0 0 0 7 7l1.700-1.700"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
  alert:'<path d="M10.300 3.900 1.800 18a2 2 0 0 0 1.700 3h17a2 2 0 0 0 1.700-3L13.700 3.900a2 2 0 0 0-3.400 0zM12 9v4M12 17h.01"/>',
  lock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  send:'<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.600 13.500 6.800 4M15.400 6.500l-6.800 4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  userplus:'<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6.500 7-6.500M19 8v6M16 11h6"/>',
  pencil:'<path d="M12 20h9M16.500 3.500a2.100 2.100 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  utensils:'<path d="M3 2v7c0 1.100.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.100.9 2 2 2h3zm0 0v7"/>',
  hourglass:'<path d="M6 2h12M6 22h12M7 2v4.500a5 5 0 0 0 1.500 3.500L12 12l-3.500 2A5 5 0 0 0 7 17.500V22M17 2v4.500a5 5 0 0 1-1.500 3.500L12 12l3.500 2a5 5 0 0 1 1.500 3.500V22"/>',
  home:'<path d="m3 11 9-8 9 8M5 10v10h14V10"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.300-4.300"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.700 21a2 2 0 0 1-3.400 0"/>',
  menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
  more:'<circle cx="12" cy="5" r="1.200"/><circle cx="12" cy="12" r="1.200"/><circle cx="12" cy="19" r="1.200"/>',
  sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  arrowup:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  undo:'<path d="M3 7v6h6M3 13a9 9 0 1 0 3-7"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  temple:'<path d="M3 21h18M5 21V11M19 21V11M9 21V11M15 21V11M3 11h18M4 11l8-7 8 7"/>',
  mountain:'<path d="m3 20 6-11 4 6 3-4 5 9z"/>',
  umbrella:'<path d="M12 12V21M5 12a7 7 0 0 1 14 0zM9 21h6"/>',
  camera:'<path d="M14.500 4h-5L8 6H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.500"/>',
  receipt:'<path d="M4 3v18l3-2 3 2 2-2 2 2 3-2 3 2V3zM8 8h8M8 12h8"/>',
  file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 14h6M9 17h4"/>',
  trash:'<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  route:'<circle cx="6" cy="19" r="2.500"/><circle cx="18" cy="5" r="2.500"/><path d="M8.500 19H17a3.500 3.500 0 0 0 0-7H7a3.500 3.500 0 0 1 0-7h8.500"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.100a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-1.800-.3 1.700 1.700 0 0 0-1 1.500V21a2 2 0 1 1-4 0v-.1a1.700 1.700 0 0 0-1.100-1.500 1.700 1.700 0 0 0-1.800.3l-.1.1a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0 .3-1.800 1.700 1.700 0 0 0-1.500-1H3a2 2 0 1 1 0-4h.1a1.700 1.700 0 0 0 1.500-1.100 1.700 1.700 0 0 0-.3-1.800l-.1-.1a2 2 0 1 1 2.800-2.800l.1.100a1.700 1.700 0 0 0 1.800.3H9a1.700 1.700 0 0 0 1-1.500V3a2 2 0 1 1 4 0v.1a1.700 1.700 0 0 0 1 1.500 1.700 1.700 0 0 0 1.800-.3l.1-.1a2 2 0 1 1 2.800 2.800l-.1.100a1.700 1.700 0 0 0-.3 1.800V9a1.700 1.700 0 0 0 1.500 1H21a2 2 0 1 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
};
export function icon(name, cls = '', size = 20) {
  const p = P[name] || P.info;
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
}

// ---- reduced motion ----
export const reduced = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
export function applyMotionPref(on) { document.documentElement.classList.toggle('reduce-motion', !!on); }

// ---- live region (restrained) ----
let liveT;
export function announce(msg) {
  const el = document.getElementById('live'); if (!el) return;
  clearTimeout(liveT);
  el.textContent = '';
  liveT = setTimeout(() => { el.textContent = msg; }, 60);
}

// ---- toast ----
let toastT;
export function toast(msg, { action, onAction, ms = 5000 } = {}) {
  const root = document.getElementById('toast-root');
  clearTimeout(toastT);
  root.innerHTML = `<div class="toast" role="status"><span>${esc(msg)}</span>${action ? `<button class="toast-btn" data-act="toast-action">${esc(action)}</button>` : ''}</div>`;
  const btn = root.querySelector('.toast-btn');
  if (btn) btn.onclick = () => { root.innerHTML = ''; onAction && onAction(); };
  toastT = setTimeout(() => { root.innerHTML = ''; }, ms);
  announce(msg);
}
export function clearToast() { clearTimeout(toastT); document.getElementById('toast-root').innerHTML = ''; }

// ---- overlay manager: ONE overlay at a time, focus trapped, Escape closes, focus restored, Back closes first ----
let current = null;   // {kind, onClose, trigger, popped}
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export const overlayOpen = () => !!current;
export function selectorFor(el) {
  if (!el || el === document.body) return '';
  if (el.id) return '#' + CSS.escape(el.id);
  const parts = ['data-act', 'data-day', 'data-kind', 'data-v', 'data-id', 'data-field'].filter(a => el.hasAttribute && el.hasAttribute(a));
  if (!parts.length) return '';
  return el.tagName.toLowerCase() + parts.map(a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join('');
}
export function openOverlay({ kind = 'dialog', title, body, labelledBy = 'ov-title', onClose, initialFocus, dismissable = true, wide = false }) {
  const replacing = !!current;
  const prevTrigger = current && current.trigger, prevSel = current && current.triggerSel;
  if (current) closeOverlay(true, false, true);       // replace in place: keep the single history entry
  const root = document.getElementById('overlay-root');
  const trigger = prevTrigger || document.activeElement;
  const triggerSel = prevSel || selectorFor(trigger);
  root.innerHTML = `
    <div class="scrim ${kind}" data-scrim="${dismissable ? '1' : ''}"></div>
    <div class="ov ov-${kind} ${wide ? 'ov-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}" tabindex="-1">
      ${kind === 'sheet' ? '<span class="sheet-grab" aria-hidden="true"></span>' : ''}
      <div class="ov-head"><h2 id="${labelledBy}" class="ov-title">${esc(title)}</h2>${dismissable ? `<button class="icon-btn" data-ov-close aria-label="Close">${icon('close')}</button>` : ''}</div>
      <div class="ov-body">${body}</div>
    </div>`;
  const box = root.querySelector('.ov');
  const scrim = root.querySelector('.scrim');
  requestAnimationFrame(() => { scrim.classList.add('on'); box.classList.add('on'); });
  current = { kind, onClose, trigger, triggerSel, dismissable, box, scrim, popped:false };
  document.body.classList.add('has-overlay');
  const first = (initialFocus && box.querySelector(initialFocus)) || box.querySelector('[data-autofocus]') || box.querySelector(FOCUSABLE) || box;
  setTimeout(() => first.focus({ preventScroll:true }), 30);
  if (!replacing) { try { history.pushState({ ov:1 }, ''); } catch {} }
  return box;
}
export function updateOverlayBody(html) {
  if (!current) return;
  const b = current.box.querySelector('.ov-body');
  const st = b.scrollTop;
  b.innerHTML = html;
  b.scrollTop = st;
}
let ignorePops = 0;
export function closeOverlay(silent = false, fromPop = false, keepHistory = false) {
  if (!current) return;
  const c = current; current = null;
  const root = document.getElementById('overlay-root');
  c.box.classList.remove('on'); c.scrim.classList.remove('on');
  const gone = c.box;
  const done = () => { if (!current) { root.innerHTML = ''; document.body.classList.remove('has-overlay'); } else { gone.remove(); c.scrim.remove(); } };
  const ms = reduced() || keepHistory ? 0 : 200;
  if (ms) setTimeout(done, ms); else done();
  if (!fromPop && !keepHistory) { try { if (history.state && history.state.ov) { ignorePops++; history.back(); } } catch {} }
  if (!silent) {
    c.onClose && c.onClose();
    setTimeout(() => {
      if (current) return;
      if (c.trigger && document.contains(c.trigger)) c.trigger.focus({ preventScroll:true });
      else if (c.triggerSel) { const n = document.querySelector(c.triggerSel); if (n) n.focus({ preventScroll:true }); }
    }, 60);
  }
}
export function getOverlayBox() { return current && current.box; }

document.addEventListener('keydown', e => {
  if (!current) return;
  if (e.key === 'Escape' && current.dismissable) { e.preventDefault(); closeOverlay(); return; }
  if (e.key === 'Tab') {
    const f = [...current.box.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
document.addEventListener('click', e => {
  if (!current) return;
  if (e.target.closest('[data-ov-close]')) closeOverlay();
  else if (e.target.classList && e.target.classList.contains('scrim') && current.dismissable) closeOverlay();
});
window.addEventListener('popstate', () => { if (ignorePops > 0) { ignorePops--; return; } if (current) closeOverlay(false, true); });

export const isPhone = () => matchMedia('(max-width: 767px)').matches;
export const isTablet = () => matchMedia('(min-width: 768px) and (max-width: 1023px)').matches;
export const isWeb = () => matchMedia('(min-width: 1024px)').matches;

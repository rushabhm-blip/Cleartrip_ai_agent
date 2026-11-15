// Connected traveller group. looks.js decides who stands where, which character they are and which single arm is raised
// for each neighbouring pair. Here every raised arm is hidden BEHIND the neighbour's body and only the HAND is drawn in front,
// resting on the top of that neighbour's far shoulder. Each person is a body layer (hand cut out with a mask) plus one hand
// layer per raised arm. Bodies share a baseline and a per-asset scale k so shoulder heights match; spacing comes from the
// palm-on-shoulder contact point, never from image rectangles. Nothing is stretched or rotated.
import { ASSETS } from './data.js';
import { arrange } from './looks.js';
import { esc, reduced } from './ui.js';

const BASE = 'assets/chars3/';
const H = 720;                                   // reference height; geometry is in these px
const DEBUG = /[?&]debug\b/.test(location.search);
Object.values(ASSETS).forEach(a => { new Image().src = `${BASE}${a.img}.webp`; new Image().src = `${BASE}${a.img}_head.webp`; });

const OUT = 34;
const HAND_UP = 26;       // px: lift the hand layer of LONG arms (their cut is hidden behind the neighbour) so the palm rests on the shoulder top, not the chest         // px: rest the hand out on the shoulder TOP (toward the shoulder tip), not on the collar or chest
const SHOW_HANDS = false;   // hands in front of the neighbour looked wrong on chests; the whole arm now stays behind the neighbour
const TUCK = 40;       // px: short (middle) arms: bring the neighbour closer, hand a little deeper on the shoulder        // px: short (middle) arms tuck the neighbour in closer, hand deeper on the shoulder
const ARM_LONG = 120;   // px: palm-to-shoulder distance above which the hand lands on the far shoulder
const trunc = n => (n.length > 13 ? n.slice(0, 12) + '…' : n);
const EASE = 'cubic-bezier(.2,.8,.2,1)';
let prev = null;   // {id -> {cx, h, key}} measured relative to the mount in the previous render

/** Where B's left edge goes so that A's right palm lands on B's shoulder. A long arm (end pose) reaches behind the neighbour to their
 *  FAR shoulder; a shorter middle-pose arm rests on the NEAR one and tucks in closer. Either way the arm is hidden behind the
 *  neighbour (when it stands in front) and only the hand shows on top of the shoulder. */
const longR = a => a.rp[0] - a.rs[0] > ARM_LONG, longL = a => a.ls[0] - a.lp[0] > ARM_LONG;
const xFromA = (A, B) => A.x + A.a.k * A.a.rp[0] - B.a.k * (longR(A.a) ? B.a.rs[0] + OUT : B.a.ls[0]) - (longR(A.a) ? 0 : TUCK + (A.a.tuck || 0));
const xFromB = (A, B) => A.x + A.a.k * (longL(B.a) ? A.a.ls[0] - OUT : A.a.rs[0]) - B.a.k * B.a.lp[0] - (longL(B.a) ? 0 : TUCK + (B.a.tuck || 0));

/** Solve the chain left to right. x = left edge in 720-px units; widths are a.w * a.k. Gap 0: right person raises, 1: left, 2: both. */
export function layout(travellers) {
  const arr = arrange(travellers);
  const n = arr.items.length;
  const items = arr.items.map((r, i) => ({ ...r, a: ASSETS[r.key], x: 0,
    upL: i > 0 && arr.gaps[i - 1] !== 1, upR: i < n - 1 && arr.gaps[i] !== 0 }));
  for (let i = 1; i < n; i++) {
    const A = items[i - 1], B = items[i], g = arr.gaps[i - 1];
    B.x = g === 1 ? xFromA(A, B) : g === 0 ? xFromB(A, B) : (xFromA(A, B) + xFromB(A, B)) / 2;     // two-arm pair: split the difference
  }
  return { items, gaps: arr.gaps, degraded: arr.degraded };
}
/** Contact error per raised arm in 720-px units (0 by construction for single-arm pairs; split between both arms otherwise). */
export function contactErrors(travellers) {
  const { items, gaps } = layout(travellers), out = [];
  for (let i = 1; i < items.length; i++) {
    const A = items[i - 1], B = items[i], g = gaps[i - 1], dx = [];
    if (g !== 0) dx.push(Math.round(A.x + A.a.k * A.a.rp[0] - (B.x + B.a.k * (longR(A.a) ? B.a.rs[0] + OUT : B.a.ls[0]) - (longR(A.a) ? 0 : TUCK))));
    if (g !== 1) dx.push(Math.round(B.x + B.a.k * B.a.lp[0] - (A.x + A.a.k * (longL(B.a) ? A.a.ls[0] - OUT : A.a.rs[0]) - (longL(B.a) ? 0 : TUCK))));
    out.push({ pair: `${A.t.name}|${B.t.name}`, dx: dx.map(d => Math.abs(d)).reduce((m, d) => Math.max(m, d), 0), arms: dx.length });
  }
  return out;
}
const clipPath = (a, r, side) => {          // 3px overlap toward the arm hides the seam between body layer and hand layer
  const x0 = side === 'r' ? r[0] - 3 : r[0], x1 = side === 'l' ? r[2] + 3 : r[2];
  return `clip-path:inset(${(r[1] / H * 100).toFixed(2)}% ${(100 - x1 / a.w * 100).toFixed(2)}% ${(100 - r[3] / H * 100).toFixed(2)}% ${(x0 / a.w * 100).toFixed(2)}%)`;
};

// the hand layer's inner (wrist) edge fades out over ~9px so the cut dissolves into the neighbour instead of showing as a straight line
const fade = (a, r, side) => { const m = side === 'l' ? `linear-gradient(90deg,#000 ${((r[2] - 9) / a.w * 100).toFixed(2)}%,transparent ${((r[2] + 2) / a.w * 100).toFixed(2)}%)` : `linear-gradient(270deg,#000 ${(100 - (r[0] + 9) / a.w * 100).toFixed(2)}%,transparent ${(100 - (r[0] - 2) / a.w * 100).toFixed(2)}%)`; return `-webkit-mask-image:${m};mask-image:${m};`; };

/** Render (or update) the group. Existing people glide to their final positions, the new one slides in, the name appears last. */
export function renderGroup(container, travellers, { animateId = null, interactive = true } = {}) {
  const n = travellers.length;
  const { items } = layout(travellers);
  const minX = Math.min(...items.map(f => f.x)), maxX = Math.max(...items.map(f => f.x + f.a.w * f.a.k));
  const names = items.map(f => f.t.name).join(', ');
  let stage = '', rest = '';
  items.forEach(({ t, a, x, z, upL, upR, key }) => {
    const ax = x - minX, k = a.k;
    const pos = `--x:${ax.toFixed(1)};--w:${(a.w * k).toFixed(1)};--k:${k};--t:${(H * (1 - k)).toFixed(1)}`;
    const img = `<img src="${BASE}${a.img}.webp" alt="" draggable="false" width="${a.w}" height="${H}">`;
    // Each raised arm is its own layer BEHIND every torso, so it can never cross in front of a neighbour; only the hand (its own
    // layer, in front) shows. The torso layer has the arm region cut out with a mask; the arm and hand layers are complementary clips.
    const arms = [upL && a.hl && ['l', a.hl, 0, a.cl], upR && a.hr && ['r', a.hr, a.cr, a.w]].filter(Boolean);
    const hv = arms.map(([, , x0, x1], j) => `--hx${j}:${x0};--hy${j}:0;--hw${j}:${x1 - x0};--hh${j}:${H};`).join('');
    stage += `<div class="cg-fig cg-base ${arms.length ? 'holes-' + arms.length : ''}" data-char="${t.id}" data-owner="${t.id}" data-key="${key}" data-cx="${a.cx * k}" data-fw="${(a.w * k).toFixed(1)}" style="${pos};${hv}z-index:${10 + z}" aria-hidden="true">${img}</div>`;
    for (const [side, r] of arms) {
      const [x0, x1] = SHOW_HANDS ? (side === 'l' ? [r[2] - 3, a.cl + 3] : [a.cr - 3, r[0] + 3]) : (side === 'l' ? [0, a.cl + 3] : [a.cr - 3, a.w]);
      stage += `<div class="cg-fig cg-arm" data-owner="${t.id}" style="${pos};z-index:1;clip-path:inset(0% ${(100 - x1 / a.w * 100).toFixed(2)}% 0% ${(x0 / a.w * 100).toFixed(2)}%)">${img}</div>`;
      if (SHOW_HANDS) stage += `<div class="cg-fig cg-hand" data-owner="${t.id}" style="${pos};z-index:${100 + z};${clipPath(a, r, side)};${fade(a, r, side)}transform:translateY(calc(-1 * ${HAND_UP} * var(--u)))">${img}</div>`;
    }    const cxu = ax + a.cx * k;
    if (interactive) rest += `<button type="button" class="cg-hit" data-owner="${t.id}" style="--x:${(cxu - 100).toFixed(1)};z-index:200" data-act="edit-traveller" data-id="${t.id}" aria-label="Edit ${esc(t.name)}"></button>`;
    rest += `<span class="cg-name" data-owner="${t.id}" data-labelfor="${t.id}" style="--x:${cxu.toFixed(1)};z-index:210" title="${esc(t.name)}">${esc(trunc(t.name))}</span>`;
    if (DEBUG) {
      const pt = (p, c) => p ? `<i class="cg-dbg" style="--x:${(ax + p[0] * k).toFixed(1)};--y:${(H * (1 - k) + p[1] * k).toFixed(1)};background:${c}"></i>` : '';
      rest += pt(a.ls, '#2563eb') + pt(a.rs, '#2563eb') + (upL ? pt(a.lp, '#dc2626') : '') + (upR ? pt(a.rp, '#dc2626') : '') + `<i class="cg-dbg" style="--x:${cxu.toFixed(1)};--y:700;background:#16a34a"></i>`;
    }
  });
  container.innerHTML = `<div class="cg-row" style="--wu:${((maxX - minX) / H).toFixed(4)}" role="img" aria-label="Travellers: ${esc(names)}"><div class="cg-stage">${stage}</div>${rest}</div>`;

  const base = container.getBoundingClientRect();
  const measure = el => { const r = el.getBoundingClientRect(); return { cx: r.left + r.width * (+el.dataset.cx / +el.dataset.fw) - base.left, h: r.height, key: el.dataset.key }; };
  const now = {};
  travellers.forEach(t => { now[t.id] = measure(container.querySelector(`[data-char="${t.id}"]`)); });
  const was = prev; prev = now;
  if (reduced() || !was) return;

  const owned = id => [...container.querySelectorAll(`[data-owner="${id}"]`)];
  // 1) existing people glide to their final slot (and scale) in 240ms; hands move with their body so contact never separates.
  //    A pose change (same face, other arm raised) is anchored on the body centre and hidden by a brief fade.
  for (const t of travellers) {
    const o = was[t.id], nw = now[t.id];
    if (!o || t.id === animateId) continue;
    const dx = o.cx - nw.cx, s = o.h / nw.h, swapped = o.key !== nw.key;
    if (Math.abs(dx) < .5 && Math.abs(s - 1) < .005 && !swapped) continue;
    for (const el of owned(t.id)) {
      if (el.classList.contains('cg-name')) { el.animate([{ transform: `translateX(calc(-50% + ${dx}px))` }, { transform: 'translateX(-50%)' }], { duration: 240, easing: EASE }); continue; }
      if (el.classList.contains('cg-hit')) { el.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 240, easing: EASE }); continue; }
      el.style.transformOrigin = 'center bottom';
      el.animate([{ transform: `translateX(${dx}px) scale(${s})`, opacity: swapped ? .3 : 1 }, { transform: 'none', opacity: 1 }], { duration: swapped ? 280 : 240, easing: EASE });
    }
  }
  // 2) the new traveller starts 24px outside, arrives over 440ms (fade-in in the first 120ms, 2px settle); name last
  if (animateId) {
    const idx = items.findIndex(f => f.t.id === animateId);
    const dir = idx >= items.length / 2 ? 1 : -1;
    for (const el of owned(animateId)) {
      if (el.classList.contains('cg-name')) { el.animate([{ opacity: 0 }, { opacity: 0, offset: .8 }, { opacity: 1 }], { duration: 120 + 560, easing: 'linear', fill: 'backwards' }); continue; }
      if (el.classList.contains('cg-hit')) continue;
      el.style.transformOrigin = 'center bottom';
      el.animate([
        { transform: `translateX(${24 * dir}px)`, opacity: 0, offset: 0 },
        { transform: `translateX(${18 * dir}px)`, opacity: 1, offset: .12 },
        { transform: `translateX(${-2 * dir}px) translateY(-2px)`, opacity: 1, offset: .86 },
        { transform: 'none', opacity: 1 },
      ], { duration: 440, delay: 140, easing: EASE, fill: 'backwards' });
    }
    setTimeout(() => { const row = container.querySelector('.cg-row'); const f = container.querySelector(`[data-char="${animateId}"]`); f && row && row.scrollWidth > container.clientWidth && f.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }, 80);
  }
}

/** Leave: the member (body and hands) fades over 160ms; the caller then updates the data, and looks.js recomputes poses/positions before the reflow. */
export function playLeave(container, id) {
  const els = [...container.querySelectorAll(`[data-owner="${id}"]`)];
  if (!els.length || reduced()) return Promise.resolve();
  return Promise.all(els.map(el => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards', easing: 'ease-in' }).finished)).catch(() => {});
}
export function resetGroupMemory() { prev = null; }

// ---- circular head avatars used in chat, approvals and headers (same face as the figure shown for that traveller) ----
export function avatar(t, size = 40, extra = '') {
  const g = t.style === 'female' ? 'female' : 'male', id = t.ident >= 1 && t.ident <= 4 ? t.ident : 1;
  return `<span class="avatar ${extra}" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(t.name)}"><img src="${BASE}middle_${g}_0${id}_head.webp" alt="" width="${size}" height="${size}" draggable="false"></span>`;
}

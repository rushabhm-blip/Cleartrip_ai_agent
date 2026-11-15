// Choosing characters, poses and left-to-right order for the traveller group. Pure and separate from names, budgets and invitations.
//
// The art set (Traveller_Group_14_Assets): per gender four identities (1-4). Poses that exist:
//   S  solo, both arms down ........ identity 1 only
//   E  left-end, RIGHT arm raised ... identity 2 only
//   R  right-end, LEFT arm raised ... identity 4 only
//   M  middle, BOTH arms raised ..... identities 1-4
// Rules: no character appears twice, the organiser keeps identity 1, nobody raises an arm toward nothing, and every
// neighbouring pair is joined by at least one raised arm. Each gap between neighbours is 0 = the right person raises their
// left arm, 1 = the left person raises their right arm, 2 = both do. Single-arm pairs are preferred; a two-arm pair is used
// only when the art set needs it (that is what makes up to 4 + 4 distinct people possible). A person's pose follows from
// the gaps on either side. The search changes as few existing people as possible (faces first, then order, then poses).

const ID_FOR = { S: 1, E: 2, R: 4 };
const typeOf = (leftUp, rightUp) => (leftUp ? (rightUp ? 'M' : 'R') : (rightUp ? 'E' : 'S'));
export const assetKey = (t, type, ident) => {
  const g = t.style === 'female' ? 'female' : 'male';
  return type === 'S' ? `solo_${g}` : type === 'E' ? `end_${g}_left` : type === 'R' ? `end_${g}_right` : `mid_${g}_${ident}`;
};
const gOf = t => (t.style === 'female' ? 'f' : 'm');
export const MAX_PEOPLE = 8;

const decode = (code, n) => { const g = []; for (let i = 0; i < n; i++) { g.push(code % 3); code = Math.floor(code / 3); } return g; };
const typesFor = gaps => {
  const ext = [1, ...gaps, 0], out = [];
  for (let i = 0; i <= gaps.length; i++) out.push(typeOf(ext[i] === 0 || ext[i] === 2, ext[i + 1] === 1 || ext[i + 1] === 2));
  return out;
};
const doubles = gaps => gaps.filter(g => g === 2).length;

function* subsets(n, k, start = 0, cur = []) {
  if (cur.length === k) { yield cur.slice(); return; }
  for (let i = start; i < n; i++) { cur.push(i); yield* subsets(n, k, i + 1, cur); cur.pop(); }
}

/** Identities for a fixed left-to-right order and pose types, or null. prev: Map id -> {ident}. */
function identFor(order, types, org, prev) {
  const N = order.length, ident = new Array(N).fill(0);
  for (const g of 'mf') {
    const pos = order.map((t, i) => i).filter(i => gOf(order[i]) === g);
    if (pos.length > 4) return null;
    const used = new Set(); const mids = [];
    const oi = order.indexOf(org);
    if (gOf(org) === g) {
      if (types[oi] !== 'S' && types[oi] !== 'M') return null;
      ident[oi] = 1; used.add(1);
    }
    for (const i of pos) {
      if (order[i] === org) continue;
      if (types[i] === 'M') { mids.push(i); continue; }
      const id = ID_FOR[types[i]];
      if (used.has(id)) return null;
      ident[i] = id; used.add(id);
    }
    const rest = [];
    for (const i of mids) { const p = prev.get(order[i].id); if (p && !used.has(p.ident)) { ident[i] = p.ident; used.add(p.ident); } else rest.push(i); }
    for (const i of rest) { const f = [3, 1, 2, 4].find(k => !used.has(k)); if (!f) return null; ident[i] = f; used.add(f); }
  }
  return ident;
}

/** Best gaps/identities for one fixed order. */
function bestFor(order, org, prev) {
  const N = order.length;
  let best = null;
  const total = 3 ** (N - 1);
  for (let code = 0; code < total; code++) {
    const gaps = decode(code, N - 1), types = typesFor(gaps);
    const ident = identFor(order, types, org, prev);
    if (!ident) continue;
    let cost = doubles(gaps) * 50;
    for (let i = 0; i < N; i++) {
      const p = prev.get(order[i].id);
      if (p) { if (p.ident !== ident[i]) cost += 1000; if (p.type && p.type !== types[i]) cost += 1; }
    }
    if (!best || cost < best.cost) best = { order, gaps, types, ident, cost };
  }
  return best;
}

/** Counts-only feasibility (no assignment of individual people): can this set of genders be shown with distinct characters? */
const feasCache = new Map();
function countFeasible(genders, orgG) {
  const N = genders.length;
  if (N > MAX_PEOPLE) return false;
  if (N === 1) return true;
  const key = orgG + genders.join('');
  if (feasCache.has(key)) return feasCache.get(key);
  const nm = genders.filter(g => g === 'm').length;
  let ok = false;
  outer: for (let code = 0; code < 3 ** (N - 1); code++) {
    const types = typesFor(decode(code, N - 1));
    for (const mpos of subsets(N, nm)) {
      const inM = new Set(mpos);
      const grp = { m: mpos, f: [...Array(N).keys()].filter(i => !inM.has(i)) };
      let good = true;
      for (const g of 'mf') {
        const c = { S: 0, E: 0, R: 0, M: 0 };
        grp[g].forEach(i => c[types[i]]++);
        if (c.S > 1 || c.E > 1 || c.R > 1 || grp[g].length > 4) { good = false; break; }
        if (g === orgG && !(c.S === 1 || c.M >= 1)) { good = false; break; }
      }
      if (good) { ok = true; break outer; }
    }
  }
  feasCache.set(key, ok);
  return ok;
}

/** Constructive fallback: first feasible gap pattern (fewest double pairs), people dropped into it in array order. */
function constructive(people, org) {
  const N = people.length, males = people.filter(t => gOf(t) === 'm'), females = people.filter(t => gOf(t) === 'f');
  const codes = [...Array(3 ** (N - 1)).keys()].sort((a, b) => doubles(decode(a, N - 1)) - doubles(decode(b, N - 1)));
  for (const code of codes) {
    const gaps = decode(code, N - 1), types = typesFor(gaps);
    for (const mpos of subsets(N, males.length)) {
      const inM = new Set(mpos), fpos = [...Array(N).keys()].filter(i => !inM.has(i));
      const order = new Array(N);
      // the organiser takes an S position of their gender if there is one, otherwise an M position
      const mine = gOf(org) === 'm' ? mpos : fpos;
      const op = mine.find(i => types[i] === 'S') ?? mine.find(i => types[i] === 'M');
      if (op === undefined) continue;
      order[op] = org;
      const restM = males.filter(t => t !== org), restF = females.filter(t => t !== org);
      mpos.filter(i => i !== op).forEach((p, j) => { order[p] = restM[j]; });
      fpos.filter(i => i !== op).forEach((p, j) => { order[p] = restF[j]; });
      const ident = identFor(order, types, org, new Map());
      if (ident) return { order, gaps, types, ident, cost: 0 };
    }
  }
  return null;
}

let last = new Map();     // id -> {idx, ident, type, style}: remembered so adding someone moves as few existing people as possible
export function resetLooks() { last = new Map(); }
const prevMap = people => {
  const p = new Map();
  people.forEach((t, i) => { const o = last.get(t.id); if (o && o.style === t.style) p.set(t.id, o); else if (t.ident) p.set(t.id, { idx: i, ident: t.ident, type: '', style: t.style }); });
  return p;
};

/** Fallback when no distinct arrangement exists (only for oversized saved state): organiser solo, others right-end pose. Repeats are flagged. */
function degrade(people, org) {
  const rest = people.filter(t => t !== org);
  return { order: [org, ...rest], gaps: rest.map(() => 0), types: ['S', ...rest.map(() => 'R')], ident: [1, ...rest.map(() => 4)], cost: 0, degraded: true };
}

function solve(people, prev) {
  const org = people.find(t => t.role === 'organiser') || people[0];
  if (people.length === 1) return { order: [org], gaps: [], types: ['S'], ident: [1], cost: 0 };
  // existing people keep their previous left-to-right order; newcomers are tried in every slot
  const known = people.filter(t => prev.has(t.id)).sort((a, b) => prev.get(a.id).idx - prev.get(b.id).idx);
  const fresh = people.filter(t => !prev.has(t.id));
  const orders = [];
  if (fresh.length === 1) for (let k = 0; k <= known.length; k++) orders.push([...known.slice(0, k), fresh[0], ...known.slice(k)]);
  else orders.push([...known, ...fresh]);
  let best = null;
  for (const o of orders) { const b = bestFor(o, org, prev); if (b && (!best || b.cost < best.cost)) best = b; }
  return best || constructive(people, org) || degrade(people, org);
}

/** Arrange the group. Mutates only `t.ident`. Returns {items:[{t,type,ident,key,z}], gaps, degraded}. */
export function arrange(people) {
  const sol = solve(people, prevMap(people));
  const z = [0];
  sol.gaps.forEach(g => z.push(z[z.length - 1] + (g === 0 ? -1 : 1)));   // the person a hand points at stands in front, hiding that arm
  const zmin = Math.min(...z);
  const items = sol.order.map((t, i) => ({ t, type: sol.types[i], ident: sol.ident[i], key: assetKey(t, sol.types[i], sol.ident[i]), z: z[i] - zmin + 1 }));
  items.forEach(it => { it.t.ident = it.ident; });
  last = new Map(items.map((it, i) => [it.t.id, { idx: i, ident: it.ident, type: it.type, style: it.t.style }]));
  return { items, gaps: sol.gaps, degraded: !!sol.degraded };
}

const orgGender = people => gOf(people.find(t => t.role === 'organiser') || people[0]);
/** Can another traveller of this gender join with all-distinct characters? */
export const canAdd = (people, style) => countFeasible([...people.map(gOf), style === 'female' ? 'f' : 'm'], orgGender(people));
/** Can this traveller switch gender style? */
export const canRestyle = (people, id, style) => countFeasible(people.map(t => (t.id === id ? (style === 'female' ? 'f' : 'm') : gOf(t))), orgGender(people.map(t => (t.id === id ? { ...t, style } : t))));
export const visualOrder = people => arrange(people).items.map(i => i.t);

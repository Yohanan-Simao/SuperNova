/**
 * Prédio: a four-storey block laid brick by brick, in a spiral. The wall is a
 * hollow ring of single bricks, in running bond. The bricklayer goes round the
 * ring and keeps going: each lap is one course, so the work climbs as a helix,
 * and a concrete slab drops on at the top of every storey. Windows are left
 * open in the front faces and glazed once their last course is up; the ground
 * floor has a door. A dashed outline holds the finished building. Left alone
 * the work runs once, from the bare foundation to the finished block, and
 * stays; then two more blocks, set back to the left and right, fade in behind
 * it, drawn whole and without the bricklaying. It does not answer the pointer. The slider is how far a brick falls
 * before it lands.
 *
 * The pattern: an ambient build. A spring drives one number, the level, and
 * every brick reads its own share of it.
 */
const {
  Cam, clamp, facing, fillet, fit, mk, open, poly, prism, proj, put, r2, reducedMotion, register, rings, seg, solid,
  spring, stepS, tdone, tval, tween, tset, disposer,
} = HL;

const STOREYS = 4, COURSES = 6, CH = 3, SH = 4, T = 4, BRICK = 8, W = 72, D = 48;
const FLOOR = COURSES * CH + SH, TOP = STOREYS * FLOOR, BUILD = 10, SPAN = 14, SLAB = 40;
/** The two blocks behind: [offset x, offset y, storeys]. Moving along -x or +y goes left, along -x or -y goes back. */
const BACK = [[-90, 0, 3], [0, -90, 5]], SHADE = 0.55, WAIT = 0.4;
let P_ = null;

/** The four runs of wall, in the order the bricklayer goes round. Openings are [from, to, first course, last course, door]. */
const SIDES = [
  { ax: "x", lo: 0, len: W, box: (u0, u1) => [u0, 0, u1, T], open: () => [] },
  { ax: "y", lo: T, len: D - T, box: (u0, u1) => [W - T, T + u0, W, T + u1], open: () => [[6, 20, 1, 4], [28, 42, 1, 4]] },
  { ax: "x", lo: 0, len: W - T, box: (u0, u1) => [u0, D - T, u1, D], open: (s) => (s === 0 ? [[6, 20, 1, 4], [28, 44, 0, 4, true], [52, 66, 1, 4]] : [[8, 22, 1, 4], [29, 43, 1, 4], [50, 64, 1, 4]]) },
  { ax: "y", lo: T, len: D - 2 * T, box: (u0, u1) => [0, T + u0, T, T + u1], open: () => [] },
];

/** A run's brick joints for one course: running bond, so odd courses start on a half brick. */
function bonds(len, odd) {
  const n = Math.round(len / BRICK), l = len / n;
  return odd ? [0, ...Array.from({ length: n }, (_, i) => (i + 0.5) * l), len] : Array.from({ length: n + 1 }, (_, i) => i * l);
}

/** Every item in the order it is laid; `key` is the order it is drawn in (low to high, far to near). */
const ITEMS = [];
for (let s = 0; s < STOREYS; s++) {
  for (let j = 0; j < COURSES; j++) {
    const z0 = s * FLOOR + j * CH;
    SIDES.forEach((side, k) => {
      const holes = side.open(s).filter(([, , a, b]) => j >= a && j <= b), cuts = bonds(side.len, j % 2), pieces = [];
      for (let i = 0; i < cuts.length - 1; i++) {
        let runs = [[cuts[i], cuts[i + 1]]];
        for (const [a, b] of holes) runs = runs.flatMap(([u0, u1]) => [[u0, Math.min(u1, a - side.lo)], [Math.max(u0, b - side.lo), u1]]).filter(([u0, u1]) => u1 - u0 > 1.2);
        pieces.push(...runs);
      }
      (k > 1 ? pieces.reverse() : pieces).forEach(([u0, u1]) => {
        const [x0, y0, x1, y1] = side.box(u0, u1), [ring, inner] = rings(x0, y0, x1, y1, 0.8, 0.45);
        ITEMS.push({ ring, inner, z0, z1: z0 + CH, s, span: SPAN, key: z0 * 1e3 + x0 + x1 + y0 + y1 });
      });
      // a window is glazed once the bricklayer has closed its last course
      holes.filter(([, , , b]) => b === j).forEach(([a, b, j0, , door]) => {
        const at = side.ax === "x" ? (u, z) => P_(u, D, z) : (u, z) => P_(W, u, z);
        ITEMS.push({ glass: { a, b, zb: s * FLOOR + j0 * CH, door, at }, z0, z1: z0 + CH, s, span: SPAN, key: z0 * 1e3 + 500 + a });
      });
    });
  }
  const [ring, inner] = rings(-2.5, -2.5, W + 2.5, D + 2.5, 3, 1.2), z0 = s * FLOOR + COURSES * CH;
  ITEMS.push({ ring, inner, z0, z1: z0 + SH, s, span: SLAB, key: z0 * 1e3 });
}
ITEMS.forEach((it, t) => { it.t = t; });
const M = ITEMS.length + SLAB, ORDER = ITEMS.slice().sort((a, b) => a.key - b.key);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let drop = value;
  const C = Cam(45, 0.5, 1.3);
  fit(C, [[-98, 56, -4], [W + 8, -98, -4], [W + 8, D + 8, -4], [-98, -98, -4], [-3, -3, TOP + 20], [W + 3, D + 3, TOP + 20], [0, -98, 5 * FLOOR], [W, -98, 5 * FLOOR], [-98, 56, 3 * FLOOR]], 200, 166);
  const P = proj(C), front = facing(C), back = mk("g", { opacity: 0 }, svg), g = mk("g", {}, svg);
  P_ = P;

  // the finished building, dashed, painted first so every plate that is built hides it
  const guide = [[0, 0], [W, 0], [W, D], [0, D]].map(([x, y]) => P(x, y, TOP));
  mk("path", { class: "nf dash", d: open(guide.concat([guide[0]])) + [[W, 0], [W, D], [0, D]].map(([x, y]) => seg(P(x, y, 0), P(x, y, TOP))).join("") }, g);
  const [fr, fi] = rings(-8, -8, W + 8, D + 8, 3, 1.2);
  put(solid(g), prism(P, front, fr, fi, -4, 0));

  ORDER.forEach((it) => { it.drawn = NaN; it.el = it.glass ? mk("path", { class: "sil" }, g) : solid(g); });

  /** The glass of one opening, a plain rounded panel so no brick shows inside it. */
  const pane = ({ a, b, zb, door, at }, lift, z1) => poly(fillet([[a, zb + lift], [b, zb + lift], [b, z1], [a, z1]], [door ? 0.6 : 1.2, door ? 0.6 : 1.2, 1.2, 1.2]).map(([u, v]) => at(u, v)));

  /** Item it at level lv: laid when lv passes it, falling in until then, absent before. */
  function draw(it, lv) {
    const f = clamp((lv - it.t) / it.span, 0, 1);
    if (f === it.drawn) return;
    it.drawn = f;
    const lift = (1 - f) * (1 - f) * (it.span === SLAB ? drop * 2 : drop);
    if (it.glass) { it.el.setAttribute("d", f > 0 ? pane(it.glass, lift, it.z1 + lift) : ""); return; }
    put(it.el, f > 0 ? prism(P, front, it.ring, it.inner, it.z0 + lift, it.z1 + lift) : { sil: "", crease: "" });
  }

  /** A block set back from the main one, drawn whole: for each storey a wall, its windows and a slab. */
  BACK.forEach(([ox, oy, n]) => {
    const [fr2, fi2] = rings(ox - 8, oy - 8, ox + W + 8, oy + D + 8, 3, 1.2);
    put(solid(back), prism(P, front, fr2, fi2, -4, 0));
    for (let s = 0; s < n; s++) {
      const z0 = s * FLOOR, [wr, wi] = rings(ox, oy, ox + W, oy + D, 2, 0.8), [sr, si] = rings(ox - 2.5, oy - 2.5, ox + W + 2.5, oy + D + 2.5, 3, 1.2);
      put(solid(back), prism(P, front, wr, wi, z0, z0 + COURSES * CH));
      const faces = [[[8, 22], [29, 43], [50, 64], (u, z) => P(ox + u, oy + D, z)], [[6, 20], [28, 42], (u, z) => P(ox + W, oy + u, z)]];
      for (const f of faces) { const at = f.pop(); f.forEach(([a, b]) => mk("path", { class: "sil", d: pane({ a, b, zb: z0 + 3, door: false, at }, 0, z0 + 15) }, back)); }
      put(solid(back), prism(P, front, sr, si, z0 + COURSES * CH, z0 + FLOOR));
    }
  });
  const fade = tween(0, 1600);
  let faded = false, shade = 0;

  const level = spring(0);
  let lit = null, clock = 0;
  const mark = () => {
    const top = ITEMS[clamp(Math.floor(level.x), 0, ITEMS.length - 1)];
    if (top === lit || level.x <= 0) return;
    lit?.el.sil?.classList.remove("hi");
    top.el.sil?.classList.add("hi");
    lit = top;
  };
  const plan = (t) => M * clamp(t / BUILD, 0, 1);
  level.x = level.t = plan(clock);
  const B = register(stage, (dt) => {
    clock += dt;
    level.t = reducedMotion() ? M : plan(clock);
    const moving = stepS(level, dt), now = performance.now(), done = reducedMotion() || clock >= BUILD + WAIT;
    for (const it of ORDER) draw(it, level.x);
    mark();
    if (done && !faded) { faded = true; tset(fade, 1, now, 0); }
    const o = r2(SHADE * tval(fade, now));
    if (o !== shade) { shade = o; back.setAttribute("opacity", o); }
    return moving || !done || !tdone(fade, now);
  });
  bag.add(B.unregister);

  bag.add(() => svg.replaceChildren());
  return { set: (v) => { drop = v; for (const it of ITEMS) it.drawn = NaN; B.wake(); }, destroy: bag.dispose };
}

hairline({
  name: "predio",
  means: "Um prédio de quatro pavimentos sobe tijolo por tijolo em espiral, sozinho, até ficar pronto.",
  rules: [5, 7, 8, 9],
  range: [4, 10, 20],
  tour: [[200, 248], [200, 196], [200, 140], [200, 100], null],
  mount,
});

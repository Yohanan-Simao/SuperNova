/**
 * Prédio: a four-storey block going up course by course on its own. Each
 * storey is six courses of brick, with the mortar joints staggered, and a
 * concrete slab on top; the ground floor has a door, every floor has windows.
 * A dashed outline holds the finished building. Left alone the work runs once,
 * from the bare foundation to the finished block, and stays there. A pointer
 * takes over: its height is the height of the work, the course
 * being laid is the bright one and settles from above. The slider is how far a
 * course falls before it lands.
 *
 * The pattern: scrub, as Exploded, with an ambient build that gives way to a
 * hand. A spring drives one number, the level, and every course reads its own
 * share of it. The pointer's height is read on the ground column of the
 * finished building, which never moves (rule 01).
 */
const {
  Cam, clamp, facing, fillet, fit, mk, open, pointer, poly, prism, proj, put, reducedMotion, register, rings, seg, solid,
  spring, stepS, disposer,
} = HL;

const STOREYS = 4, COURSES = 6, CH = 3, SH = 4, BRICK = 8, W = 72, D = 48;
const FLOOR = COURSES * CH + SH, TOP = STOREYS * FLOOR, N = STOREYS * (COURSES + 1);
const BUILD = 14.3;

/** Openings as [from, to, first course, last course, is a door], per face and storey. */
const OPEN_Y = (s) => (s === 0 ? [[6, 20, 1, 4], [28, 44, 0, 4, true], [52, 66, 1, 4]] : [[8, 22, 1, 4], [29, 43, 1, 4], [50, 64, 1, 4]]);
const OPEN_X = () => [[6, 20, 1, 4], [28, 42, 1, 4]];

/** Every item in the order it is laid: six brick courses, then the slab, storey by storey. */
const ITEMS = [];
for (let s = 0; s < STOREYS; s++) {
  for (let j = 0; j < COURSES; j++) {
    const [ring, inner] = rings(0, 0, W, D, 2, 0.8), z0 = s * FLOOR + j * CH;
    const on = (list) => list.filter(([, , a, b]) => j >= a && j <= b);
    ITEMS.push({ ring, inner, z0, z1: z0 + CH, off: (j % 2) * (BRICK / 2), j, ox: on(OPEN_X()), oy: on(OPEN_Y(s)) });
  }
  const [ring, inner] = rings(-2.5, -2.5, W + 2.5, D + 2.5, 3, 1.2), z0 = s * FLOOR + COURSES * CH;
  ITEMS.push({ ring, inner, z0, z1: z0 + SH, off: -1 });
}

/** Where the work is, in items, t seconds in: a steady climb to the finished building, where it stays. */
const plan = (t) => N * clamp(t / BUILD, 0, 1);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let drop = value;
  const C = Cam(45, 0.5, 1.62);
  fit(C, [[-8, -8, -4], [W + 8, D + 8, -4], [W + 8, -8, -4], [-8, D + 8, -4], [-3, -3, TOP + 36], [W + 3, D + 3, TOP + 36], [W + 3, -3, TOP + 36], [-3, D + 3, TOP + 36]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);

  // the finished building, dashed, painted first so every plate that is built hides it
  const guide = [[0, 0], [W, 0], [W, D], [0, D]].map(([x, y]) => P(x, y, TOP));
  mk("path", { class: "nf dash", d: open(guide.concat([guide[0]])) + [[W, 0], [W, D], [0, D]].map(([x, y]) => seg(P(x, y, 0), P(x, y, TOP))).join("") }, g);
  const [fr, fi] = rings(-8, -8, W + 8, D + 8, 3, 1.2);
  put(solid(g), prism(P, front, fr, fi, -4, 0));

  ITEMS.forEach((it) => {
    const grp = mk("g", {}, g);
    it.el = solid(grp);
    it.joints = mk("path", { class: "nf lo" }, grp);
    it.glass = mk("path", { class: "sil" }, grp);
    it.drawn = NaN;
    if (it.off >= 0) { it.cuts = []; for (let k = it.off || BRICK; k < Math.max(W, D); k += BRICK) it.cuts.push(k); }
  });

  /** The opening, once its top course is laid: one plain rounded panel, filled, so no brick course or joint shows inside it. */
  function openings(list, at, j, z1) {
    return list.filter(([, , , j1]) => j1 === j).map(([a, b, j0, , door]) => {
      const zb = z1 - (j - j0 + 1) * CH, zt = z1;
      return poly(fillet([[a, zb], [b, zb], [b, zt], [a, zt]], [door ? 0.6 : 1.2, door ? 0.6 : 1.2, 1.2, 1.2]).map(([u, v]) => at(u, v)));
    }).join("");
  }

  /** Item i at level lv: laid when lv passes it, falling in until then, absent before. */
  function draw(i, lv) {
    const it = ITEMS[i], f = clamp(lv - i, 0, 1);
    if (f === it.drawn) return;
    it.drawn = f;
    if (f <= 0) { put(it.el, { sil: "", crease: "" }); for (const p of [it.joints, it.glass]) p.setAttribute("d", ""); return; }
    const lift = (1 - f) * (1 - f) * drop, z0 = it.z0 + lift, z1 = it.z1 + lift;
    put(it.el, prism(P, front, it.ring, it.inner, z0, z1));
    if (!it.cuts) return;
    const hole = (list, k) => list.some(([a, b]) => k > a - 0.5 && k < b + 0.5);
    it.joints.setAttribute("d", it.cuts.map((k) => (k < D && !hole(it.ox, k) ? seg(P(W, k, z0), P(W, k, z1)) : "") + (k < W && !hole(it.oy, k) ? seg(P(k, D, z0), P(k, D, z1)) : "")).join(""));
    it.glass.setAttribute("d", openings(it.oy, (k, z) => P(k, D, z), it.j, z1) + openings(it.ox, (k, z) => P(W, k, z), it.j, z1));
  }

  const level = spring(0);
  let lit = -1, clock = 0, hand = false;
  const mark = () => {
    const top = clamp(Math.ceil(level.x) - 1, -1, N - 1);
    if (top === lit) return;
    if (lit >= 0) ITEMS[lit].el.sil.classList.remove("hi");
    if (top >= 0) ITEMS[top].el.sil.classList.add("hi");
    lit = top;
  };
  level.x = level.t = plan(clock);
  const B = register(stage, (dt) => {
    if (!hand) { clock += dt; level.t = reducedMotion() ? N : plan(clock); }
    const moving = stepS(level, dt);
    for (let i = 0; i < N; i++) draw(i, level.x);
    mark();
    return moving || (!hand && clock < BUILD && !reducedMotion());
  });
  bag.add(B.unregister);

  // hit: the height of the pointer on the finished building's axis, which never moves
  const yb = P(W / 2, D / 2, 0)[1], yt = P(W / 2, D / 2, TOP)[1], xL = P(-8, D + 8, 0)[0], xR = P(W + 8, -8, 0)[0];
  function set(p) {
    if (!p || p[0] < xL || p[0] > xR || p[1] < yt - 30 || p[1] > yb + 30) return release();
    hand = true;
    level.t = Math.round(clamp((yb - p[1]) / (yb - yt), 0, 1) * N * 4) / 4;
    read.textContent = level.t >= N ? "pronto" : `pav ${Math.min(STOREYS, Math.floor(level.t / (COURSES + 1)) + 1)}`;
    B.wake();
  }
  /** The work picks up from where it stands: the clock goes to the point of the build that matches the level. */
  function release() {
    if (hand) clock = (clamp(level.t, 0, N) / N) * BUILD;
    hand = false;
    read.textContent = "rest";
    B.wake();
  }

  bag.add(pointer(stage, { move: set, leave: release }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { drop = v; for (const it of ITEMS) it.drawn = NaN; B.wake(); }, destroy: bag.dispose };
}

hairline({
  name: "predio",
  means: "Um prédio de quatro pavimentos sobe fiada por fiada sozinho; a altura do ponteiro assume a obra.",
  rules: [1, 3, 5, 7, 8, 9],
  range: [8, 20, 36],
  tour: [[200, 248], [200, 196], [200, 140], [200, 100], null],
  mount,
});

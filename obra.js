/**
 * Obra: a small house in four stages, stacked. A slab, a concrete frame, the
 * walls with a door and windows, and a gable roof. At rest the frame stands on
 * its slab and the walls and roof hover above it, waiting to be lowered. The
 * stage under the pointer is where the building stops: everything up to it is
 * seated, everything above floats, staggered outwards from the pointer. Over
 * the roof the house is complete. The slider is the stagger, in ms.
 *
 * The pattern: discrete items, as Riffle. The hit test uses the stages' REST
 * heights on screen, so a stage rising out from under the pointer cannot
 * change the choice.
 */
const {
  Cam, clamp, facing, fit, hull, open, poly, proj, rings, ringAt, rrect, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid, prism,
} = HL;

const GAP = 28, REST_GAP = 25, REST_AT = 1, TOP = 22, ROOF = 10;
const bar = (x0, y0, x1, y1, z0, z1, r = 1.2, b = 0.6) => { const [ring, inner] = rings(x0, y0, x1, y1, r, b); return { ring, inner, z0, z1 }; };

// Stage 0 is the slab, 1 the frame, 2 the walls, 3 the roof. Each stage is a list of solids.
const COLS = [];
for (const y of [1, 38]) for (const x of [1, 31, 63]) COLS.push(bar(x, y, x + 4, y + 4, 0, TOP));
COLS.sort((a, b) => (a.ring[0].u + a.ring[0].v) - (b.ring[0].u + b.ring[0].v));
const PILES = [];
for (const y of [2, 40]) for (const x of [2, 32, 62]) PILES.push(bar(x, y, x + 6, y + 6, -17, -3, 2.4, 1));
PILES.sort((a, b) => (a.ring[0].u + a.ring[0].v) - (b.ring[0].u + b.ring[0].v));
const STAGES = [
  [...PILES, bar(-6, -6, 70, 50, -3, 0, 3, 1.2)],
  [...COLS, bar(1, 1, 67, 5, 17, TOP), bar(1, 1, 5, 43, 17, TOP), bar(31, 1, 35, 43, 17, TOP), bar(63, 1, 67, 43, 17, TOP), bar(1, 39, 67, 43, 17, TOP)],
  [bar(0, 0, 68, 44, 0, TOP, 2, 1), bar(8, 44, 22, 47, 0, 3, 1, 0.4), bar(8, 47, 22, 50, 0, 1.5, 0.8, 0.3)],
];
const DOOR = rrect(8, 0, 22, 15, 2, 4), WIN_A = rrect(38, 7, 56, 16, 1.5, 4), WIN_B = rrect(12, 7, 32, 16, 1.5, 4);
const EAVE = rrect(-4, -5, 72, 49, 3, 4), RIDGE = rrect(-2, 20, 70, 24, 1.5, 3);

/** Stage i seated at nominal height, then lifted: how high each stage floats when the building stops at k. */
const lifts = (k, gap) => [0, 1, 2, 3].map((i) => (i <= k ? 0 : (i - k) * gap));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;
  const C = Cam(45, 0.5, 1.95);
  fit(C, [[-6, -6, -17], [70, 50, -17], [70, -6, -17], [-6, 50, -17], [-4, -5, 3 * GAP + TOP + ROOF], [72, 49, 3 * GAP + TOP + ROOF], [-4, 49, 3 * GAP + TOP + ROOF], [72, -5, 3 * GAP + TOP + ROOF]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg);

  const stages = STAGES.map((solids) => ({ solids: solids.map((s) => ({ ...s, el: null })) }));
  stages.push({ solids: [] });
  stages.forEach((st, i) => {
    const grp = mk("g", {}, g);
    st.solids.forEach((s) => { s.el = solid(grp); });
    st.grp = grp; st.lift = tween(lifts(REST_AT, REST_GAP)[i]); st.drawn = NaN;
    if (i >= 2) st.marks = [mk("path", { class: "nf lo" }, grp), mk("path", { class: "nf lo" }, grp)];
    if (i === 3) st.roof = solid(grp);
  });

  /** The marks a stage carries, projected at its current lift: a door and two windows on the walls, the ridge on the roof. */
  function draw(i, lift) {
    const st = stages[i];
    if (lift === st.drawn) return;
    st.drawn = lift;
    st.solids.forEach((s) => put(s.el, prism(P, front, s.ring, s.inner, s.z0 + lift, s.z1 + lift)));
    if (i === 2) {
      const onY = (ring) => poly(ring.map((q) => P(q.u, 44, q.v + lift))), onX = (ring) => poly(ring.map((q) => P(68, q.u, q.v + lift)));
      st.marks[0].setAttribute("d", onY(DOOR) + onY(WIN_A));
      st.marks[1].setAttribute("d", onX(WIN_B));
    }
    if (i === 3) {
      const z0 = TOP + lift, z1 = TOP + ROOF + lift;
      put(st.roof, { sil: poly(hull(ringAt(P, EAVE, z0).concat(ringAt(P, RIDGE, z1)))), crease: seg(P(1, 22, z1), P(67, 22, z1)) + [30, 38].map((y) => seg(P(0, y, TOP + lift + ROOF * (49 - y) / 27), P(68, y, TOP + lift + ROOF * (49 - y) / 27))).join("") });
    }
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    stages.forEach((st, i) => { draw(i, tval(st.lift, now)); if (!tdone(st.lift, now)) moving = true; });
    return moving;
  });
  bag.add(B.unregister);

  // hit: the stages' resting centres on screen, a column wide enough for the house; nothing moves them.
  const rest = lifts(REST_AT, REST_GAP), zc = [-4, TOP / 2, TOP / 2, TOP + ROOF / 2];
  const cy = zc.map((z, i) => P(34, 22, z + rest[i])[1]), xL = P(-6, 50, 0)[0], xR = P(70, -6, 0)[0];
  const hit = ([x, y]) => {
    if (x < xL || x > xR || y < cy[3] - 26 || y > cy[0] + 22) return -1;
    return cy.reduce((best, c, i) => (Math.abs(y - c) < Math.abs(y - cy[best]) ? i : best), 0);
  };

  const shape = (a) => (a < 0 ? REST_AT : a), mark = (a) => stages.forEach((st, i) => {
    const on = i === shape(a);
    st.solids.forEach((s) => s.el.sil.classList.toggle("hi", on));
    if (st.roof) st.roof.sil.classList.toggle("hi", on);
  });
  let act = -1;
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act, to = lifts(shape(a), a < 0 ? REST_GAP : GAP);
    act = a;
    stages.forEach((st, i) => tset(st.lift, to[i], now, Math.abs(i - from) * stag));
    mark(a);
    read.textContent = a < 0 ? "rest" : `etapa ${a + 1}`;
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  mark(-1);
  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "obra",
  means: "Uma casa em quatro etapas: o vão sob o ponteiro é onde a obra para; o que vem depois fica suspenso.",
  rules: [1, 2, 5, 9],
  range: [0, 45, 100],
  tour: [[202, 266], [202, 196], [202, 125], null],
  mount,
});

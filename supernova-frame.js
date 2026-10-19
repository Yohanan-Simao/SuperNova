/**
 * Portal frame: four steel bays with columns, roof beams and cross braces.
 * The pointer selects a bay on the resting ground plane; its roof rises and
 * the adjacent bays follow, staggered outwards. The rest pose is a stepped
 * roofline with one bright central beam.
 */
const {
  Cam, clamp, facing, fit, prism, proj, rings, unproj, tween, tset, tval,
  tdone, mk, open, seg, pointer, put, register, disposer, solid,
} = HL;

const N = 4, BAY = 35, DEPTH = 44, POST = 5, BEAM = 5, LIFT = 46;
const ROOFS = [34, 46, 40, 52], X0 = -70, Y0 = -22;

function part(x0, y0, x1, y1, z0, z1) {
  const [ring, inner] = rings(x0, y0, x1, y1, 1.8, 0.85);
  return { ring, inner, z0, z1, el: null };
}

function mount({ stage, svg, read }, stagger) {
  const bag = disposer();
  const C = Cam(45, 0.5, 2.05);
  fit(C, [[X0 - 8, Y0 - 8, 0], [X0 + N * BAY + 8, Y0 + DEPTH + 8, 0], [X0 - 8, Y0 + DEPTH + 8, 0], [X0 + N * BAY + 8, Y0 - 8, 0], [X0, Y0, 108], [X0 + N * BAY, Y0, 108], [X0, Y0 + DEPTH, 108], [X0 + N * BAY, Y0 + DEPTH, 108]], 200, 166);
  const P = proj(C), front = facing(C), g = mk("g", {}, svg), bays = [];

  for (let i = 0; i < N; i++) {
    const x = X0 + i * BAY, h = ROOFS[i];
    const pieces = [
      part(x, Y0, x + POST, Y0 + POST, 0, h),
      part(x + BAY - POST, Y0, x + BAY, Y0 + POST, 0, h),
      part(x, Y0, x + BAY, Y0 + BEAM, h, h + BEAM),
    ];
    const group = mk("g", {}, g);
    pieces.forEach((p) => { p.el = solid(group); });
    const braceA = mk("path", { class: "nf lo" }, group);
    const braceB = mk("path", { class: "nf lo" }, group);
    bays.push({ i, x, h, pieces, braceA, braceB, lift: tween(0), drawn: NaN });
  }

  function draw(bay, lift) {
    if (lift === bay.drawn) return;
    bay.drawn = lift;
    bay.pieces.forEach((p) => put(p.el, prism(P, front, p.ring, p.inner, p.z0, p.z1 + lift)));
    const x = bay.x, z = bay.h + lift;
    bay.braceA.setAttribute("d", seg(P(x + 4, Y0 + 2.5, 3), P(x + BAY - 4, Y0 + 2.5, z - 3)));
    bay.braceB.setAttribute("d", seg(P(x + BAY - 4, Y0 + 2.5, 3), P(x + 4, Y0 + 2.5, z - 3)));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    bays.forEach((bay) => {
      const lift = tval(bay.lift, now);
      draw(bay, lift);
      if (!tdone(bay.lift, now)) moving = true;
    });
    return moving;
  });
  bag.add(B.unregister);

  let active = -1;
  function select(point) {
    const [x, y] = unproj(C, point[0], point[1], 0);
    if (x < X0 || x > X0 + N * BAY || y < Y0 - 12 || y > Y0 + DEPTH + 12) return -1;
    return clamp(Math.floor((x - X0) / BAY), 0, N - 1);
  }
  function setActive(next) {
    if (next === active) return;
    const now = performance.now(), from = next >= 0 ? next : active;
    active = next;
    bays.forEach((bay, i) => {
      const share = next < 0 ? 0 : i === next ? 1 : Math.max(0, 0.66 - Math.abs(i - next) * 0.22);
      tset(bay.lift, LIFT * share, now, Math.abs(i - from) * stagger);
      bay.pieces.forEach((p) => p.el.sil.classList.toggle("hi", next < 0 ? i === 1 : i === next));
    });
    read.textContent = next < 0 ? "rest" : `vão ${next + 1}`;
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setActive(select(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  setActive(-1);
  return { set: (v) => { stagger = v; }, destroy: bag.dispose };
}

hairline({
  name: "portal-frame",
  means: "Quatro pórticos metálicos em sequência; o vão sob o ponteiro ergue sua cobertura.",
  rules: [1, 2, 5, 6, 8, 9],
  range: [20, 65, 120],
  tour: [[132, 178], [194, 143], [261, 116], null],
  mount,
});

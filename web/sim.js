/* Mower Lab — simulation engine.
   World units are metres; y points down (screen coordinates), so a positive angle turns clockwise. */
"use strict";

const CEL = 0.05;                        // grid cell size: 5 cm

/* ---------- seeded random ---------- */
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- geometry ---------- */
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inObstacle(x, y, o) {
  if (o.type === "circle") return (x - o.x) ** 2 + (y - o.y) ** 2 <= o.r * o.r;
  return inPoly(x, y, o.pts);
}
function gardenBounds(g) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of g.lawns) for (const [x, y] of l.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (!isFinite(x0)) return { x0: 0, y0: 0, x1: 10, y1: 10 };
  return { x0, y0, x1, y1 };
}

/* ---------- exact Euclidean distance transform (Felzenszwalb & Huttenlocher) ---------- */
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
}
// blocked: Uint8Array (1 = blocked). Returns distance in metres to the nearest blocked cell.
function distanceField(blocked, W, H) {
  const INF = 1e12, n = Math.max(W, H);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const g = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = blocked[i] ? 0 : INF;
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) f[y] = g[y * W + x];
    edt1d(f, H, d, v, z);
    for (let y = 0; y < H; y++) g[y * W + x] = d[y];
  }
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) f[x] = g[y * W + x];
    edt1d(f, W, d, v, z);
    for (let x = 0; x < W; x++) out[y * W + x] = Math.sqrt(d[x]) * CEL;
  }
  return out;
}

/* ---------- rasterise a garden ---------- */
// Returns the grid with: lawn (mowable cells), distances to the edge and to obstacles, and the
// station distance field used to drive home along the shortest path.
function rasterise(g, mower) {
  const b = gardenBounds(g), m = 0.5;
  const ox = b.x0 - m, oy = b.y0 - m;
  const W = Math.ceil((b.x1 - b.x0 + 2 * m) / CEL), H = Math.ceil((b.y1 - b.y0 + 2 * m) / CEL);
  const outside = new Uint8Array(W * H), obst = new Uint8Array(W * H), mowable = new Uint8Array(W * H);
  // scanline fill per polygon is faster than a point-in-polygon test per cell
  const fillPoly = (pts, arr, val) => {
    for (let y = 0; y < H; y++) {
      const wy = oy + (y + 0.5) * CEL, xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > wy) !== (yj > wy)) xs.push(((xj - xi) * (wy - yi)) / (yj - yi) + xi);
      }
      xs.sort((a, c) => a - c);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil((xs[k] - ox) / CEL - 0.5)), c = Math.min(W - 1, Math.floor((xs[k + 1] - ox) / CEL - 0.5));
        for (let x = a; x <= c; x++) arr[y * W + x] = val;
      }
    }
  };
  outside.fill(1);
  for (const l of g.lawns) if (l.pts.length >= 3) fillPoly(l.pts, outside, 0);
  for (const o of g.obstacles) {
    if (o.type === "circle") {
      const x0 = Math.max(0, Math.floor((o.x - o.r - ox) / CEL)), x1 = Math.min(W - 1, Math.ceil((o.x + o.r - ox) / CEL));
      const y0 = Math.max(0, Math.floor((o.y - o.r - oy) / CEL)), y1 = Math.min(H - 1, Math.ceil((o.y + o.r - oy) / CEL));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const wx = ox + (x + 0.5) * CEL, wy = oy + (y + 0.5) * CEL;
        if ((wx - o.x) ** 2 + (wy - o.y) ** 2 <= o.r * o.r) obst[y * W + x] = 1;
      }
    } else if (o.pts.length >= 3) fillPoly(o.pts, obst, 1);
  }
  let nMow = 0;
  for (let i = 0; i < W * H; i++) if (!outside[i] && !obst[i]) { mowable[i] = 1; nMow++; }
  const dEdge = distanceField(outside, W, H), dObs = distanceField(obst, W, H);
  const R = { ox, oy, W, H, outside, obst, mowable, nMow, dEdge, dObs, area: nMow * CEL * CEL };
  R.cell = (x, y) => { const cx = Math.floor((x - ox) / CEL), cy = Math.floor((y - oy) / CEL); return cx < 0 || cy < 0 || cx >= W || cy >= H ? -1 : cy * W + cx; };
  return R;
}

// Which cells can the mower body actually reach (flood fill from the station)? And the
// shortest-path distance from every reachable cell to the station (for driving home).
function reachability(R, bodyR, st) {
  const { W, H, dEdge, dObs } = R;
  const free = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) free[i] = dEdge[i] >= bodyR && dObs[i] >= bodyR ? 1 : 0;
  // snap the station onto the nearest free cell
  let s = R.cell(st.x, st.y);
  if (s < 0 || !free[s]) {
    let best = -1, bd = Infinity;
    const cx = Math.floor((st.x - R.ox) / CEL), cy = Math.floor((st.y - R.oy) / CEL);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!free[i]) continue; const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < bd) { bd = d; best = i; } }
    s = best;
  }
  const home = new Float32Array(W * H).fill(Infinity);
  if (s < 0) return { free, home, start: null };
  // Dijkstra-light: 8-neighbour BFS with a bucket queue (distances in cells, diagonals 1.414)
  const q = new Int32Array(W * H * 2); let qh = 0, qt = 0;
  home[s] = 0; q[qt++] = s;
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];
  // repeated relaxation passes are enough for a grid (SPFA)
  const inq = new Uint8Array(W * H); inq[s] = 1;
  while (qh !== qt) {
    const i = q[qh]; qh = (qh + 1) % q.length; inq[i] = 0;
    const x = i % W, y = (i / W) | 0, di = home[i];
    for (const [dx, dy, c] of nb) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (!free[j]) continue;
      if (dx && dy && (!free[y * W + nx] || !free[ny * W + x])) continue;
      const nd = di + c;
      if (nd < home[j] - 1e-6) { home[j] = nd; if (!inq[j]) { inq[j] = 1; q[qt] = j; qt = (qt + 1) % q.length; } }
    }
  }
  // which mowable cells can the cutting disc reach from a reachable body position?
  return { free, home, start: { x: R.ox + ((s % W) + 0.5) * CEL, y: R.oy + (((s / W) | 0) + 0.5) * CEL } };
}
function maxCoverage(R, reach, cutR) {
  const { W, H } = R, can = new Uint8Array(W * H), r = Math.ceil(cutR / CEL);
  const offs = discOffsets(cutR);
  for (let i = 0; i < W * H; i++) {
    if (!reach.free[i] || !isFinite(reach.home[i])) continue;
    const x = i % W, y = (i / W) | 0;
    // only cells near the border of the free area add anything new; skip interior quickly
    if (x > r && y > r && x < W - r - 1 && y < H - r - 1 && reach.free[i - r] && reach.free[i + r] && reach.free[i - r * W] && reach.free[i + r * W]) { can[i] = 1; continue; }
    for (const [dx, dy] of offs) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H) can[ny * W + nx] = 1; }
  }
  let n = 0; for (let i = 0; i < W * H; i++) if (can[i] && R.mowable[i]) n++;
  return { n, can };
}
function discOffsets(r) {
  const n = Math.ceil(r / CEL), out = [];
  for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) if ((dx * CEL) ** 2 + (dy * CEL) ** 2 <= r * r) out.push([dx, dy]);
  return out;
}

/* ---------- algorithm rules ---------- */
/* An algorithm:
   { name, onStart:[actions], onEdge:[actions], obstacleSame:bool, onObstacle:[actions],
     periodic:{ every:s, actions:[...] } | null, returnAt:%, returnMode:'path'|'wire' }
   Actions:
   { t:'back', d:m } | { t:'forward', d:m, unit:'m'|'w' } | { t:'turn', mode:'fixed'|'random', deg, min, max, dir:'cw'|'ccw'|'random'|'alternate' }
   { t:'heading', deg } | { t:'spiral', grow:widths } | { t:'follow', side:'left'|'right', d:m } | { t:'pause', s } */

/* ---------- the simulator ---------- */
class Sim {
  constructor(R, mower, algo, seed) {
    this.R = R; this.mw = mower; this.algo = algo; this.rand = rng(seed || 1);
    this.cutR = mower.width / 2; this.bodyR = Math.max(mower.body / 2, this.cutR + 0.02);
    this.reach = reachability(R, this.bodyR, mower.station);
    this.offs = discOffsets(this.cutR);
    this.cov = new Uint16Array(R.W * R.H);
    this.covered = 0;
    const mc = maxCoverage(R, this.reach, this.cutR); this.maxCov = Math.max(1, mc.n); this.can = mc.can;
    this.krom = 0; this.inActie = true;
    this.t = 0; this.dist = 0; this.charges = 0; this.bumps = 0; this.stranded = 0; this.mowTime = 0;
    this.battery = 1; this.mode = "charge"; this.queue = []; this.act = null;
    this.ruleFire = { edge: 0, obstacle: 0, start: 0, periodic: 0 };
    this.lastCell = -1; this.trail = []; this.trailEvery = 0; this.history = [[0, 0]]; this.nextSample = 60;
    this.periodicT = 0; this.bumpWindow = []; this.newCells = [];
    this.st = this.reach.start || { x: mower.station.x, y: mower.station.y };
    this.x = this.st.x; this.y = this.st.y; this.h = ((mower.station.heading || 0) - 90) * Math.PI / 180;
    this.markCut();
  }
  gauss() { const u = this.rand() || 1e-9, v = this.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  nieuweBaan() { this.krom = this.gauss() * (this.mw.wobble ?? 1) * 0.5 * Math.PI / 180; }   // each new track gets its own slight curve
  get coverage() { return this.covered / this.R.nMow; }
  allowed(x, y) {
    const i = this.R.cell(x, y);
    if (i < 0) return "edge";
    if (this.R.dEdge[i] < this.bodyR) return "edge";
    if (this.R.dObs[i] < this.bodyR) return "obstacle";
    return null;
  }
  markCut() {
    const R = this.R, i = R.cell(this.x, this.y);
    if (i < 0 || i === this.lastCell) return;
    this.lastCell = i;
    const W = R.W, cx = i % W, cy = (i / W) | 0;
    for (const [dx, dy] of this.offs) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= W || y >= R.H) continue;
      const j = y * W + x; if (!R.mowable[j]) continue;
      if (this.cov[j] === 0) this.covered++;
      if (this.cov[j] < 65535) { this.cov[j]++; this.newCells.push(j); }
    }
  }
  resolve(actions, ruleKey) {
    let n = this.ruleFire[ruleKey]++;
    // lane mode: when the rule contains "turn to a direction, alternating", the alternation follows the
    // current heading (driving roughly that way → turn back the other way), so an extra bump can't break the pattern
    const baan = actions.find((a) => a.t === "heading" && a.alt && !a.random);
    if (baan) {
      const lane = ((baan.deg || 0) - 90) * Math.PI / 180;
      const verschil = Math.abs(((this.h - lane) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      n = verschil < Math.PI / 2 ? 0 : 1;
    }
    return actions.map((a) => {
      const b = Object.assign({}, a, { done: 0 });
      if (a.t === "turn") {
        let ang = a.mode === "random" ? a.min + this.rand() * (a.max - a.min) : a.deg;
        let dir = a.dir === "ccw" ? -1 : a.dir === "random" ? (this.rand() < 0.5 ? -1 : 1) : a.dir === "alternate" ? (n % 2 ? -1 : 1) : 1;
        b.ang = ((ang + this.gauss() * (this.mw.turnError ?? 3)) * Math.PI / 180) * dir;
      }
      if (a.t === "forward") b.len = a.unit === "w" ? a.d * this.mw.width : a.d;
      if (a.t === "heading") b.target = a.random ? this.rand() * Math.PI * 2 : ((a.deg || 0) + (a.alt && n % 2 === 0 ? 180 : 0) - 90 + this.gauss() * (this.mw.turnError ?? 3) * 0.25) * Math.PI / 180;
      if (a.t === "spiral") b.r = Math.max(this.cutR, 0.15);
      return b;
    });
  }
  trigger(kind) {
    this.bumps++;
    const a = this.algo;
    const acts = kind === "obstacle" && !a.obstacleSame ? a.onObstacle : a.onEdge;
    this.queue = this.resolve(acts, kind === "obstacle" && !a.obstacleSame ? "obstacle" : "edge");
    this.act = null;
    // stuck detection: many bumps within a short time → random escape turn
    this.bumpWindow.push(this.t);
    while (this.bumpWindow.length && this.t - this.bumpWindow[0] > 6) this.bumpWindow.shift();
    if (this.bumpWindow.length > 25) { this.queue = [{ t: "back", d: 0.3, done: 0 }, { t: "turn", ang: (90 + this.rand() * 180) * Math.PI / 180, done: 0 }]; this.bumpWindow = []; }
  }
  // one simulation step
  step(dt) {
    const mw = this.mw, v = mw.speed, rot = (mw.turnRate || 90) * Math.PI / 180;
    this.t += dt;
    if (this.t >= this.nextSample) { this.history.push([this.t, this.coverage]); this.nextSample += 60; }

    if (this.mode === "charge") {
      this.battery += dt / (mw.chargeMin * 60);
      if (this.battery >= 1) {
        this.battery = 1; this.mode = "mow";
        this.queue = [{ t: "back", d: mw.undock || 0.6, done: 0, undock: true }].concat(this.resolve(this.algo.onStart || [], "start"));
        this.act = null; this.periodicT = 0;
      }
      return;
    }
    // battery
    this.battery -= dt / (mw.batteryMin * 60);
    if (this.mode === "mow") {
      this.mowTime += dt;
      const ci = this.R.cell(this.x, this.y);
      const homeM = ci >= 0 && isFinite(this.reach.home[ci]) ? this.reach.home[ci] * CEL * 1.15 : 0;
      const needed = homeM / v / (mw.batteryMin * 60) + 0.03;
      if (this.battery <= Math.max((this.algo.returnAt ?? 15) / 100, needed)) {
        this.mode = "return"; this.queue = []; this.act = null; this.followDir = null;
      }
    }
    if (this.battery <= 0) { // ran flat: counts as a failure, the mower is carried home
      this.stranded++; this.x = this.st.x; this.y = this.st.y; this.h = ((mw.station.heading || 0) - 90) * Math.PI / 180;
      this.mode = "charge"; this.battery = 0; this.charges++; this.lastCell = -1; return;
    }
    if (this.mode === "return") { this.stepReturn(dt, v, rot); return; }

    // periodic rule
    if (this.algo.periodic && this.algo.periodic.every > 0) {
      this.periodicT += dt;
      if (this.periodicT >= this.algo.periodic.every && !this.queue.length && !this.act) {
        this.periodicT = 0; this.queue = this.resolve(this.algo.periodic.actions || [], "periodic");
      }
    }
    if (!this.act && this.queue.length) this.act = this.queue.shift();
    const a = this.act;
    if (!a) { if (this.inActie) { this.inActie = false; this.nieuweBaan(); } this.moveForward(v * dt, true); return; }
    this.inActie = true;
    switch (a.t) {
      case "back": {
        const s = Math.min(v * 0.8 * dt, a.d - a.done);
        const nx = this.x - Math.cos(this.h) * s, ny = this.y - Math.sin(this.h) * s;
        if (this.allowed(nx, ny)) { this.act = null; break; }
        this.x = nx; this.y = ny; this.dist += s; a.done += s; this.markCut();
        if (a.done >= a.d - 1e-9) this.act = null;
        break;
      }
      case "forward": {
        const s = Math.min(v * dt, a.len - a.done);
        if (this.moveForward(s, false)) { a.done += s; if (a.done >= a.len - 1e-9) this.act = null; }
        break;
      }
      case "turn": {
        const left = a.ang - a.done, s = Math.sign(left) * Math.min(Math.abs(left), rot * dt);
        this.h += s; a.done += s;
        if (Math.abs(a.ang - a.done) < 1e-6) this.act = null;
        break;
      }
      case "heading": {
        let diff = ((a.target - this.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
        const s = Math.sign(diff) * Math.min(Math.abs(diff), rot * dt); this.h += s;
        if (Math.abs(diff) < 1e-3) this.act = null;
        break;
      }
      case "pause": { a.done += dt; this.battery += dt / (mw.batteryMin * 60) * 0.7; if (a.done >= a.s) this.act = null; break; }
      case "spiral": {
        const s = v * dt, grow = (a.grow || 1) * mw.width;
        this.h += s / a.r; a.r += (grow * s) / (2 * Math.PI * a.r);
        if (a.max && a.r > a.max) { this.act = null; break; }
        this.moveForward(s, true);
        break;
      }
      case "follow": this.stepFollow(a, dt, v, rot, a.side === "left" ? -1 : 1, a.what || "edge"); break;
      default: this.act = null;
    }
  }
  // drive forward; a bump fires the edge/obstacle rule. Returns true if the mower moved.
  moveForward(s, untilBump) {
    // uneven ground and imperfect steering: the heading wanders a little along every straight track
    const wob = (this.mw.wobble ?? 1) * Math.PI / 180;
    if (wob > 0 && s > 0) {
      this.krom += this.gauss() * wob * Math.sqrt(s) - this.krom * (s / 3);
      this.h += this.krom * s;
    }
    const nx = this.x + Math.cos(this.h) * s, ny = this.y + Math.sin(this.h) * s;
    const hit = this.allowed(nx, ny);
    if (hit) { this.trigger(hit); return false; }
    this.x = nx; this.y = ny; this.dist += s; this.markCut(); this.addTrail();
    return true;
  }
  addTrail() { if ((this.trailEvery = (this.trailEvery + 1) % 3) === 0) { this.trail.push(this.x, this.y); if (this.trail.length > 120000) this.trail.splice(0, 20000); } }
  // follow the edge (or any boundary) keeping it on one side, for a distance
  stepFollow(a, dt, v, rot, side, what) {
    const R = this.R, i = R.cell(this.x, this.y);
    if (i < 0) { this.act = null; return; }
    const target = this.bodyR + 0.03;
    const field = what === "any" ? null : R.dEdge;
    const dist = (x, y) => { const j = R.cell(x, y); if (j < 0) return 0; return field ? field[j] : Math.min(R.dEdge[j], R.dObs[j]); };
    const e = 0.06, gx = dist(this.x + e, this.y) - dist(this.x - e, this.y), gy = dist(this.x, this.y + e) - dist(this.x, this.y - e);
    const gl = Math.hypot(gx, gy) || 1;
    // tangent with the boundary on the right (side = 1) or on the left (side = -1); y points down
    const tx = side === 1 ? -gy / gl : gy / gl, ty = side === 1 ? gx / gl : -gx / gl;
    const err = dist(this.x, this.y) - target;                        // > 0: too far from the boundary, steer towards it
    const want = Math.atan2(ty, tx) + side * Math.max(-0.9, Math.min(0.9, err * 4));
    let diff = ((want - this.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    this.h += Math.sign(diff) * Math.min(Math.abs(diff), rot * 2 * dt);
    const s = v * dt;
    const nx = this.x + Math.cos(this.h) * s, ny = this.y + Math.sin(this.h) * s;
    const hit = this.allowed(nx, ny);
    if (hit) { this.h -= side * (rot * dt + 0.05); a.stuck = (a.stuck || 0) + dt; if (a.stuck > 4) this.act = null; return; }
    a.stuck = 0;
    this.x = nx; this.y = ny; this.dist += s; a.done += s; this.markCut(); this.addTrail();
    if (a.done >= a.d) this.act = null;
  }
  // drive home: along the shortest path (descending the station distance field), or along the boundary wire
  stepReturn(dt, v, rot) {
    const R = this.R, home = this.reach.home;
    if (Math.hypot(this.x - this.st.x, this.y - this.st.y) < 0.12) {
      this.mode = "charge"; this.charges++; this.h = ((this.mw.station.heading || 0) - 90) * Math.PI / 180; this.lastCell = -1; return;
    }
    let want;
    if (this.algo.returnMode === "wire" && !this.wireGaveUp) {
      // follow the lawn edge (right-hand) until the station is close; give up after a long time
      this.wireT = (this.wireT || 0) + dt;
      // following the wire can be a long way round: switch to the direct path before the battery gets critical
      const ci = R.cell(this.x, this.y);
      const nodig = ci >= 0 && isFinite(home[ci]) ? (home[ci] * CEL * 1.2) / v / (this.mw.batteryMin * 60) + 0.02 : 0;
      if (this.battery < nodig) this.wireGaveUp = true;
      if (!this.wireGaveUp && Math.hypot(this.x - this.st.x, this.y - this.st.y) > 0.8 && this.wireT < 1800) {
        if (!this.wireAct) this.wireAct = { t: "follow", side: "right", d: 1e9, done: 0, what: "edge" };
        const cutting = this.mw.cutReturn; const old = this.markCut; if (!cutting) this.markCut = () => {};
        this.stepFollow(this.wireAct, dt, v, rot, 1, "edge");
        this.markCut = old; return;
      }
      if (this.wireT >= 1800) this.wireGaveUp = true;
    }
    const i = R.cell(this.x, this.y);
    let best = null, bv = i >= 0 ? home[i] : Infinity;
    for (let k = 0; k < 16; k++) {
      const ang = (k / 16) * Math.PI * 2;
      for (const r of [0.15, 0.3]) {
        const j = R.cell(this.x + Math.cos(ang) * r, this.y + Math.sin(ang) * r);
        if (j >= 0 && this.reach.free[j] && home[j] < bv - 0.5) { bv = home[j]; best = ang; }
      }
    }
    if (best == null) want = Math.atan2(this.st.y - this.y, this.st.x - this.x); else want = best;
    let diff = ((want - this.h) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    this.h += Math.sign(diff) * Math.min(Math.abs(diff), rot * dt);
    if (Math.abs(diff) > 1.2) return;                       // turn on the spot first
    const s = v * dt, nx = this.x + Math.cos(this.h) * s, ny = this.y + Math.sin(this.h) * s;
    const j = R.cell(nx, ny);
    if (j < 0 || !this.reach.free[j]) {
      // blocked by the grid's stair-steps: step straight towards the best neighbouring cell
      const W = R.W, cx = i % W, cy = (i / W) | 0;
      let bj = -1, bh = i >= 0 ? home[i] : Infinity;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const k = (cy + dy) * W + cx + dx;
        if ((dx || dy) && this.reach.free[k] && home[k] < bh) { bh = home[k]; bj = k; }
      }
      if (bj < 0) { this.h += 0.3; return; }
      const tx = R.ox + ((bj % W) + 0.5) * CEL, ty = R.oy + (((bj / W) | 0) + 0.5) * CEL, dd = Math.hypot(tx - this.x, ty - this.y) || 1;
      const st = Math.min(s, dd);
      this.x += ((tx - this.x) / dd) * st; this.y += ((ty - this.y) / dd) * st; this.dist += st;
      this.h = Math.atan2(ty - this.y, tx - this.x) || this.h;
      return;
    }
    this.x = nx; this.y = ny; this.dist += s; this.addTrail();
    if (this.mw.cutReturn) this.markCut();
    if (this.wireAct) { this.wireAct = null; this.wireT = 0; this.wireGaveUp = false; }
  }
  // run until the target coverage or the time limit; returns false when finished
  run(simSeconds, dt = 0.05) {
    const end = this.t + simSeconds;
    while (this.t < end) {
      this.step(dt);
      if (this.covered >= this.target * this.maxCov || this.t >= this.limit) { this.finished = true; if (this.history[this.history.length - 1][0] < this.t) this.history.push([this.t, this.coverage]); return false; }
    }
    return true;
  }
}
Sim.prototype.target = 0.99;
Sim.prototype.limit = 48 * 3600;

if (typeof module !== "undefined") module.exports = { Sim, rasterise, CEL, rng, inPoly, inObstacle, gardenBounds };

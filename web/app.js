/* Mower Lab — interface: garden editor, mower settings, rule editor, simulation and comparison. */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const klem = (x, a, b) => Math.max(a, Math.min(b, x));
function lees(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function schrijf(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage */ } }
let toastT; function toast(t) { const el = $("#toast"); el.textContent = t; el.classList.add("zichtbaar"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("zichtbaar"), 2600); }
const fmtH = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h}:${String(m).padStart(2, "0")}`; };
const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";

/* ================= examples ================= */
const VOORBEELDEN = {
  rect: { naam: "Simple rectangle (12 × 8 m)", g: { lawns: [{ pts: [[0, 0], [12, 0], [12, 8], [0, 8]] }], obstacles: [], station: { x: 0.35, y: 4, heading: 270 } } },
  l: { naam: "L-shape with trees and a flower bed", g: {
    lawns: [{ pts: [[0, 0], [16, 0], [16, 6], [24, 6], [24, 14], [6, 14], [6, 10], [0, 10]] }],
    obstacles: [{ type: "circle", kind: "tree", x: 5, y: 4, r: 0.6 }, { type: "circle", kind: "tree", x: 18.5, y: 10, r: 0.8 }, { type: "poly", kind: "bed", pts: [[9, 2], [13, 2], [13, 4], [9, 4]] }],
    station: { x: 0.35, y: 5, heading: 270 } } },
  twee: { naam: "Front and back lawn, narrow passage", g: {
    lawns: [{ pts: [[0, 0], [11, 0], [11, 3.5], [14, 3.5], [14, 0], [26, 0], [27, 6], [25, 12], [14, 12], [14, 5.2], [11, 5.2], [11, 9], [0, 9]] }],
    obstacles: [
      { type: "poly", kind: "pond", pts: [[18, 5], [20.5, 4.4], [22.5, 5.6], [22, 7.6], [19.5, 8.2], [17.6, 7]] },
      { type: "circle", kind: "tree", x: 4, y: 3, r: 0.7 }, { type: "circle", kind: "tree", x: 24, y: 2.5, r: 0.9 },
      { type: "poly", kind: "bed", pts: [[0, 7.5], [3.5, 7.5], [3.5, 9], [0, 9]] },
    ],
    station: { x: 0.35, y: 1.5, heading: 270 } } },
  rond: { naam: "Curvy lawn with an island bed", g: (() => {
    const pts = [];
    for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; const r = 7 + 1.6 * Math.sin(3 * a) + 0.8 * Math.cos(5 * a + 1); pts.push([+(11 + r * 1.3 * Math.cos(a)).toFixed(2), +(9 + r * Math.sin(a)).toFixed(2)]); }
    const eil = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; eil.push([+(12 + 2.2 * Math.cos(a)).toFixed(2), +(9 + 1.4 * Math.sin(a)).toFixed(2)]); }
    return { lawns: [{ pts }], obstacles: [{ type: "poly", kind: "bed", pts: eil }, { type: "circle", kind: "tree", x: 6, y: 6, r: 0.6 }, { type: "circle", kind: "tree", x: 17, y: 13, r: 0.7 }, { type: "poly", kind: "paving", pts: [[14.5, 2.5], [17.5, 2.5], [17.5, 4.5], [14.5, 4.5]] }], station: { x: 1.95, y: 9, heading: 270 } };
  })() },
};

const VOORBEELD_ALGOS = () => [
  { id: "random", naam: "Random bounce", onStart: [{ t: "heading", random: true }], onEdge: [{ t: "back", d: 0.3 }, { t: "turn", mode: "random", min: 90, max: 180, dir: "random" }], obstacleSame: true, onObstacle: [], periodic: { every: 0, actions: [] }, returnAt: 15, returnMode: "path" },
  { id: "vast20", naam: "Back 50 cm, turn 20° clockwise", onStart: [], onEdge: [{ t: "back", d: 0.5 }, { t: "turn", mode: "fixed", deg: 20, dir: "cw" }], obstacleSame: true, onObstacle: [], periodic: { every: 0, actions: [] }, returnAt: 15, returnMode: "path" },
  { id: "rand20", naam: "Back 50 cm, turn 20–160° clockwise", onStart: [], onEdge: [{ t: "back", d: 0.5 }, { t: "turn", mode: "random", min: 20, max: 160, dir: "cw" }], obstacleSame: true, onObstacle: [], periodic: { every: 0, actions: [] }, returnAt: 15, returnMode: "path" },
  { id: "spiraal", naam: "Spiral, then bounce", onStart: [{ t: "spiral", grow: 0.9 }], onEdge: [{ t: "back", d: 0.3 }, { t: "turn", mode: "random", min: 100, max: 170, dir: "random" }], obstacleSame: true, onObstacle: [], periodic: { every: 1200, actions: [{ t: "spiral", grow: 0.9 }] }, returnAt: 15, returnMode: "path" },
  { id: "banen", naam: "Parallel lanes", onStart: [{ t: "heading", deg: 0 }], onEdge: [{ t: "back", d: 0.05 }, { t: "turn", mode: "fixed", deg: 90, dir: "alternate" }, { t: "forward", d: 0.75, unit: "w" }, { t: "heading", deg: 0, alt: true }], obstacleSame: true, onObstacle: [], periodic: { every: 0, actions: [] }, returnAt: 15, returnMode: "path" },
  { id: "banen2", naam: "Parallel lanes + random escape", onStart: [{ t: "heading", deg: 0 }], onEdge: [{ t: "back", d: 0.05 }, { t: "turn", mode: "fixed", deg: 90, dir: "alternate" }, { t: "forward", d: 0.75, unit: "w" }, { t: "heading", deg: 0, alt: true }], obstacleSame: false, onObstacle: [{ t: "back", d: 0.3 }, { t: "turn", mode: "random", min: 90, max: 180, dir: "random" }], periodic: { every: 900, actions: [{ t: "heading", random: true }] }, returnAt: 15, returnMode: "path" },
  { id: "rand", naam: "Edge first, then random", onStart: [{ t: "follow", side: "right", d: 60 }], onEdge: [{ t: "back", d: 0.3 }, { t: "turn", mode: "random", min: 90, max: 180, dir: "random" }], obstacleSame: true, onObstacle: [], periodic: { every: 0, actions: [] }, returnAt: 15, returnMode: "wire" },
];

/* ================= state ================= */
const STD_MAAIER = { width: 0.22, body: 0.5, speed: 0.4, turnRate: 90, batteryMin: 60, chargeMin: 50, undock: 0.6, cutReturn: false, wobble: 0.2, turnError: 2 };
const D = {
  garden: lees("ml.garden", null) || JSON.parse(JSON.stringify(VOORBEELDEN.l.g)),
  mower: Object.assign({}, STD_MAAIER, lees("ml.mower", {})),
  algos: lees("ml.algos", null) || VOORBEELD_ALGOS(),
  ui: Object.assign({ tab: "tuin", algo: "random", simAlgo: "random", verg: ["random", "vast20", "rand20", "spiraal", "banen2", "rand"] }, lees("ml.ui", {})),
};
function bewaar() { schrijf("ml.garden", D.garden); schrijf("ml.mower", D.mower); schrijf("ml.algos", D.algos); schrijf("ml.ui", D.ui); }
const algoById = (id) => D.algos.find((a) => a.id === id) || D.algos[0];
const kleurVan = (id) => css("--c" + (Math.max(0, D.algos.findIndex((a) => a.id === id)) % 7));

/* ================= view ================= */
const doek = $("#doek"), ctx = doek.getContext("2d");
let dpr = 1, VW = 0, VH = 0;
const V = { s: 30, ox: 40, oy: 40 };                 // screen = o + world * s
const naarScherm = (x, y) => [V.ox + x * V.s, V.oy + y * V.s];
const naarWereld = (sx, sy) => [(sx - V.ox) / V.s, (sy - V.oy) / V.s];
function maat() {
  const r = doek.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2.5); VW = r.width; VH = r.height;
  doek.width = Math.round(VW * dpr); doek.height = Math.round(VH * dpr);
}
function pasAan() {
  const b = gardenBounds(D.garden);
  const w = Math.max(4, b.x1 - b.x0), h = Math.max(4, b.y1 - b.y0), pad = 50;
  V.s = Math.min((VW - 2 * pad) / w, (VH - 2 * pad - (actieveTab === "sim" ? 60 : 0)) / h);
  V.ox = (VW - w * V.s) / 2 - b.x0 * V.s; V.oy = (VH - h * V.s - (actieveTab === "sim" ? 60 : 0)) / 2 - b.y0 * V.s;
  teken();
}
function zoom(f, cx = VW / 2, cy = VH / 2) {
  const [wx, wy] = naarWereld(cx, cy);
  V.s = klem(V.s * f, 3, 400); V.ox = cx - wx * V.s; V.oy = cy - wy * V.s; teken();
}

/* ================= raster cache & simulation ================= */
let R = null, rasterKey = "";
function raster() {
  const key = JSON.stringify([D.garden.lawns, D.garden.obstacles]);
  if (!R || key !== rasterKey) { R = rasterise(D.garden, D.mower); rasterKey = key; }
  return R;
}
function invalideer() { stopSim(); sim = null; covImg = null; tuinStat(); }
function mowerVoorSim() { return Object.assign({}, D.mower, { station: D.garden.station }); }
function problemen() {
  if (!D.garden.lawns.some((l) => l.pts.length >= 3)) return "Draw a lawn first (Garden → Lawn shape or Lawn rectangle).";
  if (!D.garden.station) return "Place the charging station (Garden → Station).";
  return null;
}

/* ================= garden editing ================= */
const GEREEDSCHAP = [
  ["select", "Select", '<path d="M5 3l12 8-5 1.5L15 19l-2.5 1.2L9.5 14 5 17z" fill="currentColor"/>'],
  ["lawn", "Lawn shape", '<path d="M3 17L6 5l9-2 6 8-4 9H8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6" cy="5" r="1.8" fill="currentColor"/><circle cx="21" cy="11" r="1.8" fill="currentColor"/><circle cx="3" cy="17" r="1.8" fill="currentColor"/>'],
  ["lawnrect", "Lawn rectangle", '<rect x="3" y="5" width="18" height="14" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 15c2-2 3-2 5 0s3 2 5 0" stroke="currentColor" fill="none" stroke-width="1.5"/>'],
  ["obst", "Obstacle shape", '<path d="M4 16l3-9 8-2 5 7-5 7H8z" fill="currentColor" opacity=".35" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'],
  ["obstrect", "Obstacle rectangle", '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="currentColor" opacity=".35" stroke="currentColor" stroke-width="2"/>'],
  ["tree", "Tree / round", '<circle cx="12" cy="11" r="7" fill="currentColor" opacity=".4" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="11" r="1.6" fill="currentColor"/>'],
  ["station", "Station", '<path d="M4 20V10l8-6 8 6v10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 18v-6m-3 3l3-3 3 3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>'],
];
const SOORTEN = { bed: "Flower bed", pond: "Pond", paving: "Paving / shed", hedge: "Hedge" };
let tool = "select", soort = "bed", concept = null, sel = null, drag = null, undo = [];
function bewaarUndo() { undo.push(JSON.stringify(D.garden)); if (undo.length > 60) undo.shift(); }
const snapStap = () => Number($("#snap").value) || 0;
const snap = (v) => { const s = snapStap(); return s ? Math.round(v / s) * s : Math.round(v * 100) / 100; };

function renderGereedschap() {
  $("#gereedschap").innerHTML = GEREEDSCHAP.map(([k, l, svg]) => `<button data-t="${k}" aria-pressed="${k === tool}"><svg viewBox="0 0 24 24">${svg}</svg>${l}</button>`).join("");
  $$("#gereedschap button").forEach((b) => (b.onclick = () => kiesTool(b.dataset.t)));
  let o = "";
  if (tool === "obst" || tool === "obstrect") o = `<label class="veld"><span>Obstacle type</span><select id="soort">${Object.entries(SOORTEN).map(([k, l]) => `<option value="${k}" ${k === soort ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
  if ((tool === "lawn" || tool === "obst") && concept) o += `<div class="rij"><button class="knop hoofd" id="b-af" ${concept.pts.length < 3 ? "disabled" : ""}>Finish shape</button><button class="knop" id="b-weg">Cancel</button><span class="uitleg">${concept.pts.length} points</span></div>`;
  $("#tool-opties").innerHTML = o;
  const so = $("#soort"); if (so) so.onchange = () => (soort = so.value);
  const af = $("#b-af"); if (af) af.onclick = rondAf;
  const weg = $("#b-weg"); if (weg) weg.onclick = () => { concept = null; renderGereedschap(); teken(); };
  hint();
}
function hint() {
  const t = {
    select: "Drag a shape to move it, drag its corner points to reshape it, tap a small + between points to add one. Drag empty space or use two fingers to pan.",
    lawn: "Tap to place the corners of your lawn. Tap the first point (or Finish shape) to close it. Extra lawn shapes are added to the lawn.",
    lawnrect: "Drag to draw a rectangle of lawn.",
    obst: "Tap the corners of a flower bed, pond, shed… Tap the first point to close it.",
    obstrect: "Drag to draw a rectangular obstacle.",
    tree: "Tap to place a tree, or drag to set its size.",
    station: "Tap the spot for the charging station, drag to set which way the mower faces when docked. It backs out when it leaves.",
  }[tool];
  $("#hint").textContent = actieveTab === "tuin" ? t : "";
  if (actieveTab === "sim") simLegenda();
}
function simLegenda() {
  const sw = (c, l) => `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:10px"><i style="width:12px;height:12px;border-radius:3px;background:rgb(${c})"></i>${l}</span>`;
  let h = sw(KLEUR_LANG.join(","), "not mowed yet");
  if ($("#v-hitte").checked) h += ["1×", "2–3×", "4–6×", "7–12×", "13×+"].map((l, i) => sw(PASS_KLEUREN[i].join(","), l)).join("");
  else h += sw(KLEUR_KORT.join(","), "mowed");
  if ($("#v-onbereik").checked) h += sw("196,104,214", "out of reach");
  $("#hint").innerHTML = h;
}
function kiesTool(t) { if (concept && t !== tool) concept = null; tool = t; sel = null; renderGereedschap(); renderSelectie(); teken(); }
function rondAf() {
  if (!concept || concept.pts.length < 3) return;
  bewaarUndo();
  if (concept.soort === "lawn") D.garden.lawns.push({ pts: concept.pts });
  else D.garden.obstacles.push({ type: "poly", kind: soort, pts: concept.pts });
  concept = null; bewaar(); invalideer(); renderGereedschap(); teken();
}
function renderSelectie() {
  const el = $("#selectie");
  if (!sel) { el.innerHTML = "Tap a shape with the Select tool to move it, drag its points, or delete it."; return; }
  let naam = "", extra = "";
  if (sel.k === "lawn") naam = "Lawn shape";
  if (sel.k === "obst") { const o = D.garden.obstacles[sel.i]; naam = o.type === "circle" ? "Tree / round obstacle" : SOORTEN[o.kind] || "Obstacle";
    if (o.type === "circle") extra = `<label class="veld" style="margin-top:8px"><span>Diameter <b>${(o.r * 2).toFixed(2)} m</b></span><input type="range" id="sel-r" min="0.2" max="8" step="0.05" value="${o.r * 2}"></label>`;
    else extra = `<label class="veld" style="margin-top:8px"><span>Type</span><select id="sel-soort">${Object.entries(SOORTEN).map(([k, l]) => `<option value="${k}" ${k === o.kind ? "selected" : ""}>${l}</option>`).join("")}</select></label>`; }
  if (sel.k === "station") { naam = "Charging station"; extra = `<label class="veld" style="margin-top:8px"><span>Mower faces <b>${Math.round(D.garden.station.heading)}°</b></span><input type="range" id="sel-h" min="0" max="359" step="1" value="${D.garden.station.heading}"></label>`; }
  el.innerHTML = `<b>${naam}</b>${extra}<div class="rij" style="margin-top:8px">${sel.v != null ? `<button class="knop klein" id="sel-punt">Delete point</button>` : ""}${sel.k !== "station" ? `<button class="knop klein gevaar" id="sel-wis">Delete shape</button>` : ""}</div>`;
  const r = $("#sel-r"); if (r) r.oninput = () => { D.garden.obstacles[sel.i].r = Number(r.value) / 2; bewaar(); invalideer(); renderSelectie(); teken(); };
  const so = $("#sel-soort"); if (so) so.onchange = () => { D.garden.obstacles[sel.i].kind = so.value; bewaar(); teken(); };
  const h = $("#sel-h"); if (h) h.oninput = () => { D.garden.station.heading = Number(h.value); bewaar(); invalideer(); el.querySelector("b + label b").textContent = h.value + "°"; teken(); };
  const wis = $("#sel-wis"); if (wis) wis.onclick = () => { bewaarUndo(); if (sel.k === "lawn") D.garden.lawns.splice(sel.i, 1); else D.garden.obstacles.splice(sel.i, 1); sel = null; bewaar(); invalideer(); renderSelectie(); teken(); };
  const pu = $("#sel-punt"); if (pu) pu.onclick = () => { const pts = vormPts(sel); if (pts.length <= 3) { toast("A shape needs at least 3 points."); return; } bewaarUndo(); pts.splice(sel.v, 1); sel.v = null; bewaar(); invalideer(); renderSelectie(); teken(); };
}
function vormPts(s) { return s.k === "lawn" ? D.garden.lawns[s.i].pts : D.garden.obstacles[s.i].pts; }
function tuinStat() {
  const el = $("#tuin-stat"); if (!el) return;
  if (!D.garden.lawns.length) { el.innerHTML = "<dt>No lawn yet</dt><dd></dd>"; return; }
  const r = raster(), b = gardenBounds(D.garden);
  el.innerHTML = `<dt>Lawn area</dt><dd>${r.area.toFixed(1)} m²</dd><dt>Size</dt><dd>${(b.x1 - b.x0).toFixed(1)} × ${(b.y1 - b.y0).toFixed(1)} m</dd><dt>Obstacles</dt><dd>${D.garden.obstacles.length}</dd><dt>Station</dt><dd>${D.garden.station ? "placed" : "not placed"}</dd>`;
}

/* hit testing (world coordinates, tolerance in pixels) */
function hit(wx, wy) {
  const tol = 16 / V.s, g = D.garden;
  const st = g.station;
  if (st) {
    const a = (st.heading - 90) * Math.PI / 180, hx = st.x + Math.cos(a) * 1.0, hy = st.y + Math.sin(a) * 1.0;
    if (Math.hypot(wx - hx, wy - hy) < tol) return { k: "station", mode: "rot" };
    if (Math.hypot(wx - st.x, wy - st.y) < Math.max(tol, 0.4)) return { k: "station", mode: "move" };
  }
  // points of the selected shape first, then any shape's points
  const vormen = [...g.obstacles.map((o, i) => ({ k: "obst", i, o })), ...g.lawns.map((o, i) => ({ k: "lawn", i, o }))];
  if (sel && sel.k !== "station") {
    const o = sel.k === "lawn" ? g.lawns[sel.i] : g.obstacles[sel.i];
    if (o && o.pts) {
      for (let v = 0; v < o.pts.length; v++) if (Math.hypot(wx - o.pts[v][0], wy - o.pts[v][1]) < tol) return { k: sel.k, i: sel.i, mode: "vertex", v };
      for (let v = 0; v < o.pts.length; v++) { const p = o.pts[v], q = o.pts[(v + 1) % o.pts.length]; if (Math.hypot(wx - (p[0] + q[0]) / 2, wy - (p[1] + q[1]) / 2) < tol * 0.8) return { k: sel.k, i: sel.i, mode: "insert", v }; }
    }
    if (o && o.type === "circle" && Math.abs(Math.hypot(wx - o.x, wy - o.y) - o.r) < tol * 0.7) return { k: "obst", i: sel.i, mode: "radius" };
  }
  for (const f of vormen) if (f.o.pts) for (let v = 0; v < f.o.pts.length; v++) if (Math.hypot(wx - f.o.pts[v][0], wy - f.o.pts[v][1]) < tol * 0.8) return { k: f.k, i: f.i, mode: "vertex", v };
  for (const f of vormen) {
    if (f.o.type === "circle" ? Math.hypot(wx - f.o.x, wy - f.o.y) <= f.o.r : inPoly(wx, wy, f.o.pts)) return { k: f.k, i: f.i, mode: "move" };
  }
  return null;
}

/* ================= pointer input ================= */
const pointers = new Map();
let pinch = null;
doek.addEventListener("pointerdown", (e) => {
  doek.setPointerCapture(e.pointerId);
  const r = doek.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  pointers.set(e.pointerId, { sx, sy });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.sx - b.sx, a.sy - b.sy), mx: (a.sx + b.sx) / 2, my: (a.sy + b.sy) / 2, s: V.s, ox: V.ox, oy: V.oy };
    if (drag && drag.undoBij) { /* cancel a one-finger edit that turned into a pinch */ D.garden = JSON.parse(undo.pop()); }
    drag = null; return;
  }
  if (pointers.size > 2) return;
  const [wx, wy] = naarWereld(sx, sy);
  if (actieveTab !== "tuin") { drag = { mode: "pan", sx, sy, ox: V.ox, oy: V.oy }; return; }
  const g = D.garden;
  if (tool === "select") {
    const h = hit(wx, wy);
    if (!h) { sel = null; renderSelectie(); drag = { mode: "pan", sx, sy, ox: V.ox, oy: V.oy }; teken(); return; }
    bewaarUndo();
    if (h.mode === "insert") { const pts = vormPts(h); pts.splice(h.v + 1, 0, [snap(wx), snap(wy)]); h.mode = "vertex"; h.v = h.v + 1; }
    sel = { k: h.k, i: h.i, v: h.mode === "vertex" ? h.v : null };
    drag = Object.assign({}, h, { wx, wy, start: JSON.parse(JSON.stringify(h.k === "station" ? g.station : h.k === "lawn" ? g.lawns[h.i] : g.obstacles[h.i])), undoBij: true, bewogen: false });
    renderSelectie(); teken(); return;
  }
  if (tool === "lawn" || tool === "obst") {
    const p = [snap(wx), snap(wy)];
    if (!concept) concept = { soort: tool, pts: [] };
    if (concept.pts.length >= 3 && Math.hypot(wx - concept.pts[0][0], wy - concept.pts[0][1]) < 14 / V.s) { rondAf(); return; }
    concept.pts.push(p); renderGereedschap(); teken(); return;
  }
  if (tool === "lawnrect" || tool === "obstrect") { drag = { mode: "rect", a: [snap(wx), snap(wy)], b: [snap(wx), snap(wy)] }; teken(); return; }
  if (tool === "tree") { bewaarUndo(); g.obstacles.push({ type: "circle", kind: "tree", x: snap(wx), y: snap(wy), r: 0.6 }); drag = { mode: "treeR", i: g.obstacles.length - 1, x0: sx, y0: sy }; teken(); return; }
  if (tool === "station") { bewaarUndo(); g.station = { x: snap(wx), y: snap(wy), heading: g.station ? g.station.heading : 270 }; drag = { mode: "stRot", x0: sx, y0: sy }; invalideer(); teken(); return; }
});
doek.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) { muisPos(e); return; }
  const r = doek.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
  pointers.set(e.pointerId, { sx, sy });
  if (pinch && pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.sx - b.sx, a.sy - b.sy), mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2;
    const s = klem(pinch.s * d / pinch.d, 3, 400);
    const wx = (pinch.mx - pinch.ox) / pinch.s, wy = (pinch.my - pinch.oy) / pinch.s;
    V.s = s; V.ox = mx - wx * s; V.oy = my - wy * s; teken(); return;
  }
  if (!drag) { muisPos(e); return; }
  const [wx, wy] = naarWereld(sx, sy), g = D.garden;
  if (drag.mode === "pan") { V.ox = drag.ox + sx - drag.sx; V.oy = drag.oy + sy - drag.sy; teken(); return; }
  if (drag.mode === "rect") { drag.b = [snap(wx), snap(wy)]; teken(); return; }
  if (drag.mode === "treeR") { const o = g.obstacles[drag.i]; const d = Math.hypot(sx - drag.x0, sy - drag.y0) / V.s; if (d > 0.2) o.r = Math.max(0.15, snapStap() >= 0.5 ? Math.round(d * 4) / 4 : Math.round(d * 20) / 20); teken(); return; }
  if (drag.mode === "stRot") { const d = Math.hypot(sx - drag.x0, sy - drag.y0); if (d > 12) { g.station.heading = (Math.round((Math.atan2(sy - drag.y0, sx - drag.x0) * 180 / Math.PI + 90) / 5) * 5 + 360) % 360; } teken(); return; }
  const dx = wx - drag.wx, dy = wy - drag.wy; drag.bewogen = true;
  if (drag.k === "station") {
    if (drag.mode === "rot") g.station.heading = (Math.round((Math.atan2(wy - g.station.y, wx - g.station.x) * 180 / Math.PI + 90) / 5) * 5 + 360) % 360;
    else { g.station.x = snap(drag.start.x + dx); g.station.y = snap(drag.start.y + dy); }
  } else {
    const o = drag.k === "lawn" ? g.lawns[drag.i] : g.obstacles[drag.i];
    if (drag.mode === "vertex") o.pts[drag.v] = [snap(wx), snap(wy)];
    else if (drag.mode === "radius") o.r = Math.max(0.1, Math.round(Math.hypot(wx - o.x, wy - o.y) * 20) / 20);
    else if (o.type === "circle") { o.x = snap(drag.start.x + dx); o.y = snap(drag.start.y + dy); }
    else { const s0 = drag.start.pts[0], ddx = snap(s0[0] + dx) - s0[0], ddy = snap(s0[1] + dy) - s0[1]; o.pts = drag.start.pts.map(([x, y]) => [+(x + ddx).toFixed(3), +(y + ddy).toFixed(3)]); }
  }
  teken();
});
function einde(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!drag || pointers.size) return;
  const g = D.garden;
  if (drag.mode === "rect") {
    const [a, b] = [drag.a, drag.b];
    if (Math.abs(a[0] - b[0]) >= 0.2 && Math.abs(a[1] - b[1]) >= 0.2) {
      bewaarUndo();
      const pts = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
      if (tool === "lawnrect") g.lawns.push({ pts }); else g.obstacles.push({ type: "poly", kind: soort, pts });
      invalideer();
    }
  }
  if (drag.mode === "treeR" || drag.mode === "stRot" || drag.bewogen) invalideer();
  else if (drag.undoBij) undo.pop();
  if (drag.mode !== "pan") { bewaar(); renderSelectie(); }
  drag = null; teken();
}
doek.addEventListener("pointerup", einde);
doek.addEventListener("pointercancel", einde);
doek.addEventListener("wheel", (e) => { e.preventDefault(); const r = doek.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }, { passive: false });
let muis = null;
function muisPos(e) { if (actieveTab !== "tuin" || !concept) return; const r = doek.getBoundingClientRect(); muis = naarWereld(e.clientX - r.left, e.clientY - r.top); teken(); }

/* ================= drawing ================= */
let covImg = null, covCtx = null, covData = null, covVoor = null;
function teken() {
  if (!VW) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = css("--veld"); ctx.fillRect(0, 0, VW, VH);
  tekenRaster();
  const g = D.garden;
  const toonDekking = (actieveTab === "sim") && sim;
  // lawn
  ctx.save();
  ctx.setTransform(dpr * V.s, 0, 0, dpr * V.s, dpr * V.ox, dpr * V.oy);
  if (toonDekking) {
    werkDekkingBij();
    ctx.imageSmoothingEnabled = V.s < 40;
    ctx.drawImage(covImg, R.ox, R.oy, R.W * CEL, R.H * CEL);
  } else {
    ctx.fillStyle = "#6fae47";
    for (const l of g.lawns) if (l.pts.length >= 3) { ctx.beginPath(); l.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); }
    // mowing stripes for looks
    ctx.save(); ctx.beginPath(); for (const l of g.lawns) if (l.pts.length >= 3) { l.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); } ctx.clip();
    const b = gardenBounds(g); ctx.fillStyle = "rgba(255,255,255,.07)";
    for (let x = Math.floor(b.x0); x < b.x1; x += 2) ctx.fillRect(x, b.y0 - 1, 1, b.y1 - b.y0 + 2);
    ctx.restore();
  }
  ctx.lineWidth = 2 / V.s; ctx.strokeStyle = "#3d6e27";
  if (!toonDekking) for (const l of g.lawns) if (l.pts.length >= 3) { ctx.beginPath(); l.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); }
  // obstacles
  for (const o of g.obstacles) tekenObstakel(o);
  // trail
  if (toonDekking && $("#v-spoor").checked && sim.trail.length > 4) {
    ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1.2 / V.s; ctx.lineJoin = "round";
    const tr = sim.trail, start = Math.max(0, tr.length - 9000);
    ctx.beginPath(); ctx.moveTo(tr[start - (start % 2)], tr[start - (start % 2) + 1]);
    for (let i = start - (start % 2) + 2; i < tr.length; i += 2) { const dx = tr[i] - tr[i - 2], dy = tr[i + 1] - tr[i - 1]; if (dx * dx + dy * dy > 1) ctx.moveTo(tr[i], tr[i + 1]); else ctx.lineTo(tr[i], tr[i + 1]); }
    ctx.stroke();
  }
  if (g.station) tekenStation(g.station);
  if (toonDekking) tekenMaaier(sim);
  else if (actieveTab === "maaier" && g.station) tekenMaaier({ x: g.station.x, y: g.station.y, h: (g.station.heading - 90) * Math.PI / 180, bodyR: Math.max(D.mower.body / 2, D.mower.width / 2 + 0.02), cutR: D.mower.width / 2 });
  // editor overlays
  if (actieveTab === "tuin") tekenEditor();
  ctx.restore();
  tekenSchaal();
}
function tekenRaster() {
  const stap = V.s > 60 ? 0.5 : V.s > 18 ? 1 : 5;
  const [x0, y0] = naarWereld(0, 0), [x1, y1] = naarWereld(VW, VH);
  ctx.lineWidth = 1;
  for (let x = Math.floor(x0 / stap) * stap; x <= x1; x += stap) { const sx = Math.round(V.ox + x * V.s) + 0.5; ctx.strokeStyle = Math.abs(x % 5) < 1e-6 ? css("--raster5") : css("--raster"); ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, VH); ctx.stroke(); }
  for (let y = Math.floor(y0 / stap) * stap; y <= y1; y += stap) { const sy = Math.round(V.oy + y * V.s) + 0.5; ctx.strokeStyle = Math.abs(y % 5) < 1e-6 ? css("--raster5") : css("--raster"); ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(VW, sy); ctx.stroke(); }
}
function tekenSchaal() {
  const opties = [0.5, 1, 2, 5, 10, 20]; const m = opties.find((o) => o * V.s > 70) || 20;
  const x = 14, y = VH - 16, w = m * V.s;
  if (actieveTab === "sim") return;
  ctx.fillStyle = css("--tekst"); ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y - 5, 2, 8); ctx.fillRect(x + w - 2, y - 5, 2, 8);
  ctx.font = "600 12px system-ui"; ctx.fillText(m + " m", x + w + 6, y + 4);
}
function vormPad(o) { ctx.beginPath(); if (o.type === "circle") ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); else { o.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); } }
function tekenObstakel(o) {
  const lw = 1.5 / V.s;
  if (o.type === "circle") {
    // tree: shadow, canopy, highlight
    ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.beginPath(); ctx.arc(o.x + o.r * 0.12, o.y + o.r * 0.15, o.r * 1.05, 0, Math.PI * 2); ctx.fill();
    const gr = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.35, o.r * 0.1, o.x, o.y, o.r);
    gr.addColorStop(0, "#5f9e3a"); gr.addColorStop(1, "#2a5a1f");
    ctx.fillStyle = gr; vormPad(o); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.12)";
    for (let k = 0; k < 5; k++) { const a = k * 1.3; ctx.beginPath(); ctx.arc(o.x + Math.cos(a) * o.r * 0.45, o.y + Math.sin(a) * o.r * 0.45, o.r * 0.32, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#5b3a1c"; ctx.beginPath(); ctx.arc(o.x, o.y, Math.min(0.12, o.r * 0.2), 0, Math.PI * 2); ctx.fill();
    return;
  }
  const kind = o.kind || "bed";
  const stijl = { bed: ["#8a5a35", "#5c3a1f"], pond: ["#4f93c4", "#2c6390"], paving: ["#b9b4aa", "#7d786e"], hedge: ["#2f5e25", "#1d3d17"] }[kind] || ["#8a5a35", "#5c3a1f"];
  ctx.fillStyle = stijl[0]; vormPad(o); ctx.fill();
  ctx.save(); vormPad(o); ctx.clip();
  const b = o.pts.reduce((a, [x, y]) => [Math.min(a[0], x), Math.min(a[1], y), Math.max(a[2], x), Math.max(a[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
  if (kind === "bed") { const cols = ["#e85d75", "#f2c94c", "#ffffff", "#b67be8"]; let k = 0; for (let x = b[0] + 0.2; x < b[2]; x += 0.45) for (let y = b[1] + 0.2 + ((k++ % 2) * 0.2); y < b[3]; y += 0.45) { ctx.fillStyle = "#3f6f2a"; ctx.beginPath(); ctx.arc(x, y, 0.12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = cols[(Math.floor(x * 7 + y * 3)) % 4]; ctx.beginPath(); ctx.arc(x, y, 0.06, 0, Math.PI * 2); ctx.fill(); } }
  if (kind === "pond") { ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 0.05; for (let y = b[1] + 0.4; y < b[3]; y += 0.6) { ctx.beginPath(); for (let x = b[0]; x <= b[2]; x += 0.2) { const yy = y + Math.sin(x * 4) * 0.05; x === b[0] ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); } }
  if (kind === "paving") { ctx.strokeStyle = "rgba(60,55,50,.35)"; ctx.lineWidth = 0.025; for (let x = Math.floor(b[0] * 2) / 2; x < b[2]; x += 0.5) { ctx.beginPath(); ctx.moveTo(x, b[1]); ctx.lineTo(x, b[3]); ctx.stroke(); } for (let y = Math.floor(b[1] * 2) / 2; y < b[3]; y += 0.5) { ctx.beginPath(); ctx.moveTo(b[0], y); ctx.lineTo(b[2], y); ctx.stroke(); } }
  if (kind === "hedge") { ctx.fillStyle = "rgba(120,180,90,.25)"; for (let x = b[0]; x < b[2]; x += 0.3) for (let y = b[1]; y < b[3]; y += 0.3) { ctx.beginPath(); ctx.arc(x + ((y * 10) % 0.15), y, 0.12, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
  ctx.strokeStyle = stijl[1]; ctx.lineWidth = lw; vormPad(o); ctx.stroke();
}
function tekenStation(st) {
  const a = (st.heading - 90) * Math.PI / 180;
  ctx.save(); ctx.translate(st.x, st.y); ctx.rotate(a);
  // the mower faces into the station: draw the station just ahead of the docked position
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.fillRect(0.1, -0.33, 0.5, 0.7);
  ctx.fillStyle = "#3b4048"; ctx.beginPath(); ctx.moveTo(0.05, -0.32); ctx.lineTo(0.45, -0.32); ctx.lineTo(0.6, 0); ctx.lineTo(0.45, 0.32); ctx.lineTo(0.05, 0.32); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#f2b33d"; ctx.beginPath(); ctx.arc(0.3, 0, 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(-0.4, -0.3, 0.45, 0.6);
  ctx.restore();
  if (actieveTab === "tuin") {
    const hx = st.x + Math.cos(a) * 1.0, hy = st.y + Math.sin(a) * 1.0;
    ctx.strokeStyle = "#f2b33d"; ctx.lineWidth = 2 / V.s; ctx.setLineDash([4 / V.s, 3 / V.s]); ctx.beginPath(); ctx.moveTo(st.x, st.y); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#f2b33d"; ctx.beginPath(); ctx.arc(hx, hy, 6 / V.s, 0, Math.PI * 2); ctx.fill();
  }
}
function tekenMaaier(m) {
  const bodyR = m.bodyR, cutR = m.cutR;
  ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.h);
  ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(0.03, 0.04, bodyR * 1.05, bodyR * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f2f2ee"; ctx.beginPath(); ctx.moveTo(bodyR, 0); ctx.quadraticCurveTo(bodyR * 0.9, bodyR * 0.85, -bodyR * 0.2, bodyR * 0.85); ctx.quadraticCurveTo(-bodyR, bodyR * 0.85, -bodyR, 0); ctx.quadraticCurveTo(-bodyR, -bodyR * 0.85, -bodyR * 0.2, -bodyR * 0.85); ctx.quadraticCurveTo(bodyR * 0.9, -bodyR * 0.85, bodyR, 0); ctx.fill();
  ctx.strokeStyle = "#2b2f33"; ctx.lineWidth = 1.5 / V.s; ctx.stroke();
  ctx.fillStyle = "#e5603a"; ctx.beginPath(); ctx.ellipse(-bodyR * 0.15, 0, bodyR * 0.45, bodyR * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2b2f33"; ctx.fillRect(-bodyR * 0.65, -bodyR * 0.95, bodyR * 0.5, bodyR * 0.18); ctx.fillRect(-bodyR * 0.65, bodyR * 0.77, bodyR * 0.5, bodyR * 0.18);
  ctx.strokeStyle = "rgba(229,96,58,.9)"; ctx.lineWidth = 1.2 / V.s; ctx.setLineDash([3 / V.s, 2 / V.s]); ctx.beginPath(); ctx.arc(0, 0, cutR, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = "#2b2f33"; ctx.beginPath(); ctx.moveTo(bodyR * 0.95, 0); ctx.lineTo(bodyR * 0.6, -bodyR * 0.2); ctx.lineTo(bodyR * 0.6, bodyR * 0.2); ctx.fill();
  ctx.restore();
}
function tekenEditor() {
  const g = D.garden, px = 1 / V.s;
  if (sel && sel.k !== "station") {
    const o = sel.k === "lawn" ? g.lawns[sel.i] : g.obstacles[sel.i];
    if (o) {
      ctx.strokeStyle = "#1e88e5"; ctx.lineWidth = 2.5 * px; vormPad(o.pts ? o : o); if (o.pts) { ctx.beginPath(); o.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); } ctx.stroke();
      if (o.pts) {
        o.pts.forEach(([x, y], v) => { ctx.fillStyle = sel.v === v ? "#1e88e5" : "#fff"; ctx.strokeStyle = "#1e88e5"; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(x, y, 7 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
        o.pts.forEach((p, v) => { const q = o.pts[(v + 1) % o.pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; ctx.fillStyle = "rgba(30,136,229,.85)"; ctx.beginPath(); ctx.arc(mx, my, 6 * px, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.6 * px; ctx.beginPath(); ctx.moveTo(mx - 3 * px, my); ctx.lineTo(mx + 3 * px, my); ctx.moveTo(mx, my - 3 * px); ctx.lineTo(mx, my + 3 * px); ctx.stroke(); });
      } else { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#1e88e5"; ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.arc(o.x + o.r, o.y, 7 * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    }
  }
  if (concept) {
    const pts = concept.pts.slice(); if (muis) pts.push(muis);
    ctx.strokeStyle = concept.soort === "lawn" ? "#2e7d32" : "#6d4c41"; ctx.lineWidth = 2 * px; ctx.setLineDash([6 * px, 4 * px]);
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
    concept.pts.forEach(([x, y], i) => { ctx.fillStyle = i === 0 ? "#ffb300" : "#fff"; ctx.strokeStyle = "#333"; ctx.lineWidth = 1.5 * px; ctx.beginPath(); ctx.arc(x, y, (i === 0 ? 8 : 5.5) * px, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  }
  if (drag && drag.mode === "rect") {
    const [a, b] = [drag.a, drag.b];
    ctx.fillStyle = tool === "lawnrect" ? "rgba(111,174,71,.5)" : "rgba(138,90,53,.5)"; ctx.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5 * px; ctx.strokeRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
    ctx.fillStyle = "#111"; ctx.font = `${13 * px}px system-ui`; ctx.fillText(`${Math.abs(a[0] - b[0]).toFixed(2)} × ${Math.abs(a[1] - b[1]).toFixed(2)} m`, Math.max(a[0], b[0]) + 6 * px, Math.max(a[1], b[1]) + 14 * px);
  }
}

/* coverage image at grid resolution */
const KLEUR_LANG = [55, 112, 40], KLEUR_KORT = [156, 211, 96];
const PASS_KLEUREN = [[156, 211, 96], [214, 230, 120], [244, 196, 86], [234, 128, 64], [196, 64, 64]];
function passKleur(n) {
  if (!$("#v-hitte").checked) return KLEUR_KORT;
  const st = PASS_KLEUREN;
  const i = Math.min(st.length - 1, n <= 1 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : n <= 12 ? 3 : 4);
  return st[i];
}
function bouwDekking() {
  covImg = document.createElement("canvas"); covImg.width = R.W; covImg.height = R.H;
  covCtx = covImg.getContext("2d"); covData = covCtx.createImageData(R.W, R.H);
  const d = covData.data, onb = $("#v-onbereik").checked;
  for (let i = 0; i < R.W * R.H; i++) {
    if (!R.mowable[i]) { d[i * 4 + 3] = 0; continue; }
    const n = sim ? sim.cov[i] : 0;
    let c = n ? passKleur(n) : KLEUR_LANG;
    if (!n && onb && sim && !sim.can[i]) c = [196, 104, 214];
    d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
  }
  if (sim) sim.newCells.length = 0;
  covCtx.putImageData(covData, 0, 0);
}
function werkDekkingBij() {
  if (!covImg || covImg.width !== R.W || covImg.height !== R.H) { bouwDekking(); return; }
  if (!sim.newCells.length) return;
  const d = covData.data;
  for (const i of sim.newCells) { const c = passKleur(sim.cov[i]); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; }
  sim.newCells.length = 0;
  covCtx.putImageData(covData, 0, 0);
}

/* ================= mower settings ================= */
const MAAIER_VELDEN = [
  ["width", "Cutting width", 0.12, 0.6, 0.01, (v) => Math.round(v * 100) + " cm"],
  ["body", "Chassis width", 0.25, 0.9, 0.01, (v) => Math.round(v * 100) + " cm"],
  ["speed", "Speed", 0.15, 0.8, 0.01, (v) => v.toFixed(2) + " m/s"],
  ["turnRate", "Turning speed", 30, 180, 5, (v) => v + "°/s"],
  ["batteryMin", "Battery: mowing time", 10, 240, 5, (v) => v + " min"],
  ["chargeMin", "Charging time (empty → full)", 10, 240, 5, (v) => v + " min"],
  ["undock", "Backs out of the station", 0.2, 2, 0.1, (v) => v.toFixed(1) + " m"],
  ["wobble", "Wobble on straight tracks", 0, 5, 0.1, (v) => (v ? v.toFixed(1) + "°/m" : "off: perfectly straight")],
  ["turnError", "Turning inaccuracy", 0, 15, 0.5, (v) => (v ? "± " + v + "°" : "off: exact")],
];
function renderMaaier() {
  const m = D.mower;
  $("#maaier-velden").innerHTML = MAAIER_VELDEN.map(([k, l, a, b, s, f]) => `<label class="veld"><span>${l} <b id="mv-${k}">${f(m[k])}</b></span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${s}" value="${m[k]}"></label>`).join("") +
    `<p class="uitleg" style="margin-top:-4px">Wobble lets bumps in the ground and small steering differences bend every straight track a little, so no two runs repeat exactly. Turning inaccuracy adds a random error to every turn.</p>
    <label class="vink"><input type="checkbox" id="m-cutret" ${m.cutReturn ? "checked" : ""}> Keep cutting while driving home</label>
     <div class="kaart" style="margin-top:12px"><dl class="stat"><dt>Area per battery charge</dt><dd id="m-opp"></dd><dt>Cycle (mow + charge)</dt><dd id="m-cyc"></dd></dl></div>`;
  $$("#maaier-velden input[type=range]").forEach((inp) => (inp.oninput = () => {
    const k = inp.dataset.k; m[k] = Number(inp.value);
    if (k === "width" && m.body < m.width + 0.04) { m.body = +(m.width + 0.04).toFixed(2); $('#maaier-velden input[data-k="body"]').value = m.body; }
    if (k === "body" && m.body < m.width + 0.04) { m.body = +(m.width + 0.04).toFixed(2); inp.value = m.body; }
    for (const [kk, , , , , f] of MAAIER_VELDEN) $("#mv-" + kk).textContent = f(m[kk]);
    maaierStat(); bewaar(); invalideer(); teken();
  }));
  $("#m-cutret").onchange = (e) => { m.cutReturn = e.target.checked; bewaar(); invalideer(); };
  maaierStat();
}
function maaierStat() {
  const m = D.mower, opp = m.width * m.speed * m.batteryMin * 60;
  $("#m-opp").textContent = `≈ ${Math.round(opp)} m² if no strip is mowed twice`;
  $("#m-cyc").textContent = `${m.batteryMin} + ${m.chargeMin} min`;
}

/* ================= algorithm editor ================= */
const STAP_TYPES = { back: "Back up", forward: "Drive forward", turn: "Turn", heading: "Turn to a direction", random: "Turn to a random direction", spiral: "Spiral outwards", follow: "Follow the edge", pause: "Wait" };
function stapType(s) { return s.t === "heading" && s.random ? "random" : s.t; }
function nieuweStap(type) {
  return { back: { t: "back", d: 0.3 }, forward: { t: "forward", d: 1, unit: "m" }, turn: { t: "turn", mode: "fixed", deg: 90, min: 90, max: 180, dir: "cw" }, heading: { t: "heading", deg: 0 }, random: { t: "heading", random: true }, spiral: { t: "spiral", grow: 0.9 }, follow: { t: "follow", side: "right", d: 20 }, pause: { t: "pause", s: 10 } }[type];
}
function stapParams(s, pad) {
  const n = (k, v, st = "any", w) => `<input type="number" data-p="${pad}" data-k="${k}" value="${v}" step="${st}" ${w ? `style="width:${w}px"` : ""}>`;
  const sel = (k, opts, v) => `<select data-p="${pad}" data-k="${k}">${opts.map(([a, b]) => `<option value="${a}" ${String(v) === String(a) ? "selected" : ""}>${b}</option>`).join("")}</select>`;
  const typeSel = `<select data-p="${pad}" data-k="__type">${Object.entries(STAP_TYPES).map(([a, b]) => `<option value="${a}" ${stapType(s) === a ? "selected" : ""}>${b}</option>`).join("")}</select>`;
  switch (stapType(s)) {
    case "back": return `${typeSel} ${n("dcm", Math.round(s.d * 100), 1)} cm`;
    case "forward": return `${typeSel} ${n("d", s.d, 0.1)} ${sel("unit", [["m", "m"], ["w", "× cutting width"]], s.unit)}`;
    case "turn": return `${typeSel} ${sel("mode", [["fixed", "by"], ["random", "randomly between"]], s.mode)} ${s.mode === "random" ? `${n("min", s.min, 1, 62)}° and ${n("max", s.max, 1, 62)}°` : `${n("deg", s.deg, 1, 62)}°`} ${sel("dir", [["cw", "clockwise"], ["ccw", "counter-clockwise"], ["random", "either way (random)"], ["alternate", "alternating each time"]], s.dir)}`;
    case "heading": return `${typeSel} ${n("deg", s.deg, 1, 62)}° ${sel("alt", [["", "every time"], ["1", "and the opposite way every other time"]], s.alt ? "1" : "")} <span class="uitleg" style="margin:0">(0° = up, 90° = right; uses a compass, so turning errors don't add up)</span>`;
    case "random": return typeSel;
    case "spiral": return `${typeSel} growing ${n("grow", s.grow, 0.1, 62)} × cutting width per round, until it bumps`;
    case "follow": return `${typeSel} with the edge on the ${sel("side", [["right", "right"], ["left", "left"]], s.side)} for ${n("d", s.d, 1, 62)} m`;
    case "pause": return `${typeSel} ${n("s", s.s, 1, 62)} seconds`;
  }
  return typeSel;
}
function stappenHtml(lijst, pad) {
  if (!lijst.length) return `<div class="leeg">No steps: it just keeps driving straight ahead.</div>`;
  return lijst.map((s, i) => `<div class="stap"><span class="nr">${i + 1}</span><div class="params">${stapParams(s, pad + "." + i)}</div><div class="acties"><button data-op="op" data-p="${pad}.${i}" title="Move up">▲</button><button data-op="neer" data-p="${pad}.${i}" title="Move down">▼</button><button data-op="wis" data-p="${pad}.${i}" title="Delete">✕</button></div></div>`).join("");
}
function regelBlok(titel, sub, pad, lijst, extraKop = "") {
  return `<div class="regel"><div class="kop">${titel}<span class="zacht">${sub}</span>${extraKop}</div><div class="stappen">${stappenHtml(lijst, pad)}<button class="knop klein" data-op="nieuw" data-p="${pad}">+ Add step</button></div></div>`;
}
function renderAlgoLijst() {
  const opts = D.algos.map((a) => `<option value="${a.id}">${esc(a.naam)}</option>`).join("");
  $("#algo-lijst").innerHTML = opts; $("#algo-lijst").value = algoById(D.ui.algo).id;
  $("#sim-algo").innerHTML = opts; $("#sim-algo").value = algoById(D.ui.simAlgo).id;
  $("#verg-lijst").innerHTML = D.algos.map((a, i) => `<label class="vink"><input type="checkbox" data-id="${a.id}" ${D.ui.verg.includes(a.id) ? "checked" : ""}><i style="width:12px;height:12px;border-radius:3px;background:var(--c${i % 7})"></i>${esc(a.naam)}</label>`).join("");
  $$("#verg-lijst input").forEach((c) => (c.onchange = () => { D.ui.verg = $$("#verg-lijst input:checked").map((x) => x.dataset.id); bewaar(); }));
}
function renderAlgo() {
  const a = algoById(D.ui.algo);
  const per = a.periodic || { every: 0, actions: [] };
  $("#algo-editor").innerHTML = `
    <label class="veld"><span>Name</span><input type="text" id="a-naam" value="${esc(a.naam)}"></label>
    ${regelBlok("When it leaves the station", " — after backing out", "onStart", a.onStart || [])}
    ${regelBlok("When it reaches the edge of the lawn", " — the boundary wire", "onEdge", a.onEdge || [])}
    <div class="regel"><div class="kop">When it bumps into an obstacle<span class="zacht"> — trees, beds, ponds…</span></div><div class="stappen">
      <label class="vink" style="margin:2px 4px 6px"><input type="checkbox" id="a-zelfde" ${a.obstacleSame ? "checked" : ""}> Same as at the edge</label>
      ${a.obstacleSame ? "" : stappenHtml(a.onObstacle || [], "onObstacle") + `<button class="knop klein" data-op="nieuw" data-p="onObstacle">+ Add step</button>`}
    </div></div>
    <div class="regel"><div class="kop">Every <input type="number" id="a-elke" value="${Math.round((per.every || 0) / 60)}" min="0" step="1" style="width:70px;min-height:30px;padding:3px 6px"> minutes of mowing<span class="zacht"> — 0 = never</span></div>
      ${per.every > 0 ? `<div class="stappen">${stappenHtml(per.actions || [], "periodic")}<button class="knop klein" data-op="nieuw" data-p="periodic">+ Add step</button></div>` : ""}</div>
    <div class="anders">Otherwise: drive straight ahead. If a step bumps into something, the edge or obstacle rule starts again from its first step.</div>
    <div class="regel"><div class="kop">Going home to charge</div><div class="stappen">
      <label class="veld" style="margin:4px"><span>Head home when the battery drops to <b id="a-ret-w">${a.returnAt}%</b></span><input type="range" id="a-ret" min="5" max="50" step="1" value="${a.returnAt}"></label>
      <label class="veld" style="margin:4px"><span>Way home</span><select id="a-mode"><option value="path" ${a.returnMode !== "wire" ? "selected" : ""}>Shortest path (GPS / RTK mower)</option><option value="wire" ${a.returnMode === "wire" ? "selected" : ""}>Follow the boundary wire (edge on the right)</option></select></label>
      <p class="uitleg" style="margin:4px">It also leaves earlier when the remaining charge is only just enough to get home.</p>
    </div></div>`;
  const ed = $("#algo-editor");
  $("#a-naam").oninput = (e) => { a.naam = e.target.value || "Unnamed"; bewaar(); renderAlgoLijstNamen(); };
  $("#a-zelfde").onchange = (e) => { a.obstacleSame = e.target.checked; if (!a.obstacleSame && !(a.onObstacle || []).length) a.onObstacle = JSON.parse(JSON.stringify(a.onEdge)); wijzigAlgo(a, true); };
  $("#a-elke").onchange = (e) => { a.periodic = a.periodic || { every: 0, actions: [] }; a.periodic.every = Math.max(0, Number(e.target.value) || 0) * 60; if (a.periodic.every && !a.periodic.actions.length) a.periodic.actions = [{ t: "heading", random: true }]; wijzigAlgo(a, true); };
  $("#a-ret").oninput = (e) => { a.returnAt = Number(e.target.value); $("#a-ret-w").textContent = a.returnAt + "%"; wijzigAlgo(a, false); };
  $("#a-mode").onchange = (e) => { a.returnMode = e.target.value; wijzigAlgo(a, false); };
  const lijstVan = (pad) => (pad === "periodic" ? a.periodic.actions : (a[pad] = a[pad] || []));
  $$("button[data-op]", ed).forEach((b) => (b.onclick = () => {
    const [pad, idx] = b.dataset.p.split("."); const l = lijstVan(pad), i = Number(idx);
    if (b.dataset.op === "nieuw") l.push(nieuweStap(pad === "onStart" ? "random" : "turn"));
    if (b.dataset.op === "wis") l.splice(i, 1);
    if (b.dataset.op === "op" && i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
    if (b.dataset.op === "neer" && i < l.length - 1) [l[i + 1], l[i]] = [l[i], l[i + 1]];
    wijzigAlgo(a, true);
  }));
  $$("[data-k]", ed).forEach((inp) => (inp.onchange = () => {
    const [pad, idx] = inp.dataset.p.split("."); const l = lijstVan(pad), i = Number(idx), k = inp.dataset.k;
    if (k === "__type") { l[i] = nieuweStap(inp.value); wijzigAlgo(a, true); return; }
    const s = l[i];
    if (k === "dcm") s.d = Math.max(0, Number(inp.value) || 0) / 100;
    else if (["d", "deg", "min", "max", "grow", "s"].includes(k)) s[k] = Number(inp.value) || 0;
    else if (k === "alt") s.alt = inp.value === "1";
    else s[k] = inp.value;
    wijzigAlgo(a, k === "mode");
  }));
}
function renderAlgoLijstNamen() { const keep = D.ui.algo; renderAlgoLijst(); D.ui.algo = keep; $("#algo-lijst").value = keep; }
function wijzigAlgo(a, herteken) { bewaar(); if (sim && sim.algo === a) invalideer(); if (herteken) renderAlgo(); }

/* ================= simulation view ================= */
let sim = null, loopt = false, naarEind = false, simChart = null;
function maakSim() {
  const p = problemen(); if (p) { toast(p); return null; }
  raster();
  const s = new Sim(R, mowerVoorSim(), algoById(D.ui.simAlgo), 1);
  s.target = Number($("#s-doel").value); s.limit = Number($("#s-limiet").value) * 3600;
  if (!s.reach.start) { toast("The station isn't on the lawn, or the mower doesn't fit there."); return null; }
  covImg = null;
  return s;
}
function zorgSim() { if (!sim) { sim = maakSim(); if (sim) { bouwDekking(); simStats(true); } } return sim; }
function stopSim() { loopt = false; naarEind = false; $("#b-play").textContent = "▶ Play"; }
function simStats(geforceerd) {
  if (!sim) { $("#s-dekking").textContent = "0%"; $("#s-tijd").textContent = "0:00"; $("#s-modus").textContent = "ready"; $("#s-stat").innerHTML = ""; $("#b-tijd").textContent = ""; return; }
  const effectief = sim.covered / sim.maxCov;
  $("#s-dekking").textContent = pct(effectief);
  $("#s-dekking-sub").textContent = `of what it can reach · ${pct(sim.coverage)} of the whole lawn (max ${pct(sim.maxCov / R.nMow, 0)})`;
  $("#s-dekking-balk").style.width = effectief * 100 + "%";
  $("#s-tijd").textContent = fmtH(sim.t); $("#b-tijd").textContent = fmtH(sim.t);
  $("#s-modus").textContent = sim.finished ? "finished" : { mow: "mowing", return: "driving home", charge: "charging" }[sim.mode];
  $("#s-batt").style.width = Math.max(0, sim.battery) * 100 + "%"; $("#s-batt-tekst").textContent = Math.round(Math.max(0, sim.battery) * 100) + "%";
  let passen = 0; if (sim.covered) { let s = 0; for (let i = 0; i < sim.cov.length; i++) s += sim.cov[i]; passen = s / sim.covered; }
  $("#s-stat").innerHTML = `<dt>Distance driven</dt><dd>${(sim.dist / 1000).toFixed(2)} km</dd><dt>Times charged</dt><dd>${sim.charges}</dd><dt>Bumps</dt><dd>${sim.bumps}</dd><dt>Mowing time</dt><dd>${fmtH(sim.mowTime)}</dd><dt>Average passes</dt><dd>${passen.toFixed(1)}×</dd>${sim.stranded ? `<dt>Ran flat</dt><dd style="color:var(--gevaar)">${sim.stranded}×</dd>` : ""}`;
  if (geforceerd || !simChart || Math.floor(sim.t / 600) !== simStats.laatste) { simStats.laatste = Math.floor(sim.t / 600); simGrafiek(); }
}
function simGrafiek() {
  const data = sim ? sim.history.map(([t, c]) => ({ x: t / 3600, y: Math.min(100, (c * R.nMow / sim.maxCov) * 100) })) : [];
  if (sim) data.push({ x: sim.t / 3600, y: (sim.covered / sim.maxCov) * 100 });
  const kl = css("--accent");
  if (!simChart) {
    simChart = new Chart($("#g-sim"), { type: "line", data: { datasets: [{ data, borderColor: kl, backgroundColor: kl, borderWidth: 2, pointRadius: 0, tension: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, parsing: false, plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { type: "linear", min: 0, title: { display: true, text: "hours", color: css("--tekst2") }, ticks: { color: css("--tekst2") }, grid: { display: false } }, y: { min: 0, max: 100, ticks: { color: css("--tekst2"), callback: (v) => v + "%" }, grid: { color: css("--lijn2") } } } } });
  } else { simChart.data.datasets[0].data = data; simChart.update("none"); }
}
let vorige = 0;
function lus(ts) {
  const dt = Math.min(0.1, (ts - vorige) / 1000 || 0); vorige = ts;
  if (sim && loopt && !sim.finished) {
    const t0 = performance.now();
    if (naarEind) { while (performance.now() - t0 < 30 && sim.run(120)); }
    else { const sec = dt * Number($("#b-snel").value); let gedaan = 0; while (gedaan < sec && performance.now() - t0 < 30) { const stuk = Math.min(5, sec - gedaan); sim.run(stuk); gedaan += stuk; if (sim.finished) break; } }
    if (sim.finished) { stopSim(); toast(sim.covered >= sim.target * sim.maxCov ? `Target reached after ${fmtH(sim.t)}` : `Time limit reached at ${pct(sim.covered / sim.maxCov)}`); }
    teken(); simStats();
  }
  requestAnimationFrame(lus);
}

/* ================= compare ================= */
let vergChart = null, vergBezig = false;
async function vergelijk() {
  if (vergBezig) { vergBezig = false; return; }
  const p = problemen(); if (p) { toast(p); return; }
  const ids = D.ui.verg.filter((id) => D.algos.some((a) => a.id === id));
  if (!ids.length) { toast("Tick at least one algorithm."); return; }
  raster();
  const runs = Number($("#v-runs").value), limit = Number($("#v-limiet").value) * 3600;
  vergBezig = true; $("#b-verg").textContent = "Stop";
  const res = [], totaal = ids.length * runs; let klaar = 0;
  for (const id of ids) {
    const a = algoById(id), uitkomsten = [];
    for (let r = 0; r < runs && vergBezig; r++) {
      const s = new Sim(R, mowerVoorSim(), a, 1000 + r * 7919);
      if (!s.reach.start) { toast("The station isn't on the lawn."); vergBezig = false; break; }
      s.target = 0.995; s.limit = limit;
      while (vergBezig) {
        const t0 = performance.now();
        let door = true; while (door && performance.now() - t0 < 40) door = s.run(300);
        $("#v-voortgang").style.width = ((klaar + Math.min(1, s.t / limit)) / totaal) * 100 + "%";
        $("#v-status").textContent = `${a.naam}: run ${r + 1} of ${runs} · ${fmtH(s.t)} simulated`;
        await new Promise((ok) => setTimeout(ok, 0));
        if (!door) break;
      }
      let passen = 0; if (s.covered) { let t = 0; for (let i = 0; i < s.cov.length; i++) t += s.cov[i]; passen = t / s.covered; }
      uitkomsten.push({ hist: s.history.map(([t, c]) => [t, (c * R.nMow) / s.maxCov]), t: s.t, dist: s.dist, charges: s.charges, stranded: s.stranded, bumps: s.bumps, passen, eind: s.covered / s.maxCov });
      klaar++;
    }
    if (!vergBezig) break;
    // average the curves per 5 minutes; a finished run stays at its final value
    const stap = 300, curve = [];
    for (let t = 0; t <= limit; t += stap) {
      let som = 0;
      for (const u of uitkomsten) { const h = u.hist; let v = h[h.length - 1][1]; if (t < h[h.length - 1][0]) { let k = h.findIndex((p) => p[0] >= t); if (k <= 0) v = h[0][1]; else v = h[k - 1][1] + ((h[k][1] - h[k - 1][1]) * (t - h[k - 1][0])) / (h[k][0] - h[k - 1][0]); } som += v; }
      curve.push([t, som / uitkomsten.length]);
      if (som / uitkomsten.length >= 0.995 && t > 0) break;
    }
    const gem = (k) => uitkomsten.reduce((s, u) => s + u[k], 0) / uitkomsten.length;
    const tot = (f) => { const p = curve.find((c) => c[1] >= f); return p ? p[0] : null; };
    res.push({ id, naam: a.naam, curve, t50: tot(0.5), t75: tot(0.75), t90: tot(0.9), t95: tot(0.95), t99: tot(0.99), eind: gem("eind"), dist: gem("dist"), charges: gem("charges"), stranded: uitkomsten.reduce((s, u) => s + u.stranded, 0), passen: gem("passen"), bumps: gem("bumps") / (gem("t") / 3600) });
  }
  const gestopt = !vergBezig;
  vergBezig = false; $("#b-verg").textContent = "Run comparison";
  $("#v-voortgang").style.width = gestopt ? "0%" : "100%";
  $("#v-status").textContent = gestopt ? "Stopped." : `Done: ${res.length} algorithms, ${runs} run${runs > 1 ? "s" : ""} each, ${R.area.toFixed(0)} m² lawn, ${Math.round(D.mower.width * 100)} cm cutting width.`;
  if (res.length) toonVergelijking(res);
}
function toonVergelijking(res) {
  const sets = res.map((r) => ({ label: r.naam, data: r.curve.map(([t, c]) => ({ x: t / 3600, y: c * 100 })), borderColor: kleurVan(r.id), backgroundColor: kleurVan(r.id), borderWidth: 2.2, pointRadius: 0, pointHoverRadius: 4, tension: 0 }));
  $("#v-legenda").innerHTML = res.map((r) => `<span><i style="background:${kleurVan(r.id)}"></i>${esc(r.naam)}</span>`).join("");
  if (vergChart) vergChart.destroy();
  vergChart = new Chart($("#g-verg"), { type: "line", data: { datasets: sets },
    options: { responsive: true, maintainAspectRatio: false, animation: false, parsing: false, interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => fmtH(c[0].parsed.x * 3600) + " h", label: (c) => ` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%` } } },
      scales: { x: { type: "linear", min: 0, title: { display: true, text: "simulated hours (including charging)", color: css("--tekst2") }, ticks: { color: css("--tekst2") }, grid: { color: css("--lijn2") } },
        y: { min: 0, max: 100, title: { display: true, text: "share of the reachable lawn mowed", color: css("--tekst2") }, ticks: { color: css("--tekst2"), callback: (v) => v + "%" }, grid: { color: css("--lijn2") } } } } });
  const kol = [["t50", "50%", true], ["t75", "75%", true], ["t90", "90%", true], ["t95", "95%", true], ["t99", "99%", true]];
  const best = {};
  for (const [k] of kol) { const v = res.map((r) => r[k]).filter((x) => x != null); best[k] = v.length ? Math.min(...v) : null; }
  const bestDist = Math.min(...res.map((r) => r.dist / Math.max(r.eind, 0.01)));
  $("#v-tabel").innerHTML = `<thead><tr><th>Algorithm</th>${kol.map(([, l]) => `<th>${l} after</th>`).join("")}<th>Final</th><th>Distance</th><th>Charges</th><th>Passes</th><th>Bumps/h</th></tr></thead><tbody>` +
    res.map((r) => `<tr><td><span class="stip" style="background:${kleurVan(r.id)}"></span>${esc(r.naam)}</td>${kol.map(([k]) => `<td class="${r[k] != null && r[k] === best[k] ? "best" : ""}">${r[k] == null ? "–" : fmtH(r[k])}</td>`).join("")}<td>${pct(r.eind)}</td><td class="${r.dist / Math.max(r.eind, 0.01) === bestDist ? "best" : ""}">${(r.dist / 1000).toFixed(1)} km</td><td>${r.charges.toFixed(1)}${r.stranded ? ` <span style="color:var(--gevaar)" title="ran flat">(${r.stranded}!)</span>` : ""}</td><td>${r.passen.toFixed(1)}×</td><td>${Math.round(r.bumps)}</td></tr>`).join("") + "</tbody>";
}

/* ================= file export / import ================= */
function bewaarBestand(naam, tekst) {
  if (window.MowerApp && window.MowerApp.saveFile) { window.MowerApp.saveFile(naam, "application/json", btoa(unescape(encodeURIComponent(tekst)))); return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([tekst], { type: "application/json" })); a.download = naam; document.body.appendChild(a); a.click(); a.remove();
}
window.__bestandOpgeslagen = (ok, n) => toast(ok ? "Saved " + n : "Not saved");
async function importeer(f) {
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j.garden || !Array.isArray(j.garden.lawns)) throw new Error("not a Mower Lab file");
    bewaarUndo(); D.garden = j.garden; if (j.mower) D.mower = Object.assign({}, STD_MAAIER, j.mower);
    if (Array.isArray(j.algos) && j.algos.length) D.algos = j.algos;
    bewaar(); invalideer(); renderAlles(); pasAan(); toast("Opened " + f.name);
  } catch (e) { toast("Couldn't open this file: " + e.message); }
}

/* ================= tabs ================= */
let actieveTab = "tuin";
function kiesTab(t) {
  actieveTab = t; D.ui.tab = t; bewaar();
  $$("nav button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  $$("section.tab").forEach((s) => s.classList.toggle("actief", s.id === "tab-" + t));
  $("#simbalk").classList.toggle("zichtbaar", t === "sim");
  $("#vergelijk").classList.toggle("zichtbaar", t === "verg" && !!vergChart);
  if (t !== "sim") stopSim();
  if (t === "sim") zorgSim();
  if (t === "tuin") renderGereedschap();
  if (t === "algo") renderAlgo();
  hint(); simStats(true); teken();
}
function renderAlles() { renderGereedschap(); renderSelectie(); renderMaaier(); renderAlgoLijst(); renderAlgo(); tuinStat(); }

function start() {
  maat();
  const vb = $("#voorbeeld"); vb.innerHTML = `<option value="">Load an example garden…</option>` + Object.entries(VOORBEELDEN).map(([k, v]) => `<option value="${k}">${v.naam}</option>`).join("");
  $("#b-voorbeeld").onclick = () => { const k = vb.value; if (!k) return; bewaarUndo(); D.garden = JSON.parse(JSON.stringify(VOORBEELDEN[k].g)); sel = null; concept = null; bewaar(); invalideer(); renderSelectie(); pasAan(); };
  $("#b-undo").onclick = () => { if (!undo.length) { toast("Nothing to undo"); return; } D.garden = JSON.parse(undo.pop()); sel = null; bewaar(); invalideer(); renderSelectie(); teken(); };
  $("#b-passend").onclick = pasAan; $("#z-pas").onclick = pasAan;
  $("#z-in").onclick = () => zoom(1.25); $("#z-uit").onclick = () => zoom(0.8);
  $("#b-leeg").onclick = () => { if (!confirm("Remove the whole garden?")) return; bewaarUndo(); D.garden = { lawns: [], obstacles: [], station: null }; sel = null; bewaar(); invalideer(); renderSelectie(); teken(); };
  $("#b-export").onclick = () => bewaarBestand("mower-lab-garden.json", JSON.stringify({ app: "Mower Lab", garden: D.garden, mower: D.mower, algos: D.algos }, null, 1));
  $("#b-import").onclick = () => $("#f-import").click();
  $("#f-import").onchange = (e) => { importeer(e.target.files[0]); e.target.value = ""; };
  $$("nav button").forEach((b) => (b.onclick = () => kiesTab(b.dataset.tab)));
  $("#algo-lijst").onchange = (e) => { D.ui.algo = e.target.value; bewaar(); renderAlgo(); };
  $("#b-algo-nieuw").onclick = () => { const a = { id: "a" + Date.now().toString(36), naam: "My algorithm", onStart: [], onEdge: [{ t: "back", d: 0.5 }, { t: "turn", mode: "fixed", deg: 20, dir: "cw" }], obstacleSame: true, onObstacle: [], periodic: { every: 0, actions: [] }, returnAt: 15, returnMode: "path" }; D.algos.push(a); D.ui.algo = a.id; D.ui.verg.push(a.id); bewaar(); renderAlgoLijst(); renderAlgo(); };
  $("#b-algo-kopie").onclick = () => { const b = JSON.parse(JSON.stringify(algoById(D.ui.algo))); b.id = "a" + Date.now().toString(36); b.naam += " (copy)"; D.algos.push(b); D.ui.algo = b.id; bewaar(); renderAlgoLijst(); renderAlgo(); };
  $("#b-algo-wis").onclick = () => { if (D.algos.length <= 1) { toast("Keep at least one algorithm."); return; } const a = algoById(D.ui.algo); if (!confirm(`Delete "${a.naam}"?`)) return; D.algos = D.algos.filter((x) => x !== a); D.ui.algo = D.algos[0].id; if (D.ui.simAlgo === a.id) { D.ui.simAlgo = D.algos[0].id; invalideer(); } bewaar(); renderAlgoLijst(); renderAlgo(); };
  $("#b-algo-reset").onclick = () => { const vb = VOORBEELD_ALGOS(); for (const a of vb) { const i = D.algos.findIndex((x) => x.id === a.id); if (i >= 0) D.algos[i] = a; else D.algos.push(a); } bewaar(); renderAlgoLijst(); renderAlgo(); invalideer(); toast("Examples restored"); };
  $("#sim-algo").onchange = (e) => { D.ui.simAlgo = e.target.value; bewaar(); invalideer(); zorgSim(); simStats(true); teken(); };
  $("#b-play").onclick = () => { if (!zorgSim()) return; if (sim.finished) { sim = null; zorgSim(); } loopt = !loopt; naarEind = false; $("#b-play").textContent = loopt ? "❚❚ Pause" : "▶ Play"; };
  $("#b-reset").onclick = () => { stopSim(); sim = null; zorgSim(); simStats(true); teken(); };
  $("#b-eind").onclick = () => { if (!zorgSim()) return; if (sim.finished) { sim = null; zorgSim(); } loopt = true; naarEind = true; $("#b-play").textContent = "❚❚ Pause"; };
  $("#s-doel").onchange = $("#s-limiet").onchange = () => { if (sim) { sim.target = Number($("#s-doel").value); sim.limit = Number($("#s-limiet").value) * 3600; sim.finished = false; } };
  $("#v-hitte").onchange = $("#v-onbereik").onchange = () => { if (sim) bouwDekking(); simLegenda(); teken(); };
  $("#v-spoor").onchange = teken;
  $("#b-verg").onclick = async () => { await vergelijk(); $("#vergelijk").classList.toggle("zichtbaar", actieveTab === "verg" && !!vergChart); };
  window.addEventListener("resize", () => { maat(); teken(); if (vergChart) vergChart.resize(); });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { simChart && simChart.destroy(); simChart = null; simStats(true); teken(); });
  window.__terug = () => { if (concept) { concept = null; renderGereedschap(); teken(); return true; } if (actieveTab !== "tuin") { kiesTab("tuin"); return true; } return false; };
  if (window.Chart) Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  renderAlles();
  kiesTab(D.ui.tab === "verg" ? "verg" : D.ui.tab || "tuin");
  pasAan();
  requestAnimationFrame(lus);
}
document.addEventListener("DOMContentLoaded", start);

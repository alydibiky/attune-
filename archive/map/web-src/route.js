/* ---- v6.20 Directions inside Attune, offline (Ali: "what's the point of maps if it will redirect me to another map") ----
   The country's route file (tools/build_route_graph.py, "<code>-route.bin") is cut into squares of 0.1° plus a backbone of
   the main roads. A trip reads only what it needs, by byte range: the squares around the start and the end (and, for a
   short trip, every square between them), plus the backbone for a long one. Then A* finds the fastest car route (time =
   length ÷ the road's speed) or the shortest walk, and the steps are read off the road names and the turns.
   Pure code: tests/unit/v720route.test.mjs runs it on a real file of west Cairo.
   readRange(offset, bytes) → Promise<ArrayBuffer> is how the file is read (the phone: a slice of the downloaded file). */

const WALK_MS = 1.35;          // a person walks ≈ 4.9 km/h
const CAR_MAX_MS = 130 / 3.6;  // the fastest any road allows (A*'s estimate must never be too high)
const ALIGN4 = (n) => n + (-n % 4 + 4) % 4;

/** The file's directory: {cell, names:[o,n], backbone:[o,n], cells:{"lat_lon":[o,n]}} and where the blobs start. */
export async function openRoutes(readRange) {
  const head = new DataView(await readRange(0, 12));
  const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
  if (magic !== "ATRG" || head.getUint32(4, true) !== 2) throw new Error("Not an Attune route file");
  const dirBytes = head.getUint32(8, true);
  const dir = JSON.parse(new TextDecoder().decode(await readRange(12, dirBytes)));
  const base = 12 + dirBytes;
  const names = new TextDecoder().decode(await readRange(base + dir.names[0], dir.names[1])).replace(/\0+$/, "").split("\n");
  return { dir, base, names, readRange, cache: new Map() };
}

/** One blob → typed views (see graph_blob in the builder). */
export function parseBlob(buf) {
  const dv = new DataView(buf);
  const N = dv.getUint32(0, true), E = dv.getUint32(4, true), P = dv.getUint32(8, true);
  let o = 12;
  const take = (T, n) => { const a = new T(buf, o, n); o += n * T.BYTES_PER_ELEMENT; return a; };
  const gid = take(Uint32Array, N), lat = take(Int32Array, N), lon = take(Int32Array, N), first = take(Uint32Array, N + 1);
  const to = take(Uint32Array, E), len = take(Uint32Array, E), name = take(Uint32Array, E), geom = take(Uint32Array, E);
  const pts = take(Int32Array, 2 * P), gcount = take(Uint16Array, E); const flags = take(Uint8Array, E), speed = take(Uint8Array, E);
  return { N, E, gid, lat, lon, first, to, len, name, geom, pts, gcount, flags, speed };
}

async function blob(R, key, at) {
  if (R.cache.has(key)) return R.cache.get(key);
  const g = parseBlob(await R.readRange(R.base + at[0], at[1]));
  R.cache.set(key, g);
  if (R.cache.size > 40) R.cache.delete(R.cache.keys().next().value);   // keep the phone's memory in check
  return g;
}

const cellKey = (lat, lon, c) => `${Math.floor(lat / c)}_${Math.floor(lon / c)}`;
export function distM(aLat, aLon, bLat, bLon) {
  const t = Math.PI / 180, k = Math.cos(((aLat + bLat) / 2) * t);
  return Math.hypot((aLon - bLon) * k, aLat - bLat) * 111195;
}

/** The squares a trip needs: all of the box between start and end (± one square) when it is small, else the squares
 *  around each end — and then the backbone carries the long middle. */
export function cellsFor(R, a, b, maxCells = 36) {
  const c = R.dir.cell, have = R.dir.cells;
  const y0 = Math.floor(Math.min(a.lat, b.lat) / c) - 1, y1 = Math.floor(Math.max(a.lat, b.lat) / c) + 1;
  const x0 = Math.floor(Math.min(a.lon, b.lon) / c) - 1, x1 = Math.floor(Math.max(a.lon, b.lon) / c) + 1;
  const out = [];
  if ((y1 - y0 + 1) * (x1 - x0 + 1) <= maxCells) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (have[y + "_" + x]) out.push(y + "_" + x);
    return { cells: out, backbone: false };
  }
  for (const p of [a, b]) {
    const cy = Math.floor(p.lat / c), cx = Math.floor(p.lon / c);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) if (have[y + "_" + x]) out.push(y + "_" + x);
  }
  return { cells: [...new Set(out)], backbone: true };
}

/** Several blobs → one graph keyed by the country-wide node ids (a node shared by two squares is one node). */
export function joinGraphs(blobs) {
  const ix = new Map(); const lat = [], lon = [];
  for (const g of blobs) for (let i = 0; i < g.N; i++) if (!ix.has(g.gid[i])) { ix.set(g.gid[i], lat.length); lat.push(g.lat[i] / 1e6); lon.push(g.lon[i] / 1e6); }
  const adj = Array.from({ length: lat.length }, () => []);
  const seen = new Set();
  blobs.forEach((g, b) => {
    for (let u = 0; u < g.N; u++) for (let e = g.first[u]; e < g.first[u + 1]; e++) {
      const U = ix.get(g.gid[u]), V = ix.get(g.gid[g.to[e]]);
      const key = U * 4294967296 + V + "|" + g.name[e] + "|" + g.len[e];   // the same road piece from two squares: once
      if (seen.has(key)) continue; seen.add(key);
      adj[U].push({ v: V, b, e, u });
    }
  });
  return { ix, lat: Float64Array.from(lat), lon: Float64Array.from(lon), adj, blobs };
}

/** The closest node that the mode can leave from (a car start needs a car road). */
export function nearest(G, p, mode) {
  const need = mode === "walk" ? 2 : 1;
  let best = -1, bd = Infinity;
  for (let i = 0; i < G.lat.length; i++) {
    if (!G.adj[i].some((x) => G.blobs[x.b].flags[x.e] & need)) continue;
    const d = distM(p.lat, p.lon, G.lat[i], G.lon[i]);
    if (d < bd) { bd = d; best = i; }
  }
  return best < 0 ? null : { i: best, d: bd };
}

// a small binary heap of [cost, node]
function Heap() { const k = [], v = []; return {
  push(c, n) { k.push(c); v.push(n); let i = k.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } },
  pop() { const top = v[0], last = k.length - 1; k[0] = k[last]; v[0] = v[last]; k.pop(); v.pop(); let i = 0;
    for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < k.length && k[l] < k[m]) m = l; if (r < k.length && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; }
    return top; },
  get size() { return k.length; } }; }

/** A* from node s to node t. → [{v, b, e}] edges in order, or null. */
export function astar(G, s, t, mode) {
  const n = G.lat.length, need = mode === "walk" ? 2 : 1, speedMax = mode === "walk" ? WALK_MS : CAR_MAX_MS;
  const g = new Float64Array(n).fill(Infinity), via = new Array(n), done = new Uint8Array(n), H = Heap();
  const h = (i) => distM(G.lat[i], G.lon[i], G.lat[t], G.lon[t]) / speedMax;
  g[s] = 0; H.push(h(s), s);
  while (H.size) {
    const u = H.pop(); if (done[u]) continue; done[u] = 1;
    if (u === t) break;
    for (const x of G.adj[u]) {
      const B = G.blobs[x.b]; if (!(B.flags[x.e] & need)) continue;
      const m = B.len[x.e] / 10, cost = mode === "walk" ? m / WALK_MS : m / (B.speed[x.e] / 3.6);
      const ng = g[u] + cost;
      if (ng < g[x.v]) { g[x.v] = ng; via[x.v] = { u, x }; H.push(ng + h(x.v), x.v); }
    }
  }
  if (!done[t]) return null;
  const path = []; for (let v = t; v !== s; v = via[v].u) path.push(via[v].x);
  return { edges: path.reverse(), seconds: g[t] };
}

const bearing = (a, b) => { const t = Math.PI / 180, y = Math.sin((b[1] - a[1]) * t) * Math.cos(b[0] * t), x = Math.cos(a[0] * t) * Math.sin(b[0] * t) - Math.sin(a[0] * t) * Math.cos(b[0] * t) * Math.cos((b[1] - a[1]) * t); return (Math.atan2(y, x) * 180) / Math.PI; };
function turnOf(d) {   // d = change of heading, degrees (+ = right)
  const a = Math.abs(d);
  if (a < 25) return "straight";
  const side = d > 0 ? "right" : "left";
  return a < 60 ? "slight " + side : a < 150 ? side : "u-turn";
}

/** The path → {line: [[lon, lat], …], metres, seconds, steps: [{turn, name, metres}]}. */
export function describe(G, path, names, from, to) {
  const line = [[from.lon, from.lat]], steps = [];
  let metres = 0, cur = null, lastHead = null;
  for (const x of path.edges) {
    const B = G.blobs[x.b], e = x.e, u = x.u;
    const back = B.geom[e] >>> 31, g0 = B.geom[e] & 0x7fffffff, gc = B.gcount[e];
    const bends = []; for (let k = 0; k < gc; k++) bends.push([B.pts[2 * (g0 + k)] / 1e6, B.pts[2 * (g0 + k) + 1] / 1e6]);
    if (back) bends.reverse();
    const a = [B.lat[u] / 1e6, B.lon[u] / 1e6], z = [B.lat[B.to[e]] / 1e6, B.lon[B.to[e]] / 1e6];
    const seq = [a, ...bends, z];
    for (const p of seq.slice(1)) line.push([p[1], p[0]]);
    const m = B.len[e] / 10; metres += m;
    const nm = names[B.name[e]] || "";
    const headIn = bearing(seq[0], seq[1]);
    if (!cur || (nm !== cur.name)) {
      const turn = lastHead == null ? "start" : turnOf(((headIn - lastHead + 540) % 360) - 180);
      if (cur && !nm && !cur.name && turn === "straight") { cur.metres += m; }
      else { cur = { turn, name: nm, metres: m }; steps.push(cur); }
    } else cur.metres += m;
    lastHead = bearing(seq[seq.length - 2], seq[seq.length - 1]);
  }
  line.push([to.lon, to.lat]);
  return { line, metres: Math.round(metres), steps: tidySteps(steps).map((s) => ({ ...s, metres: Math.round(s.metres) })) };
}

/** A short unnamed link (a slip road, a U-turn opening) is not a step of its own: it joins the step before, and the same
 *  road on both sides of it is one step. */
export function tidySteps(steps) {
  const out = [];
  for (const s of steps) {
    const prev = out[out.length - 1];
    if (prev && !s.name && s.metres < 150 && s.turn !== "u-turn") { prev.metres += s.metres; continue; }
    if (prev && s.name && prev.name === s.name) { prev.metres += s.metres; continue; }
    out.push({ ...s });
  }
  return out;
}

/** from, to: {lat, lon}; mode "car" | "walk". → {line, metres, seconds, steps, mode} or {error}. */
export async function route(R, from, to, mode = "car") {
  let plan = cellsFor(R, from, to);
  for (let tries = 0; tries < 2; tries++) {
    const parts = [];
    for (const c of plan.cells) parts.push(await blob(R, "c" + c, R.dir.cells[c]));
    if (plan.backbone && mode === "car") parts.push(await blob(R, "backbone", R.dir.backbone));
    if (!parts.length) return { error: "no-roads" };
    const G = joinGraphs(parts);
    const s = nearest(G, from, mode), t = nearest(G, to, mode);
    if (!s || !t) return { error: "no-roads" };
    if (s.d > 3000 || t.d > 3000) return { error: "far-from-road" };
    const p = astar(G, s.i, t.i, mode);
    if (p) {
      const d = describe(G, p, R.names, from, to);
      // the walk to and from the road is added at a walking pace
      return { ...d, seconds: Math.round(p.seconds + (s.d + t.d) / WALK_MS), mode };
    }
    if (plan.backbone || mode === "walk") break;
    plan = { cells: plan.cells, backbone: true };   // no way inside the box: try the main roads too
  }
  return { error: "no-route" };
}

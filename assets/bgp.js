// The site background: a BGP mesh drawn as ASCII on a canvas, shared by every page.
// - Every router is an autonomous system and every link is a BGP session.
// - An origin AS sends UPDATE messages for a prefix. Each AS prepends its ASN and passes the route on
//   after a short MRAI delay. It keeps only the best path (shortest AS_PATH, then lowest neighbour ASN),
//   so the installed routes form a tree towards the origin. Longer copies flash on the other links and
//   are rejected.
// - Prefixes are later withdrawn, and the tree is torn down the same way.
// - Rare events: a session drops (hold timer expired), the ASes behind it hunt for a new path (amber),
//   then the session comes back through the FSM. Or an AS announces a more specific /25 of a live prefix:
//   its neighbours validate it with RPKI, find no matching ROA and drop it.
// - Keepalives tick quietly along every session.
// It draws no text: only the routers, their ASNs, and the dots and waves of the routing traffic.
// Elements passed in `masks` keep the mesh out from under them entirely (the gear sketch on phones).
import { startAscii } from "./grid.js?v=20261129";

const BG = "#0b0c0e";
const INK = (a) => `rgba(233,235,238,${a})`;
const REQ = (a) => `rgba(108,182,255,${a})`;
const USR = (a) => `rgba(255,159,67,${a})`;
const ADD = (a) => `rgba(94,227,138,${a})`;
const DEL = (a) => `rgba(255,107,107,${a})`;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

// cells of the straight line between two points (Bresenham)
function line(x0, y0, x1, y1) {
  const out = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// one router per jittered grid cell (skipping the text), each linked to its 3 nearest neighbours
function buildMesh(g, W = 16, H = 7) {
  const nodes = [], edges = [];
  for (let y = 2; y < g.rows - 2; y += H)
    for (let x = 2; x < g.cols - 2; x += W) {
      const nx = x + rnd(0, W - 3), ny = Math.min(g.rows - 2, y + rnd(0, H - 1));
      if (!g.masked(nx, ny)) nodes.push({ x: nx, y: ny });
    }
  const adj = nodes.map(() => []);
  const edgeOf = (u, v) => adj[u].find((e) => e.a === v || e.b === v);
  nodes.forEach((n, i) => {
    nodes.map((m, j) => [j, Math.hypot(m.x - n.x, (m.y - n.y) * 2.2)]).filter(([j]) => j !== i)
      .sort((p, q) => p[1] - q[1]).slice(0, 3).forEach(([j]) => {
        if (edgeOf(i, j)) return;
        const e = { id: edges.length, a: i, b: j, cells: line(n.x, n.y, nodes[j].x, nodes[j].y) };
        edges.push(e); adj[i].push(e); adj[j].push(e);
      });
  });
  return { nodes, edges, adj, edgeOf };
}

const HOP = 4; // ticks per AS hop, roughly the MRAI timer
const COLORS = [REQ, ADD, (a) => `rgba(186,148,255,${a})`];

let mesh, asn, jitter, prefixes, sessions, keepalives, nextColor, buf, fade, fadeTo, grid;

// best path from every AS to the origin over the sessions that are up
function bestPaths(origin) {
  const N = mesh.nodes.length, hop = Array(N).fill(Infinity), parent = Array(N).fill(-1);
  hop[origin] = 0;
  let frontier = [origin];
  while (frontier.length) {
    const next = [];
    for (const u of frontier)
      for (const e of mesh.adj[u]) {
        if (sessions[e.id].state !== "up") continue;
        const v = e.a === u ? e.b : e.a;
        if (hop[v] === Infinity) { hop[v] = hop[u] + 1; parent[v] = u; next.push(v); }
        else if (hop[v] === hop[u] + 1 && asn[u] < asn[parent[v]]) parent[v] = u;
      }
    frontier = next;
  }
  return { hop, parent };
}

function announce(g) {
  const used = new Set(prefixes.map((p) => p.origin));
  const free = mesh.nodes.map((_, i) => i).filter((i) => !used.has(i));
  if (!free.length) return;
  const origin = pick(free);
  const len = pick([20, 22, 23, 24]);
  const pfx = `${rnd(100, 223)}.${rnd(0, 255)}.${len > 22 ? rnd(0, 255) : 0}.0/${len}`;
  const p = { pfx, origin, color: COLORS[nextColor++ % COLORS.length], born: g.t, ...bestPaths(origin), withdrawn: -1 };
  p.reach = p.hop.map((h, i) => (h === Infinity ? Infinity : g.t + h * HOP + (h ? jitter[i] : 0)));
  prefixes.push(p);
}

function withdraw(g, p) {
  p.withdrawn = g.t;
  p.gone = p.hop.map((h, i) => (h === Infinity ? -Infinity : g.t + h * HOP + (h ? jitter[i] : 0)));
}

// a session drops; every prefix whose tree used it reconverges
function sessionDown(g) {
  if (!mesh.edges.length) return;
  const live = prefixes.filter((p) => p.withdrawn < 0);
  const used = mesh.edges.filter((e) => live.some((p) => p.parent[e.a] === e.b || p.parent[e.b] === e.a));
  const e = used.length ? pick(used) : pick(mesh.edges);
  Object.assign(sessions[e.id], { state: "down", since: g.t });
  reconverge(g);
}

function reconverge(g) {
  for (const p of prefixes) {
    if (p.withdrawn >= 0) continue;
    const next = bestPaths(p.origin);
    const changed = next.parent.map((v, i) => v !== p.parent[i] || next.hop[i] !== p.hop[i]);
    const base = Math.min(...next.hop.filter((h, i) => changed[i] && h !== Infinity));
    p.hunt = p.hunt || [];
    next.hop.forEach((h, i) => {
      if (!changed[i]) return;
      // path hunting: the AS tries longer paths before it settles
      p.hunt[i] = g.t;
      p.reach[i] = h === Infinity ? Infinity : g.t + 6 + (h - base) * HOP + jitter[i] + rnd(0, 6);
    });
    p.parent = next.parent; p.hop = next.hop;
  }
}

// a more specific route from the wrong origin: RPKI says invalid, neighbours drop it
function hijack(g) {
  const live = prefixes.filter((p) => p.withdrawn < 0);
  if (!live.length) return sessionDown(g);
  const victim = pick(live);
  const others = mesh.nodes.map((_, i) => i).filter((i) => i !== victim.origin);
  if (!others.length) return;
  const from = pick(others);
  victim.hijack = { from, t: g.t };
}

// How bright the mesh is in each cell: full in the open, and darker the closer it gets to the centre of a
// block of text, so the lines fade into the back of the text. Each block gets an oval a bit larger than it.
// On the work page each card is its own block, so the mesh also fades into the back of every scene
const TEXT = ".content:not(.gallery), .gallery h2, .gallery .card, .pages, .webring, [data-fade]";
function fadeMap(g) {
  const rects = [...document.querySelectorAll(TEXT)].map((el) => el.getBoundingClientRect()).filter((r) => r.width && r.height);
  const out = new Float32Array(g.cols * g.rows);
  const smooth = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < g.rows; y++)
    for (let x = 0; x < g.cols; x++) {
      const px = (x + 0.5) * g.cw, py = (y + 0.5) * g.ch;
      let f = 1;
      for (const r of rects) {
        // 0 at the centre of the block, 1 on an oval just outside it
        const e = Math.hypot((px - (r.left + r.right) / 2) / (r.width / 2 + 56), (py - (r.top + r.bottom) / 2) / (r.height / 2 + 40));
        if (e < 1) f = Math.min(f, 0.03 + 0.97 * smooth(e) ** 1.5);
      }
      out[y * g.cols + x] = f;
    }
  return out;
}
// when the text changes (a new page), the fade eases to its new shape instead of jumping
function easeFade() {
  for (let i = 0; i < fade.length; i++) fade[i] += (fadeTo[i] - fade[i]) * 0.3;
}
const dim = (color, f) => (f >= 1 ? color : color.replace(/,([\d.]+)\)$/, (_, a) => `,${(+a * f).toFixed(3)})`));

// Resolves to { setMasks, refit }. The site swaps pages without reloading, so the mesh keeps running:
// `refit` re-reads where the text is, `setMasks` changes the masked areas. Neither rebuilds the mesh.
export async function startBgp({ canvas, masks = [] }) {
  const refit = () => grid && (fadeTo = fadeMap(grid));
  // the gallery scrolls inside the page, and its cards move with it; scroll events do not bubble, so listen in the capture phase
  let queued = false;
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; refit(); }); } }, { capture: true, passive: true });
  const grid_ = await startAscii(canvas, {
    fontFamily: '"Spline Sans Mono", monospace',
    fontSize: innerWidth < 760 ? 11 : 12,
    lineHeight: 1.45,
    fps: 12,
    bg: BG,
    masks: masks.filter(Boolean),
    init(g) {
      grid = g;
      fade = fadeMap(g); fadeTo = fade.slice();
      mesh = buildMesh(g);
      asn = mesh.nodes.map((_, i) => 64512 + i * 3 + rnd(0, 3));
      asn[rnd(0, asn.length)] = 13335;
      jitter = mesh.nodes.map(() => rnd(0, 4));
      sessions = mesh.edges.map(() => ({ state: "up" }));
      prefixes = []; keepalives = []; nextColor = 0;
      buf = new Map();
    },
    tick(g) {
      g.t++;
      // text blocks change size (the webring loads, gear tabs switch), so refresh the fade now and then
      if (g.t % 12 === 0) fadeTo = fadeMap(g);
      easeFade();
      // a new prefix every ~4 s; with three live, the oldest is withdrawn instead
      if (g.t % 50 === 4) {
        const live = prefixes.filter((p) => p.withdrawn < 0);
        if (live.length >= 3) withdraw(g, live[0]);
        else announce(g);
      }
      // a rare event every ~25 s, the first after ~12 s
      const every = 300;
      if (g.t % every === every / 2) (g.t / every) % 2 < 1 ? sessionDown(g) : hijack(g);

      prefixes = prefixes.filter((p) => p.withdrawn < 0 || g.t - p.withdrawn < 40 + 12 * HOP);

      // a dropped session comes back after ~11 s (Idle → … → Established) and the routes reconverge
      sessions.forEach((s) => {
        if (s.state === "down" && g.t - s.since > 130) { s.state = "up"; reconverge(g); }
      });

      // keepalives: a small dot crosses a random session now and then
      if (mesh.edges.length && Math.random() < 0.25) {
        const e = pick(mesh.edges);
        if (sessions[e.id].state === "up") keepalives.push({ e, t: g.t, back: Math.random() < 0.5 });
      }
      keepalives = keepalives.filter((k) => g.t - k.t < k.e.cells.length);
    },
    draw(g) {
      const { nodes, edges } = mesh;
      buf.clear();
      // later writes win when their priority is at least as high
      const put = (x, y, c, color, pri = 0) => {
        const k = y * 4096 + x, prev = buf.get(k);
        if (!prev || pri >= prev.pri) buf.set(k, { x, y, c, color, pri });
      };

      for (const e of edges) {
        const down = sessions[e.id].state !== "up";
        e.cells.forEach(([x, y], i) => {
          if (i && i < e.cells.length - 1 && i % 2 === 0) put(x, y, down ? "╌" : "·", down ? DEL(0.22) : INK(0.06));
        });
      }
      for (const k of keepalives) {
        const L = k.e.cells.length - 1, i = g.t - k.t, [x, y] = k.e.cells[k.back ? L - i : i];
        if (i && i < L) put(x, y, "·", INK(0.16), 1);
      }

      for (const p of prefixes) {
        const now = g.t;
        nodes.forEach((_, v) => {
          const u = p.parent[v];
          if (u < 0) return;
          const e = mesh.edgeOf(v, u), cells = e.a === u ? e.cells : [...e.cells].reverse(), L = cells.length - 1;
          const t0 = p.reach[u], t1 = p.reach[v];
          if (t1 === Infinity || now < t0) return;
          const front = now >= t1 ? L : Math.floor(((now - t0) / Math.max(1, t1 - t0)) * L);
          // the installed route, torn down from the origin outwards after a withdrawal
          let gone = -1;
          if (p.withdrawn >= 0 && now >= p.gone[u]) gone = now >= p.gone[v] ? L : Math.floor(((now - p.gone[u]) / Math.max(1, p.gone[v] - p.gone[u])) * L);
          for (let i = 1; i < L; i++) {
            const [x, y] = cells[i];
            if (i <= gone) { if (now - p.gone[u] < 14) put(x, y, "·", DEL(0.3 * (1 - (now - p.gone[u]) / 14)), 2); continue; }
            if (i > front) continue;
            const fresh = i > front - 3 && now < t1 + 1;
            put(x, y, fresh ? "•" : "·", p.color(fresh ? 0.8 : 0.26), fresh ? 4 : 2);
          }
        });
        // the same UPDATE reaches the other links too, but the path is longer, so it is rejected
        for (const e of edges) {
          if (p.parent[e.a] === e.b || p.parent[e.b] === e.a || sessions[e.id].state !== "up") continue;
          const t = Math.max(p.reach[e.a], p.reach[e.b]) - p.born, age = now - p.born - t;
          if (!isFinite(t) || age < 0 || age > 8 || p.withdrawn >= 0) continue;
          e.cells.forEach(([x, y], i) => { if (i % 2 === 1) put(x, y, "·", p.color(0.12 * (1 - age / 8)), 1); });
        }
        nodes.forEach((n, i) => {
          const hunting = p.hunt && p.hunt[i] >= 0 && now < p.reach[i] && now - p.hunt[i] < 60;
          if (hunting) return put(n.x, n.y, "◈", USR(0.7), 6);
          const age = now - p.reach[i];
          if (p.withdrawn >= 0) {
            const ga = now - p.gone[i];
            if (ga >= 0 && ga < 14) put(n.x, n.y, "◇", DEL(0.7 * (1 - ga / 14) + 0.1), 5);
          } else if (age >= 0 && age < 18) put(n.x, n.y, "◆", p.color(0.75 * (1 - age / 18) + 0.15), 5);
          if (i === p.origin && p.withdrawn < 0) put(n.x, n.y, "◆", p.color(0.55), 3);
        });
        if (p.hijack && now - p.hijack.t < 70) {
          const h = p.hijack, n = nodes[h.from];
          put(n.x, n.y, "◆", DEL(0.8), 7);
          for (const e of mesh.adj[h.from]) {
            const v = e.a === h.from ? e.b : e.a, m = nodes[v];
            if (now - h.t > 6) put(m.x, m.y, "✕", DEL(0.75), 7);
            const cells = e.a === h.from ? e.cells : [...e.cells].reverse(), i = Math.min(cells.length - 1, now - h.t);
            for (let k = 1; k < i; k++) put(cells[k][0], cells[k][1], "·", DEL(0.3), 3);
          }
        }
      }

      for (const n of nodes) put(n.x, n.y, "◇", INK(0.18), -1);
      // faint ASN under every router
      nodes.forEach((n, i) => [...String(asn[i])].forEach((c, k) => put(n.x - 2 + k, n.y + 1, c, INK(asn[i] === 13335 ? 0.16 : 0.08), 3)));

      for (const v of buf.values()) g.put(v.x, v.y, v.c, dim(v.color, fade[v.y * g.cols + v.x] ?? 1));
    },
  });
  return {
    setMasks: (els) => grid_?.setMasks(els.filter(Boolean)),
    refit,
  };
}

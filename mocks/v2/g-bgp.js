// G · BGP: every router is an autonomous system and every link is a BGP session.
// - An origin AS sends UPDATE messages for a prefix. Each AS prepends its ASN and passes the route on
//   after a short MRAI delay. It keeps only the best path (shortest AS_PATH, then lowest neighbour ASN),
//   so the installed routes form a tree towards the origin. Longer copies flash on the other links and
//   are rejected.
// - Prefixes are later withdrawn, and the tree is torn down the same way.
// - Rare events: a session drops (hold timer expired), the ASes behind it hunt for a new path (amber),
//   then the session comes back through the FSM. Or an AS announces a more specific /25 of a live prefix:
//   its neighbours validate it with RPKI, find no matching ROA and drop it.
// - Keepalives tick quietly along every session.
import { run, INK, REQ, ADD, DEL, USR, rnd, pick } from "./page.js";
import { buildMesh } from "./mesh.js";

const HOP = 4; // ticks per AS hop, roughly the MRAI timer
const COLORS = [REQ, ADD, (a) => `rgba(186,148,255,${a})`];
const FAST = new URLSearchParams(location.search).has("fast"); // rare events every ~8 s, for testing
const FSM = ["Idle", "Connect", "OpenSent", "OpenConfirm", "Established"];

let mesh, asn, jitter, prefixes, notes, sessions, keepalives, nextColor, buf;

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

const asPath = (p, i) => {
  const out = [];
  for (let u = i; u >= 0; u = p.parent[u]) out.push(asn[u]);
  if (out.length > 6) out.splice(3, out.length - 5, "…");
  return out;
};

function note(x, y, str, color, life = 48) {
  if (notes.length >= 4) notes.shift();
  notes.push({ x, y, str, color, t: 0, life });
}

function announce(g) {
  const used = new Set(prefixes.map((p) => p.origin));
  const origin = pick(mesh.nodes.map((_, i) => i).filter((i) => !used.has(i)));
  const len = pick([20, 22, 23, 24]);
  const pfx = `${rnd(100, 223)}.${rnd(0, 255)}.${len > 22 ? rnd(0, 255) : 0}.0/${len}`;
  const p = { pfx, origin, color: COLORS[nextColor++ % COLORS.length], born: g.t, ...bestPaths(origin), withdrawn: -1 };
  p.reach = p.hop.map((h, i) => (h === Infinity ? Infinity : g.t + h * HOP + (h ? jitter[i] : 0)));
  prefixes.push(p);
  const o = mesh.nodes[origin];
  note(o.x, o.y, `AS${asn[origin]} UPDATE ${pfx} NEXT_HOP self`, p.color);
  // later, show the full AS_PATH at the farthest AS that hears it
  const far = p.hop.reduce((b, h, i) => (h !== Infinity && h > p.hop[b] ? i : b), origin);
  p.farNote = { i: far, at: p.reach[far] + 2 };
}

function withdraw(g, p) {
  p.withdrawn = g.t;
  p.gone = p.hop.map((h, i) => (h === Infinity ? -Infinity : g.t + h * HOP + (h ? jitter[i] : 0)));
  const o = mesh.nodes[p.origin];
  note(o.x, o.y, `AS${asn[p.origin]} WITHDRAW ${p.pfx}`, DEL);
}

// a session drops; every prefix whose tree used it reconverges
function sessionDown(g) {
  const live = prefixes.filter((p) => p.withdrawn < 0);
  const used = mesh.edges.filter((e) => live.some((p) => p.parent[e.a] === e.b || p.parent[e.b] === e.a));
  const e = used.length ? pick(used) : pick(mesh.edges);
  Object.assign(sessions[e.id], { state: "down", since: g.t });
  const mid = e.cells[e.cells.length >> 1];
  note(mid[0], mid[1], `AS${asn[e.a]}–AS${asn[e.b]} hold timer expired`, DEL, 60);
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
  const from = pick(mesh.nodes.map((_, i) => i).filter((i) => i !== victim.origin));
  const [net] = victim.pfx.split("/");
  const o = mesh.nodes[from];
  note(o.x, o.y, `AS${asn[from]} UPDATE ${net}/25 · RPKI invalid · dropped`, DEL, 70);
  victim.hijack = { from, t: g.t };
}

run("G · BGP", {
  init(g) {
    mesh = buildMesh(g);
    asn = mesh.nodes.map((_, i) => 64512 + i * 3 + rnd(0, 3));
    asn[rnd(0, asn.length)] = 13335;
    jitter = mesh.nodes.map(() => rnd(0, 4));
    sessions = mesh.edges.map(() => ({ state: "up" }));
    prefixes = []; notes = []; keepalives = []; nextColor = 0;
    buf = new Map();
  },
  tick(g) {
    // a new prefix every ~4 s; with three live, the oldest is withdrawn instead
    if (g.t % 50 === 4) {
      const live = prefixes.filter((p) => p.withdrawn < 0);
      if (live.length >= 3) withdraw(g, live[0]);
      else announce(g);
    }
    // a rare event every ~25 s, the first after ~12 s
    const every = FAST ? 100 : 300;
    if (g.t % every === every / 2) (g.t / every) % 2 < 1 ? sessionDown(g) : hijack(g);

    for (const p of prefixes) if (p.farNote && g.t === p.farNote.at && p.withdrawn < 0) {
      const n = mesh.nodes[p.farNote.i], path = asPath(p, p.farNote.i);
      note(n.x, n.y, `AS${path[0]} best ${p.pfx} AS_PATH ${path.slice(1).join(" ")}`, p.color, 56);
    }
    prefixes = prefixes.filter((p) => p.withdrawn < 0 || g.t - p.withdrawn < 40 + 12 * HOP);

    // sessions come back: Idle → Connect → OpenSent → OpenConfirm → Established
    sessions.forEach((s, id) => {
      if (s.state !== "down") return;
      const k = Math.floor((g.t - s.since - 70) / 12);
      if (k < 0) return;
      const e = mesh.edges[id], mid = e.cells[e.cells.length >> 1];
      if (k < FSM.length && (g.t - s.since - 70) % 12 === 0) note(mid[0], mid[1], FSM[k], k === FSM.length - 1 ? ADD : USR, 14);
      if (k >= FSM.length) { s.state = "up"; reconverge(g); }
    });

    // keepalives: a small dot crosses a random session now and then
    if (Math.random() < 0.25) {
      const e = pick(mesh.edges);
      if (sessions[e.id].state === "up") keepalives.push({ e, t: g.t, back: Math.random() < 0.5 });
    }
    keepalives = keepalives.filter((k) => g.t - k.t < k.e.cells.length);
    notes.forEach((n) => n.t++);
    notes = notes.filter((n) => n.t < n.life);
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

    for (const n of notes) {
      const a = Math.min(1, (n.life - n.t) / 16) * 0.6;
      const cols = Math.min(g.cols, Math.floor(innerWidth / g.cw)) - 2;
      const x = n.x + 2 + n.str.length < cols ? n.x + 2 : Math.max(1, n.x - 2 - n.str.length);
      [...n.str].forEach((c, k) => put(x + k, n.y, c, n.color(a), 9));
    }
    for (const v of buf.values()) g.put(v.x, v.y, v.c, v.color);
  },
});

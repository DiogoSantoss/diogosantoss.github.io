// Consistent hash ring backed by an AVL tree, drawn as ASCII on a background canvas.
// Shared by every page: the ring lays itself out around the page's `.content` element,
// and internal links (a[data-route]) travel through the ring before navigating.
import { startAscii } from "./grid.js";

const SPACE = 4096, VN = 1, TAU = Math.PI * 2, LIFE = 26, MIN_GAP = Math.floor(SPACE / 22), MIN_S = 3, MAX_S = 10;
const BG = "#0b0c0e";
const INK = (a) => `rgba(233,235,238,${a})`;
const REQ = (a) => `rgba(108,182,255,${a})`;
const USR = (a) => `rgba(255,159,67,${a})`;
// background traffic: each star is a real request and lands where its path hashes
const POPULAR = [
  "/", "/work", "/blog", "/cv.pdf", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/feed.xml",
  "/static/app.js", "/static/app.css", "/fonts/mono.woff2", "/img/avatar.webp",
  ...Array.from({ length: 6 }, (_, i) => `/blog/post-${i + 1}`),
  ...Array.from({ length: 6 }, (_, i) => `/img/${i + 1}.webp`),
];
const nextPath = () => (Math.random() < 0.1 ? `/blog/post-${rnd(7, 400)}` : POPULAR[rnd(0, POPULAR.length)]);
const ADD = (a) => `rgba(94,227,138,${a})`;
const DEL = (a) => `rgba(255,107,107,${a})`;
const NAMES = "abcdefghijklmnopqrstuvwxyz";

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
const hex = (k) => k.toString(16).padStart(3, "0");
const gap = (a, b) => { const d = Math.abs(a - b) % SPACE; return Math.min(d, SPACE - d); };
const hashPath = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) % SPACE; };
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// `lost` (404 page): sends a request for the missing path into the ring on load, to show which server would own it.
export function startRing({ canvas, content, footer, status, lost }) {
  let lostSent = false;
  const lostRoute = lost ? (lost.path.length > 28 ? lost.path.slice(0, 27) + "…" : lost.path) : null;
  if (lost && lost.el) lost.el.textContent = lostRoute;
  // event log, drawn inside the ring under the tree; newest line at the bottom, older lines fade upward
  let logLines = [];
  const stamp = () => { const s = Math.floor((G ? G.t : 0) / 14); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  function logEv(text, cls = "") {
    logLines.push({ ts: stamp(), text, cls });
    if (logLines.length > 20) logLines.shift();
  }
  let lastAuto = "remove";
  let root, nid, servers, nameIdx, steps, cur, waitUntil, focus, msg, keys, lookups, ghosts, sparks, life, nextChange, mode, note, hover, userUntil, entering;
  let X0, RW, cx, cy, R, ASP, treeY, gapY, slot, ringN, compact, backdrop, tm, G;

  const label = (n) => `${n.srv}:${hex(n.k)}`;
  const h = (n) => (n ? n.h : 0);
  const upd = (n) => (n.h = 1 + Math.max(h(n.l), h(n.r)));
  const bal = (n) => h(n.l) - h(n.r);
  const depthOf = (n) => (n ? 1 + Math.max(depthOf(n.l), depthOf(n.r)) : 0);
  const liveBal = (n) => depthOf(n.l) - depthOf(n.r);
  const inorder = (n, out = []) => { if (n) { inorder(n.l, out); out.push(n); inorder(n.r, out); } return out; };
  const OP = (a) => (mode === "del" ? DEL(a) : ADD(a));

  // ASP converts a horizontal radius (columns) into rows so the ring is a true circle
  const angleOf = (k) => (k / SPACE) * TAU - Math.PI / 2;
  const keyOf = (a) => Math.round(((((a + Math.PI / 2) % TAU) + TAU) % TAU) / TAU * SPACE) % SPACE;
  const polar = (a, r) => [cx + r * Math.cos(a), cy + (r / ASP) * Math.sin(a)];
  const ringPt = (k) => polar(angleOf(k), R);

  function relayout() {
    const list = inorder(root);
    const set = (n, d) => { if (!n) return; n.d = d; set(n.l, d + 1); set(n.r, d + 1); };
    set(root, 0);
    const fit = Math.floor((1.9 * R) / Math.max(1, list.length));
    slot = Math.max(2, Math.min(8, fit));
    tm = slot >= 8 && !compact ? "full" : slot >= 5 && !compact ? "short" : "dots";
    const start = Math.round(cx - (list.length * slot) / 2);
    list.forEach((n, i) => {
      n.tx = start + i * slot;
      n.ty = treeY + n.d * gapY;
      if (n.x === undefined) { n.x = n.tx; n.y = n.ty - 2; }
    });
  }

  function rotL(x) {
    const y = x.r;
    x.r = y.l; if (y.l) y.l.p = x;
    y.p = x.p;
    if (!x.p) root = y; else if (x === x.p.l) x.p.l = y; else x.p.r = y;
    y.l = x; x.p = y; upd(x); upd(y);
    return y;
  }
  function rotR(x) {
    const y = x.l;
    x.l = y.r; if (y.r) y.r.p = x;
    y.p = x.p;
    if (!x.p) root = y; else if (x === x.p.r) x.p.r = y; else x.p.l = y;
    y.r = x; x.p = y; upd(x); upd(y);
    return y;
  }

  function* fixup(n) {
    while (n) {
      upd(n);
      const b = bal(n);
      if (b > 1 || b < -1) {
        yield { focus: [n], msg: `imbalance at ${label(n)} · bf ${b > 0 ? "+" : ""}${b}`, slow: true };
        let top;
        if (b > 1) {
          if (bal(n.l) < 0) { const c = n.l; rotL(c); relayout(); yield { focus: [c, c.p], msg: `rotate left at ${label(c)} (left-right case)`, slow: true }; }
          top = rotR(n); relayout();
          yield { focus: [n, top], msg: `rotate right at ${label(n)}`, slow: true };
        } else {
          if (bal(n.r) > 0) { const c = n.r; rotR(c); relayout(); yield { focus: [c, c.p], msg: `rotate right at ${label(c)} (right-left case)`, slow: true }; }
          top = rotL(n); relayout();
          yield { focus: [n, top], msg: `rotate left at ${label(n)}`, slow: true };
        }
        n = top;
      }
      n = n.p;
    }
  }

  function* insertOp(k, srv) {
    let p = null, c = root;
    while (c) { yield { focus: [c], msg: `insert ${srv}:${hex(k)} · ${hex(k)} ${k < c.k ? "<" : ">"} ${hex(c.k)}` }; p = c; c = k < c.k ? c.l : c.r; }
    const n = { id: nid++, k, srv, l: null, r: null, p, h: 1, flash: 0 };
    if (!p) root = n; else if (k < p.k) p.l = n; else p.r = n;
    relayout();
    yield { focus: [n], msg: `insert ${label(n)} as leaf · ring now routes to it` };
    yield* fixup(p);
  }

  function* deleteOp(k) {
    let c = root;
    while (c && c.k !== k) { yield { focus: [c], msg: `delete ${hex(k)} · ${hex(k)} ${k < c.k ? "<" : ">"} ${hex(c.k)}` }; c = k < c.k ? c.l : c.r; }
    if (!c) return;
    yield { focus: [c], msg: `delete ${label(c)}`, slow: true };
    let target = c;
    ghosts.push({ x: c.x, y: c.y, text: label(c), t: 0 });
    if (c.l && c.r) {
      let s = c.r;
      while (s.l) { yield { focus: [c, s], msg: `find successor of ${label(c)}` }; s = s.l; }
      yield { focus: [c, s], msg: `successor ${label(s)} takes the place of ${label(c)}`, slow: true };
      c.k = s.k; c.srv = s.srv; c.dying = s.dying;
      target = s;
    }
    const child = target.l || target.r, p = target.p;
    if (child) child.p = p;
    if (!p) root = child; else if (p.l === target) p.l = child; else p.r = child;
    relayout();
    yield { focus: child ? [child] : [], msg: `unlink · retrace to root` };
    yield* fixup(p);
  }

  function ceil(k) {
    let c = root, best = null;
    const path = [];
    while (c) { path.push(c); if (k <= c.k) { best = c; c = c.l; } else c = c.r; }
    if (!best) { best = root; while (best && best.l) best = best.l; }
    return { node: best, path };
  }
  function liveOwner(k) {
    let o = ceil(k).node;
    for (let i = 0; o && o.dying && i < 64; i++) o = ceil((o.k + 1) % SPACE).node;
    return o;
  }

  const taken = () => [...inorder(root).map((x) => x.k), ...life.filter((l) => l.kind === "boot").map((l) => l.k)];
  const fits = (k, used = taken()) => used.every((u) => gap(u, k) >= MIN_GAP);
  function freshPositions(n, seed = []) {
    const used = taken();
    const out = [...seed];
    out.forEach((k) => used.push(k));
    for (let tries = 0; out.length < n && tries < 500; tries++) {
      const k = rnd(0, SPACE);
      if (fits(k, used)) { used.push(k); out.push(k); }
    }
    return out;
  }

  function addServer(seed = []) {
    const name = NAMES[nameIdx++ % 26];
    const vs = freshPositions(VN, seed);
    servers.push({ name, vs });
    steps.push({ mode: "add", anim: () => vs.forEach((k) => life.push({ kind: "boot", k, srv: name, t: 0 })), wait: LIFE, msg: `server ${name} booting` });
    vs.forEach((k) => steps.push({ mode: "add", gen: () => insertOp(k, name), label: `+${name}` }));
  }

  function removeServer(name) {
    const i = name ? servers.findIndex((s) => s.name === name) : rnd(0, servers.length);
    const s = servers.splice(i, 1)[0];
    steps.push({
      mode: "del",
      anim: () => {
        inorder(root).forEach((n) => { if (n.srv === s.name) n.dying = true; });
        s.vs.forEach((k) => {
          life.push({ kind: "die", k, srv: s.name, t: 0 });
          const [x, y] = ringPt(k);
          for (let j = 0; j < 7; j++) {
            const a = Math.random() * TAU, v = 0.4 + Math.random() * 0.7;
            sparks.push({ x, y, vx: Math.cos(a) * v, vy: (Math.sin(a) * v) / ASP, t: 0 });
          }
        });
      },
      wait: LIFE, msg: `server ${s.name} died · requests skip it`,
    });
    s.vs.forEach((k) => steps.push({ mode: "del", gen: () => deleteOp(k), label: `-${s.name}` }));
  }

  const busy = () => cur || steps.length || G.t < waitUntil;
  const warn = (text) => { note = { text, t: G.t }; logEv(text, "d"); };


  function sendFrom(px, py, extra = {}) {
    const gx = px / G.cw, gy = py / G.ch;
    const a = extra.k !== undefined ? angleOf(extra.k) : Math.atan2((gy - cy) * ASP, gx - cx);
    const k = extra.k !== undefined ? extra.k : keyOf(a);
    // start where the click happened, then travel along the ray from the ring centre at angle(k)
    const r = Math.max(R * 1.05, Math.hypot(gx - cx, (gy - cy) * ASP));
    if (extra.nav) {
      const [tx, ty] = ringPt(k);
      keys.push({ k, a: k, hist: [], state: "fly", user: true, x: gx, y: gy, fx: gx, fy: gy, tx, ty, p: 0, ...extra });
      return;
    }
    keys.push({ k, a: k, r, v: 0.7, hist: [], state: "in", user: true, x: gx, y: gy, ...extra });
  }

  function hitTest(px, py) {
    if (!G || backdrop) return null;
    const gx = px / G.cw, gy = py / G.ch;
    let best = null;
    inorder(root).forEach((n) => {
      if (n.dying) return;
      const [x, y] = ringPt(n.k);
      const d = Math.hypot(gx - x, (gy - y) * ASP);
      if (d < 4 && (!best || d < best.d)) best = { kind: "server", node: n, d };
    });
    if (best) return best;
    const r = Math.hypot(gx - cx, (gy - cy) * ASP);
    if (Math.abs(r - R) < 4) return { kind: "ring", k: keyOf(Math.atan2((gy - cy) * ASP, gx - cx)) };
    return null;
  }

  // internal links: send a request for the route through the ring, enter the owning server, then navigate
  document.querySelectorAll("a[data-route]").forEach((a) => {
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const href = a.getAttribute("href");
      if (reduceMotion || !G || !root) { location.href = href; return; }
      if (keys.some((k) => k.nav && !k.nav.lost)) return;
      const route = a.dataset.route;
      const rect = a.getBoundingClientRect();
      sendFrom(rect.left + rect.width / 2, rect.top + rect.height / 2, { k: hashPath(route), nav: { href, route } });
      note = { text: `GET ${route} · hash ${hex(hashPath(route))}`, t: G.t, ok: true, u: true, hold: true };
      logEv(`you: GET ${route} · hash ${hex(hashPath(route))}`, "u");
      setTimeout(() => { location.href = href; }, 6000); // safety net
    });
  });

  window.addEventListener("pageshow", (e) => { if (e.persisted) { document.body.classList.remove("leaving"); entering = null; keys = keys.filter((k) => !k.nav); note = null; } });

  window.addEventListener("mousemove", (e) => {
    if (!G || e.target.closest(".content, a, footer")) { hover = null; document.body.style.cursor = ""; return; }
    hover = hitTest(e.clientX, e.clientY);
    document.body.style.cursor = backdrop ? "" : hover ? "pointer" : "crosshair";
  });
  window.addEventListener("click", (e) => {
    if (!G || backdrop || e.target.closest(".content, a, footer")) return;
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) { sendFrom(e.clientX, e.clientY); return; }
    if (busy()) { warn("busy · wait for the tree to settle"); return; }
    if (hit.kind === "server") {
      if (servers.length <= MIN_S) { warn(`keeping at least ${MIN_S} servers`); return; }
      logEv(`you killed ${hit.node.srv}`, "d");
      removeServer(hit.node.srv);
    } else {
      if (servers.length >= MAX_S) { warn(`at most ${MAX_S} servers`); return; }
      if (!fits(hit.k)) { warn("too close to another server"); return; }
      logEv(`you added a server at ${hex(hit.k)}`, "a");
      addServer([hit.k]);
    }
    userUntil = G.t + 280;
    nextChange = Math.max(nextChange, userUntil);
  });

  function layout(g) {
    ASP = g.ch / g.cw;
    const rect = content.getBoundingClientRect();
    const portrait = window.innerWidth < 760;
    compact = portrait;
    backdrop = false;
    if (!portrait) {
      X0 = Math.ceil(rect.right / g.cw) + 4;
      RW = g.cols - X0 - 3;
      R = Math.min(RW * 0.37, g.rows * 0.32 * ASP);
      cx = X0 + RW / 2;
      cy = Math.round(g.rows * 0.47);
      if (RW < 50) backdrop = true;
    } else {
      const top = Math.ceil(rect.bottom / g.ch) + 2;
      const bottom = g.rows - (footer && getComputedStyle(footer).display !== "none" ? 4 : 2);
      const avail = bottom - top;
      if (avail >= 16 && rect.bottom < window.innerHeight) {
        R = Math.min(g.cols * 0.36, (avail / 2 - 2) * ASP);
        cx = g.cols / 2;
        cy = Math.round(top + avail / 2);
      } else backdrop = true;
    }
    if (backdrop) {
      R = Math.min(g.cols * 0.42, g.rows * 0.4 * ASP);
      cx = g.cols / 2; cy = Math.round(g.rows / 2);
    }
    canvas.style.opacity = backdrop ? "0.32" : "1";
    gapY = compact ? 2 : 3;
    treeY = Math.round(cy - 2.5 * gapY);
    ringN = Math.ceil(TAU * R * 1.6);
  }

  startAscii(canvas, {
    fontFamily: '"Spline Sans Mono", monospace',
    fontSize: window.innerWidth < 760 ? 11 : 12,
    lineHeight: 1.45,
    fps: 14,
    bg: BG,
    masks: [content, footer].filter(Boolean),
    init(g) {
      G = g;
      layout(g);
      root = null; nid = 0; servers = []; nameIdx = 0; steps = []; cur = null; waitUntil = 0; mode = "add";
      keys = []; lookups = []; ghosts = []; sparks = []; life = []; focus = []; msg = "—"; note = null; userUntil = 0; entering = null;
      logLines = []; logEv("ring up · 7 servers"); lostSent = false;
      for (let i = 0; i < 7; i++) {
        const name = NAMES[nameIdx++];
        const vs = freshPositions(VN);
        servers.push({ name, vs });
        vs.forEach((k) => { const it = insertOp(k, name); while (!it.next().done); });
      }
      relayout();
      inorder(root).forEach((n) => { n.x = n.tx; n.y = n.ty; });
      nextChange = g.t + (lost ? 70 : 35);
      try {
        const sb = JSON.parse(sessionStorage.getItem("servedBy") || "null");
        sessionStorage.removeItem("servedBy");
        if (sb) { note = { text: `200 ${sb.route} · served by ${sb.srv}:${sb.k}`, t: g.t, ok: true, u: true }; logEv(`200 ${sb.route} · served by ${sb.srv}:${sb.k}`, "u"); }
      } catch {}
    },
    tick(g) {
      g.t++;

      if (lost && !lostSent && root && g.t >= 20) {
        lostSent = true;
        const r = (lost.el || content).getBoundingClientRect();
        sendFrom(r.left + r.width / 2, r.top + r.height / 2, { k: hashPath(lost.path), nav: { route: lostRoute, href: null, lost: true } });
        note = { text: `GET ${lostRoute} · hash ${hex(hashPath(lost.path))}`, t: g.t, ok: true, u: true, hold: true };
        logEv(`GET ${lostRoute} · hash ${hex(hashPath(lost.path))}`, "u");
      }

      if (!busy() && g.t >= nextChange && g.t >= userUntil && !entering) {
        const n = servers.length;
        const next = n <= MIN_S + 1 ? "add" : n >= MAX_S - 1 ? "remove" : lastAuto === "add" ? "remove" : "add";
        next === "add" ? addServer() : removeServer();
        lastAuto = next;
        nextChange = g.t + rnd(150, 220);
      }
      if (!cur && steps.length && g.t >= waitUntil) {
        const s = steps.shift();
        mode = s.mode;
        if (s.anim) { s.anim(); waitUntil = g.t + s.wait; msg = s.msg; focus = []; logEv(s.msg.split(" · ")[0], s.mode === "del" ? "d" : "a"); }
        else { cur = { it: s.gen(), label: s.label }; waitUntil = g.t; }
      }
      if (cur && g.t >= waitUntil) {
        const r = cur.it.next();
        if (r.done) { cur = null; focus = []; if (!steps.length) waitUntil = g.t + 10; }
        else {
          focus = r.value.focus || []; msg = r.value.msg; waitUntil = g.t + (r.value.slow ? 16 : 7);
          if (r.value.slow || /as leaf|unlink/.test(msg)) logEv(msg.split(" · ")[0].replace(/^unlink$/, `unlink ${cur.label.slice(1)}`), /rotate|imbalance/.test(msg) ? "" : mode === "del" ? "d" : "a");
        }
      }

      inorder(root).forEach((n) => {
        n.x += (n.tx - n.x) * 0.22; n.y += (n.ty - n.y) * 0.22;
        n.flash = (n.flash || 0) * 0.9;
      });
      ghosts.forEach((x) => x.t++); ghosts = ghosts.filter((x) => x.t < 14);
      life.forEach((x) => x.t++); life = life.filter((x) => x.t < LIFE + 10);
      sparks.forEach((s) => { s.t++; s.x += s.vx; s.y += s.vy; }); sparks = sparks.filter((s) => s.t < 18);

      // background requests come straight in from outside the ring, at the angle of their own hash
      if (root && g.t % 14 === 0 && !entering) {
        const path = nextPath();
        const k = hashPath(path);
        keys.push({ k, a: k, path, r: R * (1.2 + Math.random() * 0.35), v: 0.45 + Math.random() * 0.3, hist: [], state: "in" });
      }
      keys = keys.filter((key) => {
        if (!root) return false;
        if (key.state === "fly") {
          const dist = Math.hypot(key.tx - key.fx, (key.ty - key.fy) * ASP) || 1;
          key.p = Math.min(1, key.p + 4.5 / dist);
          key.x = key.fx + (key.tx - key.fx) * key.p;
          key.y = key.fy + (key.ty - key.fy) * key.p;
          key.hist.unshift([key.x, key.y]); key.hist = key.hist.slice(0, 10);
          if (key.p >= 1) key.r = R;
        } else if (key.state === "in") {
          key.r = key.r > R ? Math.max(R, key.r - key.v) : Math.min(R, key.r + key.v);
          [key.x, key.y] = polar(angleOf(key.k), key.r);
          key.hist.unshift([key.x, key.y]); key.hist = key.hist.slice(0, 10);
        }
        if (key.state === "in" || key.state === "fly") {
          if (Math.abs(key.r - R) < 0.01) {
            key.state = "walk"; key.hit = g.t; key.hist = [];
            if (key.user) {
              lookups = [{ path: ceil(key.k).path, t: g.t, user: true }];
              const o = liveOwner(key.k);
              note = { text: key.nav ? `GET ${key.nav.route} · hash ${hex(key.k)} → server ${o.srv}` : `GET ${hex(key.k)} → ${o.srv}`, t: g.t, ok: true, u: true, hold: !!key.nav };
            } else if (Math.random() < 0.12 && !lookups.length) {
              const c = ceil(key.k);
              lookups.push({ path: c.path, t: g.t });
              logEv(`GET ${key.path} → ${liveOwner(key.k).srv} · ${c.path.length} hops`, "r");
            }
          }
          return true;
        }
        const o = liveOwner(key.a);
        const d = (o.k - key.a + SPACE) % SPACE;
        const step = key.nav ? 80 : 18;
        if (d < step) {
          o.flash = Math.min(1, (o.flash || 0) + 0.25);
          o.flashU = !!key.user;
          if (key.nav && key.nav.lost) {
            note = { text: `404 ${key.nav.route} · server ${o.srv} owns this key, but has nothing there`, t: g.t, ok: false };
            logEv(`404 ${key.nav.route} · ${o.srv} has nothing there`, "d");
          } else if (key.nav) {
            entering = { node: o, t: g.t, href: key.nav.href };
            try { sessionStorage.setItem("servedBy", JSON.stringify({ route: key.nav.route, srv: o.srv, k: hex(o.k) })); } catch {}
            note = { text: `entering server ${o.srv} · ${key.nav.route}`, t: g.t, ok: true, u: true, hold: true };
            logEv(`you: GET ${key.nav.route} → ${o.srv} · entering`, "u");
          } else if (key.user) {
            note = { text: `GET ${hex(key.k)} → ${o.srv}`, t: g.t, ok: true, u: true };
            logEv(`you: GET ${hex(key.k)} → ${o.srv} · ${ceil(key.k).path.length} hops`, "u");
          }
          return false;
        }
        key.a = (key.a + step) % SPACE;
        [key.x, key.y] = ringPt(key.a);
        key.hist.unshift([key.x, key.y]); key.hist = key.hist.slice(0, 8);
        return true;
      });
      lookups = lookups.filter((l) => g.t - l.t < (l.user ? 24 : 8));
      if (note && !note.hold && g.t - note.t > (note.ok ? 70 : 40)) note = null;

      if (entering && g.t - entering.t === 10) {
        document.body.classList.add("leaving");
        setTimeout(() => { location.href = entering.href; }, 380);
      }

      if (status) {
        const nodes = inorder(root);
        const cls = mode === "del" ? "d" : "a";
        status.innerHTML = `${servers.length} servers · tree height ${depthOf(root)} · ` +
          (note ? `<span class="${note.u ? "u" : note.ok ? "r" : "d"}">${note.text}</span>` : cur || g.t < waitUntil ? `<span class="${cls}">${cur ? cur.label + " · " : ""}${msg}</span>` : "balanced");
      }
    },
    draw(g) {
      const nodes = inorder(root);
      const fset = new Set(focus);
      const lset = new Set(lookups.flatMap((l) => l.path));
      const uset = new Set(lookups.filter((l) => l.user).flatMap((l) => l.path));
      const LK = (n, a) => (uset.has(n) ? USR(a) : REQ(a));
      const FL = (n, a) => (n.flashU ? USR(a) : REQ(a));
      const hovering = (n) => hover && hover.kind === "server" && hover.node.srv === n.srv && !busy();
      const showTree = !backdrop;
      const showLabels = !backdrop;

      // 1. collect every label first so background layers can stay out from under them
      const labels = [];
      const addLabel = (x, y, text, color) => showLabels && labels.push({ x: Math.round(x), y: Math.round(y), text, color });

      nodes.forEach((n) => {
        if (n.dying && life.some((l) => l.k === n.k && l.kind === "die")) return;
        const [x, y] = ringPt(n.k);
        const a = angleOf(n.k);
        const hov = hovering(n);
        const off = compact ? 2.5 : 4;
        const ox = Math.cos(a) * off, oy = (Math.sin(a) * off) / ASP;
        const txt = hov ? `kill ${n.srv}` : compact ? n.srv : `${n.srv}:${hex(n.k)}`;
        const col = n.dying ? DEL(0.5) : hov ? DEL(1) : fset.has(n) ? OP(1) : n.flash > 0.5 ? FL(n, 0.95) : INK(0.6);
        addLabel(x + ox - (ox < 0 ? txt.length - 1 : 0), y + oy, txt, col);
      });
      life.forEach((l) => {
        const [x, y] = ringPt(l.k);
        const f = l.t / LIFE;
        const txt = compact ? `${l.kind === "boot" ? "+" : "-"}${l.srv}` : `${l.kind === "boot" ? "+" : "-"}${l.srv}:${hex(l.k)}`;
        addLabel(x + 2, y - 1, txt, l.kind === "boot" ? ADD(0.95) : DEL(Math.max(0.35, 1 - f)));
      });
      keys.forEach((k) => { if (k.user) addLabel(k.x + 2, k.y - 1, k.nav ? `GET ${k.nav.route}` : `GET ${hex(k.k)}`, USR(1)); });
      if (hover && hover.kind === "ring" && !busy()) {
        const [x, y] = ringPt(hover.k);
        const ok = fits(hover.k) && servers.length < MAX_S;
        addLabel(x + 2, y - 1, ok ? "add server" : "no room", ok ? ADD(0.95) : INK(0.45));
      }
      const bfNotes = [];
      if (showTree && tm !== "dots")
        nodes.forEach((n) => {
          const struct = fset.has(n);
          const b = liveBal(n);
          const txt = tm === "full" ? label(n) : hex(n.k);
          const col = struct ? OP(1) : n.dying ? DEL(0.5) : lset.has(n) ? LK(n, 0.95) : Math.abs(b) > 1 ? OP(1) : INK(0.45);
          addLabel(n.x, n.y, txt, col);
          // balance factor as a small note just above the box's top-right corner
          if (b !== 0 || struct)
            bfNotes.push({ x: Math.round(n.x) + txt.length, y: Math.round(n.y) - 1, text: `${b > 0 ? "+" : ""}${b}`, color: struct || Math.abs(b) > 1 ? OP(0.95) : INK(0.4) });
        });

      const tags = [];
      if (showLabels && !compact)
        keys.forEach((k) => {
          if (k.user || k.state !== "in" || !k.path) return;
          const text = `GET ${k.path}`;
          const x = Math.round(k.x < cx ? k.x - text.length + 1 : k.x), y = Math.round(k.y) - 1;
          if (g.masked(x, y) || g.masked(x + text.length - 1, y)) return;
          if (labels.some((l) => l.y === y && x <= l.x + l.text.length && l.x <= x + text.length)) return;
          if (tags.some((t) => t.y === y && x <= t.x + t.text.length && t.x <= x + text.length)) return;
          tags.push({ x, y, text });
        });
      const occ = new Set();
      labels.forEach((l) => { for (let i = -1; i <= l.text.length; i++) occ.add(l.y * g.cols + l.x + i); });
      tags.forEach((t) => { for (let i = 0; i < t.text.length; i++) occ.add(t.y * g.cols + t.x + i); });
      bfNotes.forEach((t) => { for (let i = 0; i < t.text.length; i++) occ.add(t.y * g.cols + t.x + i); });

      // log block: rows between the deepest possible tree level and the bottom of the ring
      const logRows = [];
      if (showLabels) {
        const rowsR = R / ASP;
        const top = Math.round(treeY + 3 * gapY + 2), last = Math.floor(cy + rowsR - 2);
        const n = Math.min(compact ? 3 : 5, last - top + 1, logLines.length);
        if (n > 0) {
          const halfAt = (y) => R * Math.sqrt(Math.max(0, 1 - ((y - cy) / rowsR) ** 2)) - 3;
          const lastY = top + n - 1;
          const w = Math.max(0, Math.min(52, Math.floor(2 * halfAt(lastY))));
          const x0 = Math.round(cx - w / 2);
          logLines.slice(-n).forEach((l, i, arr) => {
            let text = `${l.ts} ${l.text}`;
            if (text.length > w) text = text.slice(0, Math.max(0, w - 1)) + "…";
            const y = top + i;
            logRows.push({ x: x0, y, text, l, a: 0.12 + (0.4 * (i + 1)) / arr.length });
            for (let j = -1; j <= text.length; j++) occ.add(y * g.cols + x0 + j);
          });
        }
      }
      const put = (x, y, c, col) => { if (!occ.has(Math.round(y) * g.cols + Math.round(x))) g.put(x, y, c, col); };

      // 2. background layers
      for (let i = 0; i < ringN; i++) {
        const k = (i / ringN) * SPACE;
        const [x, y] = ringPt(k);
        const o = root ? ceil(k).node : null;
        const hot = o && fset.has(o);
        put(x, y, hot ? "=" : "·", hot ? OP(0.85) : o && o.dying ? DEL(0.25) : INK(0.24));
      }

      if (showTree)
        nodes.forEach((n) => {
          // right-angle connectors: a bar under the parent, then a corner and a drop to each child
          const nx = tm === "full" ? 2 : tm === "short" ? 1 : 0;
          const px = Math.round(n.x) + nx, py = Math.round(n.y) + 1;
          let left = false, right = false, jcol = null;
          [n.l, n.r].forEach((c) => {
            if (!c) return;
            const hot = fset.has(n) && fset.has(c) ? OP(0.85) : lset.has(n) && lset.has(c) ? LK(c, 0.75) : null;
            const col = hot || INK(0.28);
            if (hot || !jcol) jcol = col;
            const cx2 = Math.round(c.x) + nx, cy2 = Math.round(c.y);
            if (cx2 !== px) {
              const dir = cx2 < px ? -1 : 1;
              dir < 0 ? (left = true) : (right = true);
              for (let x = px + dir; x !== cx2; x += dir) put(x, py, "─", col);
              put(cx2, py, dir < 0 ? "┌" : "┐", col);
            }
            for (let y = cx2 !== px ? py + 1 : py; y < cy2; y++) put(cx2, y, "│", col);
          });
          if (left || right) put(px, py, left && right ? "┴" : left ? "┘" : "└", jcol);
          if (tm === "dots") {
            const col = fset.has(n) ? OP(1) : n.dying ? DEL(0.5) : lset.has(n) ? LK(n, 0.95) : INK(0.45);
            put(n.x, n.y, fset.has(n) || lset.has(n) ? "●" : "o", col);
          }
        });

      keys.forEach((k) => {
        const C = k.user ? USR : REQ;
        if (k.state === "fly") {
          const dx = k.tx - k.fx, dy = k.ty - k.fy, len = Math.hypot(dx, dy * ASP) || 1;
          for (let j = 1; j <= 16; j++) {
            const back = j * 0.8;
            if (back > k.p * len) break;
            put(k.x - (dx / len) * back, k.y - (dy / len) * back, "·", C(0.85 * (1 - j / 17)));
          }
          put(k.x, k.y, "◉", C(1));
        } else if (k.state === "in") {
          k.hist.forEach(([x, y], i) => i > 0 && put(x, y, "·", C((k.user ? 0.8 : 0.45) * (1 - i / 10))));
          put(k.x, k.y, k.user ? "◉" : "•", C(k.user ? 1 : 0.95));
        } else {
          const o = liveOwner(k.a);
          const d = (o.k - k.a + SPACE) % SPACE;
          const step = SPACE / ringN;
          for (let s = step; s < d; s += step) {
            const [x, y] = ringPt((k.a + s) % SPACE);
            put(x, y, "•", C(k.user ? 0.75 : 0.42));
          }
          k.hist.forEach(([x, y], i) => i > 0 && put(x, y, "·", C(0.6 * (1 - i / 8))));
          const [ox, oy] = ringPt(o.k);
          put(ox, oy, "◆", C(1));
          put(k.x, k.y, "●", C(1));
        }
      });

      life.forEach((l) => {
        const [x, y] = ringPt(l.k);
        const f = l.t / LIFE;
        if (l.kind === "boot") {
          const rr = 1 + l.t * 0.45;
          const segs = Math.ceil(TAU * rr * 1.5);
          if (l.t < LIFE) for (let i = 0; i < segs; i++) {
            const a = (i / segs) * TAU;
            put(x + rr * Math.cos(a), y + (rr / ASP) * Math.sin(a), "·", ADD(0.7 * (1 - f)));
          }
          put(x, y, l.t < LIFE * 0.3 ? "·" : l.t < LIFE * 0.6 ? "o" : l.t < LIFE ? "O" : "◆", ADD(1));
        } else if (l.t < LIFE && Math.floor(l.t / 3) % 2 === 0) put(x, y, "x", DEL(1));
      });
      sparks.forEach((s) => put(s.x, s.y, s.t < 6 ? "*" : "·", DEL(1 - s.t / 18)));

      // entering a server: a blue ripple grows out of it until the page fades
      if (entering) {
        const [x, y] = ringPt(entering.node.k);
        const age = g.t - entering.t;
        [0, 4].forEach((lag) => {
          const rr = Math.max(0, age - lag) * 2.2;
          const segs = Math.ceil(TAU * rr * 1.4) + 8;
          for (let i = 0; i < segs; i++) {
            const a = (i / segs) * TAU;
            g.put(x + rr * Math.cos(a), y + (rr / ASP) * Math.sin(a), "·", USR(Math.max(0, 0.9 - age / 22)));
          }
        });
      }

      nodes.forEach((n) => {
        if (n.dying && life.some((l) => l.k === n.k && l.kind === "die")) return;
        const [x, y] = ringPt(n.k);
        const enter = entering && entering.node === n;
        const c = enter ? USR(1) : n.dying ? DEL(0.45) : hovering(n) ? DEL(1) : fset.has(n) ? OP(1) : n.flash > 0.5 ? FL(n, 1) : INK(0.85);
        put(x, y, enter ? "◉" : n.dying ? "x" : "◆", c);
      });
      if (hover && hover.kind === "ring" && !busy()) {
        const [x, y] = ringPt(hover.k);
        put(x, y, "+", fits(hover.k) && servers.length < MAX_S ? ADD(1) : INK(0.4));
      }
      if (showTree && tm !== "dots") ghosts.forEach((x) => g.text(x.x, x.y, tm === "full" ? x.text : x.text.split(":")[1], DEL(0.8 * (1 - x.t / 14))));
      if (showTree && tm !== "dots" && cur && focus[0] && focus[0].x !== undefined) put(focus[0].x - 2, focus[0].y, "▸", OP(0.9));

      tags.forEach((t) => g.text(t.x, t.y, t.text, REQ(0.32)));
      bfNotes.forEach((t) => g.text(t.x, t.y, t.text, t.color));
      logRows.forEach((r) => {
        const col = r.l.cls === "u" ? USR : r.l.cls === "r" ? REQ : r.l.cls === "a" ? ADD : r.l.cls === "d" ? DEL : INK;
        g.text(r.x, r.y, r.text.slice(0, 5), INK(r.a * 0.6));
        g.text(r.x + 6, r.y, r.text.slice(6), col(r.a));
      });

      // 3. labels on top, each in its own box
      labels.forEach((l) => {
        if (g.masked(l.x, l.y) || g.masked(l.x + l.text.length - 1, l.y)) return;
        g.rect(l.x, l.y, l.text.length, 1, BG, l.color.replace(/[\d.]+\)$/, "0.35)"));
        g.text(l.x, l.y, l.text, l.color);
      });
    },
  });
}

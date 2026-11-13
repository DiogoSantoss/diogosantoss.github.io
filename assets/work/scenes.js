// The 13 scenes of the work gallery, one per job or project, in the site's line-art style.
// Each scene is a function that gets a kit (`k`) and builds into k.scene. It drives itself with
// k.every / k.after / k.tween / k.frame and moves messages with k.comet. Nothing here touches the DOM
// except through k.label; gallery.js owns the renderer, the camera aspect and the clock.
import * as THREE from "../vendor/three.js?v=0187";

export const INK = 0xe9ebee, REQ = 0x6cb6ff, USR = 0xff9f43, ADD = 0x5ee38a, DEL = 0xff6b6b, VIO = 0xba94ff, CF = 0xf6821f;
const TAU = Math.PI * 2;

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ease = (e) => (e < 0.5 ? 2 * e * e : 1 - (-2 * e + 2) ** 2 / 2);
const lerp3 = (a, b, e) => [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];

export function makeKit(labelsEl, seed = 1) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 4 / 3, 0.1, 200);
  const jobs = [], timers = [], frames = [], bills = [], labels = [];
  const q = new THREE.Quaternion();
  let now = 0, view = null;
  const mat = (c, o) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
  const geo = (pts) => new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3));
  const add = (o, parent) => ((parent || scene).add(o), o);
  const drop = (o) => { o.parent?.remove(o); o.traverse((x) => { x.geometry?.dispose(); x.material?.dispose(); }); };

  const k = {
    scene, camera, labels, rnd: mulberry(seed), drop,
    // the visitor turns the scene by dragging; it keeps turning a little after the release
    drag: { yaw: 0, pitch: 0, vel: 0, on: false },
    get now() { return now; },
    get target() { return view.target; },
    line: (pts, c = INK, o = 0.5, p) => add(new THREE.Line(geo(pts), mat(c, o)), p),
    loop: (pts, c = INK, o = 0.5, p) => add(new THREE.LineLoop(geo(pts), mat(c, o)), p),
    segs: (pts, c = INK, o = 0.5, p) => add(new THREE.LineSegments(geo(pts), mat(c, o)), p),
    // segments with a colour per vertex (pairs of points, pairs of colours)
    csegs(pts, cols, o = 0.9, p) {
      const g = geo(pts); g.setAttribute("color", new THREE.Float32BufferAttribute(cols.flat(), 3));
      return add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: o, depthWrite: false })), p);
    },
    edges: (g, c = INK, o = 0.6, p) => add(new THREE.LineSegments(new THREE.EdgesGeometry(g), mat(c, o)), p),
    box(w, h, d, c, o, p) { return k.edges(new THREE.BoxGeometry(w, h, d), c, o, p); },
    solid(w, h, d, c = INK, o = 0.2, p) { return add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })), p); },
    dot(r = 0.05, c = INK, p, o = 1) {
      const m = add(new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })), p);
      bills.push(m); return m;
    },
    group(p) { return add(new THREE.Group(), p); },
    // a label is HTML; pos is a world point, or follow an object (plus an offset); no pos pins it to a corner
    label(text, pos, cls = "") {
      const el = Object.assign(document.createElement("span"), { textContent: text, className: cls });
      labelsEl.append(el);
      const l = { el, pos: pos && new THREE.Vector3(...pos), obj: null, off: new THREE.Vector3(), on: true, set: (t) => (el.textContent = t) };
      l.follow = (obj, off = [0, 0, 0]) => ((l.obj = obj), l.off.set(...off), l);
      labels.push(l); return l;
    },
    circle(r, n = 64, plane = "xz", c = [0, 0, 0]) {
      return [...Array(n).keys()].map((i) => { const a = (i / n) * TAU, x = Math.cos(a) * r, y = Math.sin(a) * r; return plane === "xz" ? [c[0] + x, c[1], c[2] + y] : [c[0] + x, c[1] + y, c[2]]; });
    },
    arc(a, b, h = 0.6, n = 40) {
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + h, (a[2] + b[2]) / 2];
      return [...Array(n + 1).keys()].map((i) => { const t = i / n, u = 1 - t; return [0, 1, 2].map((j) => u * u * a[j] + 2 * u * t * m[j] + t * t * b[j]); });
    },
    // straight polyline, resampled to evenly spaced points
    path(pts, n = 40) {
      const len = [0];
      for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(...[0, 1, 2].map((j) => pts[i][j] - pts[i - 1][j])));
      const L = len.at(-1) || 1, out = [];
      for (let s = 0, i = 0; s <= n; s++) {
        const d = (s / n) * L;
        while (i < pts.length - 2 && len[i + 1] < d) i++;
        out.push(lerp3(pts[i], pts[i + 1], (d - len[i]) / (len[i + 1] - len[i] || 1)));
      }
      return out;
    },
    at(pts, e) { const h = Math.min(1, Math.max(0, e)) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(h)); return lerp3(pts[i], pts[i + 1], h - i); },
    // a message: a short bright trail with a dot at its head, running along pts
    comet(pts, o = {}) {
      const { color = INK, dur = 1, len = 0.3, opacity = 0.95, head = true, parent, arrive, done, r = 0.045 } = o;
      const l = k.line(pts, color, opacity, parent), n = pts.length;
      l.geometry.setDrawRange(0, 0);
      const d = head ? k.dot(r, color, parent) : null;
      let arrived = false;
      k.tween(dur * (1 + len), (e) => {
        const h = e * (1 + len) * (n - 1);
        const a = Math.max(0, Math.floor(h - len * (n - 1))), b = Math.min(n - 1, Math.floor(h));
        l.geometry.setDrawRange(a, Math.max(0, b - a + 1));
        if (d) { d.position.set(...k.at(pts, h / (n - 1))); d.visible = h <= n - 1; }
        if (!arrived && h >= n - 1) { arrived = true; arrive?.(); }
      }, () => { drop(l); if (d) { drop(d); bills.splice(bills.indexOf(d), 1); } done?.(); });
    },
    tween(dur, fn, done) { const j = { t0: now, dur, fn, done }; jobs.push(j); fn(0); return j; },
    after(sec, fn) { return k.tween(sec, () => {}, fn); },
    every(sec, fn, first = 0) { timers.push({ next: now + first, sec, fn }); },
    frame(fn) { frames.push(fn); },
    orbit(target, dist, yaw, pitch, swing = 9, speed = 0.12) { view = { target: new THREE.Vector3(...target), dist, yaw, pitch, swing, speed }; },
    tick(dt) {
      now += dt;
      for (const t of timers) while (now >= t.next) { t.next += t.sec; t.fn(); }
      for (const j of [...jobs]) {
        const e = Math.min(1, (now - j.t0) / j.dur);
        j.fn(e);
        if (e >= 1) { jobs.splice(jobs.indexOf(j), 1); j.done?.(); }
      }
      for (const f of frames) f(dt, now);
      if (!k.drag.on) { k.drag.yaw += k.drag.vel; k.drag.vel *= 0.92; }
      if (view) {
        const yaw = ((view.yaw + Math.sin(now * view.speed) * view.swing + k.drag.yaw) * Math.PI) / 180;
        const pitch = (Math.max(-10, Math.min(80, view.pitch + k.drag.pitch)) * Math.PI) / 180;
        camera.position.set(view.target.x + Math.sin(yaw) * Math.cos(pitch) * view.dist, view.target.y + Math.sin(pitch) * view.dist, view.target.z + Math.cos(yaw) * Math.cos(pitch) * view.dist);
        camera.lookAt(view.target);
      }
      camera.updateMatrixWorld();
      for (const b of bills) { b.parent.getWorldQuaternion(q).invert().multiply(camera.quaternion); b.quaternion.copy(q); }
    },
    dispose() { drop(scene); labelsEl.replaceChildren(); },
  };
  return k;
}

const fade = (k, obj, from, to, dur = 0.4) => k.tween(dur, (e) => (obj.material.opacity = from + (to - from) * e));
const flash = (k, obj, color, base, dur = 0.6) => { obj.material.color.setHex(color); k.after(dur, () => obj.material.color.setHex(base)); };
const envelope = (k, c) => {
  const g = k.group();
  k.box(0.52, 0.34, 0.02, c, 0.95, g);
  k.segs([[-0.26, 0.17, 0.011], [0, -0.02, 0.011], [0, -0.02, 0.011], [0.26, 0.17, 0.011]], c, 0.95, g);
  return g;
};

export const SCENES = {
  // Cloudflare's MTA: a sending server speaks SMTP to the edge; the mail is authenticated (SPF, DKIM, DMARC),
  // matched to a routing rule, queued and relayed to the destination MX. Email Sending joins the same queue
  cloudflare(k) {
    const S = [-2.9, 0, 0], G = [2.9, 0, 0], A = [-0.8, 0, 1.9];
    k.box(0.55, 0.55, 0.55, INK, 0.6).position.set(...S); k.label("mx.sender.net", [S[0], -0.55, 0], "small");
    k.box(0.55, 0.55, 0.55, INK, 0.6).position.set(...G); k.label("gmail mx", [G[0], -0.55, 0], "small");
    k.box(0.5, 0.34, 0.34, USR, 0.8).position.set(...A); k.label("worker · send_email", [A[0], -0.36, A[2]], "small");
    k.box(3.5, 1.1, 1.3, CF, 0.3).position.set(0, 0.05, 0); k.label("cloudflare mta", [0, 0.82, 0], "small");
    const ST = [["smtp", -1.2], ["auth", -0.4], ["rules", 0.4], ["queue", 1.2]].map(([n, x]) => {
      const b = k.box(0.46, 0.4, 0.46, CF, 0.85); b.position.set(x, 0, 0); k.label(n, [x, -0.4, 0], "small");
      return { n, b, p: [x, 0, 0] };
    });
    k.segs(ST.slice(1).flatMap((s, i) => [[ST[i].p[0] + 0.23, 0, 0], [s.p[0] - 0.23, 0, 0]]), CF, 0.4);
    const log = k.label("", null, "corner log"), stat = k.label("", null, "corner2"), lines = [];
    const say = (s) => { lines.push(s); if (lines.length > 4) lines.shift(); log.set(lines.join("\n")); };
    const talk = (steps, done) => {
      const run = (i) => {
        if (i === steps.length) return done();
        const [c, s] = steps[i];
        say("> " + c);
        k.comet(k.arc(S, ST[0].p, 0.35, 24), { color: REQ, dur: 0.32, len: 0.5, r: 0.025, arrive: () => {
          say("< " + s);
          k.comet(k.arc(ST[0].p, S, -0.25, 24), { color: s[0] === "5" ? DEL : INK, dur: 0.28, len: 0.5, r: 0.02, arrive: () => k.after(0.1, () => run(i + 1)) });
        } });
      };
      run(0);
    };
    // the envelope visits each stage; a stage can do something on arrival
    const through = (env, stages, done) => {
      let i = 0;
      const step = () => {
        if (i === stages.length) return done();
        const a = env.position.toArray(), [st, on] = stages[i++];
        k.tween(0.35, (e) => env.position.set(...lerp3(a, [st.p[0], 0.36, 0], ease(e))), () => { flash(k, st.b, ADD, CF, 0.3); on?.(); k.after(0.25, step); });
      };
      step();
    };
    const out = (env, done) => k.tween(1.0, (e) => env.position.set(...k.at(k.arc([ST[3].p[0], 0.36, 0], [G[0], 0.36, 0], 0.9), ease(e))), () => { k.drop(env); done(); });
    let n = 0, c = 0, id = 0x4f2a;
    const inbound = () => {
      const bad = c % 4 === 3, to = bad ? "nobody@diogoms.com" : "me@diogoms.com";
      talk([["EHLO mx.sender.net", "250 mx.cloudflare.net"], ["MAIL FROM:<alice@sender.net>", "250 ok"], [`RCPT TO:<${to}>`, bad ? "550 5.1.1 no such user" : "250 ok"]], () => {
        if (bad) return talk([["QUIT", "221 bye"]], () => stat.set("rejected · no routing rule for nobody@"));
        talk([["DATA", "354 go ahead"]], () => {
          const env = envelope(k, INK); env.scale.setScalar(0.6); env.position.set(S[0], 0.36, 0);
          k.tween(0.5, (e) => env.position.set(...k.at(k.arc([S[0], 0.36, 0], [ST[0].p[0], 0.36, 0], 0.5), ease(e))), () => through(env, [
            [ST[0]],
            [ST[1], () => stat.set("spf pass · dkim pass · dmarc pass")],
            [ST[2], () => stat.set("rule: me@diogoms.com → forward to gmail")],
            [ST[3], () => { id += 0x9d; say(`< 250 2.0.0 queued as ${id.toString(16)}`); k.comet(k.arc(ST[0].p, S, -0.25, 24), { color: ADD, dur: 0.3, r: 0.022 }); }],
          ], () => out(env, () => stat.set(`relayed to gmail mx · 250 ok · ${String(++n).padStart(4, "0")} delivered`))));
        });
      });
    };
    const sending = () => {
      lines.length = 0;
      say("POST send_email {from: me@diogoms.com}");
      const env = envelope(k, USR); env.scale.setScalar(0.6); env.position.set(A[0], 0.2, A[2]);
      k.tween(0.6, (e) => env.position.set(...lerp3([A[0], 0.2, A[2]], [ST[1].p[0], 0.36, 0], ease(e))), () => through(env, [
        [ST[1], () => stat.set("dkim signed · d=diogoms.com")],
        [ST[3], () => say("queued · email sending")],
      ], () => out(env, () => stat.set(`sent to gmail mx · 250 ok · ${String(++n).padStart(4, "0")} delivered`))));
    };
    k.every(7, () => (c++ % 3 === 2 ? sending() : inbound()));
    k.orbit([0, 0.2, 0.4], 8.4, 0, 22, 8);
  },

  // a distributed validator: four operators, each with a full node stack and Charon in its middle.
  // Every validator client holds one share of the validator key; nobody holds the whole key.
  // The Charons agree on the duty, swap partial signatures, and each one sends the aggregate to its own beacon node
  dvlabs(k) {
    const OBOL = 0x2fe4ab, N = 4, R = 2.0, ops = [];
    const LAYERS = [["validator client", 1.45, 0.3, INK], ["charon", 0.8, 0.36, OBOL], ["beacon node", 0.15, 0.3, INK], ["execution client", -0.45, 0.3, INK]];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + Math.PI / 4, x = Math.cos(a) * R, z = Math.sin(a) * R, boxes = {};
      for (const [name, y, h, c] of LAYERS) { const b = k.box(0.78, h, 0.5, c, name === "charon" ? 0.95 : 0.5); b.position.set(x, y, z); boxes[name] = b; }
      k.segs([[x, -0.3, z], [x, 1.3, z]], INK, 0.12);
      const share = k.solid(0.12, 0.12, 0.12, USR, 0.95); share.position.set(x + 0.28, 1.45, z);
      k.label(`share ${i + 1}/4`, [x, 1.85, z], "small usr");
      ops.push({ x, z, boxes, share, at: (name) => [x, LAYERS.find((l) => l[0] === name)[1], z] });
    }
    // the layer names, once, beside the front operator
    const front = ops.reduce((b, o) => (o.z + o.x * 0.3 > b.z + b.x * 0.3 ? o : b));
    for (const [name, y] of LAYERS) k.label(name, [front.x + 0.5, y, front.z], "right small");
    k.segs(ops.flatMap((a, i) => ops.slice(i + 1).flatMap((b) => [a.at("charon"), b.at("charon")])), OBOL, 0.12);
    const stage = k.label("", null, "corner");
    let slot = 8_120_400;
    k.every(5.2, () => {
      slot += 1;
      const down = k.rnd() < 0.45 ? Math.floor(k.rnd() * N) : -1;
      ops.forEach((o, i) => Object.values(o.boxes).forEach((b) => (b.material.opacity = i === down ? 0.12 : b.material.color.getHex() === OBOL ? 0.95 : 0.5)));
      const live = ops.filter((_, i) => i !== down);
      stage.set(`slot ${slot} · attestation duty${down >= 0 ? ` · operator ${down + 1} offline` : ""}`);
      for (const o of live) k.comet(k.path([o.at("beacon node"), o.at("charon")], 10), { color: INK, dur: 0.35, len: 0.6, r: 0.025 });
      k.after(0.5, () => { stage.set("charons agree on the data (qbft)"); for (const a of live) for (const b of live) if (a !== b) k.comet(k.arc(a.at("charon"), b.at("charon"), 0.3, 24), { color: OBOL, dur: 0.5, len: 0.5, r: 0.028 }); });
      k.after(1.5, () => { stage.set("each validator client signs with its share"); for (const o of live) k.comet(k.path([o.at("charon"), o.at("validator client")], 10), { color: INK, dur: 0.3, len: 0.6, r: 0.025, arrive: () => { flash(k, o.share, ADD, USR, 0.4); k.comet(k.path([o.at("validator client"), o.at("charon")], 10), { color: USR, dur: 0.3, len: 0.6, r: 0.03 }); } }); });
      k.after(2.6, () => { stage.set("partial signatures exchanged · 3 of 4 needed"); for (const a of live) for (const b of live) if (a !== b) k.comet(k.arc(a.at("charon"), b.at("charon"), 0.45, 24), { color: USR, dur: 0.5, len: 0.5, r: 0.028 }); });
      k.after(3.5, () => {
        stage.set("aggregated · each charon broadcasts to its own beacon node");
        for (const o of live) { flash(k, o.boxes.charon, ADD, OBOL, 0.6); k.comet(k.path([o.at("charon"), o.at("beacon node")], 10), { color: ADD, dur: 0.4, len: 0.6, r: 0.032, arrive: () => flash(k, o.boxes["beacon node"], ADD, INK, 0.5) }); }
      });
    }, 0.2);
    k.orbit([0, 0.65, 0], 9.6, 18, 22, 14);
  },

  // Alea-BFT: no leader; every node fills its own queue, agreement visits the queues in turn
  inesc(k) {
    const N = 4, xs = [...Array(N).keys()].map((i) => (i - 1.5) * 1.35), queues = xs.map(() => []), log = [];
    const bases = xs.map((x, i) => { const b = k.box(0.8, 0.14, 0.8, INK, 0.6); b.position.set(x, 0, 0); k.label(`node ${i + 1}`, [x, -0.35, 0]); return b; });
    k.label("log", [-2.6, -0.05, 1.9]);
    const ptr = k.loop(k.circle(0.55, 48), USR, 0.9); ptr.position.y = -0.06;
    const aba = k.label("", [0, 2.4, 0], "usr");
    const stage = k.label("", null, "corner");
    let crashed = -1, r = 0;
    const stack = (i) => queues[i].forEach((m, j) => k.tween(0.3, (e) => (m.position.y = m.position.y + (0.36 + j * 0.42 - m.position.y) * e)));
    const push = (i) => {
      if (queues[i].length >= 4 || i === crashed) return;
      for (let j = 0; j < N; j++) if (j !== i) k.comet(k.arc([xs[i], 0.2, 0], [xs[j], 0.2, 0], 0.5, 24), { color: REQ, dur: 0.5, len: 0.5, r: 0.03 });
      const m = k.box(0.34, 0.34, 0.34, REQ, 0.9); m.position.set(xs[i], 0.36 + queues[i].length * 0.42 + 0.8, 0);
      queues[i].push(m); stack(i); k.after(0.6, () => m.material.color.setHex(INK));
    };
    k.every(0.75, () => push(Math.floor(k.rnd() * N)));
    k.every(9, () => {
      crashed = Math.floor(k.rnd() * N); bases[crashed].material.color.setHex(DEL);
      const c = crashed; k.after(4, () => { bases[c].material.color.setHex(INK); crashed = -1; });
    }, 5);
    k.every(2, () => {
      const i = r++ % N;
      const from = ptr.position.x;
      k.tween(0.45, (e) => (ptr.position.x = from + (xs[i] - from) * ease(e)));
      aba.pos.set(xs[i], 2.3, 0);
      stage.set(`agreement on queue ${i + 1}`);
      let flips = 0;
      k.tween(0.8, () => { if (++flips % 4 === 0) aba.set(`ABA ${k.rnd() < 0.5 ? 0 : 1}`); }, () => {
        const yes = queues[i].length > 0;
        aba.set(yes ? "ABA → 1 · deliver" : "ABA → 0 · skip");
        if (!yes) return;
        const m = queues[i].shift(); stack(i);
        const a = m.position.toArray(), b = [-2.2 + log.length * 0.42, 0, 1.9];
        m.material.color.setHex(ADD);
        k.tween(0.6, (e) => { const p = lerp3(a, b, ease(e)); p[1] += 0.6 * Math.sin(Math.PI * e); m.position.set(...p); }, () => {
          m.material.color.setHex(INK); log.push(m);
          if (log.length > 11) {
            k.drop(log.shift());
            log.forEach((x, j) => { const x0 = x.position.x, x1 = -2.2 + j * 0.42; k.tween(0.3, (e) => (x.position.x = x0 + (x1 - x0) * e)); });
          }
        });
      });
    }, 1);
    k.orbit([0, 0.8, 0.6], 8, 16, 22, 10);
  },

  // the scheduling page: each jury member marks the hours they are free; the defence is booked where all three overlap
  dei(k) {
    const D = 5, Hh = 8, c = 0.46, ox = -((D - 1) * c) / 2, oz = -((Hh - 1) * c) / 2;
    const cell = (d, h, y) => [ox + d * c, y, oz + h * c];
    const grid = (y, color, o) => {
      const pts = [];
      for (let d = 0; d <= D; d++) pts.push([ox - c / 2 + d * c, y, oz - c / 2], [ox - c / 2 + d * c, y, oz - c / 2 + Hh * c]);
      for (let h = 0; h <= Hh; h++) pts.push([ox - c / 2, y, oz - c / 2 + h * c], [ox - c / 2 + D * c, y, oz - c / 2 + h * c]);
      return k.segs(pts, color, o);
    };
    grid(0, INK, 0.3);
    ["mon", "tue", "wed", "thu", "fri"].forEach((d, i) => k.label(d, [ox + i * c, 0, oz + Hh * c + 0.05], "small"));
    ["9h", "11h", "13h", "15h"].forEach((h, i) => k.label(h, [ox - c - 0.12, 0, oz + i * 2 * c], "small"));
    const JURY = [["advisor", REQ, 0.75], ["president", VIO, 1.25], ["examiner", ADD, 1.75]];
    JURY.forEach(([name, color, y]) => { grid(y, color, 0.12); k.label(name, [ox + D * c + 0.1, y, oz], "right small"); });
    const stage = k.label("", null, "corner"), booked = k.label("", [0, 0, 0], "usr");
    let tiles = [], n = 0;
    const defence = () => {
      tiles.forEach((t) => k.drop(t)); tiles = [];
      booked.on = false;
      // a slot everyone is free for, plus some free hours of their own
      const meet = [Math.floor(k.rnd() * D), Math.floor(k.rnd() * Hh)];
      const marks = JURY.map(() => { const m = new Set([meet.join()]); while (m.size < 9) m.add(`${Math.floor(k.rnd() * D)},${Math.floor(k.rnd() * Hh)}`); return [...m].sort(() => k.rnd() - 0.5); });
      stage.set(`defence ${++n} · jury marks free hours`);
      JURY.forEach(([, color, y], j) => marks[j].forEach((m, i) => k.after(j * 0.9 + i * 0.09, () => {
        const [d, h] = m.split(",").map(Number), t = k.solid(c * 0.8, 0.02, c * 0.8, color, 0.0);
        t.position.set(...cell(d, h, y)); tiles.push(t); fade(k, t, 0, 0.55, 0.2);
      })));
      k.after(3.1, () => {
        stage.set("overlap found · booking");
        const p = cell(meet[0], meet[1], 0);
        for (const [, , y] of JURY) k.comet(k.path([[p[0], y, p[2]], [p[0], 0.02, p[2]]], 12), { color: USR, dur: 0.45, len: 0.6, r: 0.03 });
        k.after(0.5, () => {
          const b = k.box(c * 0.86, 0.32, c * 0.86, USR, 0.95); b.position.set(p[0], 0.16, p[2]); tiles.push(b);
          booked.pos.set(p[0], 0.55, p[2]); booked.on = true;
          booked.set(`${["mon", "tue", "wed", "thu", "fri"][meet[0]]} ${9 + meet[1]}:00 · room ${["0.19", "1.38", "EA2"][n % 3]}`);
          stage.set(`defence ${n} booked · emails sent to the jury`);
        });
      });
    };
    k.every(5.6, defence);
    k.orbit([0, 0.7, 0], 7.6, -26, 32, 10);
  },

  // Ray on Kubernetes: objects from S3 go through SQS to the head, fan out to workers, results back to S3
  jungle(k) {
    const bucket = (x, y, label) => {
      for (const yy of [y - 0.35, y + 0.35]) k.loop(k.circle(0.42, 40, "xz", [x, yy, 0]), INK, 0.6);
      k.segs([0, 1, 2, 3].flatMap((i) => { const a = (i / 4) * TAU + 0.4; return [[x + Math.cos(a) * 0.42, y - 0.35, Math.sin(a) * 0.42], [x + Math.cos(a) * 0.42, y + 0.35, Math.sin(a) * 0.42]]; }), INK, 0.35);
      k.label(label, [x, y - 0.65, 0]);
    };
    bucket(-2.7, -0.2, "s3 in");
    bucket(-2.7, 1.5, "s3 out");
    const sqs = k.box(1.1, 0.32, 0.32, INK, 0.6); sqs.position.set(-1.25, -0.2, 0);
    k.label("sqs", [-1.25, -0.6, 0]);
    k.box(3.0, 1.0, 2.6, INK, 0.12).position.set(1.45, -0.2, 0);
    k.label("k8s · ray cluster", [1.45, -0.95, 1.3]);
    const head = k.box(0.48, 0.48, 0.48, USR, 0.85); head.position.set(0.25, -0.2, 0);
    k.label("head", [0.25, 0.25, 0]);
    const workers = [];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const w = k.box(0.34, 0.34, 0.34, INK, 0.45); w.position.set(1.15 + i * 0.5, -0.2, -0.5 + j * 1.0); workers.push(w); }
    const msgs = [];
    k.every(0.42, () => {
      const m = k.solid(0.16, 0.16, 0.16, REQ, 0.8); m.position.set(-1.7, -0.2, 0); msgs.push(m);
      k.comet(k.arc([-2.7, 0.15, 0], [-1.75, -0.05, 0], 0.5, 24), { color: REQ, dur: 0.45, len: 0.5, r: 0.03 });
      k.tween(0.9, (e) => (m.position.x = -1.7 + 0.9 * e), () => {
        k.drop(m); msgs.splice(msgs.indexOf(m), 1);
        k.comet(k.path([[-0.8, -0.2, 0], [0.05, -0.2, 0]], 12), { color: REQ, dur: 0.25, len: 0.6, r: 0.03, arrive: () => {
          const pick = [...workers].sort(() => k.rnd() - 0.5).slice(0, 2 + Math.floor(k.rnd() * 2));
          for (const w of pick) k.comet(k.arc([0.25, -0.2, 0], w.position.toArray(), 0.35, 20), { color: VIO, dur: 0.35, len: 0.5, r: 0.025, arrive: () => {
            w.material.color.setHex(VIO); w.material.opacity = 1;
            k.after(0.7, () => {
              w.material.color.setHex(INK); w.material.opacity = 0.45;
              if (k.rnd() < 0.5) k.comet(k.arc(w.position.toArray(), [-2.7, 1.5, 0], 1.1, 40), { color: ADD, dur: 0.9, len: 0.35, r: 0.028 });
            });
          } });
        } });
      });
    });
    k.orbit([0.3, 0.5, 0], 8, 8, 22, 10);
  },

  // Mapp.it: a farmer looks at their land with a data layer above it (soil moisture). The cursor moves over
  // the map; the cell under it shows its value and points down to the ground. A click opens the parcel
  spinworks(k) {
    const W = 6, N = 24, Y = 1.05;
    const hgt = (x, z) => 0.2 * Math.sin(x * 0.9 + 0.4) * Math.cos(z * 0.7) + 0.1 * Math.sin(x * 2.1 - z * 1.3);
    const tp = [];
    for (let i = 0; i <= N; i++) {
      const a = -W / 2 + (i / N) * W;
      for (let j = 0; j < N; j++) {
        const b0 = -W / 2 + (j / N) * W, b1 = -W / 2 + ((j + 1) / N) * W;
        tp.push([a, hgt(a, b0), b0], [a, hgt(a, b1), b1], [b0, hgt(b0, a), a], [b1, hgt(b1, a), a]);
      }
    }
    k.segs(tp, INK, 0.1);
    // parcels draped on the land, with their vine rows
    const PARCELS = [[[-2.5, -2.3], [-0.4, -2.0], [-0.6, -0.3], [-2.6, -0.6]], [[0.2, -2.4], [2.5, -2.2], [2.3, 0.1], [0.0, -0.1]], [[-2.4, 0.3], [-0.2, 0.5], [-0.4, 2.5], [-2.5, 2.3]], [[0.4, 0.6], [2.6, 0.8], [2.4, 2.5], [0.3, 2.4]]];
    const drape = (a, b, n = 20) => [...Array(n + 1).keys()].map((i) => { const x = a[0] + (b[0] - a[0]) * (i / n), z = a[1] + (b[1] - a[1]) * (i / n); return [x, hgt(x, z) + 0.01, z]; });
    PARCELS.forEach((q) => {
      k.line([0, 1, 2, 3, 0].map((i) => q[i]).flatMap((p, i, all) => (i ? drape(all[i - 1], p) : [])), INK, 0.5);
      const rows = [];
      for (let r = 1; r < 8; r++) { const t = r / 8, a = [q[0][0] + (q[3][0] - q[0][0]) * t, q[0][1] + (q[3][1] - q[0][1]) * t], b = [q[1][0] + (q[2][0] - q[1][0]) * t, q[1][1] + (q[2][1] - q[1][1]) * t]; const d = drape(a, b, 10); for (let i = 1; i < d.length; i++) rows.push(d[i - 1], d[i]); }
      k.segs(rows, ADD, 0.22);
    });
    const inParcel = (x, z) => PARCELS.findIndex((q) => { let ins = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, zi] = q[i], [xj, zj] = q[j]; if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; });
    // the data layer: one colour per vertex, from dry (orange) to wet (blue); the wet patches drift
    const plane = new THREE.PlaneGeometry(W, W, N, N); plane.rotateX(-Math.PI / 2); plane.translate(0, Y, 0);
    const pos = plane.attributes.position;
    plane.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.count * 3), 3));
    const col = plane.attributes.color.array;
    k.scene.add(new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, side: 2 /* DoubleSide */, depthWrite: false })));
    const gl = [];
    for (let i = 0; i <= N; i += 2) { const a = -W / 2 + (i / N) * W; gl.push([a, Y, -W / 2], [a, Y, W / 2], [-W / 2, Y, a], [W / 2, Y, a]); }
    k.segs(gl, INK, 0.07);
    k.segs([[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sz]) => [[(sx * W) / 2, hgt((sx * W) / 2, (sz * W) / 2), (sz * W) / 2], [(sx * W) / 2, Y, (sz * W) / 2]]), INK, 0.14);
    const BLOBS = [[-1.5, -1.2, 1.1, 0.9], [1.4, -1.0, 0.9, -0.9], [0.4, 1.5, 1.2, 0.8], [-1.8, 1.6, 0.8, -0.7], [1.8, 1.8, 0.7, -0.6]];
    const moist = (x, z, t) => {
      let v = 0.5;
      for (const [bx, bz, r, s] of BLOBS) { const cx = bx + 0.4 * Math.sin(t * 0.15 + bz), cz = bz + 0.3 * Math.cos(t * 0.12 + bx); v += 0.5 * s * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r)); }
      return Math.min(1, Math.max(0, v));
    };
    const DRY = [0.95, 0.5, 0.18], MID = [0.85, 0.82, 0.5], WET = [0.3, 0.6, 1];
    const ramp = (m) => (m < 0.5 ? DRY.map((c, i) => c + (MID[i] - c) * m * 2) : MID.map((c, i) => c + (WET[i] - c) * (m - 0.5) * 2));
    // the cursor faces the camera and draws on top of everything
    const cur = k.group(), C = 0.95;
    const arrow = [[0, 0], [0, -0.3], [0.075, -0.235], [0.13, -0.35], [0.175, -0.33], [0.12, -0.215], [0.215, -0.215]];
    const tri = [0, 1, 2, 0, 2, 5, 0, 5, 6, 2, 3, 4, 2, 4, 5].map((i) => [arrow[i][0] * C, arrow[i][1] * C, 0]);
    const fill = new THREE.Mesh(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(tri.flat(), 3)), new THREE.MeshBasicMaterial({ color: 0x0b0c0e, transparent: true, opacity: 0.95, side: 2, depthTest: false, depthWrite: false }));
    cur.add(fill);
    const edge = k.loop(arrow.map(([x, y]) => [x * C, y * C, 0.001]), INK, 1, cur);
    fill.renderOrder = 10; edge.renderOrder = 11; edge.material.depthTest = false;
    const s = W / N, cell = k.loop([[-s / 2, 0, -s / 2], [s / 2, 0, -s / 2], [s / 2, 0, s / 2], [-s / 2, 0, s / 2]], INK, 0.95);
    const foot = k.loop([[-s / 2, 0, -s / 2], [s / 2, 0, -s / 2], [s / 2, 0, s / 2], [-s / 2, 0, s / 2]], INK, 0.8);
    const stem = k.segs([[0, 0, 0], [0, 1, 0]], INK, 0.5);
    const tip = k.label("", [0, 0, 0], "right small"), pin = k.label("", [0, 0, 0], "usr small");
    pin.on = false;
    k.label("mapp.it · layer: soil moisture", null, "corner");
    const where = k.label("", null, "corner2");
    const at = { x: 0, z: 0 };
    k.frame((dt, now) => {
      for (let i = 0; i < pos.count; i++) col.set(ramp(moist(pos.getX(i), pos.getZ(i), now)), i * 3);
      plane.attributes.color.needsUpdate = true;
      cur.position.set(at.x, Y + 0.02, at.z);
      cur.quaternion.copy(k.camera.quaternion);
      const cx = Math.min(W / 2 - s / 2, Math.max(-W / 2 + s / 2, (Math.floor(at.x / s + N / 2) - N / 2 + 0.5) * s));
      const cz = Math.min(W / 2 - s / 2, Math.max(-W / 2 + s / 2, (Math.floor(at.z / s + N / 2) - N / 2 + 0.5) * s));
      const h = hgt(cx, cz) + 0.02, m = moist(cx, cz, now);
      cell.position.set(cx, Y + 0.005, cz); foot.position.set(cx, h, cz);
      stem.position.set(cx, h, cz); stem.scale.y = Y - h;
      tip.pos.set(at.x + 0.28, Y, at.z);
      tip.set(`${Math.round(m * 100)}% · ${m < 0.35 ? "dry" : m > 0.65 ? "wet" : "ok"}`);
      where.set(`zoom 17 · ${(38.7412 - at.z * 0.0009).toFixed(4)} N  ${(9.1395 - at.x * 0.0011).toFixed(4)} W`);
      // the map follows the cursor a little, like a hand panning
      k.target.x += (at.x * 0.35 - k.target.x) * Math.min(1, dt * 1.5);
      k.target.z += (at.z * 0.35 + 0.1 - k.target.z) * Math.min(1, dt * 1.5);
    });
    let stops = 0;
    const move = () => {
      const from = { ...at }, to = { x: (k.rnd() - 0.5) * 4.8, z: (k.rnd() - 0.5) * 4.8 };
      const bend = [(k.rnd() - 0.5) * 1.6, (k.rnd() - 0.5) * 1.6];
      k.tween(1.3, (e) => {
        const u = ease(e), b = Math.sin(Math.PI * u);
        at.x = from.x + (to.x - from.x) * u + bend[0] * b * 0.5; at.z = from.z + (to.z - from.z) * u + bend[1] * b * 0.5;
      }, () => {
        if (++stops % 3) return;
        // a click: a ring on the layer, and the parcel's summary on the ground
        const ring = k.loop(k.circle(0.1, 32), USR, 0.95); ring.position.set(at.x, Y + 0.01, at.z);
        k.tween(0.6, (e) => { ring.scale.setScalar(1 + e * 2.5); ring.material.opacity = 0.95 * (1 - e); }, () => k.drop(ring));
        const p = inParcel(at.x, at.z), m = moist(at.x, at.z, k.now);
        pin.pos.set(at.x, hgt(at.x, at.z) - 0.25, at.z); pin.on = true;
        pin.set(p < 0 ? `no parcel here` : `parcel ${p + 1} · ${Math.round(m * 100)}% · ${m < 0.35 ? "irrigate" : m > 0.65 ? "skip watering" : "fine"}`);
        k.after(2.2, () => (pin.on = false));
      });
    };
    k.every(2.4, move, 0.3);
    k.orbit([0, 0.4, 0.1], 10.4, 18, 36, 10, 0.06);
  },

  // consistent hashing: servers own arcs of the ring; a new server takes only its share of keys
  ring(k) {
    const R = 2, colors = [REQ, ADD, VIO, USR], VN = 6;
    k.loop(k.circle(R, 128), INK, 0.3);
    k.segs([...Array(64).keys()].flatMap((i) => { const a = (i / 64) * TAU, r0 = i % 8 ? R - 0.05 : R - 0.12; return [[Math.cos(a) * r0, 0, Math.sin(a) * r0], [Math.cos(a) * R, 0, Math.sin(a) * R]]; }), INK, 0.2);
    const vnodes = colors.map((c, s) => [...Array(VN)].map(() => ({ s, a: k.rnd() * TAU })));
    const ticks = vnodes.map((vs, s) => { const g = k.group(); for (const v of vs) { k.segs([[Math.cos(v.a) * (R - 0.02), 0, Math.sin(v.a) * (R - 0.02)], [Math.cos(v.a) * (R + 0.28), 0, Math.sin(v.a) * (R + 0.28)]], colors[s], 0.95, g); const d = k.dot(0.05, colors[s], g); d.position.set(Math.cos(v.a) * (R + 0.3), 0, Math.sin(v.a) * (R + 0.3)); } return g; });
    const keys = [...Array(40)].map(() => { const a = k.rnd() * TAU, d = k.dot(0.035, INK); d.position.set(Math.cos(a) * (R - 0.35), 0, Math.sin(a) * (R - 0.35)); return { a, d, owner: -1, link: null }; });
    const stat = k.label("", null, "corner");
    let live = [0, 1, 2], tree = null;
    const owner = (a) => {
      const all = live.flatMap((s) => vnodes[s]).sort((x, y) => x.a - y.a);
      return all.find((v) => v.a >= a) || all[0];
    };
    const relink = (animate) => {
      let moved = 0;
      for (const key of keys) {
        const o = owner(key.a);
        if (key.owner !== o.s) { if (key.owner >= 0) moved++; key.owner = o.s; }
        key.link && k.drop(key.link);
        const pts = [], a1 = o.a < key.a ? o.a + TAU : o.a;
        for (let i = 0; i <= 12; i++) { const a = key.a + ((a1 - key.a) * i) / 12; pts.push([Math.cos(a) * (R - 0.35), 0, Math.sin(a) * (R - 0.35)]); }
        key.link = k.line(pts, colors[o.s], 0.5);
        key.d.material.color.setHex(colors[o.s]);
        if (animate && moved && key.owner === 3) { key.link.material.opacity = 0; fade(k, key.link, 0, 0.9, 0.5); }
      }
      // the AVL tree that holds the vnode positions, drawn under the ring
      tree && k.drop(tree);
      tree = k.group(); tree.position.set(0, -1.25, 0);
      const sorted = live.flatMap((s) => vnodes[s]).sort((x, y) => x.a - y.a), n = sorted.length;
      const build = (lo, hi, depth, px) => {
        if (lo > hi) return;
        const mid = (lo + hi) >> 1, x = ((mid + 0.5) / n - 0.5) * 4.4, y = -depth * 0.28;
        const d = k.dot(0.04, colors[sorted[mid].s], tree); d.position.set(x, y, 0);
        if (px) k.segs([px, [x, y, 0]], INK, 0.25, tree);
        build(lo, mid - 1, depth + 1, [x, y, 0]); build(mid + 1, hi, depth + 1, [x, y, 0]);
      };
      build(0, n - 1, 0, null);
      return moved;
    };
    relink(false);
    ticks[3].visible = false;
    stat.set(`3 servers · ${VN} vnodes each`);
    k.every(4.5, () => {
      const adding = !live.includes(3);
      live = adding ? [0, 1, 2, 3] : [0, 1, 2];
      ticks[3].visible = adding;
      const m = relink(true);
      stat.set(`${adding ? "add" : "remove"} s4 · keys moved ${m}/${keys.length} · hash % n: ~75%`);
    }, 3);
    k.orbit([0, -0.35, 0], 7.4, 0, 34, 12);
  },

  // Gmail alias: mail comes in through Email Routing, the reply goes out through the Email Sending API
  mail(k) {
    const S = [-2.5, 0, 0], C = [0, 0, 0], G = [2.5, 0, 0];
    k.box(0.6, 0.6, 0.6, INK, 0.6).position.set(...S); k.label("sender", [S[0], -0.6, 0]);
    k.box(0.75, 0.75, 0.75, CF, 0.9).position.set(...C); k.label("cloudflare email", [0, -0.68, 0]);
    k.box(0.6, 0.6, 0.6, INK, 0.6).position.set(...G); k.label("gmail", [G[0], -0.6, 0]);
    const env = (c) => {
      const g = k.group();
      k.box(0.52, 0.34, 0.02, c, 0.95, g);
      k.segs([[-0.26, 0.17, 0.011], [0, -0.02, 0.011], [0, -0.02, 0.011], [0.26, 0.17, 0.011]], c, 0.95, g);
      return g;
    };
    const tag = k.label("", [0, 0, 0]), stage = k.label("", null, "corner");
    const fly = (g, pts, dur, done) => k.tween(dur, (e) => { const p = k.at(pts, ease(e)); g.position.set(...p); tag.pos.set(p[0], p[1] + 0.4, p[2]); }, done);
    const cycle = () => {
      const a = env(INK);
      tag.el.className = ""; tag.set("to: me@diogoms.com"); stage.set("inbound · email routing");
      fly(a, k.arc(S, C, 1.1), 1.1, () => { tag.set("forward → gmail"); fly(a, k.arc(C, G, 1.1), 1.1, () => { k.after(0.5, () => k.drop(a)); tag.set("in your inbox"); }); });
      k.after(3.2, () => {
        const b = env(USR);
        tag.el.className = "usr"; tag.set("send as me@diogoms.com"); stage.set("reply · email sending api");
        fly(b, k.arc(G, C, -1.1), 1.1, () => { tag.set("from: me@diogoms.com"); fly(b, k.arc(C, S, -1.1), 1.1, () => { tag.set("same thread ✓"); k.after(0.6, () => k.drop(b)); }); });
      });
    };
    k.every(7, cycle);
    k.orbit([0, 0.1, 0], 7.4, 0, 16, 16);
  },

  // HDSLedger: clients send transfers; the leader fills a block of three and runs QBFT (pre-prepare,
  // prepare, commit, quorum 3 of 4). The leader stays the same; only when it fails do the nodes change round
  qbft(k) {
    const N = 4, R = 1.7, nodes = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + 0.3, p = [Math.cos(a) * R + 0.6, 0, Math.sin(a) * R];
      const b = k.box(0.5, 0.22, 0.5, INK, 0.6); b.position.set(...p);
      k.label(`node ${i + 1}`, [p[0], -0.38, p[2]], "small");
      nodes.push({ p, b, chain: [] });
    }
    const client = [-2.7, 0.2, 0];
    k.box(0.36, 0.36, 0.36, REQ, 0.8).position.set(...client); k.label("client", [client[0], -0.25, 0], "small");
    const lead = k.loop(k.circle(0.45, 40), USR, 0.95); lead.position.set(nodes[0].p[0], -0.12, nodes[0].p[2]);
    const stage = k.label("", null, "corner"), pool = [];
    let leader = 0, round = 0, height = 0, fee = 100, failed = false;
    const all = (color) => { for (const a of nodes) for (const b of nodes) if (a !== b && !a.dead && !b.dead) k.comet(k.arc(a.p, b.p, 0.35, 24), { color, dur: 0.5, len: 0.5, r: 0.028 }); };
    const instance = () => {
      const L = nodes[leader];
      stage.set(`height ${height} · round ${round} · leader node ${leader + 1} · PRE-PREPARE`);
      for (const b of nodes) if (b !== L) k.comet(k.arc(L.p, b.p, 0.5, 24), { color: USR, dur: 0.5, len: 0.5, r: 0.034 });
      k.after(0.7, () => { stage.set(`height ${height} · PREPARE · quorum 3`); all(REQ); });
      k.after(1.4, () => { stage.set(`height ${height} · COMMIT · quorum 3`); all(ADD); });
      k.after(2.1, () => {
        fee += 3; stage.set(`block ${++height} · 3 transfers · fees → node ${leader + 1}`);
        pool.splice(0).forEach((m) => k.drop(m));
        for (const n of nodes) {
          if (n.dead) continue;
          const b = k.box(0.32, 0.26, 0.32, ADD, 0.95), y = 0.32 + n.chain.length * 0.3;
          b.position.set(n.p[0], y + 0.7, n.p[2]); n.chain.push(b);
          k.tween(0.3, (e) => (b.position.y = y + 0.7 * (1 - e)), () => k.after(0.3, () => { b.material.color.setHex(INK); b.material.opacity = 0.6; }));
          if (n.chain.length > 3) { k.drop(n.chain.shift()); n.chain.forEach((x, j) => (x.position.y = 0.32 + j * 0.3)); }
        }
        k.comet(k.arc(L.p, client, 0.6, 30), { color: INK, dur: 0.5, r: 0.025 });
      });
    };
    const changeRound = () => {
      const L = nodes[leader]; L.dead = true; L.b.material.color.setHex(DEL);
      stage.set(`node ${leader + 1} (leader) failed · timers expire · ROUND-CHANGE`);
      k.after(0.6, () => all(VIO));
      k.after(1.4, () => {
        round++; leader = (leader + 1) % N;
        const from = lead.position.clone(), to = nodes[leader].p;
        k.tween(0.4, (e) => lead.position.set(from.x + (to[0] - from.x) * e, -0.12, from.z + (to[2] - from.z) * e));
        stage.set(`round ${round} · node ${leader + 1} leads`);
      });
      k.after(9, () => { L.dead = false; L.b.material.color.setHex(INK); });
    };
    let tick = 0;
    k.every(1.1, () => {
      tick++;
      if (!failed && tick % 13 === 12) { failed = true; changeRound(); k.after(2.2, () => (failed = false)); return; }
      if (failed) return;
      // a transfer goes to the leader and one more node (the small quorum)
      const L = nodes[leader], other = nodes.find((n, i) => i !== leader && !n.dead);
      for (const t of [L, other]) k.comet(k.arc(client, t.p, 0.7, 30), { color: REQ, dur: 0.5, len: 0.4, r: 0.026 });
      k.after(0.5, () => {
        const m = k.solid(0.12, 0.12, 0.12, REQ, 0.9); m.position.set(L.p[0] - 0.5, 0.1 + pool.length * 0.16, L.p[2]); pool.push(m);
        if (pool.length === 3) instance();
      });
    }, 0.3);
    k.orbit([-0.1, 0.45, 0], 8.6, 16, 28, 12);
  },

  // Boney Bank: each time slot, the bank servers ask the Boney servers (Paxos) who is primary; the primary then
  // orders client commands with tentative/commit to the other bank servers
  paxos(k) {
    const row = (x, n, gap, label) => { const out = [...Array(n).keys()].map((i) => { const p = [x, 0, (i - (n - 1) / 2) * gap]; const b = k.box(0.36, 0.36, 0.36, INK, 0.6); b.position.set(...p); return { p, b }; }); k.label(label, [x, -0.45, ((n - 1) / 2) * gap + 0.25], "small"); return out; };
    const clients = row(-2.9, 2, 1.2, "clients"), bank = row(-0.9, 3, 1.0, "bank servers"), boney = row(1.9, 5, 0.66, "boney · paxos");
    boney.forEach((b, i) => { b.p[0] += Math.sin((i / 4) * Math.PI) * 0.6; b.b.position.set(...b.p); });
    bank.forEach((b, i) => k.label(`b${6 + i}`, [b.p[0], 0.38, b.p[2]], "small"));
    const ring = k.loop(k.circle(0.34, 40), USR, 0.95); ring.position.y = -0.2;
    const stage = k.label("", null, "corner"), bal = k.label("", null, "corner2");
    let slot = 0, primary = 0, balance = 0, seq = 0, suspect = -1;
    const elect = () => {
      slot++;
      const cand = suspect === primary ? (primary + 1) % 3 : primary;
      stage.set(`slot ${slot}/12 · CompareAndSwap(slot ${slot}, b${6 + cand})`);
      for (const b of bank) for (const x of boney) k.comet(k.arc(b.p, x.p, 0.4, 24), { color: VIO, dur: 0.45, len: 0.5, r: 0.022 });
      const L = boney[0];
      k.after(0.6, () => { stage.set(`slot ${slot} · paxos: prepare → promise`); for (const x of boney.slice(1)) k.comet(k.arc(L.p, x.p, 0.3, 20), { color: VIO, dur: 0.35, len: 0.5, r: 0.022, arrive: () => k.comet(k.arc(x.p, L.p, -0.25, 20), { color: INK, dur: 0.3, len: 0.5, r: 0.02 }) }); });
      k.after(1.4, () => { stage.set(`slot ${slot} · accept → decide (3 of 5)`); for (const x of boney.slice(1)) k.comet(k.arc(L.p, x.p, 0.3, 20), { color: ADD, dur: 0.35, len: 0.5, r: 0.022 }); });
      k.after(2.0, () => {
        for (const x of boney) k.comet(k.arc(x.p, bank[cand].p, -0.4, 24), { color: ADD, dur: 0.4, len: 0.5, r: 0.022 });
        const changed = cand !== primary; primary = cand;
        bank.forEach((b, i) => b.b.material.color.setHex(i === suspect ? DEL : INK));
        const from = ring.position.clone(), to = bank[primary].p;
        k.tween(0.35, (e) => ring.position.set(from.x + (to[0] - from.x) * e, -0.2, from.z + (to[2] - from.z) * e));
        stage.set(`slot ${slot} · primary b${6 + primary}${changed ? " · cleanup: ListPendingRequests" : ""}`);
        if (suspect >= 0 && changed) k.after(4, () => { bank[suspect].b.material.color.setHex(INK); suspect = -1; });
      });
    };
    const command = () => {
      const c = clients[Math.floor(k.rnd() * 2)], P = bank[primary];
      const op = k.rnd() < 0.65 ? ["D", [200, 50, 120][Math.floor(k.rnd() * 3)]] : ["W", [30, 80, 500][Math.floor(k.rnd() * 3)]];
      for (const b of bank) k.comet(k.arc(c.p, b.p, 0.45, 24), { color: REQ, dur: 0.4, len: 0.5, r: 0.024 });
      k.after(0.45, () => {
        const n = ++seq;
        stage.set(`b${6 + primary} · phase 1 · tentative #${n} ${op.join(" ")}`);
        const backups = bank.filter((_, i) => i !== primary);
        for (const b of backups) k.comet(k.arc(P.p, b.p, 0.3, 20), { color: USR, dur: 0.35, len: 0.5, r: 0.022, arrive: () => k.comet(k.arc(b.p, P.p, -0.25, 20), { color: INK, dur: 0.3, len: 0.5, r: 0.02 }) });
        k.after(0.75, () => {
          const ok = op[0] === "D" || balance >= op[1];
          if (ok) balance += op[0] === "D" ? op[1] : -op[1];
          stage.set(`b${6 + primary} · phase 2 · commit #${n} ${op.join(" ")}${ok ? "" : " · refused, balance too low"}`);
          for (const b of backups) k.comet(k.arc(P.p, b.p, 0.3, 20), { color: ok ? ADD : DEL, dur: 0.35, len: 0.5, r: 0.022 });
          k.comet(k.arc(P.p, c.p, -0.35, 24), { color: ok ? ADD : DEL, dur: 0.4, r: 0.024 });
          bal.set(`balance ${balance} €`);
        });
      });
    };
    let t = 0;
    k.every(1.0, () => {
      t++;
      if (t % 9 === 1) { if (slot % 3 === 2) suspect = primary; elect(); return; }
      if (t % 9 > 3) command();
    }, 0.1);
    k.orbit([-0.3, 0.2, 0], 8.4, 8, 40, 10);
  },

  // nvolopi: sign in (JWT), upload a file, share its ID; the shared user downloads it, anyone else gets 403.
  // A stress test of uploads makes the autoscaler add upload pods
  gke(k) {
    k.box(3.6, 1.4, 2.8, INK, 0.12).position.set(0.6, 0.3, 0);
    k.label("gke cluster", [0.6, -0.55, 1.4], "small");
    const lb = [-1.15, 0.3, 0];
    k.box(0.22, 0.6, 0.6, REQ, 0.85).position.set(...lb); k.label("lb :80", [-1.15, -0.15, 0], "small");
    const svc = (x, z, name) => {
      const pods = [], g = { x, z, pods, name };
      k.label(name, [x, 0.95, z], "small");
      g.add = () => { const b = k.box(0.3, 0.3, 0.3, ADD, 0.95); b.position.set(x, 0.3 + pods.length * 0.38 - 0.38, z); pods.push(b); k.after(0.5, () => b.material.color.setHex(INK)); };
      g.drop = () => { const b = pods.pop(); b.material.color.setHex(DEL); k.after(0.4, () => k.drop(b)); };
      g.add(); return g;
    };
    const front = svc(-0.2, 0, "frontend"), auth = svc(0.85, -0.95, "auth"), up = svc(0.85, 0.95, "upload");
    const db = [1.85, 0.3, 0];
    for (const y of [0, 0.5]) k.loop(k.circle(0.3, 32, "xz", [db[0], y, 0]), INK, 0.6);
    k.segs([0, 1, 2, 3].flatMap((i) => { const a = (i / 4) * TAU + 0.4; return [[db[0] + Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], [db[0] + Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.3]]; }), INK, 0.35);
    k.label("mongodb", [db[0], -0.2, 0], "small");
    const users = { alice: [-2.9, 0.3, -0.9], bob: [-2.9, 0.3, 0.6], carol: [-2.9, 0.3, 1.5] };
    for (const [n, p] of Object.entries(users)) { k.box(0.3, 0.3, 0.3, INK, 0.6).position.set(...p); k.label(n, [p[0], p[1] + 0.34, p[2]], "small"); }
    const stage = k.label("", null, "corner"), tag = k.label("", [0, 0, 0], "small");
    const P = (s) => [s.x, 0.3, s.z];
    const hop = (pts, color, done, r = 0.026) => { const seg = (i) => i === pts.length - 1 ? done?.() : k.comet(k.arc(pts[i], pts[i + 1], 0.25, 20), { color, dur: 0.32, len: 0.5, r, arrive: () => seg(i + 1) }); seg(0); };
    const file = () => { const g = k.group(); k.segs([[-0.09, -0.12, 0], [0.04, -0.12, 0], [0.04, -0.12, 0], [0.09, -0.07, 0], [0.09, -0.07, 0], [0.09, 0.12, 0], [0.09, 0.12, 0], [-0.09, 0.12, 0], [-0.09, 0.12, 0], [-0.09, -0.12, 0]].map(([x, y, z]) => [x * 1.4, y * 1.4, z]), USR, 0.95, g); return g; };
    let id = 0;
    const story = () => {
      const fid = (0x3f2a + ++id * 4099).toString(16).slice(-4) + "…";
      stage.set("alice: POST /api/auth/auth"); tag.on = false;
      hop([users.alice, lb, P(front), P(auth)], REQ, () => {
        stage.set("auth: bcrypt ✓ · JWT (RS256, 30 min)");
        hop([P(auth), P(front), lb, users.alice], ADD, () => {
          stage.set("alice: upload 4 MB · allowed: bob · Bearer JWT");
          const f = file(); f.position.set(...users.alice);
          const path = [users.alice, lb, P(front), P(up), db];
          let i = 0;
          const step = () => { if (i === path.length - 1) { k.drop(f); stage.set(`stored · fileID ${fid}`); return share(); } const a = path[i], b = path[++i]; k.tween(0.35, (e) => f.position.set(...lerp3(a, b, e)), step); };
          step();
        });
      });
      const share = () => {
        tag.on = true; tag.pos.set(-2.2, 0.3, -0.15); tag.set(`id ${fid}`);
        k.comet(k.path([users.alice, users.bob], 12), { color: USR, dur: 0.5, r: 0.03, arrive: () => {
          stage.set("bob: POST /download · allowed ✓");
          hop([users.bob, lb, P(front), P(up), db], REQ, () => hop([db, P(up), P(front), lb, users.bob], ADD, () => {
            stage.set("carol: POST /download · 403 not allowed");
            hop([users.carol, lb, P(front), P(up)], REQ, () => k.comet(k.arc(P(up), users.carol, 0.4, 24), { color: DEL, dur: 0.45, r: 0.03 }));
          }));
        } });
      };
    };
    const stress = () => {
      stage.set("hiroshima.py: 500 uploads · hpa 50% cpu");
      for (let i = 0; i < 24; i++) k.after(i * 0.12, () => hop([users[["alice", "bob", "carol"][i % 3]], lb, P(up)], USR, null, 0.02));
      k.after(1.2, () => up.pods.length < 3 && up.add());
      k.after(2.0, () => up.pods.length < 3 && up.add());
      k.after(6.5, () => { up.drop(); k.after(1, () => up.drop()); stage.set("load over · upload back to 1 pod"); });
    };
    let n = 0;
    k.every(8, () => (n++ % 3 === 2 ? stress() : story()));
    k.orbit([-0.6, 0.2, 0.2], 9.2, 8, 44, 10);
  },

  // EcoWorld@Cloud: Javassist counts the instructions each request runs. From those counts the load balancer
  // guesses a new request's cost, and sends it to the worker with the least work. Under load, one more worker starts
  aws(k) {
    const SRC = [-3.0, 0.3, 0], LB = [-1.5, 0.3, 0], XS = [0.0, 0.85, 1.7, 2.55], CAP = 2.0, RATE = 0.1;
    k.label("requests", [SRC[0], -0.1, 0], "small");
    const lbBox = k.box(0.5, 0.5, 0.5, USR, 0.9); lbBox.position.set(...LB);
    k.label("load balancer", [LB[0], -0.2, 0], "small");
    const est = k.label("", [LB[0], 0.85, 0], "usr small"), stage = k.label("", null, "corner"), stat = k.label("", null, "corner2");
    const KINDS = [["/simulate", REQ, () => `gen ${200 + Math.floor(k.rnd() * 1800)}`], ["/insectwar", VIO, () => `max ${20 + Math.floor(k.rnd() * 200)}`], ["/compress", ADD, () => `${(0.3 + k.rnd() * 3).toFixed(1)} MP`]];
    const workers = [];
    const spawn = () => {
      const x = XS.find((x) => !workers.some((w) => w.x === x)), g = k.group(); g.position.set(x, 0, 0);
      const frame = k.box(0.6, CAP, 0.6, INK, 0.3, g); frame.position.y = CAP / 2;
      const name = k.label(`worker ${XS.indexOf(x) + 1}`, [x, -0.2, 0], "small");
      const w = { x, g, frame, name, blocks: [], pending: 0, load: () => w.blocks.reduce((s, b) => s + b.h, 0) + w.pending };
      flash(k, frame, ADD, INK, 0.8);
      workers.push(w); workers.sort((a, b) => a.x - b.x); return w;
    };
    const retire = (w) => { workers.splice(workers.indexOf(w), 1); w.frame.material.color.setHex(DEL); w.name.on = false; k.after(0.5, () => k.drop(w.g)); };
    spawn(); spawn();
    const block = (h, color) => { const g = k.group(); k.solid(0.44, 1, 0.44, color, 0.4, g); k.box(0.44, 1, 0.44, color, 0.9, g); g.scale.y = h; return g; };
    const top = (w) => w.blocks.reduce((s, b) => s + b.h + 0.02, 0);
    k.frame((dt) => {
      for (const w of workers) {
        const b = w.blocks[0];
        if (b) {
          b.h -= dt * RATE;
          if (b.h <= 0.01) {
            w.blocks.shift(); k.drop(b.g);
            k.comet(k.arc([w.x, CAP, 0], LB, 0.5, 24), { color: VIO, dur: 0.6, len: 0.4, r: 0.02 });
            stat.set(`worker ${XS.indexOf(w.x) + 1} done · measured ${b.cost.toFixed(1)}G instructions`);
          }
        }
        let y = 0;
        for (const x of w.blocks) { x.g.position.set(w.x, y + x.h / 2, 0); x.g.scale.y = Math.max(0.001, x.h); y += x.h + 0.02; }
      }
    });
    k.every(0.25, () => {
      if (k.rnd() > 0.17 + 0.13 * Math.sin(k.now * 0.25)) return;
      const [path, color, arg] = KINDS[Math.floor(k.rnd() * 3)], h = 0.15 + k.rnd() * 0.45, cost = h * 10;
      k.comet(k.path([SRC, LB], 12), { color: INK, dur: 0.35, len: 0.5, r: 0.025, arrive: () => {
        est.set(`≈ ${cost.toFixed(1)}G`);
        const w = [...workers].sort((a, b) => a.load() - b.load())[0];
        if (w.load() + h > CAP) { stage.set(`${path} ${arg()} · all workers full · 503`); return k.comet(k.arc(LB, SRC, -0.3, 20), { color: DEL, dur: 0.35, r: 0.025 }); }
        stage.set(`${path} ${arg()} · ≈ ${cost.toFixed(1)}G instr → worker ${XS.indexOf(w.x) + 1}`);
        flash(k, lbBox, ADD, USR, 0.2);
        w.pending += h;
        const b = { g: block(h, color), h, cost };
        k.tween(0.55, (e) => { const end = [w.x, top(w) + h / 2, 0]; b.g.position.set(...k.at(k.arc([LB[0], LB[1], 0], end, 0.8, 24), ease(e))); }, () => {
          w.pending -= h;
          if (workers.includes(w)) w.blocks.push(b); else k.drop(b.g);
        });
      } });
    });
    k.every(2.5, () => {
      const avg = workers.reduce((s, w) => s + w.load(), 0) / workers.length / CAP;
      if (avg > 0.6 && workers.length < XS.length) { spawn(); stage.set(`autoscaler · average ${Math.round(avg * 100)}% · start a worker`); return; }
      const idle = workers.find((w) => !w.blocks.length && !w.pending);
      if (avg < 0.08 && workers.length > 1 && idle) { retire(idle); stage.set(`autoscaler · average ${Math.round(avg * 100)}% · stop a worker`); }
    }, 1);
    k.orbit([0.4, 0.8, 0], 8.2, 10, 18, 10);
  },

  // the broker: two locks, a password and a TOTP code; behind them the server signs a JWT that lasts 10 minutes.
  // Every trade carries the JWT, and when it expires the refresh cookie gets a new one
  "2fa"(k) {
    const C = [-2.4, 0.2, 0], S = [1.5, 0.2, 0], PH = [-2.4, 1.5, 0], TK = [-0.8, 1.25, 0];
    k.box(0.6, 0.45, 0.45, INK, 0.6).position.set(...C); k.label("browser", [C[0], -0.2, 0], "small");
    k.box(0.22, 0.4, 0.04, INK, 0.7).position.set(...PH); k.label("authenticator", [PH[0], PH[1] - 0.5, 0], "small");
    k.box(1.4, 1.3, 0.8, INK, 0.6).position.set(...S); k.label("broker", [S[0], -0.65, 0.4], "small");
    const lock = (x, name) => {
      const g = k.group(); g.position.set(x, S[1] + 0.32, 0.41);
      const body = k.box(0.22, 0.17, 0.02, INK, 0.9, g);
      const sh = k.line([...Array(13).keys()].map((i) => { const a = (Math.PI * i) / 12; return [Math.cos(a) * 0.065, 0.085 + Math.sin(a) * 0.08, 0]; }), INK, 0.9, g);
      k.label(name, [x, S[1] + 0.05, 0.41], "small");
      return { open: (on) => { sh.position.y = on ? 0.06 : 0; for (const m of [body, sh]) m.material.color.setHex(on ? ADD : INK); } };
    };
    const L1 = lock(S[0] - 0.33, "password"), L2 = lock(S[0] + 0.33, "code");
    // a price chart on the broker's front, moved by each trade
    const prices = [...Array(14)].map((_, i) => 0.5 + 0.2 * Math.sin(i * 0.9));
    const chart = k.line(prices.map((p, i) => [S[0] - 0.55 + i * 0.085, S[1] - 0.5 + p * 0.35, 0.41]), REQ, 0.8);
    const tick = (up) => { prices.shift(); prices.push(Math.min(1, Math.max(0, prices.at(-1) + (up ? 0.12 : -0.1) * (0.5 + k.rnd())))); prices.forEach((p, i) => chart.geometry.attributes.position.setY(i, S[1] - 0.5 + p * 0.35)); chart.geometry.attributes.position.needsUpdate = true; };
    const dial = k.line([...Array(41).keys()].map((i) => { const a = Math.PI / 2 - (i / 40) * TAU; return [PH[0] + Math.cos(a) * 0.36, PH[1] + Math.sin(a) * 0.36, 0]; }), USR, 0.9);
    const code = k.label("", [PH[0], PH[1] + 0.58, 0], "code");
    const newCode = () => code.set(String(Math.floor(k.rnd() * 1e6)).padStart(6, "0").replace(/(\d{3})/, "$1 "));
    newCode(); k.every(6, newCode, 6);
    // the JWT: a card above the browser, with a ring that runs down over its lifetime
    const card = k.box(0.5, 0.3, 0.02, ADD, 0.95); card.position.set(...TK); card.visible = false;
    const ring = k.line([...Array(41).keys()].map((i) => { const a = Math.PI / 2 - (i / 40) * TAU; return [TK[0] + Math.cos(a) * 0.36, TK[1] + Math.sin(a) * 0.36, 0]; }), ADD, 0.9);
    ring.visible = false;
    const tok = k.label("", [TK[0] + 0.48, TK[1], 0], "right small add"), stage = k.label("", null, "corner");
    const go = (a, b, color, done, h = 0.45) => k.comet(k.arc(a, b, h, 24), { color, dur: 0.5, len: 0.5, r: 0.032, arrive: done });
    let state = "out", left = 0, refreshes = 0, trades = 0;
    const setTok = (on, color = ADD) => { card.visible = ring.visible = on; tok.on = on; card.material.color.setHex(color); ring.material.color.setHex(color); };
    const issue = () => { left = 1; state = "in"; setTok(true); tok.set("jwt · 10 min"); };
    const login = () => {
      state = "busy"; setTok(false); L1.open(false); L2.open(false);
      stage.set("1 · password");
      go(C, S, REQ, () => {
        L1.open(true);
        stage.set(`2 · code ${code.el.textContent} from the app`);
        k.comet(k.path([PH, C], 10), { color: USR, dur: 0.4, r: 0.03, arrive: () => go(C, S, USR, () => {
          L2.open(true);
          stage.set("3 · both locks open · the broker signs a jwt");
          go(S, TK, ADD, issue, -0.5);
        }) });
      });
    };
    const trade = () => {
      const buy = k.rnd() < 0.6, n = 1 + Math.floor(k.rnd() * 9);
      stage.set(`4 · ${buy ? "buy" : "sell"} ${n} NCMB · carries the jwt`);
      flash(k, card, INK, ADD, 0.25);
      go(TK, S, REQ, () => { tick(buy); trades++; k.comet(k.arc(S, C, -0.35, 24), { color: ADD, dur: 0.45, r: 0.026 }); }, 0.35);
    };
    const expire = () => {
      state = "busy"; setTok(true, DEL); tok.set("expired");
      if (refreshes++ % 2) {
        stage.set(`session over · ${trades} trades · log in again`);
        return k.after(2, () => { trades = 0; login(); });
      }
      stage.set("5 · jwt expired · the refresh cookie asks for a new one");
      go(C, S, INK, () => go(S, TK, ADD, () => { issue(); stage.set("5 · new jwt · no password needed"); }, -0.5));
    };
    k.frame((dt, now) => {
      dial.geometry.setDrawRange(0, Math.max(2, Math.round((1 - (now % 6) / 6) * 40) + 1));
      if (state === "in") { left -= dt / 7; ring.geometry.setDrawRange(0, Math.max(2, Math.round(left * 40) + 1)); if (left <= 0) expire(); }
    });
    k.every(1.6, () => state === "in" && left > 0.15 && trade(), 0.8);
    k.after(0.3, login);
    k.orbit([-0.4, 0.6, 0], 7.6, 8, 14, 12);
  },
};

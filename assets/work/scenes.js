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
    get now() { return now; },
    get target() { return view.target; },
    line: (pts, c = INK, o = 0.5, p) => add(new THREE.Line(geo(pts), mat(c, o)), p),
    loop: (pts, c = INK, o = 0.5, p) => add(new THREE.LineLoop(geo(pts), mat(c, o)), p),
    segs: (pts, c = INK, o = 0.5, p) => add(new THREE.LineSegments(geo(pts), mat(c, o)), p),
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
      if (view) {
        const yaw = ((view.yaw + Math.sin(now * view.speed) * view.swing) * Math.PI) / 180, pitch = (view.pitch * Math.PI) / 180;
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

export const SCENES = {
  // Email Routing and Sending: mail lands at the nearest colo, then leaves for the destination
  cloudflare(k) {
    const R = 2, g = k.group();
    g.rotation.z = 0.32;
    for (let lat = -60; lat <= 60; lat += 30) {
      const r = R * Math.cos((lat * Math.PI) / 180), y = R * Math.sin((lat * Math.PI) / 180);
      k.loop(k.circle(r, 80).map((p) => [p[0], y, p[2]]), INK, lat === 0 ? 0.22 : 0.1, g);
    }
    for (let lon = 0; lon < 180; lon += 30) {
      const l = (lon * Math.PI) / 180;
      k.loop([...Array(80).keys()].map((i) => { const a = (i / 80) * TAU; return [R * Math.cos(a) * Math.cos(l), R * Math.sin(a), R * Math.cos(a) * Math.sin(l)]; }), INK, 0.1, g);
    }
    const sph = (lat, lon) => [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
    const randLL = () => sph((k.rnd() * 110 - 50) * (Math.PI / 180), k.rnd() * TAU);
    const colos = [...Array(36)].map(randLL);
    for (const c of colos) { const d = k.dot(0.032, CF, g, 0.9); d.position.set(...c.map((v) => v * R)); }
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const great = (a, b, h, n = 48) => {
      const w = Math.acos(Math.min(1, dot(a, b))), s = Math.sin(w) || 1;
      return [...Array(n + 1).keys()].map((i) => {
        const t = i / n, f = (R * (1 + h * Math.sin(Math.PI * t))), u = Math.sin((1 - t) * w) / s, v = Math.sin(t * w) / s;
        return [0, 1, 2].map((j) => (a[j] * u + b[j] * v) * f);
      });
    };
    const routed = k.label("", null, "corner");
    let n = 0;
    k.every(0.32, () => {
      const s = randLL(), c = colos.reduce((b, x) => (dot(x, s) > dot(b, s) ? x : b));
      k.comet(great(s, c, 0.05, 20), { color: REQ, dur: 0.55, len: 0.6, parent: g, r: 0.03, arrive: () => {
        const far = colos.filter((x) => dot(x, c) < 0.2);
        k.comet(great(c, far[Math.floor(k.rnd() * far.length)], 0.32), { color: CF, dur: 1.5, len: 0.3, parent: g, r: 0.035 });
        routed.set(`mail routed ${String(++n).padStart(5, "0")}`);
      } });
    });
    k.frame((dt) => (g.rotation.y += dt * 0.07));
    k.orbit([0, 0, 0], 7, 0, 12, 0);
  },

  // Charon: four nodes agree on the duty, each signs a share, any three shares make the signature
  dvlabs(k) {
    const N = 4, R = 1.9, nodes = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU + Math.PI / 4, p = [Math.cos(a) * R, 0, Math.sin(a) * R];
      const b = k.box(0.55, 0.55, 0.55, INK, 0.7); b.position.set(...p);
      k.label(`charon ${i + 1}`, [p[0], -0.55, p[2]]);
      nodes.push({ p, b });
    }
    k.segs(nodes.flatMap((a, i) => nodes.slice(i + 1).flatMap((b) => [a.p, b.p])), INK, 0.08);
    const key = k.edges(new THREE.OctahedronGeometry(0.34), INK, 0.8);
    k.label("validator key", [0, -0.62, 0]);
    const beacon = k.box(1.3, 0.24, 0.5, INK, 0.6); beacon.position.set(0, 2.3, 0);
    k.label("beacon node", [0.8, 2.3, 0], "right");
    k.segs([[0, 0.4, 0], [0, 2.15, 0]], INK, 0.08);
    const stage = k.label("", null, "corner");
    k.frame((dt) => (key.rotation.y += dt * 0.6));
    const duty = () => {
      const down = k.rnd() < 0.55 ? Math.floor(k.rnd() * N) : -1;
      nodes.forEach((n, i) => { n.b.material.color.setHex(i === down ? DEL : INK); n.b.material.opacity = i === down ? 0.9 : 0.7; });
      const live = nodes.filter((_, i) => i !== down);
      stage.set(down >= 0 ? `consensus · charon ${down + 1} down` : "consensus on the duty");
      for (const r of [0, 0.6]) k.after(r, () => { for (const a of live) for (const b of live) if (a !== b) k.comet(k.arc(a.p, b.p, 0.3, 24), { color: REQ, dur: 0.5, len: 0.5, r: 0.03 }); });
      k.after(1.5, () => {
        let got = 0;
        stage.set("partial signatures 0/3");
        live.forEach((n, i) => k.after(i * 0.12, () => k.comet(k.arc(n.p, [0, 0, 0], 0.5, 30), { color: USR, dur: 0.7, arrive: () => {
          got++; stage.set(`partial signatures ${Math.min(got, 3)}/3`);
          if (got === 3) { flash(k, key, ADD, INK); stage.set("threshold met · aggregate"); k.comet(k.path([[0, 0.3, 0], [0, 2.15, 0]], 20), { color: ADD, dur: 0.6, arrive: () => flash(k, beacon, ADD, INK) }); }
        } })));
      });
    };
    k.every(4.4, duty);
    k.orbit([0, 0.8, 0], 7.4, 10, 24, 14);
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

  // thesis defenses: blocks drop into free (day, slot, room) cells; a clash with the jury moves them on
  dei(k) {
    const D = 5, S = 4, Rm = 3, c = 0.62, ox = -((D - 1) * c) / 2, oz = -((Rm - 1) * c) / 2;
    const cell = (d, s, r) => [ox + d * c, s * c, oz + r * c];
    const lat = [];
    for (let d = 0; d <= D; d++) for (let r = 0; r <= Rm; r++) lat.push([ox - c / 2 + d * c, -c / 2, oz - c / 2 + r * c], [ox - c / 2 + d * c, S * c - c / 2, oz - c / 2 + r * c]);
    for (let s = 0; s <= S; s++) for (let r = 0; r <= Rm; r++) lat.push([ox - c / 2, s * c - c / 2, oz - c / 2 + r * c], [ox - c / 2 + D * c, s * c - c / 2, oz - c / 2 + r * c]);
    k.segs(lat, INK, 0.07);
    ["mon", "tue", "wed", "thu", "fri"].forEach((d, i) => k.label(d, [ox + i * c, -0.62, oz + Rm * c - 0.2]));
    k.label("rooms", [ox + D * c - 0.1, -0.5, oz - 0.3]);
    k.label("slots", [ox - c, S * c - 0.3, oz + Rm * c - 0.3]);
    const stage = k.label("", null, "corner");
    let taken = new Map(), clashes = 0;
    const free = () => { const out = []; for (let d = 0; d < D; d++) for (let s = 0; s < S; s++) for (let r = 0; r < Rm; r++) if (!taken.has(`${d},${s},${r}`)) out.push([d, s, r]); return out; };
    k.every(0.65, () => {
      const f = free();
      if (f.length < D * S * Rm * 0.3) {
        for (const b of taken.values()) fade(k, b, b.material.opacity, 0, 0.5);
        const old = taken; taken = new Map(); clashes = 0;
        k.after(0.55, () => old.forEach((b) => k.drop(b)));
        return;
      }
      const pick = () => f[Math.floor(k.rnd() * f.length)];
      let target = pick();
      const place = () => {
        const b = k.box(c * 0.82, c * 0.82, c * 0.82, ADD, 0.95), p = cell(...target);
        taken.set(target.join(), b);
        k.tween(0.5, (e) => b.position.set(p[0], p[1] + (1 - ease(e)) * 1.6, p[2]), () => k.after(0.3, () => { b.material.color.setHex(INK); b.material.opacity = 0.55; }));
        stage.set(`defenses ${taken.size} · jury clashes ${clashes}`);
      };
      if (k.rnd() < 0.28) {
        clashes++;
        const ghost = k.box(c * 0.82, c * 0.82, c * 0.82, DEL, 0.9); ghost.position.set(...cell(...target));
        fade(k, ghost, 0.9, 0, 0.6);
        k.after(0.6, () => k.drop(ghost));
        target = pick(); k.after(0.35, place);
      } else place();
    });
    k.orbit([0, 0.8, 0], 7.6, -24, 24, 10);
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

  // precision agriculture: a contour map of the terrain, farm zones outlined on it, the map panning
  spinworks(k) {
    const rnd = k.rnd, waves = [...Array(5)].map(() => [rnd() * 1.4 + 0.3, rnd() * 1.4 + 0.3, rnd() * TAU, rnd() * 0.6 + 0.2]);
    const f = (x, z) => waves.reduce((s, [a, b, p, h]) => s + Math.sin(x * a + p) * Math.cos(z * b - p) * h, 0);
    const G = 70, size = 9, step = size / G, vals = [];
    for (let i = 0; i <= G; i++) { vals.push([]); for (let j = 0; j <= G; j++) vals[i].push(f(-size / 2 + i * step, -size / 2 + j * step)); }
    const flat = vals.flat(), lo = Math.min(...flat), hi = Math.max(...flat), H = (v) => ((v - lo) / (hi - lo)) * 0.9;
    const levels = 14;
    for (let l = 1; l < levels; l++) {
      const iso = lo + ((hi - lo) * l) / levels, segs = [];
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
        const v = [vals[i][j], vals[i + 1][j], vals[i + 1][j + 1], vals[i][j + 1]];
        const P = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], cross = [];
        for (let e = 0; e < 4; e++) {
          const a = v[e], b = v[(e + 1) % 4];
          if ((a < iso) !== (b < iso)) { const t = (iso - a) / (b - a), p = P[e], q = P[(e + 1) % 4]; cross.push([-size / 2 + (p[0] + (q[0] - p[0]) * t) * step, H(iso), -size / 2 + (p[1] + (q[1] - p[1]) * t) * step]); }
        }
        if (cross.length >= 2) segs.push(cross[0], cross[1]);
        if (cross.length === 4) segs.push(cross[2], cross[3]);
      }
      k.segs(segs, INK, 0.1 + (l / levels) * 0.28);
    }
    const zones = [...Array(6)].map((_, n) => {
      const cx = (rnd() - 0.5) * 6, cz = (rnd() - 0.5) * 6, w = 0.8 + rnd() * 0.9, d = 0.6 + rnd() * 0.8, a = rnd() * Math.PI;
      const corner = (u, v) => { const x = cx + Math.cos(a) * u - Math.sin(a) * v, z = cz + Math.sin(a) * u + Math.cos(a) * v; return [x, H(f(x, z)) + 0.02, z]; };
      const pts = [];
      for (const [u0, v0, u1, v1] of [[-w, -d, w, -d], [w, -d, w, d], [w, d, -w, d], [-w, d, -w, -d]]) for (let s = 0; s < 10; s++) pts.push(corner(u0 + ((u1 - u0) * s) / 10, v0 + ((v1 - v0) * s) / 10));
      const loop = k.loop(pts, ADD, 0.6);
      const ha = (w * d * 4 * 2.5).toFixed(1);
      return { loop, c: [cx, H(f(cx, cz)) + 0.25, cz], text: `zone ${n + 1} · ${ha} ha · ndvi 0.${50 + Math.floor(rnd() * 40)}` };
    });
    const tag = k.label("", [0, 0, 0], "usr");
    let z = 0;
    k.every(2.2, () => {
      zones.forEach((q) => { q.loop.material.color.setHex(ADD); q.loop.material.opacity = 0.6; });
      const q = zones[z++ % zones.length];
      q.loop.material.color.setHex(USR); q.loop.material.opacity = 1;
      tag.pos.set(...q.c); tag.set(q.text);
    });
    // the map pans slowly, like someone exploring it
    k.orbit([0, 0.3, 0], 7.2, 0, 50, 8, 0.05);
    k.frame((dt, now) => k.target.set(Math.sin(now * 0.11) * 1.5, 0.3, Math.cos(now * 0.07) * 1.1));
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

  // QBFT: pre-prepare from the leader, prepare and commit all-to-all, then every node appends the block
  qbft(k) {
    const N = 4, R = 1.9, nodes = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU, p = [Math.cos(a) * R, 0, Math.sin(a) * R];
      k.box(0.5, 0.22, 0.5, INK, 0.6).position.set(...p);
      k.label(`v${i + 1}`, [p[0], -0.4, p[2]]);
      nodes.push({ p, chain: [] });
    }
    const lead = k.loop(k.circle(0.45, 40), USR, 0.95); lead.position.y = -0.12;
    const stage = k.label("", null, "corner");
    let round = 0, height = 0;
    const all = (color, t) => { for (const a of nodes) for (const b of nodes) if (a !== b) k.comet(k.arc(a.p, b.p, 0.35, 24), { color, dur: 0.5, len: 0.5, r: 0.03 }); };
    k.every(3.3, () => {
      const L = nodes[round % N], from = lead.position.clone();
      k.tween(0.3, (e) => lead.position.set(from.x + (L.p[0] - from.x) * e, -0.12, from.z + (L.p[2] - from.z) * e));
      stage.set(`height ${height} · round ${round} · PRE-PREPARE`);
      for (const b of nodes) if (b !== L) k.comet(k.arc(L.p, b.p, 0.5, 24), { color: USR, dur: 0.55, len: 0.5, r: 0.035 });
      k.after(0.8, () => { stage.set(`height ${height} · PREPARE`); all(REQ); });
      k.after(1.6, () => { stage.set(`height ${height} · COMMIT`); all(ADD); });
      k.after(2.4, () => {
        stage.set(`height ${++height} · block decided`);
        for (const n of nodes) {
          const b = k.box(0.3, 0.3, 0.3, ADD, 0.95), y = 0.36 + n.chain.length * 0.36;
          b.position.set(n.p[0], y + 0.8, n.p[2]); n.chain.push(b);
          k.tween(0.35, (e) => (b.position.y = y + 0.8 * (1 - e)), () => k.after(0.3, () => { b.material.color.setHex(INK); b.material.opacity = 0.6; }));
          if (n.chain.length > 5) { k.drop(n.chain.shift()); n.chain.forEach((x, j) => (x.position.y = 0.36 + j * 0.36)); }
        }
      });
      round++;
    }, 0.4);
    k.orbit([0, 0.6, 0], 7.8, 20, 24, 14);
  },

  // multi-paxos bank: the leader gets each operation accepted in a log slot, then the balance moves
  paxos(k) {
    const tier = (x, n, label, c = INK) => { const out = [...Array(n).keys()].map((i) => { const p = [x, 0, (i - (n - 1) / 2) * 1.0]; const b = k.box(0.42, 0.42, 0.42, c, 0.6); b.position.set(...p); return { p, b }; }); k.label(label, [x, -0.55, ((n - 1) / 2) * 1.0 + 0.3]); return out; };
    const clients = tier(-2.6, 2, "clients"), bank = tier(-0.5, 3, "bank"), acc = tier(1.8, 3, "paxos");
    const slots = [...Array(8).keys()].map((i) => { const b = k.box(0.34, 0.34, 0.06, INK, 0.25); b.position.set(-1.3 + i * 0.42, 1.55, 0); return b; });
    k.label("log", [-1.85, 1.55, 0]);
    const opTag = k.label("", [0, 0, 0], "add"), stage = k.label("", null, "corner");
    let leader = 0, ballot = 1, slot = 0, balance = 100;
    const mark = () => bank.forEach((b, i) => { b.b.material.color.setHex(i === leader ? USR : INK); b.b.material.opacity = i === leader ? 0.95 : 0.6; });
    mark();
    const request = () => {
      const c = clients[Math.floor(k.rnd() * 2)], L = bank[leader], amt = [20, -5, 50, -15, 10][Math.floor(k.rnd() * 5)];
      stage.set(`leader b${leader + 1} · ballot ${ballot} · balance ${balance} €`);
      k.comet(k.arc(c.p, L.p, 0.5, 24), { color: REQ, dur: 0.45, arrive: () => {
        let ok = 0;
        for (const a of acc) k.comet(k.arc(L.p, a.p, 0.45, 24), { color: USR, dur: 0.4, len: 0.5, r: 0.03, arrive: () => k.comet(k.arc(a.p, L.p, -0.3, 24), { color: ADD, dur: 0.4, len: 0.5, r: 0.03, arrive: () => {
          if (++ok !== 2) return;
          const s = slots[slot % 8];
          if (slot % 8 === 0) slots.forEach((x) => { x.material.opacity = 0.25; x.material.color.setHex(INK); });
          s.material.color.setHex(ADD); s.material.opacity = 0.95;
          opTag.pos.set(s.position.x, 1.95, 0); opTag.set(`${amt > 0 ? "+" : ""}${amt}`);
          balance += amt; slot++;
          stage.set(`leader b${leader + 1} · ballot ${ballot} · balance ${balance} €`);
          k.comet(k.arc(L.p, c.p, -0.4, 24), { color: INK, dur: 0.4, r: 0.03 });
        } }) });
      } });
    };
    k.every(1.5, request);
    k.every(11, () => {
      const old = leader; bank[old].b.material.color.setHex(DEL);
      leader = (leader + 1) % 3; ballot++;
      stage.set(`b${old + 1} down · b${leader + 1} prepares ballot ${ballot}`);
      for (const a of acc) k.comet(k.arc(bank[leader].p, a.p, 0.8, 24), { color: VIO, dur: 0.5, len: 0.5, r: 0.03, arrive: () => k.comet(k.arc(a.p, bank[leader].p, -0.5, 24), { color: VIO, dur: 0.45, len: 0.5, r: 0.03 }) });
      k.after(1.2, mark);
    }, 8);
    k.orbit([-0.3, 0.5, 0], 7.6, 18, 22, 10);
  },

  // GKE: traffic rises, the horizontal pod autoscaler adds pods, traffic falls, pods go away
  gke(k) {
    k.box(4.4, 1.2, 2.4, INK, 0.12).position.set(0.5, 0, 0);
    k.label("gke cluster", [0.5, -0.85, 1.2]);
    const nodes = [-0.9, 0.5, 1.9].map((x, i) => { k.box(1.2, 0.8, 2.0, INK, 0.35).position.set(x, 0, 0); k.label(`node ${i + 1}`, [x, 0.6, -1.0]); return x; });
    const slots = nodes.flatMap((x) => [0, 1].flatMap((i) => [0, 1, 2].map((j) => [x - 0.25 + i * 0.5, 0, -0.6 + j * 0.6])));
    const ingress = [-2.7, 0, 0];
    k.box(0.4, 0.4, 0.4, REQ, 0.8).position.set(...ingress); k.label("ingress", [-2.7, -0.5, 0]);
    const pods = new Map();
    const spark = [...Array(60)].map(() => 0.2), sparkLine = k.line(spark.map((v, i) => [-2.2 + i * 0.08, 1.2 + v, -1.3]), REQ, 0.7);
    k.segs([[-2.2, 1.2, -1.3], [2.6, 1.2, -1.3]], INK, 0.2);
    k.label("cpu", [-2.45, 1.3, -1.3]);
    const stat = k.label("", null, "corner");
    let load = 0.2, t = 0;
    const want = () => Math.max(2, Math.min(slots.length, Math.round(load * 18)));
    k.every(0.12, () => {
      t += 0.12;
      load = Math.max(0.08, Math.min(0.95, 0.45 + Math.sin(t * 0.35) * 0.35 + Math.sin(t * 1.7) * 0.06));
      spark.shift(); spark.push(load * 0.9);
      sparkLine.geometry.attributes.position.array.set(spark.flatMap((v, i) => [-2.2 + i * 0.08, 1.2 + v, -1.3]));
      sparkLine.geometry.attributes.position.needsUpdate = true;
      if (k.rnd() < load * 0.8 && pods.size) {
        const keys = [...pods.keys()], p = slots[keys[Math.floor(k.rnd() * keys.length)]];
        k.comet(k.arc(ingress, p, 0.6, 24), { color: REQ, dur: 0.4, len: 0.5, r: 0.025 });
      }
    });
    k.every(0.5, () => {
      const n = want();
      if (pods.size < n) {
        const i = slots.findIndex((_, j) => !pods.has(j)), b = k.box(0.3, 0.3, 0.3, ADD, 0.95);
        b.position.set(...slots[i]); pods.set(i, b);
        k.tween(0.3, (e) => b.scale.setScalar(Math.max(0.01, e)), () => k.after(0.4, () => { b.material.color.setHex(INK); b.material.opacity = 0.7; }));
      } else if (pods.size > n) {
        const i = [...pods.keys()].at(-1), b = pods.get(i); pods.delete(i);
        b.material.color.setHex(DEL); fade(k, b, 0.9, 0, 0.4); k.after(0.45, () => k.drop(b));
      }
      stat.set(`hpa · cpu ${Math.round(load * 100)}% · pods ${pods.size}`);
    });
    k.orbit([0, 0.3, 0], 7.6, 18, 26, 10);
  },

  // EC2 workers instrumented with Javassist: each request is priced in instructions, sent to the
  // least-loaded worker; small ones go to Lambda when the workers are busy; the fleet scales
  aws(k) {
    const src = [-3, 0, 0], lb = [-1.3, 0, 0], lam = [1.3, 1.6, 0];
    k.box(0.5, 0.5, 0.5, USR, 0.9).position.set(...lb); k.label("load balancer", [-1.3, -0.55, 0]);
    k.loop([...Array(6).keys()].map((i) => { const a = (i / 6) * TAU; return [lam[0] + Math.cos(a) * 0.3, lam[1] + Math.sin(a) * 0.3, 0]; }), VIO, 0.9);
    k.label("lambda", [lam[0] + 0.45, lam[1], 0], "right");
    k.label("clients", [-3, -0.4, 0]);
    const zs = [-1.6, -0.8, 0, 0.8, 1.6], workers = [];
    const spawn = (z) => {
      const g = k.group(); g.position.set(1.3, 0, z);
      const b = k.box(0.5, 0.5, 0.5, ADD, 0.9, g), bar = k.solid(0.08, 1, 0.08, REQ, 0.8, g);
      bar.position.set(0.42, -0.25, 0); bar.scale.y = 0.001;
      k.after(0.6, () => b.material.color.setHex(INK));
      const w = { g, b, bar, z, load: 0 }; workers.push(w); return w;
    };
    spawn(-0.8); spawn(0.8);
    const cost = k.label("", [0, 0, 0], "usr"), stat = k.label("", null, "corner");
    k.every(0.38, () => {
      const c = 0.08 + k.rnd() ** 2 * 0.5, min = workers.reduce((a, b) => (b.load < a.load ? b : a));
      k.comet(k.path([src, lb], 14), { color: INK, dur: 0.3, len: 0.5, r: 0.02 + c * 0.06, arrive: () => {
        cost.pos.set(-1.3, 0.5, 0); cost.set(`≈ ${(c * 6).toFixed(1)}M instr`);
        if (min.load > 0.7 && c < 0.18) return k.comet(k.arc(lb, lam, 0.6, 24), { color: VIO, dur: 0.45, r: 0.03 });
        k.comet(k.arc(lb, min.g.position.toArray(), 0.4, 24), { color: REQ, dur: 0.4, r: 0.02 + c * 0.06, arrive: () => (min.load = Math.min(1, min.load + c)) });
      } });
    });
    k.frame((dt) => { for (const w of workers) { w.load = Math.max(0, w.load - dt * 0.12); w.bar.scale.y = Math.max(0.001, w.load); w.bar.position.y = -0.25 + w.load / 2; } });
    k.every(1, () => {
      const avg = workers.reduce((s, w) => s + w.load, 0) / workers.length;
      if (avg > 0.55 && workers.length < zs.length) { const z = zs.find((z) => !workers.some((w) => w.z === z)); spawn(z); stat.set(`scale out · ${workers.length} workers`); return; }
      if (avg < 0.12 && workers.length > 2) { const w = workers.pop(); w.b.material.color.setHex(DEL); k.after(0.4, () => k.drop(w.g)); stat.set(`scale in · ${workers.length} workers`); return; }
      stat.set(`${workers.length} workers · avg load ${Math.round(avg * 100)}%`);
    });
    k.orbit([-0.4, 0.3, 0], 7.6, 16, 24, 10);
  },

  // 2FA broker: a time-based code is checked, then a JWT is put together and sent to the broker
  "2fa"(k) {
    const D = [-1.5, 0.4, 0], P = 1.5;
    k.loop(k.circle(0.95, 96, "xy", D), INK, 0.35);
    k.segs([...Array(30).keys()].flatMap((i) => { const a = (i / 30) * TAU + Math.PI / 2, r0 = i % 5 ? 1.02 : 1.08; return [[D[0] + Math.cos(a) * r0, D[1] + Math.sin(a) * r0, 0], [D[0] + Math.cos(a) * 1.15, D[1] + Math.sin(a) * 1.15, 0]]; }), INK, 0.4);
    const sweep = k.line([...Array(61).keys()].map((i) => { const a = Math.PI / 2 - (i / 60) * TAU; return [D[0] + Math.cos(a) * 0.95, D[1] + Math.sin(a) * 0.95, 0]; }), USR, 0.95);
    const code = k.label("", D, "code"); k.label("totp · 30 s", [D[0], D[1] - 1.45, 0]);
    const parts = [["header", REQ, "eyJhbGciOiJIUzI1NiJ9"], ["payload", VIO, "eyJzdWIiOiJkaW9nbyJ9"], ["signature", ADD, "SflKxwRJSMeKKF2QT4f"]].map(([name, c, txt], i) => {
      const g = k.group(); k.box(1.5, 0.3, 0.04, c, 0.95, g);
      const y = 1.0 - i * 0.42;
      g.position.set(P + 3, y, 0);
      const l = k.label(txt.slice(0, 10) + "…", [0, 0, 0], "small").follow(g, [0, 0.27, 0]);
      return { g, y, l };
    });
    const broker = k.box(0.9, 0.5, 0.5, INK, 0.6); broker.position.set(P, -1.35, 0);
    k.label("broker", [P + 0.6, -1.35, 0], "right");
    const stage = k.label("", null, "corner");
    const PERIOD = 6.5;
    k.frame((dt, now) => { const left = 1 - ((now % PERIOD) / PERIOD); sweep.geometry.setDrawRange(0, Math.max(2, Math.round(left * 60) + 1)); });
    const cycle = () => {
      code.set(String(Math.floor(k.rnd() * 1e6)).padStart(6, "0").replace(/(\d{3})/, "$1 "));
      stage.set("password ✓ · waiting for code");
      parts.forEach((p) => { p.g.position.set(P + 3, p.y, 0); p.g.visible = false; p.l.on = false; });
      k.after(0.9, () => {
        stage.set("code ✓ · signing token");
        k.comet(k.arc([D[0] + 1.0, D[1], 0], [P - 0.8, 0.6, 0], 0.5, 24), { color: USR, dur: 0.5, arrive: () => parts.forEach((p, i) => k.after(i * 0.3, () => {
          p.g.visible = true; p.l.on = true;
          k.tween(0.45, (e) => p.g.position.set(P + 3 * (1 - ease(e)), p.y, 0));
        })) });
      });
      k.after(3.0, () => {
        stage.set("Authorization: Bearer eyJ…");
        parts.forEach((p) => { const y0 = p.y; p.l.on = false; k.tween(0.4, (e) => p.g.position.set(P, y0 + (0.58 - y0) * ease(e), 0)); });
        k.after(0.45, () => k.comet(k.path([[P, 0.4, 0], [P, -1.1, 0]], 16), { color: ADD, dur: 0.5, arrive: () => { flash(k, broker, ADD, INK); stage.set("200 OK · order placed"); } }));
      });
    };
    k.every(PERIOD, cycle);
    k.orbit([0, 0, 0], 7.4, 0, 8, 14);
  },
};

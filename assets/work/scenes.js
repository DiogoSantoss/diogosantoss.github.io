// The 13 scenes of the work gallery, one per job or project, in the site's line-art style.
// Each scene is a function that gets a kit (`k`) and builds into k.scene. It drives itself with
// k.every / k.after / k.tween / k.frame and moves messages with k.comet. Nothing here touches the DOM
// except through k.label; gallery.js owns the renderer, the camera aspect and the clock.
import * as THREE from "../vendor/three.js?v=0187b";

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
  // the MTA, a closed box, and its four entry points drawn as what they are: another MTA relays over SMTP (25),
  // a laptop's mail app submits over TLS (465), a terminal calls the REST API, and a Worker uses its binding.
  // The mail leaves for any provider's MX; each mailbox raises its flag when mail lands
  cloudflare(k) {
    const tint = (l, c) => ((l.el.style.color = "#" + c.toString(16).padStart(6, "0")), l);
    const rect = (x0, y0, x1, y1, c, o, p) => k.loop([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], c, o, p);
    const at = (x, y) => { const g = k.group(); g.position.set(x, y, 0); return g; };
    const X = -2.05;
    // relay: a rack server with blinking lights, another MTA
    const srv = at(X, 1.15), leds = [];
    rect(-0.32, -0.22, 0.32, 0.22, INK, 0.7, srv);
    for (const y of [-0.08, 0.08]) k.segs([[-0.32, y, 0], [0.32, y, 0]], INK, 0.35, srv);
    for (let i = 0; i < 3; i++) { const d = k.dot(0.025, ADD, srv, 0.9); d.position.set(0.22, -0.15 + i * 0.155, 0.01); leds.push(d); }
    for (let i = 0; i < 3; i++) k.segs([[-0.24, -0.15 + i * 0.155, 0], [0.05, -0.15 + i * 0.155, 0]], INK, 0.25, srv);
    k.label("mx.other.org", [X, 0.8, 0], "small");
    k.frame((dt, now) => leds.forEach((d, i) => (d.visible = Math.sin(now * (5 + i * 2.3) + i) > -0.3)));
    // submission: a laptop running a mail app, with a padlock for TLS
    const lap = at(X, 0.42);
    rect(-0.27, -0.06, 0.27, 0.28, INK, 0.7, lap);
    k.line([[-0.36, -0.14, 0], [0.36, -0.14, 0], [0.27, -0.06, 0], [-0.27, -0.06, 0], [-0.36, -0.14, 0]], INK, 0.6, lap);
    const icon = envelope(k, REQ); icon.scale.setScalar(0.42); icon.position.set(0, 0.11, 0.01); lap.add(icon);
    const lock = at(X + 0.5, 0.42), lockBody = rect(-0.06, -0.05, 0.06, 0.04, REQ, 0.9, lock);
    k.line([...Array(9).keys()].map((i) => { const a = (Math.PI * i) / 8; return [Math.cos(a) * 0.04, 0.04 + Math.sin(a) * 0.045, 0]; }), REQ, 0.9, lock);
    k.label("mail app · 465", [X, 0.1, 0], "small");
    // rest api: a terminal that types a request and prints the answer
    const term = at(X, -0.42);
    rect(-0.75, -0.27, 0.75, 0.27, INK, 0.7, term);
    k.segs([[-0.75, 0.17, 0], [0.75, 0.17, 0]], INK, 0.35, term);
    [0xff6b6b, 0xffd166, ADD].forEach((c, i) => { const d = k.dot(0.022, c, term, 0.9); d.position.set(-0.67 + i * 0.07, 0.22, 0.01); });
    // the text is drawn on the terminal's screen, so it turns with the terminal
    const cv = Object.assign(document.createElement("canvas"), { width: 576, height: 160 }), cx = cv.getContext("2d");
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = "srgb";
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    screen.position.set(0, -0.05, 0.01); term.add(screen);
    const tty = { set(t) {
      cx.clearRect(0, 0, cv.width, cv.height);
      cx.font = '500 40px "Spline Sans Mono", ui-monospace, monospace'; cx.fillStyle = "#e9ebee";
      t.split("\n").forEach((line, i) => cx.fillText(line, 16, 46 + i * 50));
      tex.needsUpdate = true;
    } };
    // binding: a Worker, a hexagon with its code beside it
    const wk = at(X, -1.2);
    const hex = k.loop([...Array(6).keys()].map((i) => { const a = (i / 6) * TAU + Math.PI / 6; return [Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0]; }), CF, 0.95, wk);
    k.segs([[-0.08, 0.08, 0], [-0.13, 0, 0], [-0.13, 0, 0], [-0.08, -0.08, 0], [0.08, 0.08, 0], [0.13, 0, 0], [0.13, 0, 0], [0.08, -0.08, 0], [0.03, 0.1, 0], [-0.03, -0.1, 0]], CF, 0.95, wk);
    const code = tint(k.label("env.EMAIL.send(msg)", [X, -1.5, 0], "small"), CF);
    // the MTA, and the mailboxes
    k.solid(0.9, 2.5, 0.8, 0x0b0c0e, 0.96);
    const edge = k.box(0.9, 2.5, 0.8, CF, 0.9);
    k.label("cloudflare mta", [0, 1.45, 0], "small");
    const boxes = ["gmail.com", "outlook.com", "icloud.com"].map((n, i) => {
      const g = at(2.2, 0.95 - i * 0.95), c = INK;
      k.line([[-0.2, 0, 0], [-0.2, 0.14, 0], ...[...Array(13).keys()].map((j) => { const a = Math.PI - (Math.PI * j) / 12; return [Math.cos(a) * 0.2, 0.14 + Math.sin(a) * 0.12, 0]; }), [0.2, 0, 0], [-0.2, 0, 0]], c, 0.7, g);
      k.segs([[0, 0, 0], [0, -0.32, 0], [-0.12, 0.08, 0.001], [0.06, 0.08, 0.001]], INK, 0.5, g);
      const flag = k.group(g); flag.position.set(0.2, 0.06, 0);
      k.line([[0, 0, 0], [0, 0.22, 0], [0.12, 0.22, 0], [0.12, 0.14, 0], [0, 0.14, 0]], DEL, 0.9, flag);
      flag.rotation.z = -Math.PI / 2;
      k.label(n, [2.2, g.position.y - 0.42, 0], "small");
      return { g, flag, p: [2.0, g.position.y + 0.12, 0] };
    });
    const raise = (b) => { k.tween(0.25, (e) => (b.flag.rotation.z = -Math.PI / 2 * (1 - e))); k.after(1.6, () => k.tween(0.3, (e) => (b.flag.rotation.z = (-Math.PI / 2) * e))); };
    const fly = (env, pts, dur, done) => k.tween(dur, (e) => env.position.set(...k.at(pts, ease(e))), done);
    const send = (from, color) => {
      const env = envelope(k, color); env.scale.setScalar(0.4);
      fly(env, k.arc(from, [-0.45, from[1] * 0.75, 0], 0.15, 30), 0.7, () => {
        env.visible = false; flash(k, edge, color === INK ? ADD : color, CF, 0.2);
        k.after(0.45, () => {
          const b = boxes[Math.floor(k.rnd() * boxes.length)];
          env.visible = true;
          fly(env, k.arc([0.45, b.p[1] * 0.75, 0], b.p, 0.2, 30), 0.75, () => { k.drop(env); raise(b); });
        });
      });
    };
    // relay: the two MTAs talk before the mail goes
    const say = [k.label("", [0, 0, 0], "small"), k.label("", [0, 0, 0], "small")];
    say.forEach((l) => (l.on = false));
    const relay = () => {
      const lines = [["EHLO", "250"], ["MAIL FROM", "250"], ["RCPT TO", "250"], ["DATA", "354"]];
      lines.forEach(([c, r], i) => k.after(i * 0.4, () => {
        say[0].set(c); say[0].pos.set(X + 0.75, 1.32, 0); say[0].on = true; say[0].el.style.color = "";
        k.after(0.2, () => { say[1].set(r); say[1].pos.set(-0.75, 1.0, 0); say[1].on = true; tint(say[1], CF); });
      }));
      k.after(1.7, () => { say[0].on = say[1].on = false; send([X + 0.32, 1.15, 0], INK); });
    };
    const submit = () => { flash(k, lockBody, ADD, REQ, 0.5); flash(k, icon.children[0], ADD, REQ, 0.4); k.after(0.3, () => send([X + 0.5, 0.42, 0], REQ)); };
    const api = () => {
      const cmd = "$ curl -X POST \\\n    …/sending/send";
      let n = 0;
      k.tween(1.3, (e) => { const m = Math.floor(e * cmd.length); if (m !== n) { n = m; tty.set(cmd.slice(0, n) + "▍"); } }, () => {
        tty.set(cmd);
        send([X + 0.75, -0.42, 0], VIO);
        k.after(1.0, () => tty.set(cmd + '\n{"success": true}'));
        k.after(2.6, () => tty.set("▍"));
      });
    };
    const bind = () => { flash(k, hex, ADD, CF, 0.4); code.el.style.opacity = "1"; send([X + 0.22, -1.2, 0], CF); };
    tty.set("▍");
    k.every(4.6, relay, 0.4);
    k.every(3.7, submit, 1.6);
    k.every(5.3, api, 2.4);
    k.every(2.9, bind, 0.9);
    k.orbit([0, 0, 0], 7.6, 0, 4, 3);
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
    let slot = 8_120_400;
    k.every(5.2, () => {
      slot += 1;
      const down = k.rnd() < 0.45 ? Math.floor(k.rnd() * N) : -1;
      ops.forEach((o, i) => Object.values(o.boxes).forEach((b) => (b.material.opacity = i === down ? 0.12 : b.material.color.getHex() === OBOL ? 0.95 : 0.5)));
      const live = ops.filter((_, i) => i !== down);
      for (const o of live) k.comet(k.path([o.at("beacon node"), o.at("charon")], 10), { color: INK, dur: 0.35, len: 0.6, r: 0.025 });
      k.after(0.5, () => { for (const a of live) for (const b of live) if (a !== b) k.comet(k.arc(a.at("charon"), b.at("charon"), 0.3, 24), { color: OBOL, dur: 0.5, len: 0.5, r: 0.028 }); });
      k.after(1.5, () => { for (const o of live) k.comet(k.path([o.at("charon"), o.at("validator client")], 10), { color: INK, dur: 0.3, len: 0.6, r: 0.025, arrive: () => { flash(k, o.share, ADD, USR, 0.4); k.comet(k.path([o.at("validator client"), o.at("charon")], 10), { color: USR, dur: 0.3, len: 0.6, r: 0.03 }); } }); });
      k.after(2.6, () => { for (const a of live) for (const b of live) if (a !== b) k.comet(k.arc(a.at("charon"), b.at("charon"), 0.45, 24), { color: USR, dur: 0.5, len: 0.5, r: 0.028 }); });
      k.after(3.5, () => {
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
    const JURY = [["advisor", REQ, 0.75], ["president", VIO, 1.25], ["jury", ADD, 1.75]];
    JURY.forEach(([name, color, y]) => { grid(y, color, 0.12); k.label(name, [ox + D * c + 0.1, y, oz], "right small"); });
    const booked = k.label("", [0, 0, 0], "usr");
    let tiles = [], n = 0;
    const defence = () => {
      tiles.forEach((t) => k.drop(t)); tiles = [];
      booked.on = false;
      // a slot everyone is free for, plus some free hours of their own
      const meet = [Math.floor(k.rnd() * D), Math.floor(k.rnd() * Hh)];
      const marks = JURY.map(() => { const m = new Set([meet.join()]); while (m.size < 9) m.add(`${Math.floor(k.rnd() * D)},${Math.floor(k.rnd() * Hh)}`); return [...m].sort(() => k.rnd() - 0.5); });
      JURY.forEach(([, color, y], j) => marks[j].forEach((m, i) => k.after(j * 0.9 + i * 0.09, () => {
        const [d, h] = m.split(",").map(Number), t = k.solid(c * 0.8, 0.02, c * 0.8, color, 0.0);
        t.position.set(...cell(d, h, y)); tiles.push(t); fade(k, t, 0, 0.55, 0.2);
      })));
      k.after(3.1, () => {
        const p = cell(meet[0], meet[1], 0);
        for (const [, , y] of JURY) k.comet(k.path([[p[0], y, p[2]], [p[0], 0.02, p[2]]], 12), { color: USR, dur: 0.45, len: 0.6, r: 0.03 });
        k.after(0.5, () => {
          const b = k.box(c * 0.86, 0.32, c * 0.86, USR, 0.95); b.position.set(p[0], 0.16, p[2]); tiles.push(b);
          booked.pos.set(p[0], 0.55, p[2]); booked.on = true;
          booked.set(`${["mon", "tue", "wed", "thu", "fri"][meet[0]]} ${9 + meet[1]}:00 · room ${["0.19", "1.38", "EA2"][n % 3]}`);
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

  // Mapp.it: a map like Google Maps, with the farmer as a blue dot. The layers menu changes what the map shows:
  // the base map, satellite, NDVI per parcel, or soil moisture. A cursor picks a layer, then reads a parcel
  spinworks(k) {
    const MW = 7.4, MH = 5.4, NX = 148, NZ = 108, GB = 0x4285f4;
    const road = (x) => -0.25 + 0.15 * Math.sin(x * 0.8), road2 = (z) => 1.2 + 0.12 * Math.sin(z * 1.4), river = (z) => -2.45 + 0.3 * Math.sin(z * 1.3 + 0.5);
    const village = (x, z) => x > 1.45 && x < 3.3 && z > -2.3 && z < -0.55;
    const parcels = [];
    for (const [x0, x1] of [[-1.95, -0.75], [-0.65, 0.3], [0.4, 1.0], [1.45, 2.4], [2.5, 3.3]]) {
      for (const [z0, z1] of [[-2.3, -1.4], [-1.3, -0.6], [0.1, 1.1], [1.2, 2.3]]) {
        if (village(x0 + 0.01, z0 + 0.01)) continue;
        const j = () => (k.rnd() - 0.5) * 0.1, q = [[x0 + j(), z0 + j()], [x1 + j(), z0 + j()], [x1 + j(), z1 + j()], [x0 + j(), z1 + j()]];
        const ha = Math.abs(q.reduce((s, [x, z], i) => { const [x2, z2] = q[(i + 1) % 4]; return s + x * z2 - x2 * z; }, 0)) / 2;
        parcels.push({ q, ha, rows: k.rnd() < 0.5, vig: 0.2 + 0.7 * k.rnd(), wet: k.rnd(), crop: ["vineyard", "maize", "olive grove", "wheat"][Math.floor(k.rnd() * 4)], c: [(x0 + x1) / 2, (z0 + z1) / 2] });
      }
    }
    const inPoly = (q, x, z) => { let ins = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, zi] = q[i], [xj, zj] = q[j]; if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) ins = !ins; } return ins; };
    const noise = (x, z) => 0.5 + 0.3 * Math.sin(x * 6.1 + z * 3.7) * Math.sin(z * 5.3 - x * 2.9) + 0.15 * Math.sin(x * 11 + z * 9);
    const ramp3 = (a, b, c, t) => (t < 0.5 ? a.map((v, i) => v + (b[i] - v) * t * 2) : b.map((v, i) => v + (c[i] - v) * (t - 0.5) * 2));
    const clamp = (t) => Math.min(1, Math.max(0, t));
    const LAYERS = ["map", "satellite", "ndvi", "soil moisture"];
    const LEGEND = ["mapp.it · 39.25 N 8.58 W", "sentinel-2 · 10 m · 12 nov", "ndvi · red low → green high", "soil moisture · orange dry → blue wet"];
    const colorAt = (layer, x, z) => {
      const dr = Math.min(Math.abs(z - road(x)), Math.abs(x - road2(z))), water = Math.abs(x - river(z)) < 0.11;
      const p = parcels.find((p) => inPoly(p.q, x, z)), n = noise(x, z);
      if (layer === 1) {
        if (water) return [0.08, 0.14, 0.16];
        if (dr < 0.05) return [0.45, 0.43, 0.4];
        if (village(x, z)) return [0.34 + 0.12 * n, 0.3 + 0.1 * n, 0.27];
        if (p) { const r = 0.5 + 0.5 * Math.sin((p.rows ? x : z) * 15); return [0.27 + 0.1 * n - 0.1 * p.vig * r, 0.24 + 0.2 * p.vig * r + 0.05 * n, 0.14]; }
        return [0.24 + 0.08 * n, 0.22 + 0.07 * n, 0.15];
      }
      if (water) return [0.14, 0.24, 0.36];
      if (dr < 0.05) return [0.3, 0.31, 0.33];
      if (village(x, z)) return [0.15, 0.15, 0.16];
      if (!p) return [0.09, 0.1, 0.11];
      if (layer === 2) return ramp3([0.85, 0.28, 0.22], [0.9, 0.8, 0.32], [0.3, 0.75, 0.38], clamp(p.vig + (n - 0.5) * 0.35));
      if (layer === 3) return ramp3([0.92, 0.52, 0.2], [0.75, 0.72, 0.56], [0.28, 0.56, 0.95], clamp(p.wet + (noise(z, x) - 0.5) * 0.4));
      return [0.12, 0.17, 0.13];
    };
    // the map itself: one colour per vertex for each layer; a layer switch blends between them
    const geo = new THREE.PlaneGeometry(MW, MH, NX, NZ); geo.rotateX(-Math.PI / 2);
    const P = geo.attributes.position;
    const cols = LAYERS.map((_, l) => { const a = new Float32Array(P.count * 3); for (let i = 0; i < P.count; i++) a.set(colorAt(l, P.getX(i), P.getZ(i)).map((v) => v ** 2.2), i * 3); return a; });
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cols[0], 3));
    const C = geo.attributes.color.array;
    k.scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true })));
    let layer = 0;
    const setLayer = (i) => { const from = C.slice(), to = cols[i]; layer = i; k.tween(0.6, (e) => { for (let j = 0; j < C.length; j++) C[j] = from[j] + (to[j] - from[j]) * e; geo.attributes.color.needsUpdate = true; }); };
    // roads, river banks, parcel edges and houses drawn over it
    const Y = 0.01, X0 = -MW / 2, X1 = MW / 2, Z0 = -MH / 2, Z1 = MH / 2, along = (f, a, b, n = 60) => [...Array(n + 1).keys()].map((i) => a + ((b - a) * i) / n).map(f);
    for (const d of [-0.05, 0.05]) {
      k.line(along((x) => [x, Y, road(x) + d], X0, X1), INK, 0.45);
      k.line(along((z) => [road2(z) + d, Y, z], Z0, Z1), INK, 0.45);
      k.line(along((z) => [river(z) + d * 2.2, Y, z], Z0, Z1), REQ, 0.35);
    }
    for (const p of parcels) k.loop(p.q.map(([x, z]) => [x, Y, z]), INK, 0.2);
    for (let i = 0; i < 16; i++) { const w = 0.12 + k.rnd() * 0.14, d = 0.1 + k.rnd() * 0.12; k.box(w, 0.04, d, INK, 0.3).position.set(1.6 + k.rnd() * 1.55, 0.02, -2.15 + k.rnd() * 1.4); }
    k.label("N118", [-1.3, 0, road(-1.3) - 0.16], "small");
    k.label("Alpiarça", [2.4, 0, -1.45], "small");
    k.label("rio Tejo", [river(1.7) + 0.42, 0, 1.7], "small");
    // the farmer: blue dot, accuracy circle and heading cone, walking along the road and down the track
    const you = k.group();
    const flat = (g, c, o, y) => { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; you.add(m); return m; };
    const acc = flat(new THREE.CircleGeometry(0.38, 40), GB, 0.16, 0.02);
    flat(new THREE.CircleGeometry(0.46, 16, Math.PI / 2 - 0.45, 0.9), GB, 0.3, 0.025);
    flat(new THREE.CircleGeometry(0.1, 24), 0xffffff, 1, 0.03);
    flat(new THREE.CircleGeometry(0.075, 24), GB, 1, 0.035);
    const walk = k.path([...along((x) => [x, 0, road(x) + 0.12], -1.7, road2(road(1.0)) - 0.12, 30), ...along((z) => [road2(z) - 0.12, 0, z], road(1.0) + 0.12, 1.9, 20)], 300);
    k.frame((dt, now) => {
      const u = (now * 0.035) % 2, e = u < 1 ? u : 2 - u, i = Math.min(walk.length - 2, Math.floor(e * (walk.length - 1)));
      const p = k.at(walk, e), dir = u < 1 ? 1 : -1, dx = (walk[i + 1][0] - walk[i][0]) * dir, dz = (walk[i + 1][2] - walk[i][2]) * dir;
      you.position.set(p[0], 0, p[2]);
      you.rotation.y += (((Math.atan2(-dx, -dz) - you.rotation.y + 3 * Math.PI) % TAU) - Math.PI) * Math.min(1, dt * 5);
      acc.scale.setScalar(1 + 0.12 * Math.sin(now * 2.4));
    });
    // the layers menu and the cursor are HTML on top of the view, like the real app's controls
    const panel = k.label("", null, "layers");
    const items = LAYERS.map((n) => { const d = document.createElement("div"); d.textContent = n; panel.el.append(d); return d; });
    const mark = (i) => items.forEach((d, j) => d.classList.toggle("on", i === j));
    mark(0);
    const legend = k.label(LEGEND[0], null, "corner2");
    const cur = k.label("", null, "cur");
    cur.el.innerHTML = '<svg width="13" height="19" viewBox="0 0 13 19"><path d="M1 1v15l3.6-3.4 2.4 5.4 2.6-1.1-2.4-5.3H12z" fill="#0b0c0e" stroke="#e9ebee" stroke-width="1.2" stroke-linejoin="round"/></svg><div class="tip"></div>';
    const tip = cur.el.querySelector(".tip"), v3 = new THREE.Vector3();
    const box = () => cur.el.parentElement.getBoundingClientRect();
    const onMap = (p) => () => { v3.set(p[0], 0, p[1]).project(k.camera); const r = box(); return [((v3.x + 1) / 2) * r.width, ((1 - v3.y) / 2) * r.height]; };
    const onItem = (i) => () => { const r = box(), b = items[i].getBoundingClientRect(); return [b.left - r.left + 18, b.top - r.top + b.height / 2]; };
    const at = [90, 120];
    let follow = null;
    const moveTo = (fn, dur, done) => {
      const from = [...at]; follow = null;
      k.tween(dur, (e) => { const t = fn(), u = ease(e); at[0] = from[0] + (t[0] - from[0]) * u; at[1] = from[1] + (t[1] - from[1]) * u; }, () => { follow = fn; done?.(); });
    };
    const click = () => { cur.el.classList.add("click"); k.after(0.15, () => cur.el.classList.remove("click")); };
    k.frame(() => { if (follow) [at[0], at[1]] = follow(); cur.el.style.left = `${at[0]}px`; cur.el.style.top = `${at[1]}px`; });
    const info = (l, p) => [`${p.crop} · ${(p.ha * 10).toFixed(1)} ha`, `${p.crop} · cloud-free`, `ndvi ${(0.2 + 0.7 * p.vig).toFixed(2)} · ${p.vig < 0.4 ? "weak" : p.vig > 0.7 ? "strong" : "normal"}`, `${Math.round(12 + 30 * p.wet)}% · ${p.wet < 0.35 ? "dry, irrigate" : p.wet > 0.65 ? "wet" : "ok"}`][l];
    k.every(6.5, () => {
      const next = (layer + 1) % LAYERS.length;
      tip.textContent = "";
      moveTo(onItem(next), 1.0, () => {
        click(); mark(next); setLayer(next); legend.set(LEGEND[next]);
        k.after(0.8, () => {
          if (next === 0) return moveTo(() => onMap([you.position.x, you.position.z])(), 1.1, () => (tip.textContent = "you · ±5 m"));
          const p = parcels[Math.floor(k.rnd() * parcels.length)];
          moveTo(onMap(p.c), 1.1, () => (tip.textContent = info(next, p)));
        });
      });
    }, 1);
    k.orbit([0.15, 0, 0.1], 7.6, 0, 60, 4, 0.08);
  },

  // consistent hashing: servers own arcs of the ring; a new server takes only its share of keys
  ring(k) {
    const R = 2, colors = [REQ, ADD, VIO, USR], VN = 6;
    k.loop(k.circle(R, 128), INK, 0.3);
    k.segs([...Array(64).keys()].flatMap((i) => { const a = (i / 64) * TAU, r0 = i % 8 ? R - 0.05 : R - 0.12; return [[Math.cos(a) * r0, 0, Math.sin(a) * r0], [Math.cos(a) * R, 0, Math.sin(a) * R]]; }), INK, 0.2);
    const vnodes = colors.map((c, s) => [...Array(VN)].map(() => ({ s, a: k.rnd() * TAU })));
    const ticks = vnodes.map((vs, s) => { const g = k.group(); for (const v of vs) { k.segs([[Math.cos(v.a) * (R - 0.02), 0, Math.sin(v.a) * (R - 0.02)], [Math.cos(v.a) * (R + 0.28), 0, Math.sin(v.a) * (R + 0.28)]], colors[s], 0.95, g); const d = k.dot(0.05, colors[s], g); d.position.set(Math.cos(v.a) * (R + 0.3), 0, Math.sin(v.a) * (R + 0.3)); } return g; });
    const keys = [...Array(40)].map(() => { const a = k.rnd() * TAU, d = k.dot(0.035, INK); d.position.set(Math.cos(a) * (R - 0.35), 0, Math.sin(a) * (R - 0.35)); return { a, d, owner: -1, link: null }; });
    const stat = k.label("", null, "corner2");
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

  // Gmail Alias Sender: mail to me@diogoms.com reaches Gmail through Email Routing. The extension adds an
  // orange button to the reply; its Rust core builds the reply and sends it through the Email Sending API,
  // from the alias and in the same thread, and a copy comes back to Gmail
  mail(k) {
    const rect = (x0, y0, x1, y1, c, o, z = 0) => k.loop([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], c, o);
    // the browser window: tab bar, address, inbox list on the left, a reply on the right
    rect(-1.65, -1.2, 1.65, 1.2, INK, 0.55);
    k.segs([[-1.65, 0.95, 0], [1.65, 0.95, 0]], INK, 0.3);
    k.label("mail.google.com", [-0.8, 1.07, 0], "small");
    const rows = [...Array(6)].map((_, i) => { const y = 0.72 - i * 0.26; return k.segs([[-1.5, y, 0.01], [-0.35, y, 0.01]], INK, 0.25); });
    const unread = k.dot(0.04, ADD, null, 0.95); unread.position.set(-1.56, 0.72, 0.02); unread.visible = false;
    // the extension: its toolbar icon and the small part that does the work
    const icon = k.box(0.14, 0.14, 0.02, USR, 0.95); icon.position.set(1.45, 1.07, 0);
    const ext = k.box(1.1, 0.44, 0.04, USR, 0.85); ext.position.set(0.95, 0.55, 0);
    k.segs([[1.45, 1.0, 0], [1.45, 0.8, 0]], USR, 0.4);
    k.label("extension", [0.95, 0.63, 0.03], "small usr");
    k.label("rust core", [0.95, 0.46, 0.03], "small");
    // the reply, with Gmail's send button and the extension's orange one
    const compose = k.group(); compose.visible = false;
    const frame = rect(-0.2, -1.1, 1.55, 0.0, INK, 0.6, 0.01); compose.add(frame);
    const lines = [0.75, 1.3, 0.95].map((w, i) => { const l = k.segs([[0, 0, 0], [1, 0, 0]], INK, 0.5, compose); l.position.set(-0.05, -0.2 - i * 0.15, 0.02); l.scale.x = 0.001; return { l, w }; });
    const gsend = k.box(0.34, 0.15, 0.02, REQ, 0.7, compose); gsend.position.set(0.05, -0.95, 0.02);
    const orange = k.box(0.95, 0.15, 0.02, USR, 0.95, compose); orange.position.set(0.97, -0.95, 0.02); orange.visible = false;
    const btn = k.label("send as me@diogoms.com", [0.97, -0.72, 0.03], "small usr"); btn.on = false;
    const toast = k.label("sent as me@diogoms.com", [0, -1.36, 0.03], "small"); toast.on = false;
    // outside the browser: the other person, and Cloudflare
    const ALICE = [-2.35, 0.2, 0], CF_ = [2.35, 0.2, 0];
    k.box(0.4, 0.4, 0.4, INK, 0.6).position.set(...ALICE); k.label("alice", [ALICE[0], -0.15, 0], "small");
    k.box(0.5, 0.5, 0.5, CF, 0.9).position.set(...CF_); k.label("cloudflare", [CF_[0], -0.2, 0], "small");
    // an envelope with a note riding above it
    const note = k.label("", [0, 0, 0], "small"); note.on = false;
    const carry = (env, pts, dur, text, cls, done) => {
      note.set(text); note.el.className = `small ${cls}`; note.on = !!text;
      k.tween(dur, (e) => { const p = k.at(pts, ease(e)); env.position.set(...p); note.pos.set(p[0], p[1] + 0.24, p[2]); }, () => { note.on = false; done?.(); });
    };
    const env = (c) => { const g = envelope(k, c); g.scale.setScalar(0.42); return g; };
    // the visitor's cursor, an HTML arrow placed over a point of the scene
    const cur = k.label("", null, "cur");
    cur.el.innerHTML = '<svg width="13" height="19" viewBox="0 0 13 19"><path d="M1 1v15l3.6-3.4 2.4 5.4 2.6-1.1-2.4-5.3H12z" fill="#0b0c0e" stroke="#e9ebee" stroke-width="1.2" stroke-linejoin="round"/></svg>';
    const v3 = new THREE.Vector3(), aim = [-0.6, -0.5, 0], from = [...aim], to = [...aim];
    let t0 = -1, dur = 1;
    k.frame(() => {
      const e = t0 < 0 ? 1 : Math.min(1, (k.now - t0) / dur), u = ease(e);
      v3.set(...from.map((v, i) => v + (to[i] - v) * u)).project(k.camera);
      const r = cur.el.parentElement.getBoundingClientRect();
      cur.el.style.left = `${((v3.x + 1) / 2) * r.width}px`; cur.el.style.top = `${((1 - v3.y) / 2) * r.height}px`;
    });
    const point = (p, d = 0.7) => { const e = t0 < 0 ? 1 : Math.min(1, (k.now - t0) / dur); for (let i = 0; i < 3; i++) from[i] += (to[i] - from[i]) * ease(e); to.splice(0, 3, ...p); t0 = k.now; dur = d; };
    const click = () => { cur.el.classList.add("click"); k.after(0.15, () => cur.el.classList.remove("click")); };
    const cycle = () => {
      compose.visible = false; orange.visible = false; btn.on = false; toast.on = false;
      lines.forEach((x) => (x.l.scale.x = 0.001));
      // 1. alice writes to the alias; Email Routing forwards it into Gmail
      const a = env(INK); a.position.set(...ALICE);
      carry(a, k.arc(ALICE, CF_, 1.5, 40), 1.1, "to: me@diogoms.com", "", () => carry(a, k.arc(CF_, [-0.9, 0.72, 0.03], 0.4, 30), 0.8, "email routing", "", () => {
        k.drop(a); unread.visible = true; flash(k, rows[0], ADD, INK, 0.6);
        // 2. open it and reply; the extension puts its button in the reply
        point([-0.9, 0.72, 0]);
        k.after(0.8, () => {
          click(); unread.visible = false; compose.visible = true;
          lines.forEach((x, i) => k.after(0.2 + i * 0.35, () => k.tween(0.35, (e) => (x.l.scale.x = Math.max(0.001, x.w * e)))));
          k.comet(k.path([[0.95, 0.33, 0.03], [0.97, -0.87, 0.03]], 20), { color: USR, dur: 0.5, r: 0.03, arrive: () => { orange.visible = true; btn.on = true; } });
          point([0.6, -0.55, 0]);
          // 3. click it: the page hands the draft to the extension
          k.after(1.6, () => {
            point([1.25, -0.97, 0], 0.5);
            k.after(0.6, () => {
              click(); flash(k, orange, ADD, USR, 0.3);
              const d = env(USR); d.position.set(0.97, -0.95, 0.05);
              carry(d, k.path([[0.97, -0.95, 0.05], [0.95, 0.55, 0.05]], 20), 0.6, "draft", "usr", () => {
                flash(k, ext, ADD, USR, 0.6);
                note.set("from the alias · same thread"); note.el.className = "small usr"; note.on = true; note.pos.set(0.95, 0.85, 0);
                // 4. the core sends it through the Email Sending API; Cloudflare delivers it, and a copy comes back
                k.after(0.9, () => carry(d, k.path([[0.95, 0.55, 0.05], CF_], 20), 0.6, "POST /send · api token", "usr", () => {
                  carry(d, k.arc(CF_, ALICE, 1.5, 40), 1.1, "from: me@diogoms.com", "usr", () => { k.drop(d); compose.visible = false; btn.on = false; toast.on = true; });
                  const c = env(INK); c.position.set(...CF_);
                  k.tween(0.9, (e) => c.position.set(...k.at(k.arc(CF_, [-0.9, 0.46, 0.03], -0.3, 30), ease(e))), () => { k.drop(c); flash(k, rows[1], ADD, INK, 0.6); });
                }));
              });
            });
          });
        });
      }));
    };
    k.every(11, cycle);
    k.orbit([0, 0.05, 0], 7.2, 0, 6, 2);
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
    const pool = [];
    let leader = 0, round = 0, height = 0, fee = 100, failed = false;
    const all = (color) => { for (const a of nodes) for (const b of nodes) if (a !== b && !a.dead && !b.dead) k.comet(k.arc(a.p, b.p, 0.35, 24), { color, dur: 0.5, len: 0.5, r: 0.028 }); };
    const instance = () => {
      const L = nodes[leader];
      for (const b of nodes) if (b !== L) k.comet(k.arc(L.p, b.p, 0.5, 24), { color: USR, dur: 0.5, len: 0.5, r: 0.034 });
      k.after(0.7, () => { all(REQ); });
      k.after(1.4, () => { all(ADD); });
      k.after(2.1, () => {
        fee += 3; 
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
      k.after(0.6, () => all(VIO));
      k.after(1.4, () => {
        round++; leader = (leader + 1) % N;
        const from = lead.position.clone(), to = nodes[leader].p;
        k.tween(0.4, (e) => lead.position.set(from.x + (to[0] - from.x) * e, -0.12, from.z + (to[2] - from.z) * e));
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
    const bal = k.label("", null, "corner2");
    let slot = 0, primary = 0, balance = 0, seq = 0, suspect = -1;
    const elect = () => {
      slot++;
      const cand = suspect === primary ? (primary + 1) % 3 : primary;
      for (const b of bank) for (const x of boney) k.comet(k.arc(b.p, x.p, 0.4, 24), { color: VIO, dur: 0.45, len: 0.5, r: 0.022 });
      const L = boney[0];
      k.after(0.6, () => { for (const x of boney.slice(1)) k.comet(k.arc(L.p, x.p, 0.3, 20), { color: VIO, dur: 0.35, len: 0.5, r: 0.022, arrive: () => k.comet(k.arc(x.p, L.p, -0.25, 20), { color: INK, dur: 0.3, len: 0.5, r: 0.02 }) }); });
      k.after(1.4, () => { for (const x of boney.slice(1)) k.comet(k.arc(L.p, x.p, 0.3, 20), { color: ADD, dur: 0.35, len: 0.5, r: 0.022 }); });
      k.after(2.0, () => {
        for (const x of boney) k.comet(k.arc(x.p, bank[cand].p, -0.4, 24), { color: ADD, dur: 0.4, len: 0.5, r: 0.022 });
        const changed = cand !== primary; primary = cand;
        bank.forEach((b, i) => b.b.material.color.setHex(i === suspect ? DEL : INK));
        const from = ring.position.clone(), to = bank[primary].p;
        k.tween(0.35, (e) => ring.position.set(from.x + (to[0] - from.x) * e, -0.2, from.z + (to[2] - from.z) * e));
        if (suspect >= 0 && changed) k.after(4, () => { bank[suspect].b.material.color.setHex(INK); suspect = -1; });
      });
    };
    const command = () => {
      const c = clients[Math.floor(k.rnd() * 2)], P = bank[primary];
      const op = k.rnd() < 0.65 ? ["D", [200, 50, 120][Math.floor(k.rnd() * 3)]] : ["W", [30, 80, 500][Math.floor(k.rnd() * 3)]];
      for (const b of bank) k.comet(k.arc(c.p, b.p, 0.45, 24), { color: REQ, dur: 0.4, len: 0.5, r: 0.024 });
      k.after(0.45, () => {
        const n = ++seq;
        const backups = bank.filter((_, i) => i !== primary);
        for (const b of backups) k.comet(k.arc(P.p, b.p, 0.3, 20), { color: USR, dur: 0.35, len: 0.5, r: 0.022, arrive: () => k.comet(k.arc(b.p, P.p, -0.25, 20), { color: INK, dur: 0.3, len: 0.5, r: 0.02 }) });
        k.after(0.75, () => {
          const ok = op[0] === "D" || balance >= op[1];
          if (ok) balance += op[0] === "D" ? op[1] : -op[1];
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
    const tag = k.label("", [0, 0, 0], "small");
    const P = (s) => [s.x, 0.3, s.z];
    const hop = (pts, color, done, r = 0.026) => { const seg = (i) => i === pts.length - 1 ? done?.() : k.comet(k.arc(pts[i], pts[i + 1], 0.25, 20), { color, dur: 0.32, len: 0.5, r, arrive: () => seg(i + 1) }); seg(0); };
    const file = () => { const g = k.group(); k.segs([[-0.09, -0.12, 0], [0.04, -0.12, 0], [0.04, -0.12, 0], [0.09, -0.07, 0], [0.09, -0.07, 0], [0.09, 0.12, 0], [0.09, 0.12, 0], [-0.09, 0.12, 0], [-0.09, 0.12, 0], [-0.09, -0.12, 0]].map(([x, y, z]) => [x * 1.4, y * 1.4, z]), USR, 0.95, g); return g; };
    let id = 0;
    const story = () => {
      const fid = (0x3f2a + ++id * 4099).toString(16).slice(-4) + "…";
      tag.on = false;
      hop([users.alice, lb, P(front), P(auth)], REQ, () => {
        hop([P(auth), P(front), lb, users.alice], ADD, () => {
          const f = file(); f.position.set(...users.alice);
          const path = [users.alice, lb, P(front), P(up), db];
          let i = 0;
          const step = () => { if (i === path.length - 1) { k.drop(f); return share(); } const a = path[i], b = path[++i]; k.tween(0.35, (e) => f.position.set(...lerp3(a, b, e)), step); };
          step();
        });
      });
      const share = () => {
        tag.on = true; tag.pos.set(-2.2, 0.3, -0.15); tag.set(`id ${fid}`);
        k.comet(k.path([users.alice, users.bob], 12), { color: USR, dur: 0.5, r: 0.03, arrive: () => {
          hop([users.bob, lb, P(front), P(up), db], REQ, () => hop([db, P(up), P(front), lb, users.bob], ADD, () => {
            hop([users.carol, lb, P(front), P(up)], REQ, () => k.comet(k.arc(P(up), users.carol, 0.4, 24), { color: DEL, dur: 0.45, r: 0.03 }));
          }));
        } });
      };
    };
    const stress = () => {
      for (let i = 0; i < 24; i++) k.after(i * 0.12, () => hop([users[["alice", "bob", "carol"][i % 3]], lb, P(up)], USR, null, 0.02));
      k.after(1.2, () => up.pods.length < 3 && up.add());
      k.after(2.0, () => up.pods.length < 3 && up.add());
      k.after(6.5, () => { up.drop(); k.after(1, () => up.drop()); });
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
    k.label("load balancer", [LB[0], -0.2, 0], "small usr"); k.label("+ autoscaler", [LB[0], -0.42, 0], "small usr");
    k.label("javassist-instrumented workers", [1.25, 2.35, 0], "small");
    const est = k.label("", [LB[0], 0.85, 0], "usr small"), stat = k.label("", null, "corner2");
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
        if (w.load() + h > CAP) { return k.comet(k.arc(LB, SRC, -0.3, 20), { color: DEL, dur: 0.35, r: 0.025 }); }
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
      if (avg > 0.6 && workers.length < XS.length) { spawn(); return; }
      const idle = workers.find((w) => !w.blocks.length && !w.pending);
      if (avg < 0.08 && workers.length > 1 && idle) { retire(idle); }
    }, 1);
    k.orbit([0.4, 0.8, 0], 8.2, 10, 18, 10);
  },

  // the broker: two locks, a password and a TOTP code from the authenticator app; then the broker signs a JWT
  // that the browser keeps for 10 minutes. Every trade from the browser carries it; a refresh cookie renews it
  "2fa"(k) {
    const PH = [-2.7, 0.2, 0], C = [-1.4, 0.2, 0], S = [1.3, 0.2, 0], TK = [-1.4, 0.85, 0];
    const phone = k.box(0.22, 0.4, 0.04, INK, 0.7); phone.position.set(...PH); k.label("authenticator", [PH[0], PH[1] - 0.5, 0], "small");
    k.box(0.6, 0.45, 0.45, INK, 0.6).position.set(...C); k.label("browser", [C[0], -0.2, 0], "small");
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
    // the app shows a new 6-digit code every period; the dial runs down until the next one
    const dial = k.line([...Array(41).keys()].map((i) => { const a = Math.PI / 2 - (i / 40) * TAU; return [PH[0] + Math.cos(a) * 0.36, PH[1] + Math.sin(a) * 0.36, 0]; }), USR, 0.9);
    const code = k.label("", [PH[0], PH[1] + 0.58, 0], "code");
    const newCode = () => code.set(String(Math.floor(k.rnd() * 1e6)).padStart(6, "0").replace(/(\d{3})/, "$1 "));
    newCode(); k.every(6, newCode, 6);
    // the JWT the browser holds: a card on top of it, with a ring that runs down over its lifetime
    const card = k.box(0.42, 0.26, 0.02, ADD, 0.95); card.position.set(...TK); card.visible = false;
    const ring = k.line([...Array(41).keys()].map((i) => { const a = Math.PI / 2 - (i / 40) * TAU; return [TK[0] + Math.cos(a) * 0.3, TK[1] + Math.sin(a) * 0.3, 0]; }), ADD, 0.9);
    ring.visible = false;
    const tok = k.label("", [TK[0] + 0.4, TK[1], 0], "right small add");
    // a message: a comet with the name of what it carries riding above it
    const msg = k.label("", [0, 0, 0], "small"); msg.on = false;
    const send = (a, b, text, color, cls, done, h = 0.45) => {
      const pts = k.arc(a, b, h, 24);
      msg.set(text); msg.el.className = `small ${cls}`; msg.on = true;
      k.tween(0.6, (e) => { const p = k.at(pts, e); msg.pos.set(p[0], p[1] + 0.22, p[2]); });
      k.comet(pts, { color, dur: 0.6, len: 0.5, r: 0.032, arrive: () => { msg.on = false; done?.(); } });
    };
    let state = "out", left = 0, refreshes = 0;
    const setTok = (on, color = ADD) => { card.visible = ring.visible = on; tok.on = on; card.material.color.setHex(color); ring.material.color.setHex(color); };
    const issue = () => { left = 1; state = "in"; setTok(true); tok.set("jwt · 10 min"); };
    const login = () => {
      state = "busy"; setTok(false); L1.open(false); L2.open(false);
      send(C, S, "password", REQ, "", () => {
        L1.open(true);
        // the user reads the code off the app and types it in the browser
        flash(k, phone, USR, INK, 0.8); code.el.classList.add("usr");
        k.after(0.5, () => send(PH, C, code.el.textContent, USR, "usr", () => {
          code.el.classList.remove("usr");
          send(C, S, code.el.textContent, USR, "usr", () => { L2.open(true); send(S, C, "jwt", ADD, "add", issue, -0.5); });
        }, 0.3));
      });
    };
    const trade = () => {
      const buy = k.rnd() < 0.6, n = 1 + Math.floor(k.rnd() * 9);
      flash(k, card, INK, ADD, 0.25);
      send(C, S, `jwt · ${buy ? "buy" : "sell"} ${n}`, ADD, "add", () => { tick(buy); k.comet(k.arc(S, C, -0.35, 24), { color: INK, dur: 0.45, r: 0.024 }); }, 0.35);
    };
    const expire = () => {
      state = "busy"; setTok(true, DEL); tok.set("expired");
      if (refreshes++ % 2) return k.after(2, login);
      send(C, S, "refresh cookie", INK, "", () => send(S, C, "new jwt", ADD, "add", issue, -0.5));
    };
    k.frame((dt, now) => {
      dial.geometry.setDrawRange(0, Math.max(2, Math.round((1 - (now % 6) / 6) * 40) + 1));
      if (state === "in") { left -= dt / 7; ring.geometry.setDrawRange(0, Math.max(2, Math.round(left * 40) + 1)); if (left <= 0) expire(); }
    });
    k.every(1.6, () => state === "in" && left > 0.15 && trade(), 0.8);
    k.after(0.3, login);
    k.orbit([-0.55, 0.45, 0], 7.8, 4, 14, 6);
  },
};

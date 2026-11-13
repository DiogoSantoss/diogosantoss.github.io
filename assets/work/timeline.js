// The work page drawing: the path of a few emails through a mail system, drawn as a line chart in 3D.
// Time runs left to right. Every message leaves the shared baseline, rises to its own lane, passes the
// stages (the columns), and drops back to the baseline where it is delivered. Some are deferred by the
// remote server (orange square), wait and retry (ring); some bounce (red cross) and end there.
// Lanes also spread in depth, so the bundle shows its shape as the camera drifts.
// Returns { stop }; app.js calls it when the visitor leaves the page.
import * as THREE from "../vendor/three.js?v=0187";

const INK = 0xe9ebee, USR = 0xff9f43, DEL = 0xff6b6b;
const END = 10, STEP = 0.04, SPEED = 1.35; // x units, x per point, x per second
const STAGES = [[1.7, "smtp in"], [3.3, "dkim sign"], [4.8, "queue"], [6.2, "mx lookup"], [7.9, "remote mx"]];
const DEFER = 6.5, RETRY = 7.5, FALL = [8.4, 9.3], MERGE = 9.4;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// one cycle: which message is deferred, which bounces
function scenario() {
  const n = 7, out = [];
  const order = [...Array(n).keys()].sort(() => Math.random() - 0.5);
  const deferred = new Set(order.slice(0, 2)), bounced = Math.random() < 0.6 ? order[2] : -1;
  for (let i = 0; i < n; i++) {
    const start = 0.3 + i * 0.14;
    // deferred after the MX lookup; a bounce is the remote MX answering 550
    const at = i === bounced ? 7.9 + (Math.random() - 0.5) * 0.2 : DEFER + (Math.random() - 0.5) * 0.3;
    out.push({ lane: 0.9 + i * 0.3, z: (i - (n - 1) / 2) * 0.34, start, deferred: deferred.has(i), bounced: i === bounced, at });
  }
  return out;
}

// how far up its lane a message is at x: 0 on the baseline, 1 on its lane
function lift(m, x) {
  let f = smooth(m.start, m.start + 0.9, x) * (1 - smooth(FALL[0] + m.start * 0.2, FALL[1], x));
  if (m.deferred) f *= 1 - 0.8 * smooth(m.at, m.at + 0.35, x) * (1 - smooth(RETRY - 0.35, RETRY, x));
  return f;
}
const point = (m, x) => { const f = lift(m, x); return [x, f * m.lane, f * m.z]; };

export function startTimeline({ canvas, labels }) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const target = new THREE.Vector3(5, 1.3, 0);
  const mat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = (pts, m, Kind = THREE.Line) => new Kind(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts.flat(), 3)), m);
  const ring = (r, m) => line([...Array(24).keys()].map((k) => [Math.cos((k / 24) * 2 * Math.PI) * r, Math.sin((k / 24) * 2 * Math.PI) * r, 0]), m, THREE.LineLoop);

  // the fixed frame: baseline with ticks, the stage columns
  const frame = new THREE.Group();
  frame.add(line([[-0.3, 0, 0], [END + 0.3, 0, 0]], mat(INK, 0.35)));
  const ticks = [];
  for (let x = 0; x <= END + 1e-6; x += 0.5) ticks.push([x, 0, 0], [x, x % 2.5 === 0 ? -0.12 : -0.06, 0]);
  frame.add(line(ticks, mat(INK, 0.25), THREE.LineSegments));
  frame.add(line(STAGES.flatMap(([x]) => [[x, 0.25, -1.4], [x, 3.4, -1.4]]), mat(INK, 0.09), THREE.LineSegments));
  frame.add(line(STAGES.flatMap(([x]) => [[x, 0, -1.4], [x, 0, 1.4]]), mat(INK, 0.06), THREE.LineSegments));
  scene.add(frame);

  // labels are HTML, placed over the canvas at projected points
  const tags = [];
  const tag = (text, pos, cls = "") => {
    const el = Object.assign(document.createElement("span"), { textContent: text, className: cls });
    labels.append(el); tags.push({ el, pos: new THREE.Vector3(...pos), on: true }); return tags.at(-1);
  };
  for (const [x, s] of STAGES) tag(s, [x, 3.55, -1.4], "stage");
  tag("accepted", [-0.3, -0.32, 0], "end");
  const done = tag("delivered", [MERGE, -0.32, 0], "end");
  const clock = tag("", [END + 0.3, 3.55, -1.4], "clock").el;

  let lines = [], cycle = null, t0 = 0, raf = 0, w = 1, h = 1, mx = 0, mxE = 0;
  const events = { defer: tag("421 deferred", [0, 0, 0], "usr"), retry: tag("retry", [0, 0, 0]), bounce: tag("550 bounced", [0, 0, 0], "del") };

  function build() {
    for (const l of lines) { scene.remove(l.group); l.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); }
    cycle = scenario();
    lines = cycle.map((m) => {
      const stop = m.bounced ? m.at : END;
      const pts = [];
      for (let x = 0; x <= stop + 1e-6; x += STEP) pts.push(point(m, x));
      const group = new THREE.Group();
      const path = line(pts, mat(INK, 0.55));
      path.geometry.setDrawRange(0, 0);
      const head = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: INK, transparent: true }));
      group.add(path, head);
      const marks = [];
      const mark = (obj, x, kind) => { obj.position.set(...point(m, x)); obj.visible = false; group.add(obj); marks.push({ obj, x, kind }); };
      if (m.deferred) {
        mark(new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshBasicMaterial({ color: USR, transparent: true })), m.at, "defer");
        mark(ring(0.06, mat(INK, 0.8)), RETRY, "retry");
      }
      if (m.bounced) {
        const c = 0.07;
        mark(line([[-c, -c, 0], [c, c, 0], [-c, c, 0], [c, -c, 0]], mat(DEL, 0.95), THREE.LineSegments), m.at, "bounce");
      }
      scene.add(group);
      return { m, group, path, head, marks, n: pts.length, stop };
    });
    const merge = ring(0.075, mat(INK, 0.9));
    merge.position.set(MERGE, 0, 0); merge.visible = false;
    lines.push({ merge, group: merge, marks: [] });
    scene.add(merge);
    for (const k in events) events[k].on = false;
    done.el.style.opacity = "";
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  function aim(sec) {
    mxE += (mx - mxE) * 0.05;
    const yaw = (-16 + (reduce ? 0 : Math.sin(sec / 9) * 7) + mxE * 6) * (Math.PI / 180);
    const pitch = (13 + (reduce ? 0 : Math.sin(sec / 13) * 3)) * (Math.PI / 180);
    // far enough that the whole chart fits, whatever the aspect
    const half = Math.tan((camera.fov * Math.PI) / 360);
    const dist = Math.max(11.2 / camera.aspect, 4.4) / (2 * half) + 1;
    camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(target);
  }

  function place() {
    const v = new THREE.Vector3();
    for (const t of tags) {
      v.copy(t.pos).project(camera);
      t.el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
      t.el.style.opacity = t.on ? "" : "0";
    }
  }

  function step(now) {
    const sec = now / 1000, head = reduce ? END + 4 : (now - t0) / 1000 * SPEED;
    const fade = reduce ? 1 : 1 - smooth(END + 3.2, END + 4.2, head);
    aim(sec);
    for (const l of lines) {
      if (l.merge) { l.merge.visible = head >= MERGE + 0.3; l.merge.material.opacity = 0.9 * fade; continue; }
      const x = Math.min(head, l.stop);
      l.path.geometry.setDrawRange(0, Math.max(0, Math.min(l.n, Math.floor(x / STEP) + 1)));
      l.path.material.opacity = 0.72 * fade;
      l.head.visible = head > 0 && head < l.stop + 0.6;
      l.head.position.set(...point(l.m, x));
      l.head.quaternion.copy(camera.quaternion);
      l.head.material.opacity = fade * (head < l.stop ? 1 : 1 - (head - l.stop) / 0.6);
      for (const k of l.marks) {
        k.obj.visible = head >= k.x;
        k.obj.quaternion.copy(camera.quaternion);
        k.obj.material.opacity = fade * (k.kind === "retry" ? 0.8 : 0.95);
        if (head >= k.x && !events[k.kind].on) { events[k.kind].on = true; events[k.kind].pos.copy(k.obj.position).add(new THREE.Vector3(0.12, 0.14, 0)); }
      }
    }
    done.on = head >= MERGE + 0.3;
    labels.style.setProperty("--fade", fade);
    clock.textContent = `+${String(Math.round(Math.max(0, Math.min(head, END)) * 84)).padStart(3, "0")} ms`;
    place();
    renderer.render(scene, camera);
    if (!reduce && head > END + 4.4) { build(); t0 = now; }
    raf = requestAnimationFrame(step);
  }

  addEventListener("resize", resize);
  const onMove = (e) => (mx = (e.clientX / innerWidth) * 2 - 1);
  addEventListener("pointermove", onMove);
  build(); resize();
  t0 = performance.now();
  raf = requestAnimationFrame(step);

  return {
    stop() {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize); removeEventListener("pointermove", onMove);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      renderer.dispose();
      labels.replaceChildren();
    },
  };
}

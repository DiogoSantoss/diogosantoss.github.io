// Tiny hidden-line 3D engine for box scenes. No dependencies.
// Faces go into a depth buffer; an edge is drawn only where nothing is in front of it.
// The same buffer stores which item covers each pixel, for hover picking.

const rad = (d) => (d * Math.PI) / 180;
const rotX = ([x, y, z], a) => [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
const rotY = ([x, y, z], a) => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

// the 6 faces of a box as vertex indices (bit 0 = +x, bit 1 = +y, bit 2 = +z)
const FACES = [[0, 2, 6, 4], [1, 3, 7, 5], [0, 1, 5, 4], [2, 3, 7, 6], [0, 1, 3, 2], [4, 5, 7, 6]];
const EDGES = [];
for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) if ([1, 2, 4].includes(i ^ j)) EDGES.push([i, j]);

// world-space boxes for a list of items; owner is the item index
export function worldBoxes(items) {
  const out = [];
  const push = (part, owner, at = [0, 0, 0], yaw = 0) => {
    const [w, h, d] = part.s;
    const verts = [];
    for (let i = 0; i < 8; i++) {
      let v = [(i & 1 ? 0.5 : -0.5) * w, (i & 2 ? 0.5 : -0.5) * h, (i & 4 ? 0.5 : -0.5) * d];
      if (part.rz) v = rotZ(v, rad(part.rz));
      if (part.rx) v = rotX(v, rad(part.rx));
      if (part.yaw) v = rotY(v, rad(part.yaw));
      v = add(v, part.c);
      if (yaw) v = rotY(v, rad(yaw));
      verts.push(add(v, at));
    }
    out.push({ verts, owner, color: part.color, ghost: part.ghost });
  };
  items.forEach((it, i) => it.parts.forEach((p) => push(it.ghost ? { ...p, ghost: true } : p, i, it.at, it.yaw)));
  return out;
}

export function createView(canvas) {
  const ctx = canvas.getContext("2d");
  const K = 0.5; // depth buffer resolution relative to CSS pixels
  let W = 0, H = 0, BW = 0, BH = 0, zbuf, ibuf;
  const cam = { yaw: -28, pitch: 24, dist: 560, target: [0, 70, 0], fit: 1, cx: 0, cy: 0 };

  function resize(area) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    BW = Math.ceil(W * K); BH = Math.ceil(H * K);
    zbuf = new Float32Array(BW * BH); ibuf = new Int16Array(BW * BH);
    cam.area = area;
  }

  // world -> view space (camera looks down -z from +z)
  const toView = (v) => rotX(rotY([v[0] - cam.target[0], v[1] - cam.target[1], v[2] - cam.target[2]], rad(-cam.yaw)), rad(cam.pitch));
  // view -> screen; n is "nearness", larger is closer, linear in screen space
  function project(p) {
    const depth = cam.dist - p[2];
    return { x: cam.cx + (cam.fit * p[0]) / depth, y: cam.cy - (cam.fit * p[1]) / depth, n: 1 / depth };
  }

  // scale so the scene fills its area at any yaw in the swing range
  function fit(boxes, yaws, pad = [0.9, 0.86]) {
    const a = cam.area;
    cam.cx = a.x + a.w / 2; cam.cy = a.y + a.h / 2;
    const keep = cam.yaw;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cam.fit = 1; const cx = cam.cx, cy = cam.cy; cam.cx = 0; cam.cy = 0;
    for (const yaw of yaws) {
      cam.yaw = yaw;
      for (const b of boxes) for (const v of b.verts) {
        const s = project(toView(v));
        minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
      }
    }
    cam.yaw = keep;
    cam.fit = Math.min((a.w * pad[0]) / (maxX - minX), (a.h * pad[1]) / (maxY - minY));
    cam.cx = cx - cam.fit * (minX + maxX) / 2; cam.cy = cy - cam.fit * (minY + maxY) / 2;
  }

  function raster(a, b, c, id) {
    const ax = a.x * K, ay = a.y * K, bx = b.x * K, by = b.y * K, cx = c.x * K, cy = c.y * K;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-6) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(BW - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(BH - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / area;
        const w1 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -0.01 || w1 < -0.01 || w2 < -0.01) continue;
        const n = w0 * a.n + w1 * b.n + w2 * c.n, i = y * BW + x;
        if (n > zbuf[i]) { zbuf[i] = n; ibuf[i] = id; }
      }
  }

  // returns visible segments: [{x0,y0,x1,y1,owner}]
  function render(boxes) {
    zbuf.fill(-Infinity); ibuf.fill(-2);
    const proj = boxes.map((b) => {
      const view = b.verts.map(toView);
      return { view, scr: view.map(project), owner: b.owner, color: b.color, ghost: b.ghost };
    });
    // ghost boxes (mesh, glass) show their edges but hide nothing behind them
    for (const b of proj) {
      if (b.ghost) continue;
      const center = b.view.reduce((s, v) => add(s, v), [0, 0, 0]).map((x) => x / 8);
      for (const f of FACES) {
        const fc = f.reduce((s, i) => add(s, b.view[i]), [0, 0, 0]).map((x) => x / 4);
        const normal = [fc[0] - center[0], fc[1] - center[1], fc[2] - center[2]];
        const eye = [fc[0], fc[1], fc[2] - cam.dist];
        if (normal[0] * eye[0] + normal[1] * eye[1] + normal[2] * eye[2] >= 0) continue;
        const [p, q, r, s] = f.map((i) => b.scr[i]);
        raster(p, q, r, b.owner); raster(p, r, s, b.owner);
      }
    }
    const segs = [];
    for (const b of proj)
      for (const [i, j] of EDGES) {
        const a = b.scr[i], c = b.scr[j];
        const len = Math.hypot(c.x - a.x, c.y - a.y), steps = Math.max(2, Math.ceil(len / 1.5));
        let run = null;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps, x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t, n = a.n + (c.n - a.n) * t;
          const bx = Math.floor(x * K), by = Math.floor(y * K);
          let vis = bx < 0 || by < 0 || bx >= BW || by >= BH;
          if (!vis) {
            const z = zbuf[by * BW + bx];
            vis = z === -Infinity || n >= z - Math.abs(z) * 0.006;
          }
          if (vis && !run) run = { x0: x, y0: y };
          if (vis) { run.x1 = x; run.y1 = y; }
          if ((!vis || s === steps) && run) { if (Math.hypot(run.x1 - run.x0, run.y1 - run.y0) > 0.5) segs.push({ ...run, owner: b.owner, color: b.color }); run = null; }
        }
      }
    return segs;
  }

  const pick = (x, y) => {
    const bx = Math.floor(x * K), by = Math.floor(y * K);
    return bx < 0 || by < 0 || bx >= BW || by >= BH ? -1 : Math.max(-1, ibuf[by * BW + bx]);
  };
  // screen position of a world point (for labels)
  const screen = (v) => project(toView(v));

  return { ctx, cam, resize, fit, render, pick, screen, size: () => [W, H] };
}

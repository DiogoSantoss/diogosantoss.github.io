// Helpers for multi-component diagrams: boxes, orthogonal wires and particles that travel along paths.

export function box(g, x, y, w, h, color, dashed = false) {
  const hz = dashed ? "╌" : "─";
  const vt = dashed ? "╎" : "│";
  g.put(x, y, "┌", color);
  g.put(x + w - 1, y, "┐", color);
  g.put(x, y + h - 1, "└", color);
  g.put(x + w - 1, y + h - 1, "┘", color);
  for (let i = 1; i < w - 1; i++) {
    g.put(x + i, y, hz, color);
    g.put(x + i, y + h - 1, hz, color);
  }
  for (let j = 1; j < h - 1; j++) {
    g.put(x, y + j, vt, color);
    g.put(x + w - 1, y + j, vt, color);
  }
}

// Orthogonal route from a to b that turns at column mx (defaults to the midpoint).
export function elbow(a, b, mx = Math.round((a[0] + b[0]) / 2)) {
  return [a, [mx, a[1]], [mx, b[1]], b];
}

export function wire(g, path, color, ch) {
  for (let i = 0; i < path.length - 1; i++) {
    const [x0, y0] = path[i];
    const [x1, y1] = path[i + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    const c = ch || (y0 === y1 ? "─" : x0 === x1 ? "│" : "·");
    for (let s = 0; s <= steps; s++) g.put(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, c, color);
  }
}

function along(path, f) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const l = Math.hypot(path[i + 1][0] - path[i][0], (path[i + 1][1] - path[i][1]) * 2);
    segs.push(l);
    total += l;
  }
  let d = Math.min(1, Math.max(0, f)) * total;
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? d / segs[i] : 0;
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
    }
    d -= segs[i];
  }
  return path[path.length - 1];
}

export function pathLength(path) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += Math.hypot(path[i + 1][0] - path[i][0], (path[i + 1][1] - path[i][1]) * 2);
  return total;
}

export function particles() {
  let list = [];
  return {
    get size() { return list.length; },
    clear() { list = []; },
    // speed in cells per tick; jitter multiplies duration to model asynchrony
    send(g, path, { glyph = "·", color, speed = 2.5, jitter = 0.5, onArrive, trail = true } = {}) {
      const dur = Math.max(3, (pathLength(path) / speed) * (1 + Math.random() * jitter));
      list.push({ path, t0: g.t, dur, glyph, color, onArrive, trail });
    },
    step(g, trailBuf) {
      const arrived = [];
      list = list.filter((p) => {
        const f = (g.t - p.t0) / p.dur;
        if (f >= 1) { arrived.push(p); return false; }
        p.pos = along(p.path, f);
        if (trailBuf && p.trail) trailBuf.mark(p.pos[0], p.pos[1]);
        return true;
      });
      arrived.forEach((p) => p.onArrive && p.onArrive());
    },
    draw(g) {
      list.forEach((p) => p.pos && g.put(p.pos[0], p.pos[1], p.glyph, typeof p.color === "function" ? p.color() : p.color));
    },
  };
}

export function trails(g, decay = 0.86) {
  const buf = new Float32Array(g.cols * g.rows);
  return {
    mark(x, y) {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && y >= 0 && x < g.cols && y < g.rows) buf[y * g.cols + x] = 1;
    },
    step() { for (let i = 0; i < buf.length; i++) buf[i] *= decay; },
    draw(g, color) {
      for (let y = 0; y < g.rows; y++)
        for (let x = 0; x < g.cols; x++) {
          const v = buf[y * g.cols + x];
          if (v > 0.06) g.put(x, y, "·", color(v));
        }
    },
  };
}

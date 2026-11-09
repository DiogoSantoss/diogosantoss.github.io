// I · Anycast: PoPs spread over the screen, each owning the area closest to it (only the borders
// are drawn). Requests appear anywhere and fly to the nearest healthy PoP. When a PoP fails its
// neighbours take over its area, and requests on their way turn to the new owner.
import { run, INK, REQ, ADD, DEL, rnd, pick } from "./page.js";

const ASP = 2.1; // a cell is about twice as tall as it is wide
let pops, owner, reqs, cols, rows;

function nearest(x, y) {
  let best = -1, bd = Infinity;
  pops.forEach((p, i) => {
    if (p.down) return;
    const d = (p.x - x) ** 2 + ((p.y - y) * ASP) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
function assign() {
  owner = new Int16Array(cols * rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) owner[y * cols + x] = nearest(x, y);
}

run("I · anycast", {
  init(g) {
    cols = g.cols; rows = g.rows;
    pops = [];
    const W = 26, H = 11;
    for (let y = 3; y < rows - 2; y += H)
      for (let x = 4; x < cols - 4; x += W) {
        const px = x + rnd(0, W - 6), py = Math.min(rows - 3, y + rnd(0, H - 3));
        if (!g.masked(px, py)) pops.push({ x: px, y: py, flash: 0, down: false });
      }
    reqs = [];
    assign();
  },
  tick(g) {
    // a PoP fails every ~7 s and comes back ~4 s later
    if (g.t % 84 === 30) { const p = pick(pops.filter((p) => !p.down)); p.down = g.t; assign(); }
    for (const p of pops) if (p.down && g.t - p.down > 50) { p.down = false; assign(); }

    if (reqs.length < 70) for (let i = 0; i < 3; i++) {
      const x = rnd(0, cols), y = rnd(0, rows);
      if (!g.masked(x, y)) reqs.push({ x, y, to: owner[y * cols + x], hist: [] });
    }
    reqs = reqs.filter((r) => {
      const p = pops[r.to];
      if (!p || p.down) { r.to = nearest(r.x, r.y); r.turned = g.t; return r.to >= 0; }
      const dx = p.x - r.x, dy = (p.y - r.y) * ASP, d = Math.hypot(dx, dy);
      if (d < 1.2) { p.flash = 1; return false; }
      r.hist.unshift([r.x, r.y]); r.hist = r.hist.slice(0, 5);
      r.x += (dx / d) * 1.3; r.y += ((dy / d) * 1.3) / ASP;
      return true;
    });
    pops.forEach((p) => (p.flash *= 0.85));
  },
  draw(g) {
    // borders between areas
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const o = owner[y * cols + x];
        const edge = (x + 1 < cols && owner[y * cols + x + 1] !== o) || (y + 1 < rows && owner[(y + 1) * cols + x] !== o);
        if (edge && (x + y) % 2 === 0) g.put(x, y, "·", INK(0.13));
      }
    for (const r of reqs) {
      const c = r.turned && g.t - r.turned < 40 ? ADD : REQ;
      r.hist.forEach(([x, y], i) => g.put(x, y, "·", c(0.3 - i * 0.05)));
      g.put(r.x, r.y, "●", c(0.6));
    }
    for (const p of pops) {
      if (p.down) { g.put(p.x, p.y, "×", DEL(0.55)); continue; }
      g.put(p.x, p.y, "◆", p.flash > 0.3 ? REQ(0.3 + p.flash * 0.4) : INK(0.3));
    }
  },
});

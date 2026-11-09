// C · Gossip: a field of nodes. A new version starts at one node and spreads peer to peer
// (mostly to neighbours, sometimes far away) until every node has it. Waves overlap.
import { run, INK, REQ, ADD, USR, rnd } from "./page.js";

const COLORS = [REQ, ADD, USR];
const SX = 4, SY = 2;
let nodes, cols, rowsN, ver, waves;

run("C · gossip", {
  init(g) {
    cols = Math.ceil(g.cols / SX); rowsN = Math.ceil(g.rows / SY);
    nodes = [];
    for (let j = 0; j < rowsN; j++)
      for (let i = 0; i < cols; i++)
        nodes.push({ x: i * SX + (j % 2) * 2, y: j * SY + 1, v: 0, at: -999 });
    ver = 0; waves = [];
  },
  tick(g) {
    // a new version every ~6 s, starting at a random node
    if (g.t % 70 === 6) {
      ver++;
      const n = nodes[rnd(0, nodes.length)];
      n.v = ver; n.at = g.t;
      waves.push({ v: ver, t: g.t, start: n });
    }
    // each node that got a version recently pushes it to one peer per tick
    const now = g.t;
    for (const n of nodes) {
      if (now - n.at > 8 || n.at === now || Math.random() < 0.5) continue;
      const far = Math.random() < 0.03;
      const i = far ? rnd(0, cols) : Math.round(n.x / SX) + rnd(-2, 3);
      const j = far ? rnd(0, rowsN) : Math.round((n.y - 1) / SY) + rnd(-2, 3);
      if (i < 0 || j < 0 || i >= cols || j >= rowsN) continue;
      const p = nodes[j * cols + i];
      if (p.v < n.v) { p.v = n.v; p.at = now; }
    }
    waves = waves.filter((w) => g.t - w.t < 400);
  },
  draw(g) {
    for (const n of nodes) {
      const age = g.t - n.at;
      const c = COLORS[n.v % COLORS.length];
      if (n.v === 0) g.put(n.x, n.y, "·", INK(0.08));
      else if (age < 3) g.put(n.x, n.y, "●", c(0.75));
      else if (age < 12) g.put(n.x, n.y, "•", c(0.5 - age * 0.025));
      else if (age < 140) g.put(n.x, n.y, "·", c(Math.max(0.1, 0.24 - age * 0.001)));
      else g.put(n.x, n.y, "·", c(0.1));
    }
    // a small marker where each recent version started
    for (const w of waves) if (g.t - w.t < 40) g.text(w.start.x + 2, w.start.y, `v${w.v}`, COLORS[w.v % COLORS.length](0.5 * (1 - (g.t - w.t) / 40)));
  },
});

// K · SWIM: a field of nodes that keep pinging each other. When one dies, a ping goes
// unanswered, three neighbours probe it indirectly, it becomes suspect, then its death
// spreads as a red gossip wave. When it rejoins, a green wave follows.
import { run, INK, ADD, DEL, USR, pick } from "./page.js";

const SX = 6, SY = 3;
let nodes, cols, rowsN, probes, waves, story;

const at = (i, j) => (i < 0 || j < 0 || i >= cols || j >= rowsN ? null : nodes[j * cols + i]);
const near = (n, r) => { const out = []; for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { const m = at(n.i + di, n.j + dj); if (m && m !== n && !m.hidden) out.push(m); } return out; };
const probe = (a, b, t, kind) => probes.push({ a, b, t, kind });

run("K · SWIM", {
  init(g) {
    cols = Math.ceil(g.cols / SX); rowsN = Math.ceil(g.rows / SY);
    nodes = [];
    for (let j = 0; j < rowsN; j++)
      for (let i = 0; i < cols; i++) {
        const x = i * SX + (j % 2) * 3, y = j * SY + 1;
        nodes.push({ i, j, x, y, state: "alive", hidden: g.masked(x, y) });
      }
    probes = []; waves = []; story = null;
  },
  tick(g) {
    const live = nodes.filter((n) => !n.hidden && n.state !== "dead");
    // background protocol: a few random pings per tick, all answered
    for (let k = 0; k < 3; k++) { const a = pick(live), b = pick(near(a, 2)); if (b && b.state === "alive") probe(a, b, g.t, "ping"); }

    // one failure story every ~8 s
    if (!story && g.t % 100 === 20) {
      const v = pick(live.filter((n) => near(n, 1).length >= 4));
      if (v) { v.state = "dead-unknown"; story = { v, t: g.t, prober: pick(near(v, 2)) }; }
    }
    if (story) {
      const s = story, dt = g.t - s.t;
      if (dt === 8) probe(s.prober, s.v, g.t, "lost");
      if (dt === 20) near(s.v, 2).filter((m) => m !== s.prober).slice(0, 3).forEach((m) => probe(m, s.v, g.t, "indirect"));
      if (dt === 32) s.v.state = "suspect";
      if (dt === 56) { s.v.state = "dead"; waves.push({ from: s.v, t: g.t, color: DEL }); }
      if (dt === 150) { s.v.state = "alive"; waves.push({ from: s.v, t: g.t, color: ADD }); }
      if (dt > 160) story = null;
    }
    probes = probes.filter((p) => g.t - p.t < 8);
    waves = waves.filter((w) => g.t - w.t < 80);
  },
  draw(g) {
    for (const p of probes) {
      const age = g.t - p.t, f = Math.min(1, age / 5);
      const color = p.kind === "ping" ? INK : p.kind === "lost" ? DEL : USR;
      const steps = Math.max(Math.abs(p.b.x - p.a.x), Math.abs(p.b.y - p.a.y));
      for (let s = 1; s < steps * f; s += 2) {
        const x = Math.round(p.a.x + ((p.b.x - p.a.x) * s) / steps), y = Math.round(p.a.y + ((p.b.y - p.a.y) * s) / steps);
        g.put(x, y, "·", color(p.kind === "ping" ? 0.12 : 0.4));
      }
    }
    for (const n of nodes) {
      if (n.hidden) continue;
      let ch = "·", col = INK(0.14);
      // the gossip wave: a ring growing out from the node whose state changed
      for (const w of waves) {
        const d = Math.hypot((n.x - w.from.x) / SX, ((n.y - w.from.y) / SY) * 1.1);
        const front = (g.t - w.t) * 0.7;
        if (d <= front && front - d < 6) { ch = "•"; col = w.color(0.5 * (1 - (front - d) / 6) + 0.08); }
      }
      if (n.state === "suspect") { ch = "◎"; col = USR(0.6); }
      if (n.state === "dead") { ch = "×"; col = DEL(0.55); }
      g.put(n.x, n.y, ch, col);
    }
    if (story) {
      const v = story.v, dt = g.t - story.t;
      const label = dt < 20 ? "" : dt < 32 ? "no ack · probing indirectly" : dt < 56 ? "suspect" : dt < 150 ? "dead · gossiping" : "rejoined";
      if (label) g.text(v.x + 2, v.y, label, (dt < 56 ? USR : dt < 150 ? DEL : ADD)(0.45));
    }
  },
});

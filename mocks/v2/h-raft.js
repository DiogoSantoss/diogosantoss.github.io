// H · Raft: many small 5-node clusters scattered over the screen. Leaders send heartbeats;
// now and then a leader crashes, a follower times out, asks for votes and takes over.
import { run, INK, REQ, ADD, DEL, USR, rnd, pick } from "./page.js";

const HB = 12; // ticks between heartbeats
let clusters;

function cluster(cx, cy) {
  const nodes = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return { x: Math.round(cx + Math.cos(a) * 6), y: Math.round(cy + Math.sin(a) * 2.6), state: "follower", flash: 0 };
  });
  const leader = rnd(0, 5);
  nodes[leader].state = "leader";
  return { nodes, leader, term: rnd(1, 9), phase: "ok", t: 0, msgs: [], offset: rnd(0, HB) };
}
const send = (c, from, to, kind, t) => c.msgs.push({ from, to, kind, t });

run("H · raft", {
  init(g) {
    clusters = [];
    const W = 30, H = 10;
    for (let y = 4; y < g.rows - 3; y += H)
      for (let x = 8; x < g.cols - 7; x += W) {
        const cx = x + rnd(-4, 5), cy = y + rnd(-1, 2);
        const c = cluster(cx, cy);
        if (!c.nodes.some((n) => g.masked(n.x, n.y))) clusters.push(c);
      }
  },
  tick(g) {
    // one leader somewhere crashes every ~3 s
    if (g.t % 36 === 20) {
      const c = pick(clusters.filter((c) => c.phase === "ok"));
      if (c) { c.nodes[c.leader].state = "down"; c.phase = "leaderless"; c.t = g.t; }
    }
    for (const c of clusters) {
      if (c.phase === "ok" && (g.t + c.offset) % HB === 0)
        c.nodes.forEach((_, i) => i !== c.leader && c.nodes[i].state !== "down" && send(c, c.leader, i, "hb", g.t));
      if (c.phase === "leaderless" && g.t - c.t > 24) {
        // the follower whose election timer fires first becomes a candidate
        const cand = pick(c.nodes.map((n, i) => i).filter((i) => c.nodes[i].state === "follower"));
        c.nodes[cand].state = "candidate"; c.cand = cand; c.term++; c.phase = "election"; c.t = g.t;
        c.nodes.forEach((n, i) => i !== cand && n.state !== "down" && send(c, cand, i, "vote", g.t));
      }
      if (c.phase === "election" && g.t - c.t > 16) {
        c.nodes[c.cand].state = "leader"; c.nodes[c.cand].flash = 1; c.leader = c.cand; c.phase = "ok"; c.won = g.t;
      }
      // the crashed node comes back as a follower
      c.nodes.forEach((n) => { if (n.state === "down" && c.phase === "ok" && g.t - c.won > 60) n.state = "follower"; n.flash *= 0.85; });
      c.msgs = c.msgs.filter((m) => {
        const p = (g.t - m.t) / 6;
        if (p >= 1) { c.nodes[m.to].flash = Math.max(c.nodes[m.to].flash, 0.6); return false; }
        return true;
      });
    }
  },
  draw(g) {
    for (const c of clusters) {
      for (const m of c.msgs) {
        const a = c.nodes[m.from], b = c.nodes[m.to], p = (g.t - m.t) / 6;
        const x = Math.round(a.x + (b.x - a.x) * p), y = Math.round(a.y + (b.y - a.y) * p);
        g.put(x, y, "·", (m.kind === "vote" ? USR : REQ)(0.45));
      }
      c.nodes.forEach((n) => {
        const map = {
          leader: ["◆", c.won && g.t - c.won < 30 ? ADD(0.7) : INK(0.4)],
          follower: ["○", n.flash > 0.2 ? REQ(0.2 + n.flash * 0.4) : INK(0.16)],
          candidate: ["◎", USR(0.6)],
          down: ["×", DEL(0.4)],
        };
        const [ch, col] = map[n.state];
        g.put(n.x, n.y, ch, col);
      });
      if (c.phase !== "ok" || (c.won && g.t - c.won < 30)) {
        const top = c.nodes[0];
        const label = c.phase === "leaderless" ? "leader lost" : c.phase === "election" ? `election · term ${c.term}` : `leader · term ${c.term}`;
        g.text(top.x - Math.floor(label.length / 2), top.y - 1, label, (c.phase === "leaderless" ? DEL : c.phase === "election" ? USR : ADD)(0.4));
      }
    }
  },
});

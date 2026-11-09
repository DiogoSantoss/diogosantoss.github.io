// B · tail -f: request logs from many cities scroll up behind the text.
// Every ~25 s a bad deploy raises the 5xx rate, then a rollback clears it.
import { run, INK, REQ, USR, DEL, ADD, rnd, pick } from "./page.js";

const COLOS = ["lis", "mad", "cdg", "fra", "ams", "lhr", "iad", "sjc", "gru", "nrt", "sin", "syd"];
const PATHS = ["/", "/work", "/gear", "/blog", "/feed.xml", "/favicon.svg", "/og.png", "/assets/ring.js", "/blog/post-", "/cv-diogo-santos.pdf", "/api/v1/messages", "/robots.txt"];
let rows, incident, version, clock;

const pad = (n, w) => String(n).padStart(w, "0");
function entry(bad) {
  clock += rnd(3, 40);
  const s = Math.floor(clock / 1000), ts = `${pad(Math.floor(s / 3600) % 24, 2)}:${pad(Math.floor(s / 60) % 60, 2)}:${pad(s % 60, 2)}.${pad(clock % 1000, 3)}`;
  let path = pick(PATHS); if (path.endsWith("-")) path += rnd(1, 400);
  const r = Math.random();
  const status = bad && r < 0.35 ? pick([500, 502, 503]) : r < 0.86 ? 200 : r < 0.93 ? 304 : r < 0.98 ? 404 : 301;
  const ms = status >= 500 ? rnd(800, 3000) : Math.round(Math.exp(Math.random() * 4.5));
  const color = status >= 500 ? DEL : status === 404 ? USR : null;
  return [
    [ts + " ", INK, 0.6],
    [pick(COLOS) + pad(rnd(1, 30), 2) + " ", INK, 0.8],
    [(path.startsWith("/api") ? "POST " : "GET  ") + path.padEnd(22).slice(0, 22) + " ", INK, 1],
    [String(status) + " ", color || INK, color ? 2.2 : 1],
    [(ms + "ms").padStart(6) + "  ", ms > 500 ? USR : INK, ms > 500 ? 1.6 : 0.7],
  ];
}
function row(g) {
  const bad = incident && incident.phase === "bad";
  const segs = [];
  let w = 0;
  while (w < g.cols + 60) { const e = entry(bad); e.forEach((s) => (w += s[0].length)); segs.push(...e, ["   ", INK, 0]); w += 3; }
  return { segs, off: -rnd(0, 50) };
}
function event(g, text, color) {
  return { segs: [[text, color, 2.4]], off: rnd(4, Math.max(5, g.cols - text.length - 4)) };
}

run("B · tail -f", {
  init(g) {
    clock = 51_000_000 + rnd(0, 1e6); version = 412; incident = null;
    rows = [];
    for (let i = 0; i < g.rows; i++) rows.push(row(g));
  },
  tick(g) {
    if (g.t % 300 === 200) { incident = { phase: "bad", t: g.t }; rows.push(event(g, `deploy edge-proxy v${version + 1} · 1% → 100%`, REQ)); }
    if (incident && incident.phase === "bad" && g.t - incident.t === 50) rows.push(event(g, `alert · 5xx rate 4.1% > 1% · paging`, DEL));
    if (incident && incident.phase === "bad" && g.t - incident.t === 80) { incident.phase = "ok"; rows.push(event(g, `rollback edge-proxy v${version + 1} → v${version} · 5xx back to 0.01%`, ADD)); }
    if (incident && g.t - incident.t > 120) incident = null;
    if (g.t % 3 === 0) { rows.push(row(g)); rows = rows.slice(-g.rows); }
  },
  draw(g) {
    const n = rows.length;
    rows.forEach((r, i) => {
      const y = g.rows - n + i;
      const age = (n - 1 - i) / g.rows; // 0 newest, 1 oldest
      const base = 0.02 + 0.08 * (1 - age);
      let x = r.off;
      for (const [text, color, k] of r.segs) {
        if (k) for (let j = 0; j < text.length; j++) g.put(x + j, y, text[j], color(Math.min(0.85, base * k)));
        x += text.length;
      }
    });
  },
});

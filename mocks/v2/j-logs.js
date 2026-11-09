// J · Logs: single log lines appear in free spots, stay a few seconds and fade, so the screen
// is never a wall of text. Now and then a burst of 5xx lines clusters in one area, then a rollback.
import { run, INK, USR, DEL, ADD, rnd, pick } from "./page.js";

const COLOS = ["lis", "mad", "cdg", "fra", "ams", "lhr", "iad", "sjc", "gru", "nrt", "sin", "syd"];
const PATHS = ["/", "/work", "/gear", "/blog", "/feed.xml", "/favicon.svg", "/og.png", "/assets/ring.js", "/blog/post-", "/cv-diogo-santos.pdf", "/robots.txt"];
const LIFE = 70;
let lines, burst, clock;

const pad = (n, w) => String(n).padStart(w, "0");
function text(bad) {
  clock += rnd(20, 400);
  const s = Math.floor(clock / 1000);
  const ts = `${pad(Math.floor(s / 3600) % 24, 2)}:${pad(Math.floor(s / 60) % 60, 2)}:${pad(s % 60, 2)}`;
  let path = pick(PATHS); if (path.endsWith("-")) path += rnd(1, 400);
  const r = Math.random();
  const status = bad ? pick([500, 502, 503, 200]) : r < 0.88 ? 200 : r < 0.95 ? 304 : 404;
  const ms = status >= 500 ? rnd(900, 3000) : Math.round(Math.exp(Math.random() * 4.5));
  return { s: `${ts} ${pick(COLOS)}${pad(rnd(1, 30), 2)} GET ${path} ${status} ${ms}ms`, color: status >= 500 ? DEL : status === 404 ? USR : INK };
}
// a free spot: no overlap with live lines (one empty cell around) and not under the text
function place(g, len, near) {
  for (let tries = 0; tries < 30; tries++) {
    const x = near ? near.x + rnd(-18, 18) : rnd(0, g.cols - len);
    const y = near ? near.y + rnd(-5, 6) : rnd(0, g.rows);
    if (x < 0 || x + len > g.cols || y < 0 || y >= g.rows) continue;
    if (g.masked(x, y) || g.masked(x + len - 1, y)) continue;
    if (lines.some((l) => Math.abs(l.y - y) < 1 && x < l.x + l.s.length + 2 && l.x < x + len + 2)) continue;
    return { x, y };
  }
  return null;
}
function add(g, t, item, near) {
  const at = place(g, item.s.length, near);
  if (at) lines.push({ ...item, ...at, t });
}

run("J · logs", {
  init(g) {
    clock = 51_000_000 + rnd(0, 1e6); lines = []; burst = null;
    for (let i = 0; i < 30; i++) add(g, -rnd(0, LIFE), text(false));
  },
  tick(g) {
    if (g.t % 3 === 0) add(g, g.t, text(false));
    if (g.t % 280 === 150) burst = { t: g.t, at: { x: rnd(10, g.cols - 40), y: rnd(4, g.rows - 4) } };
    if (burst && g.t - burst.t < 40 && g.t % 2 === 0) add(g, g.t, text(true), burst.at);
    if (burst && g.t - burst.t === 46) add(g, g.t, { s: `rollback edge-proxy v413 → v412 · 5xx 4.1% → 0.01%`, color: ADD, strong: true }, burst.at);
    if (burst && g.t - burst.t > 60) burst = null;
    lines = lines.filter((l) => g.t - l.t < (l.strong ? LIFE * 1.6 : LIFE));
  },
  draw(g) {
    for (const l of lines) {
      const age = (g.t - l.t) / (l.strong ? LIFE * 1.6 : LIFE);
      // fade in quickly, hold, fade out slowly
      const a = Math.min(1, (g.t - l.t) / 4) * (1 - Math.max(0, age - 0.4) / 0.6);
      const k = l.color === INK ? 0.2 : l.strong ? 0.6 : 0.4;
      g.text(l.x, l.y, l.s, l.color(Math.max(0, a * k)));
    }
  },
});

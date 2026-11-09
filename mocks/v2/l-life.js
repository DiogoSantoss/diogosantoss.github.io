// L · Life: Conway's Game of Life over the whole screen, wrapping at the edges. The text is a
// wall (cells there stay dead). New cells are blue, old ones fade to grey, dead cells leave a
// short trail. When the board goes quiet, a glider or an R-pentomino is dropped in to wake it.
import { run, INK, REQ, rnd, pick } from "./page.js";

const GLIDERS = [
  [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  [[1, 0], [0, 1], [0, 2], [1, 2], [2, 2]],
  [[1, 0], [2, 1], [2, 2], [1, 2], [0, 2]].map(([x, y]) => [x, 2 - y]),
  [[1, 0], [0, 1], [0, 2], [1, 2], [2, 2]].map(([x, y]) => [2 - x, 2 - y]),
];
const R_PENTOMINO = [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]];
const STEP = 2; // ticks per generation
const CW = 2; // a cell is two characters wide, so it is about square

let W, H, age, ghost, wall, quiet, gen;

const idx = (x, y) => ((y + H) % H) * W + ((x + W) % W);
function stamp(shape, x, y) { for (const [dx, dy] of shape) { const i = idx(x + dx, y + dy); if (!wall[i]) age[i] = 1; } }
function freeSpot(g) {
  for (let t = 0; t < 40; t++) {
    const x = rnd(0, W), y = rnd(0, H);
    if (!g.masked(x * CW, y) && !g.masked((x + 4) * CW, y + 4)) return [x, y];
  }
  return [0, 0];
}

run("L · life", {
  fps: 12,
  init(g) {
    W = Math.ceil(g.cols / CW); H = g.rows; gen = 0; quiet = 0;
    age = new Uint16Array(W * H); ghost = new Uint8Array(W * H); wall = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) wall[y * W + x] = g.masked(x * CW, y) || g.masked(x * CW + 1, y) ? 1 : 0;
    // seed a few random patches of soup instead of the whole screen
    for (let p = 0; p < Math.max(6, Math.floor((W * H) / 900)); p++) {
      const [sx, sy] = freeSpot(g);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (Math.random() < 0.38) { const i = idx(sx + x, sy + y); if (!wall[i]) age[i] = 1; }
    }
  },
  tick(g) {
    if (g.t % STEP) return;
    gen++;
    const next = new Uint16Array(W * H);
    let pop = 0, born = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (wall[i]) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && age[idx(x + dx, y + dy)]) n++;
        const alive = age[i] > 0;
        if (alive && (n === 2 || n === 3)) { next[i] = Math.min(age[i] + 1, 999); pop++; }
        else if (!alive && n === 3) { next[i] = 1; pop++; born++; }
        else if (alive) ghost[i] = 6;
        if (!next[i] && ghost[i]) ghost[i]--;
      }
    age = next;
    // quiet board: few births for a while, or a small population
    quiet = born < Math.max(6, pop * 0.02) ? quiet + 1 : 0;
    if (quiet > 30 || pop < (W * H) / 200) {
      const [x, y] = freeSpot(g);
      stamp(Math.random() < 0.35 ? R_PENTOMINO : pick(GLIDERS), x, y);
      quiet = 0;
    }
    // and a glider every ~8 s regardless, so something always travels
    if (gen % 50 === 0) { const [x, y] = freeSpot(g); stamp(pick(GLIDERS), x, y); }
  },
  draw(g) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x, a = age[i];
        if (a) {
          if (a < 3) g.put(x * CW, y, "●", REQ(0.42));
          else if (a < 12) g.put(x * CW, y, "•", REQ(0.32 - a * 0.012));
          else g.put(x * CW, y, "•", INK(Math.max(0.12, 0.24 - a * 0.002)));
        } else if (ghost[i]) g.put(x * CW, y, "·", INK(ghost[i] * 0.025));
      }
  },
});

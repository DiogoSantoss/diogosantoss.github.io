// A mesh of routers spread over the screen, shared by the routing scenes.
import { rnd } from "./page.js";

// cells of the straight line between two points (Bresenham)
export function line(x0, y0, x1, y1) {
  const out = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return out;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// one router per jittered grid cell (skipping the text), each linked to its 3 nearest neighbours
export function buildMesh(g, W = 16, H = 7) {
  const nodes = [], edges = [];
  for (let y = 2; y < g.rows - 2; y += H)
    for (let x = 2; x < g.cols - 2; x += W) {
      const nx = x + rnd(0, W - 3), ny = Math.min(g.rows - 2, y + rnd(0, H - 1));
      if (!g.masked(nx, ny)) nodes.push({ x: nx, y: ny, flash: 0 });
    }
  const adj = nodes.map(() => []);
  const edgeOf = (u, v) => adj[u].find((e) => e.a === v || e.b === v);
  nodes.forEach((n, i) => {
    nodes.map((m, j) => [j, Math.hypot(m.x - n.x, (m.y - n.y) * 2.2)]).filter(([j]) => j !== i)
      .sort((p, q) => p[1] - q[1]).slice(0, 3).forEach(([j]) => {
        if (edgeOf(i, j)) return;
        const e = { id: edges.length, a: i, b: j, cells: line(n.x, n.y, nodes[j].x, nodes[j].y) };
        edges.push(e); adj[i].push(e); adj[j].push(e);
      });
  });
  return { nodes, edges, adj, edgeOf };
}

// distance in cells from one router to every other (Dijkstra), skipping links in `down`
export function distances(mesh, from, down = new Map()) {
  const { nodes, adj } = mesh;
  const dist = nodes.map(() => Infinity), prev = nodes.map(() => -1), done = new Set();
  dist[from] = 0;
  while (done.size < nodes.length) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!done.has(i) && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break;
    done.add(u);
    for (const e of adj[u]) {
      if (down.has(e.id)) continue;
      const v = e.a === u ? e.b : e.a, d = dist[u] + e.cells.length - 1;
      if (d < dist[v]) { dist[v] = d; prev[v] = u; }
    }
  }
  return { dist, prev };
}

// shortest path as a list of routers, or null when there is none
export function route(mesh, a, b, down) {
  const { prev } = distances(mesh, a, down);
  const path = [b];
  while (path[0] !== a) { if (prev[path[0]] < 0) return null; path.unshift(prev[path[0]]); }
  return path;
}

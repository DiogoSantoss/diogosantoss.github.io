// A · Routing: a mesh of routers across the screen. Packets follow the shortest path;
// now and then a link fails, packets route around it, and the link comes back.
import { run, INK, REQ, DEL, ADD, rnd, pick } from "./page.js";
import { buildMesh, route } from "./mesh.js";

let mesh, packets, down;

run("A · routing", {
  init(g) {
    mesh = buildMesh(g); packets = []; down = new Map();
  },
  tick(g) {
    const { nodes, edges, edgeOf } = mesh;
    if (g.t % 4 === 0 && packets.length < 28) {
      const a = rnd(0, nodes.length), b = rnd(0, nodes.length);
      const path = a !== b && route(mesh, a, b, down);
      if (path && path.length > 3) packets.push({ path, i: 0, p: 0, dst: b, hist: [] });
    }
    // a link fails every ~20 s and heals after ~12 s
    if (g.t % 240 === 120) { const e = pick(edges); down.set(e.id, g.t); }
    for (const [id, t] of down) if (g.t - t > 150) down.delete(id);

    packets = packets.filter((k) => {
      const u = k.path[k.i], v = k.path[k.i + 1];
      const e = edgeOf(u, v);
      if (down.has(e.id)) {
        // the next link died: route again from here
        const again = route(mesh, u, k.dst, down);
        if (!again) return false;
        k.path = again; k.i = 0; k.p = 0; k.rerouted = g.t;
        return true;
      }
      const cells = e.a === u ? e.cells : [...e.cells].reverse();
      k.p += 1.4;
      if (k.p >= cells.length - 1) {
        k.i++; k.p = 0;
        nodes[v].flash = 1;
        return k.i < k.path.length - 1;
      }
      const [x, y] = cells[Math.floor(k.p)];
      k.hist.unshift([x, y]); k.hist = k.hist.slice(0, 7);
      k.x = x; k.y = y;
      return true;
    });
    nodes.forEach((n) => (n.flash *= 0.85));
  },
  draw(g) {
    for (const e of mesh.edges) {
      const dead = down.has(e.id);
      e.cells.forEach(([x, y], i) => {
        if (i === 0 || i === e.cells.length - 1 || i % 2) return;
        if (dead) g.put(x, y, i === Math.floor(e.cells.length / 2) ? "×" : "·", DEL(0.35));
        else g.put(x, y, "·", INK(0.07));
      });
    }
    for (const n of mesh.nodes) g.put(n.x, n.y, n.flash > 0.3 ? "◆" : "◇", n.flash > 0.3 ? REQ(0.25 + n.flash * 0.4) : INK(0.2));
    for (const k of packets) {
      if (k.x === undefined) continue;
      const fresh = k.rerouted && g.t - k.rerouted < 30;
      k.hist.forEach(([x, y], i) => g.put(x, y, "·", (fresh ? ADD : REQ)(0.35 - i * 0.045)));
      g.put(k.x, k.y, "●", (fresh ? ADD : REQ)(0.7));
    }
  },
});

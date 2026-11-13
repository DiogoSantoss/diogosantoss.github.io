// The work gallery: every card has a live 3D scene, but there is only one WebGL renderer. It covers
// the window with one fixed canvas, and each frame draws every card that is on screen into that
// card's rectangle (viewport + scissor), clipped to the scrolling list. Off-screen cards are paused.
// Returns { stop }; app.js calls it when the visitor leaves the page.
import * as THREE from "../vendor/three.js?v=0187b";
import { SCENES, makeKit } from "./scenes.js?v=20261133";

export function startGallery({ canvas, root }) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setScissorTest(true);
  renderer.autoClear = false;

  const views = [...root.querySelectorAll("[data-scene]")].map((el, i) => {
    const labels = Object.assign(document.createElement("div"), { className: "view-labels" });
    el.append(labels);
    const k = makeKit(labels, 7 + i * 31);
    SCENES[el.dataset.scene](k);
    // fill the queues and the trails before the first frame, so no card starts empty
    for (let t = 0; t < (reduce ? 6 : 1.5); t += 1 / 30) k.tick(1 / 30);
    return { el, k };
  });

  // drag a card's scene to turn it; on a project card a drag must not also open the link
  const ac = new AbortController();
  for (const { el, k } of views) {
    let at = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      e.preventDefault();
      at = { x: e.clientX, y: e.clientY, moved: false };
      k.drag.on = true; k.drag.vel = 0;
      el.setPointerCapture(e.pointerId); el.classList.add("turning");
    }, { signal: ac.signal });
    el.addEventListener("pointermove", (e) => {
      if (!at) return;
      const dx = e.clientX - at.x, dy = e.clientY - at.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) at.moved = true;
      k.drag.yaw -= dx * 0.4; k.drag.pitch += dy * 0.3; k.drag.vel = -dx * 0.4;
      at.x = e.clientX; at.y = e.clientY;
    }, { signal: ac.signal });
    const end = () => {
      if (!at) return;
      if (at.moved) el.closest("a")?.addEventListener("click", (e) => e.preventDefault(), { capture: true, once: true });
      at = null; k.drag.on = false; el.classList.remove("turning");
    };
    el.addEventListener("pointerup", end, { signal: ac.signal });
    el.addEventListener("pointercancel", end, { signal: ac.signal });
  }

  const v = new THREE.Vector3();
  let raf = 0, last = performance.now(), W = 0, H = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (innerWidth !== W || innerHeight !== H) {
      W = innerWidth; H = innerHeight;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(W, H); // also sets the CSS size: a canvas does not stretch to inset: 0 by itself
    }
    renderer.setScissor(0, 0, W, H);
    renderer.clear();
    const clip = root.getBoundingClientRect();
    for (const { el, k } of views) {
      const r = el.getBoundingClientRect();
      const x0 = Math.max(r.left, clip.left), x1 = Math.min(r.right, clip.right), y0 = Math.max(r.top, clip.top), y1 = Math.min(r.bottom, clip.bottom);
      if (x1 <= x0 || y1 <= y0) continue;
      if (!reduce) k.tick(dt);
      k.camera.aspect = r.width / r.height;
      k.camera.updateProjectionMatrix();
      renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
      renderer.setScissor(x0, H - y1, x1 - x0, y1 - y0);
      renderer.render(k.scene, k.camera);
      for (const l of k.labels) {
        if (!l.pos && !l.obj) continue;
        if (l.obj) l.obj.getWorldPosition(v).add(l.off); else v.copy(l.pos);
        v.project(k.camera);
        l.el.style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px)`;
        l.el.style.opacity = l.on && v.z < 1 ? "" : "0";
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      cancelAnimationFrame(raf);
      ac.abort();
      for (const { k } of views) k.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

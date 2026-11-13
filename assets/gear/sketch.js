// The gear page: the list on the left (desk / homelab tabs) and a 3D sketch of the room on the right.
// The whole room is always drawn; the tab picks which group the camera frames and which section shows.
// Hovering a row highlights its object; hovering an object highlights its rows. A click or a tap pins
// the highlight (that is how it works on phones); a second tap, or a tap on empty space, clears it.
// The sketch swings slowly; drag to turn it, scroll to zoom. Clicking a faded object, or a tab,
// flies the camera over to that group.
// With `edit`, the "e" key opens a layout editor: drag the things on the desk around, turn them with
// , and . and resize the desk. The layout is kept in localStorage; "copy" puts the values on the clipboard.
import { GROUPS, ITEMS, DESK, setDesk } from "./scene.js?v=20261124";
import { createView, worldBoxes } from "./engine.js?v=20261124";

const INK = (a) => `rgba(233,235,238,${a})`;
const REQ = (a) => `rgba(108,182,255,${a})`;
const PHONE = () => innerWidth < 760;

// Returns { stop }: the site swaps pages without reloading, so leaving the gear page must end the
// animation loop and drop every window listener.
export function startGear({ canvas, content, edit: editable = false }) {
  const ac = new AbortController(), signal = ac.signal;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const view = createView(canvas);
  const byId = (id) => ITEMS.find((it) => it.id === id);
  const groups = Object.keys(GROUPS);
  let sceneKey = groups.includes(location.hash.slice(1)) ? location.hash.slice(1) : groups[0];
  let listedIds = new Set();
  const inGroup = (i) => i >= 0 && ITEMS[i].group === sceneKey;
  const listed = (i) => inGroup(i) && listedIds.has(ITEMS[i].id);
  const hoverable = (i) => listed(i) || (inGroup(i) && !!ITEMS[i].label);
  const nameOf = (it) => it.label || content.querySelector(`li[data-id="${it.id}"] b`)?.textContent || it.id;
  let boxes = worldBoxes(ITEMS);
  let clip, hot = -1, rowHot = -1, picked = -1, swing = 0, drag = null, userYaw = 0, userPitch = 0, zoom = 1, other = -1, fly = null;
  const base = { yaw: 0, pitch: 0 };
  const editor = editable ? makeEditor() : null;

  function list() {
    content.querySelectorAll("section[data-group]").forEach((s) => (s.hidden = s.dataset.group !== sceneKey));
    content.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.group === sceneKey));
    listedIds = new Set([...content.querySelectorAll(`section[data-group="${sceneKey}"] li[data-id]`)].map((li) => li.dataset.id));
  }
  const pin = (i) => (picked = picked === i ? -1 : i);
  content.querySelectorAll("li[data-id]").forEach((li) => {
    const i = ITEMS.indexOf(byId(li.dataset.id));
    li.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && (rowHot = i));
    li.addEventListener("pointerleave", () => (rowHot = -1));
    li.addEventListener("click", () => pin(i));
  });
  content.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => b.dataset.group !== sceneKey && load(b.dataset.group, true)));

  function area() {
    if (PHONE()) {
      // between the page links at the top and the list
      const y = (document.querySelector(".pages")?.getBoundingClientRect().bottom || 0) + 8;
      return { x: 10, y, w: innerWidth - 20, h: innerHeight * 0.46 - y - 8 };
    }
    const r = content.getBoundingClientRect(), x = r.right + 40;
    // above the footer (badges and webring)
    return { x, y: 40, w: innerWidth - x - 40, h: innerHeight - 40 - 116 };
  }

  // the camera state that moves when flying between groups
  const snap = () => ({ target: [...view.cam.target], fit: view.cam.fit, cx: view.cam.cx, cy: view.cam.cy, yaw: base.yaw + Math.sin(swing / 300) * 16 + userYaw, pitch: base.pitch + userPitch });

  function load(key, animate = false) {
    const from = animate ? snap() : null;
    sceneKey = key; history.replaceState(null, "", "#" + key);
    hot = rowHot = picked = -1; userYaw = userPitch = 0; zoom = 1;
    list();
    clip = area();
    view.resize(clip);
    // aim at the middle of the group
    const mine = boxes.filter((b) => inGroup(b.owner)), vs = mine.flatMap((b) => b.verts);
    const lo = [0, 1, 2].map((k) => Math.min(...vs.map((v) => v[k]))), hi = [0, 1, 2].map((k) => Math.max(...vs.map((v) => v[k])));
    const cam = GROUPS[key].camera;
    Object.assign(view.cam, { yaw: cam.yaw, pitch: cam.pitch, target: lo.map((x, k) => (x + hi[k]) / 2) });
    const y = view.cam.yaw;
    view.fit(mine, [y - 20, y - 10, y, y + 10, y + 20], [0.92, 0.8]);
    Object.assign(base, { yaw: cam.yaw, pitch: cam.pitch });
    swing = 0;
    if (from) fly = { from, to: snap(), t0: performance.now(), ms: 900 };
  }

  function flying(now) {
    const k = Math.min(1, (now - fly.t0) / fly.ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const mix = (a, b) => a + (b - a) * e, { from, to } = fly;
    Object.assign(view.cam, {
      target: from.target.map((v, i) => mix(v, to.target[i])), fit: mix(from.fit, to.fit), cx: mix(from.cx, to.cx), cy: mix(from.cy, to.cy),
      yaw: mix(from.yaw, to.yaw), pitch: mix(from.pitch, to.pitch),
    });
    if (k === 1) Object.assign(view.cam, { target: to.target, fit: to.fit, cx: to.cx, cy: to.cy }), (fly = null);
  }

  addEventListener("resize", () => load(sceneKey), { signal });
  canvas.addEventListener("pointerdown", (e) => {
    if (editor && editor.down(e)) return;
    drag = { x: e.clientX, y: e.clientY, yaw: userYaw, pitch: userPitch }; canvas.style.cursor = "grabbing";
  });
  addEventListener("pointerup", (e) => {
    if (editor && editor.up()) return;
    if (!drag) return;
    const click = drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6;
    drag = null; canvas.style.cursor = "";
    if (!click || fly) return;
    // a click (not a drag): a faded object flies to its group, an object of this group is pinned
    const i = view.pick(e.clientX, e.clientY);
    if (i >= 0 && !inGroup(i)) return load(ITEMS[i].group, true);
    if (!hoverable(i)) return (picked = -1);
    pin(i);
    if (picked === i) content.querySelector(`section:not([hidden]) li[data-id="${ITEMS[i].id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, { signal });
  addEventListener("pointermove", (e) => {
    if (editor && editor.move(e)) return;
    if (drag) { userYaw = drag.yaw + (e.clientX - drag.x) * 0.3; userPitch = Math.max(-14, Math.min(24, drag.pitch - (e.clientY - drag.y) * 0.2)); return; }
    const i = e.target === canvas && !fly ? view.pick(e.clientX, e.clientY) : -1;
    hot = hoverable(i) ? i : -1;
    other = i >= 0 && !inGroup(i) ? i : -1;
    canvas.style.cursor = other >= 0 ? "pointer" : "";
  }, { signal });
  canvas.addEventListener("mouseleave", () => (hot = -1));
  // zoom towards the cursor, so the point under it stays put
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (fly) return;
    const next = Math.max(0.6, Math.min(4, zoom * Math.exp(-e.deltaY * 0.0015))), k = next / zoom;
    zoom = next;
    const { cam } = view;
    cam.fit *= k; cam.cx = e.clientX + (cam.cx - e.clientX) * k; cam.cy = e.clientY + (cam.cy - e.clientY) * k;
  }, { passive: false });

  load(sceneKey);
  function frame(now) {
    if (signal.aborted) return;
    const active = rowHot >= 0 ? rowHot : hot >= 0 ? hot : picked, activeId = active >= 0 ? ITEMS[active].id : null;
    content.querySelectorAll("li[data-id]").forEach((li) => li.classList.toggle("hot", li.dataset.id === activeId));
    if (fly) reduce ? (fly.t0 = -Infinity, flying(now)) : flying(now);
    else {
      // gentle swing unless the user is turning it, looking at something, or editing
      if (!drag && active < 0 && !(editor && editor.on) && !reduce) swing += 1;
      view.cam.yaw = base.yaw + Math.sin(swing / 300) * 16 + userYaw;
      view.cam.pitch = base.pitch + userPitch;
    }
    draw(active);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  signal.addEventListener("abort", () => editor?.panel.remove());

  function draw(active) {
    const { ctx } = view;
    const [W, H] = view.size();
    ctx.clearRect(0, 0, W, H);
    // a soft dark halo so the background mesh fades out behind the sketch
    const hx = clip.x + clip.w / 2, hy = clip.y + clip.h / 2, hr = Math.max(clip.w, clip.h) * 0.62;
    const halo = ctx.createRadialGradient(hx, hy, hr * 0.25, hx, hy, hr);
    halo.addColorStop(0, "rgba(11,12,14,0.92)"); halo.addColorStop(1, "rgba(11,12,14,0)");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H);
    const segs = view.render(boxes);
    ctx.save(); ctx.beginPath();
    if (PHONE()) ctx.rect(0, 0, W, clip.y + clip.h + 12); else ctx.rect(clip.x, 0, W - clip.x, H);
    ctx.clip();
    const selIdx = editor && editor.on ? ITEMS.indexOf(byId(editor.sel)) : -1;
    for (const s of segs) {
      const on = s.owner === active || s.owner === selIdx, mine = inGroup(s.owner);
      // furniture (not listed, not hoverable) stays quieter than the things on it
      const b = !mine ? 0.16 : !hoverable(s.owner) ? 0.34 : 0.66;
      const a = on ? 1 : active >= 0 && mine ? Math.min(b, 0.3) : b;
      ctx.strokeStyle = s.color ? s.color.replace("A", on ? 1 : a * 1.1) : on ? REQ(0.95) : INK(a);
      ctx.lineWidth = on ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
    }
    if (active >= 0) label(ctx, active);
    ctx.restore();
  }

  // top-centre of an item, in screen space
  function anchor(i) {
    let top = null;
    for (const b of boxes) if (b.owner === i) for (const v of b.verts) if (!top || v[1] > top[1]) top = v;
    const vs = boxes.filter((b) => b.owner === i).flatMap((b) => b.verts);
    const mid = vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1], s[2] + v[2]], [0, 0, 0]).map((x) => x / vs.length);
    return view.screen([mid[0], top[1], mid[2]]);
  }

  function label(ctx, i) {
    const p = anchor(i), text = nameOf(ITEMS[i]);
    ctx.font = '12px "Spline Sans Mono", monospace';
    // point the label left when it would run off the right edge
    const dir = p.x + 18 + ctx.measureText(text).width > view.size()[0] - 8 ? -1 : 1;
    ctx.strokeStyle = REQ(0.5); ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x + 14 * dir, p.y - 22); ctx.stroke();
    ctx.fillStyle = REQ(0.95); ctx.textAlign = dir < 0 ? "end" : "start";
    ctx.fillText(text, p.x + 18 * dir, p.y - 24); ctx.textAlign = "start";
  }

  // ── layout editor (only with `edit`) ───────────────────
  function makeEditor() {
    const EDITABLE = ["mac", "side", "dock", "main", "bonsai", "keyboard", "mouse", "sony", "chair"];
    const FOLLOW = { main: "camera" }; // the webcam sits on the main monitor
    const ed = { on: false, sel: "mac" };
    let moving = null;
    const move = (id, dx, dz, dyaw = 0) => {
      for (const k of [id, FOLLOW[id]].filter(Boolean)) { const it = byId(k); it.at[0] += dx; it.at[2] += dz; it.yaw = (it.yaw || 0) + dyaw; }
    };
    const saved = JSON.parse(localStorage.getItem("gear-layout") || "null");
    if (saved) {
      for (const id of EDITABLE) if (saved[id]) { const it = byId(id); move(id, saved[id].at[0] - it.at[0], saved[id].at[2] - it.at[2], saved[id].yaw - (it.yaw || 0)); }
      if (saved.desk) setDesk(saved.desk.w, saved.desk.d);
      boxes = worldBoxes(ITEMS);
    }
    if (!document.getElementById("edit-css")) document.head.append(Object.assign(document.createElement("style"), { id: "edit-css", textContent: `
      .edit { position: fixed; right: 18px; bottom: 18px; z-index: 3; font-size: 12px; color: var(--mid); background: rgba(11,12,14,.9);
        border: 1px solid rgba(233,235,238,.15); padding: 10px 12px; display: none; grid-template-columns: auto auto; gap: 6px 12px; align-items: center; }
      .edit.on { display: grid; }
      .edit b { color: var(--ink); font-weight: 500; grid-column: 1 / -1; }
      .edit input, .edit select, .edit button { all: unset; color: var(--ink); background: rgba(233,235,238,.07); padding: 1px 6px; border-radius: 2px; }
      .edit input { width: 5ch; text-align: right; } .edit select { min-width: 9ch; }
      .edit button { cursor: pointer; } .edit button:hover { color: var(--req); }
      .edit .row { display: flex; gap: 6px; align-items: center; }
      .edit .hint { grid-column: 1 / -1; color: var(--dim); font-size: 11px; }
      body.editing #scene { cursor: crosshair; }` }));
    const panel = Object.assign(document.createElement("div"), { className: "edit" });
    panel.innerHTML = `<b>edit layout</b>
      <span>item</span><select id="e-item">${EDITABLE.map((id) => `<option>${id}</option>`).join("")}</select>
      <span>x · z</span><span class="row"><input id="e-x" type="number" step="1" /><input id="e-z" type="number" step="1" /></span>
      <span>yaw</span><input id="e-yaw" type="number" step="1" />
      <span>desk w × d</span><span class="row"><input id="e-w" type="number" step="5" /><input id="e-d" type="number" step="5" /></span>
      <span class="row"><button id="e-copy">copy</button><button id="e-reset">reset</button></span><span></span>
      <span class="hint">drag an item · arrows move 1 cm (shift 5) · , . turn · tab switches · e closes</span>`;
    document.body.append(panel);
    const $ = (id) => panel.querySelector("#" + id);
    const rebuild = () => {
      boxes = worldBoxes(ITEMS);
      const out = {};
      for (const id of EDITABLE) out[id] = { at: byId(id).at.map((v) => Math.round(v)), yaw: Math.round(byId(id).yaw || 0) };
      out.desk = { ...DESK };
      localStorage.setItem("gear-layout", JSON.stringify(out));
    };
    const sync = () => {
      const it = byId(ed.sel);
      $("e-item").value = ed.sel; $("e-x").value = Math.round(it.at[0]); $("e-z").value = Math.round(it.at[2]); $("e-yaw").value = Math.round(it.yaw || 0);
      $("e-w").value = DESK.w; $("e-d").value = DESK.d;
    };
    const nudge = (dx, dz, dyaw = 0) => { move(ed.sel, dx, dz, dyaw); rebuild(); sync(); };
    $("e-item").addEventListener("change", (e) => { ed.sel = e.target.value; sync(); });
    for (const [id, f] of [["e-x", (v) => move(ed.sel, v - byId(ed.sel).at[0], 0)], ["e-z", (v) => move(ed.sel, 0, v - byId(ed.sel).at[2])], ["e-yaw", (v) => move(ed.sel, 0, 0, v - (byId(ed.sel).yaw || 0))], ["e-w", (v) => setDesk(v, DESK.d)], ["e-d", (v) => setDesk(DESK.w, v)]])
      $(id).addEventListener("input", (e) => { const v = Number(e.target.value); if (Number.isFinite(v)) { f(v); rebuild(); } });
    $("e-copy").addEventListener("click", () => {
      const txt = EDITABLE.map((id) => `${id}: at [${byId(id).at.map((v) => Math.round(v)).join(", ")}], yaw ${Math.round(byId(id).yaw || 0)}`).concat(`desk: ${DESK.w} × ${DESK.d}`).join("\n");
      navigator.clipboard.writeText(txt); $("e-copy").textContent = "copied"; setTimeout(() => ($("e-copy").textContent = "copy"), 900);
    });
    $("e-reset").addEventListener("click", () => { localStorage.removeItem("gear-layout"); location.reload(); });
    addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.key === "e") { ed.on = !ed.on; panel.classList.toggle("on", ed.on); document.body.classList.toggle("editing", ed.on); sync(); return; }
      if (!ed.on) return;
      const k = e.shiftKey ? 5 : 1;
      const map = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k], ",": [0, 0, -5 * (e.shiftKey ? 3 : 1)], ".": [0, 0, 5 * (e.shiftKey ? 3 : 1)] };
      if (map[e.key]) { e.preventDefault(); nudge(...map[e.key]); }
      if (e.key === "Tab") { e.preventDefault(); ed.sel = EDITABLE[(EDITABLE.indexOf(ed.sel) + 1) % EDITABLE.length]; sync(); }
    }, { signal });
    // screen movement -> desk-plane movement, from how 1 cm in x and in z project at the item
    function dragItem(it, mx, my) {
      const p = it.at, o = view.screen(p), sx = view.screen([p[0] + 1, p[1], p[2]]), sz = view.screen([p[0], p[1], p[2] + 1]);
      const a = sx.x - o.x, b = sz.x - o.x, c = sx.y - o.y, d = sz.y - o.y, det = a * d - b * c;
      if (Math.abs(det) < 1e-6) return;
      move(it.id, (mx * d - b * my) / det, (a * my - c * mx) / det);
    }
    ed.down = (e) => {
      const i = view.pick(e.clientX, e.clientY);
      if (!ed.on || i < 0 || !EDITABLE.includes(ITEMS[i].id)) return false;
      ed.sel = ITEMS[i].id; sync(); moving = { x: e.clientX, y: e.clientY };
      return true;
    };
    ed.up = () => { if (!moving) return false; moving = null; rebuild(); sync(); return true; };
    ed.move = (e) => {
      if (!moving) return false;
      dragItem(byId(ed.sel), e.clientX - moving.x, e.clientY - moving.y); moving = { x: e.clientX, y: e.clientY }; boxes = worldBoxes(ITEMS);
      return true;
    };
    ed.panel = panel;
    return ed;
  }

  return { stop: () => ac.abort() };
}

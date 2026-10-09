// Shared character-grid renderer for the mocks. Each mock supplies init/tick/draw.
export async function startAscii(canvas, opts) {
  const {
    fontFamily,
    fontSize = 14,
    lineHeight = 1.35,
    fps = 12,
    bg,
    masks = [],
    maskPad = [2, 1],
    init,
    tick,
    draw,
  } = opts;

  const ctx = canvas.getContext("2d");
  const g = { cols: 0, rows: 0, cw: 0, ch: 0, t: 0, masks: [] };
  // canvas text does not trigger font loading, so load the face explicitly before measuring
  await document.fonts.load(`${fontSize}px ${fontFamily}`).catch(() => {});
  await document.fonts.ready;

  g.masked = (x, y) =>
    g.masks.some((m) => x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1);

  g.put = (x, y, c, color) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= g.cols || y >= g.rows || c === " ") return;
    if (g.masked(x, y)) return;
    ctx.fillStyle = color;
    ctx.fillText(c, x * g.cw, y * g.ch + (g.ch - fontSize) / 2);
  };

  // Filled, optionally stroked box in cell coordinates (used behind labels).
  g.rect = (x, y, w, h, fill, stroke) => {
    const px = Math.round(x * g.cw) - 3, py = Math.round(y * g.ch) + 1;
    const pw = Math.round(w * g.cw) + 6, ph = Math.round(h * g.ch) - 2;
    ctx.fillStyle = fill;
    ctx.fillRect(px, py, pw, ph);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    }
  };

  g.text = (x, y, str, color) => {
    for (let i = 0; i < str.length; i++) g.put(x + i, y, str[i], color);
  };

  let w = 0;
  let h = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "top";
    g.cw = ctx.measureText("M").width;
    g.ch = Math.round(fontSize * lineHeight);
    g.cols = Math.ceil(w / g.cw);
    g.rows = Math.ceil(h / g.ch);
    g.masks = masks.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x0: Math.floor(r.left / g.cw) - maskPad[0],
        x1: Math.ceil(r.right / g.cw) + maskPad[0],
        y0: Math.floor(r.top / g.ch) - maskPad[1],
        y1: Math.ceil(r.bottom / g.ch) + maskPad[1],
      };
    });
    g.t = 0;
    init(g);
  }

  function render() {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    draw(g);
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let timer;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      resize();
      if (reduce) warmStatic();
    }, 120);
  });

  // ?warm=N fast-forwards N ticks (debugging); errors are written into the page title
  const warm = Number(new URLSearchParams(location.search).get("warm")) || 240;
  function warmStatic() {
    try {
      for (let i = 0; i < warm; i++) {
        tick(g);
        if (i % 50 === 0) render();
      }
      render();
    } catch (e) {
      document.title = "ERR " + e.message + " @ " + (e.stack || "").split("\n")[1];
      throw e;
    }
  }

  resize();
  if (reduce) {
    warmStatic();
    return;
  }

  let last = 0;
  function frame(now) {
    if (now - last >= 1000 / fps) {
      last = now;
      tick(g);
      render();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

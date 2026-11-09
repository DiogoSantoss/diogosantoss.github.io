// Shared shell for the v2 mocks: the real home text in front, a full-screen ambient scene behind it.
// Press "h" to hide the text and look at the background alone.
import { startAscii } from "/assets/grid.js";

export const BG = "#0b0c0e";
export const INK = (a) => `rgba(233,235,238,${a})`;
export const REQ = (a) => `rgba(108,182,255,${a})`;
export const USR = (a) => `rgba(255,159,67,${a})`;
export const ADD = (a) => `rgba(94,227,138,${a})`;
export const DEL = (a) => `rgba(255,107,107,${a})`;
export const rnd = (a, b) => a + Math.floor(Math.random() * (b - a));
export const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

const HOME = `
  <nav class="pages">
    <a href="/" aria-current="page">home</a>
    <a href="/work">work</a>
    <a href="/gear">gear</a>
    <a href="/blog">blog</a>
  </nav>
  <h1>Diogo Santos</h1>
  <p>Systems engineer at Cloudflare, building Email Service. Previously a protocol engineer at DV Labs, making distributed validators for Ethereum more resilient. MSc in Computer Science and Engineering from Instituto Superior Técnico.</p>
  <div class="links">
    <a href="https://github.com/DiogoSantoss">github</a>
    <a href="https://www.linkedin.com/in/diogo-silva-santos/">linkedin</a>
    <a href="https://x.com/l_Didas_l">twitter</a>
    <a href="/cv-diogo-santos.pdf">cv</a>
  </div>`;

export function run(name, scene) {
  const canvas = document.createElement("canvas");
  const content = Object.assign(document.createElement("main"), { className: "content", innerHTML: HOME });
  const footer = Object.assign(document.createElement("footer"), { className: "webring", innerHTML: "<a>« Eduardo Espadeiro</a><span>webring</span><a>Vasco Correia »</a>" });
  const tag = Object.assign(document.createElement("a"), { href: "./", textContent: `v2 · ${name} · h hides text` });
  tag.style.cssText = "position:fixed;top:14px;right:18px;font-size:11px;color:rgba(233,235,238,.28);z-index:2";
  document.body.append(canvas, content, footer, tag);

  let masks = [content, footer];
  addEventListener("keydown", (e) => {
    if (e.key !== "h") return;
    const off = content.style.visibility !== "hidden";
    content.style.visibility = footer.style.visibility = off ? "hidden" : "";
    masks.length = 0;
    if (!off) masks.push(content, footer);
    dispatchEvent(new Event("resize"));
  });

  startAscii(canvas, {
    fontFamily: '"Spline Sans Mono", monospace',
    fontSize: innerWidth < 760 ? 11 : 12,
    lineHeight: 1.45,
    fps: scene.fps || 12,
    bg: BG,
    masks,
    init: scene.init,
    tick(g) { g.t++; scene.tick(g); },
    draw: scene.draw,
  });
}

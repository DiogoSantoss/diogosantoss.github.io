// The site shell. Every page loads this one module. It starts the background once, then handles clicks
// on internal links itself: it fetches the next page, swaps the page content in place and keeps the
// background, the page links and the fonts as they are. The mesh does not restart between pages.
// Each page sets <body data-page="…">; `PAGES` starts that page's script and stops it again on leave.
import { startBgp } from "./bgp.js?v=20261127";

const V = new URL(import.meta.url).searchParams.get("v") || "";
// the background, the page links and the footer (badges, webring) stay through page swaps
const KEEP = (el) => el.id === "bg" || el.matches("nav.pages, .badges, .webring, script");
const html = new Map(); // path -> Promise<{ doc, status }>
let here = location.pathname;

const PAGES = {
  gear: async (signal) => {
    const { startGear } = await import(`./gear/sketch.js?v=${V}`);
    if (signal.aborted) return;
    const gear = startGear({
      canvas: document.getElementById("scene"),
      content: document.getElementById("content"),
      edit: new URLSearchParams(location.search).has("edit"),
    });
    signal.addEventListener("abort", gear.stop);
  },
  work: async (signal) => {
    const { startGallery } = await import(`./work/gallery.js?v=${V}`);
    if (signal.aborted) return;
    const g = startGallery({ canvas: document.getElementById("works"), root: document.getElementById("content") });
    signal.addEventListener("abort", g.stop);
  },
  lost: () => {
    const path = location.pathname;
    document.getElementById("lost-path").textContent = path.length > 28 ? path.slice(0, 27) + "…" : path;
  },
};

// the footer is on every page and is set up once
import(`./webring.js?v=${V}`).then(({ startWebring }) => startWebring(document.getElementById("webring")));
// the badge strip loops: a second copy of the badges follows the first
const track = document.querySelector(".badges .track");
if (track) for (const a of [...track.children]) track.append(Object.assign(a.cloneNode(true), { tabIndex: -1 }));

const bgp = await startBgp({ canvas: document.getElementById("bg"), masks: masks() });
let page = start();

function masks() {
  return [...document.querySelectorAll("[data-mask]")];
}

function start() {
  const ac = new AbortController();
  PAGES[document.body.dataset.page]?.(ac.signal);
  return ac;
}

function load(path) {
  if (!html.has(path))
    html.set(path, fetch(path).then(async (r) => ({ doc: new DOMParser().parseFromString(await r.text(), "text/html"), status: r.status })));
  const p = html.get(path);
  p.catch(() => html.delete(path));
  return p;
}

const internal = (a) =>
  a && a.origin === location.origin && !a.target && !a.hasAttribute("download") && !/\.\w+$/.test(a.pathname) && !a.pathname.startsWith("/mocks");

async function go(url, push) {
  let next;
  try { next = await load(url.pathname); } catch { return (location.href = url.href); }
  const { doc } = next;
  // a tab that has been open across a deploy runs the old app.js; the new page may need code it lacks,
  // so when the versions differ, load the page in full instead of swapping it in
  const theirs = doc.querySelector('script[src*="/assets/app.js"]')?.getAttribute("src");
  if (!theirs || new URL(theirs, location.href).searchParams.get("v") !== V) return (location.href = url.href);
  const swap = () => {
    page.abort();
    for (const el of [...document.body.children]) if (!KEEP(el)) el.remove();
    const nav = document.querySelector("nav.pages");
    // clone, so the cached page stays whole for the next visit
    for (const src of doc.body.children) {
      if (KEEP(src)) continue;
      const el = document.importNode(src, true);
      src.matches("canvas, [data-mask]") ? nav.before(el) : document.body.append(el);
    }
    document.body.className = doc.body.className;
    document.body.dataset.page = doc.body.dataset.page;
    document.title = doc.title;
    for (const sel of ['meta[name="description"]', 'link[rel="canonical"]'])
      document.querySelector(sel)?.replaceWith(doc.querySelector(sel).cloneNode());
    for (const a of nav.querySelectorAll("a")) a.pathname === url.pathname ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
    if (push) history.pushState(null, "", url.href);
    here = url.pathname;
    page = start();
    bgp.setMasks(masks());
    bgp.refit();
    document.getElementById("content")?.focus({ preventScroll: true });
  };
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(swap);
  else swap();
}

addEventListener("click", (e) => {
  const a = e.target.closest("a[href]");
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !internal(a)) return;
  e.preventDefault();
  if (a.pathname === location.pathname) return a.hash !== location.hash && (location.hash = a.hash);
  go(new URL(a.href), true);
});
addEventListener("popstate", () => {
  if (location.pathname !== here) go(new URL(location.href), false);
});
// fetch a page as soon as the pointer or the finger lands on its link
for (const type of ["pointerover", "touchstart", "focusin"])
  addEventListener(type, (e) => { const a = e.target.closest?.("a[href]"); if (internal(a) && a.pathname !== location.pathname) load(a.pathname); }, { passive: true });

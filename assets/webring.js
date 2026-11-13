// pombosmalvados webring: links to the previous and next member around me.
// The member list is fetched once per visit and reused when the home page is shown again.
const link = (href, text) => Object.assign(document.createElement("a"), { href, textContent: text });
let ring;

export function startWebring(box, signal) {
  if (!box) return;
  ring ||= fetch("https://pombosmalvados.github.io/webring/webring.json").then((r) => r.json());
  ring
    .then((members) => {
      if (signal?.aborted) return;
      const i = members.findIndex((m) => m.name.toLowerCase() === "diogo santos");
      if (i === -1) return;
      const prev = members[(i - 1 + members.length) % members.length];
      const next = members[(i + 1) % members.length];
      const first = (m) => m.name.split(" ")[0];
      // full names when they fit, first names on narrow screens
      const render = (short) => {
        const label = Object.assign(document.createElement("span"), { textContent: "webring" });
        const a = link(prev.url, `« ${short ? first(prev) : prev.name}`);
        const b = link(next.url, `${short ? first(next) : next.name} »`);
        a.title = prev.name; b.title = next.name;
        box.replaceChildren(a, label, b);
      };
      const fit = () => { render(false); if (box.scrollWidth > box.clientWidth) render(true); };
      fit();
      addEventListener("resize", fit, { signal });
    })
    .catch(() => {});
}

// pombosmalvados webring: links to the previous and next member around me
const box = document.getElementById("webring");
const link = (href, text) => Object.assign(document.createElement("a"), { href, textContent: text });

if (box)
  fetch("https://pombosmalvados.github.io/webring/webring.json")
    .then((r) => r.json())
    .then((ring) => {
      const i = ring.findIndex((m) => m.name.toLowerCase() === "diogo santos");
      if (i === -1) return;
      const prev = ring[(i - 1 + ring.length) % ring.length];
      const next = ring[(i + 1) % ring.length];
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
      addEventListener("resize", fit);
    })
    .catch(() => {});

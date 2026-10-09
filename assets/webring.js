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
      const label = Object.assign(document.createElement("span"), { textContent: "webring" });
      box.replaceChildren(link(prev.url, `« ${prev.name}`), label, link(next.url, `${next.name} »`));
    })
    .catch(() => {});

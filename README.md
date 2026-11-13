# diogoms.com

Personal site. Plain HTML, CSS and ES modules, no build step. The background is a BGP mesh: autonomous systems exchange route announcements and withdrawals, drawn as ASCII on a canvas (`assets/bgp.js`, `assets/grid.js`). The gear page draws the desk and the homelab as a hidden-line 3D sketch (`assets/gear/`); `/gear?edit` and the `e` key open a layout editor.

Run locally (clean URLs and 404 page like GitHub Pages):

```sh
python3 mocks/serve.py 4321
```

`mocks/` holds design experiments. It is excluded from the published site by `_config.yml`.

CSS and JS links carry a `?v=YYYYMMDD` version, because GitHub Pages lets browsers cache assets for 10 minutes. Bump it in the HTML pages and in the module imports when a change must reach visitors at once.

Every page loads one module, `assets/app.js`. It starts the background once and handles internal links itself: it fetches the next page (already on hover or touch), swaps the content with a short cross-fade, and leaves the mesh and the page links in place. Each page names its script with `<body data-page="…">`.


The 88×31 buttons in the footer of every page are by Cody Collier ([a90.com/experiments/88x31](https://a90.com/experiments/88x31/), "Take one."). They are hosted here and each links back to his page.

The work page is a gallery: each job and project has a live 3D scene (`assets/work/scenes.js`). One three.js renderer (`assets/work/gallery.js`) draws all visible cards into their own rectangles of a single canvas, and pauses the ones off screen. `assets/vendor/three.js` is a tree-shaken, minified build of three.js r187 (MIT) with only the classes the scenes use.

Names like Cloudflare and Técnico are chips: `<span class="chip cf">` with a pixel-art logo from `assets/chips/`.

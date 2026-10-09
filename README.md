# diogoms.com

Personal site. Plain HTML, CSS and ES modules, no build step. The background is a consistent hash ring backed by an AVL tree, drawn as ASCII on a canvas (`assets/ring.js`, `assets/grid.js`).

Run locally (clean URLs and 404 page like GitHub Pages):

```sh
python3 mocks/serve.py 4321
```

`mocks/` holds design experiments. It is excluded from the published site by `_config.yml`.

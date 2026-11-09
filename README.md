# diogoms.com

Personal site. Plain HTML, CSS and ES modules, no build step. The background is a BGP mesh: autonomous systems exchange route announcements and withdrawals, drawn as ASCII on a canvas (`assets/bgp.js`, `assets/grid.js`). The gear page draws the desk and the homelab as a hidden-line 3D sketch (`assets/gear/`); `/gear?edit` and the `e` key open a layout editor.

Run locally (clean URLs and 404 page like GitHub Pages):

```sh
python3 mocks/serve.py 4321
```

`mocks/` holds design experiments. It is excluded from the published site by `_config.yml`.

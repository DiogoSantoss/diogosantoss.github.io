// Rasterises Natural Earth land polygons onto the character grid and exposes a lat/lon projection.
import { feature } from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

let landPromise;
export function loadLand() {
  landPromise ||= fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json")
    .then((r) => r.json())
    .then((t) => feature(t, t.objects.land));
  return landPromise;
}

export const CITIES = {
  lis: [38.7, -9.1], mad: [40.4, -3.7], lhr: [51.5, -0.1], ams: [52.4, 4.9], fra: [50.1, 8.7],
  cdg: [49.0, 2.5], mxp: [45.6, 8.7], waw: [52.2, 21.0], hel: [60.2, 24.9], arn: [59.6, 17.9],
  ist: [41.0, 29.0], ath: [37.9, 23.7], cai: [30.0, 31.2], dxb: [25.2, 55.3], ruh: [24.7, 46.7],
  del: [28.6, 77.1], bom: [19.1, 72.9], blr: [13.0, 77.6], cmb: [7.2, 79.9], dac: [23.8, 90.4],
  sin: [1.35, 103.8], kul: [3.1, 101.7], bkk: [13.7, 100.7], cgk: [-6.1, 106.7], mnl: [14.5, 121.0],
  hkg: [22.3, 114.2], tpe: [25.1, 121.2], icn: [37.5, 126.4], nrt: [35.7, 139.7], kix: [34.4, 135.2],
  syd: [-33.9, 151.2], mel: [-37.7, 144.8], per: [-31.9, 115.9], bne: [-27.4, 153.1], akl: [-37.0, 174.8],
  jnb: [-26.2, 28.0], cpt: [-33.9, 18.6], los: [6.5, 3.4], acc: [5.6, -0.2], nbo: [-1.3, 36.8],
  gru: [-23.5, -46.6], gig: [-22.8, -43.2], eze: [-34.6, -58.4], scl: [-33.4, -70.8], lim: [-12.0, -77.1],
  bog: [4.7, -74.1], pty: [9.0, -79.5], mex: [19.4, -99.1], mia: [25.8, -80.3], atl: [33.6, -84.4],
  iad: [38.9, -77.4], ewr: [40.7, -74.2], bos: [42.4, -71.0], ord: [41.9, -87.6], dfw: [32.9, -97.0],
  den: [39.8, -104.7], phx: [33.4, -112.0], lax: [34.0, -118.4], sjc: [37.4, -121.9], sea: [47.5, -122.3],
  yyz: [43.7, -79.6], yul: [45.5, -73.6], yvr: [49.2, -123.2], anc: [61.2, -150.0], hnl: [21.3, -157.9],
};

const rad = (d) => (d * Math.PI) / 180;
export function hav([la1, lo1], [la2, lo2]) {
  const a = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(a)) * 6371; // km
}

export function rasterize(g, land, { latTop = 78, latBot = -58, stretch = 1.45, x0 = 0, width = g.cols } = {}) {
  const mapW = width;
  const mapH = Math.min(g.rows - 2, Math.round(((mapW * g.cw * (latTop - latBot)) / 360 / g.ch) * stretch));
  const mapY0 = Math.floor((g.rows - mapH) / 2);
  const project = (lat, lon) => [x0 + ((lon + 180) / 360) * mapW, mapY0 + ((latTop - lat) / (latTop - latBot)) * mapH];
  const unproject = (x, y) => [latTop - ((y - mapY0) / mapH) * (latTop - latBot), ((x - x0) / mapW) * 360 - 180];

  const off = document.createElement("canvas");
  off.width = g.cols;
  off.height = g.rows;
  const c = off.getContext("2d");
  c.fillStyle = "#fff";
  c.beginPath();
  const polys = land.features.flatMap((f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates));
  polys.forEach((poly) =>
    poly.forEach((ring) => {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = project(lat, lon);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      });
      c.closePath();
    }),
  );
  c.fill("evenodd");
  const data = c.getImageData(0, 0, g.cols, g.rows).data;
  const landCells = [];
  for (let i = 0; i < g.cols * g.rows; i++) if (data[i * 4 + 3] > 90) landCells.push(i);
  return { project, unproject, landCells, mapY0, mapH };
}

export function drawLand(g, map, color) {
  for (const i of map.landCells) {
    const x = i % g.cols, y = Math.floor(i / g.cols);
    g.put(x, y, (x + y) % 2 ? "·" : ".", color);
  }
}

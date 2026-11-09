// The gear room, built from boxes. Units are centimetres; x right, y up, z towards you.
// A part is { c: centre, s: size, rx?/rz?: tilt in degrees, yaw?: turn in degrees, color? }.
// An item moves and turns all its parts together with `at` and `yaw`, and belongs to a group
// (the tabs). Each group has a camera that frames it.
// Items are matched to list rows by id. Items without a row are furniture, unless they have a
// `label`: then they can be hovered and show it.

export const DESK_Y = 75;
export const DESK = { w: 160, d: 60 };
const POT = "rgba(70,96,170,A)", WOOD = "rgba(160,112,74,A)", LEAF = "rgba(104,180,98,A)";

// the IKEA frame: top, two T-legs with feet, a crossbar
const deskParts = (w, d) => [
  { c: [0, DESK_Y - 1.25, 0], s: [w, 2.5, d] },
  { c: [-(w / 2 - 14), 38, 0], s: [7, 68, 5] },
  { c: [w / 2 - 14, 38, 0], s: [7, 68, 5] },
  { c: [-(w / 2 - 14), 1.5, 0], s: [7, 3, d - 10] },
  { c: [w / 2 - 14, 1.5, 0], s: [7, 3, d - 10] },
  { c: [0, 68, 0], s: [w - 35, 5, 5] },
];

// resize the desk; the PC (and the headset on it) stays tight against the inside of the right leg
export function setDesk(w, d) {
  DESK.w = w; DESK.d = d;
  ITEMS.find((it) => it.id === "desk").parts = deskParts(w, d);
  const x = w / 2 - 14 - 3.5 - 1 - 23.5 / 2;
  for (const id of ["pc", "audio"]) ITEMS.find((it) => it.id === id).at[0] = x;
}

// headphones lying flat: two ear cups joined by a band that curves back
function headphones(r, cup) {
  const parts = [
    { c: [-r, cup[1] / 2, 0], s: cup },
    { c: [r, cup[1] / 2, 0], s: cup },
  ];
  const N = 8, y = cup[1] * 0.7;
  for (let k = 0; k < N; k++) {
    const a0 = (Math.PI * k) / N, a1 = (Math.PI * (k + 1)) / N;
    const x0 = -r * Math.cos(a0), z0 = -r * Math.sin(a0) * 1.1, x1 = -r * Math.cos(a1), z1 = -r * Math.sin(a1) * 1.1;
    const len = Math.hypot(x1 - x0, z1 - z0);
    parts.push({ c: [(x0 + x1) / 2, y, (z0 + z1) / 2], s: [len + 0.6, 1.4, 3], yaw: (Math.atan2(-(z1 - z0), x1 - x0) * 180) / Math.PI });
  }
  return parts;
}

// a table top on four legs
const table = (w, d, h, leg = 3) => [
  { c: [0, h - 1.25, 0], s: [w, 2.5, d] },
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => ({ c: [sx * (w / 2 - leg), (h - 2.5) / 2, sz * (d / 2 - leg)], s: [leg, h - 2.5, leg] })),
];

export const GROUPS = {
  desk: { camera: { yaw: -22, pitch: 20 } },
  homelab: { camera: { yaw: -34, pitch: 24 } },
};

export const ITEMS = [
  // ── desk ──────────────────────────────────────────────
  { id: "desk", group: "desk", at: [0, 0, 0], parts: deskParts(DESK.w, DESK.d) },
  {
    id: "main", group: "desk",
    at: [3, DESK_Y, -17],
    parts: [
      { c: [0, 30, 0], s: [61, 36, 4] },
      { c: [0, 7, -4], s: [5, 14, 3] },
      { c: [0, 0.75, 0], s: [26, 1.5, 20] },
    ],
  },
  { id: "camera", group: "desk", at: [3, DESK_Y, -17], parts: [{ c: [0, 50, 0.5], s: [9, 3, 4] }] },
  {
    id: "side", group: "desk",
    at: [-46, DESK_Y, -11], yaw: 26,
    parts: [
      { c: [0, 39, 0], s: [35, 61, 4] },
      { c: [0, 5, -4], s: [5, 10, 3] },
      { c: [0, 0.75, 0], s: [22, 1.5, 18] },
    ],
  },
  { id: "dock", group: "desk", at: [-40, DESK_Y, 7], yaw: 26, parts: [{ c: [0, 1.5, 0], s: [20, 3, 9] }] },
  {
    // Boyata stand: a base plate, two arms, a tilted top plate; at the front-left corner, turned towards the chair
    id: "mac", group: "desk",
    at: [-66, DESK_Y, 17], yaw: 58,
    parts: [
      { c: [0, 0.5, 1], s: [24, 1, 20] },
      { c: [-10.5, 6.5, 1], s: [1.6, 12.5, 2.6], rx: -22 },
      { c: [10.5, 6.5, 1], s: [1.6, 12.5, 2.6], rx: -22 },
      { c: [0, 12.5, 0], s: [26, 1, 22], rx: 14 },
      { c: [0, 14, 0.4], s: [36, 1.6, 25], rx: 14 },
      { c: [0, 28.3, -14.1], s: [36, 24, 0.7], rx: -12 },
    ],
  },
  {
    id: "bonsai", group: "desk", label: "bonsai",
    at: [52, DESK_Y, -8], yaw: -55,
    parts: [
      // pot
      { c: [0, 5, 0], s: [22, 9, 16], color: POT },
      { c: [0, 0.5, 0], s: [18, 1, 12], color: POT },
      // trunk: grows up in small zig-zags
      { c: [0, 14, 0], s: [3.6, 10, 3.6], rz: 7, color: WOOD },
      { c: [0.8, 23, 0], s: [3, 10, 3], rz: -10, color: WOOD },
      { c: [-0.6, 32, 0], s: [2.4, 10, 2.4], rz: 12, color: WOOD },
      { c: [0, 40.5, 0], s: [1.8, 8, 1.8], rz: -6, color: WOOD },
      { c: [-6, 26, 0], s: [1.4, 10, 1.4], rz: 62, color: WOOD },
      { c: [6, 34, 0], s: [1.2, 9, 1.2], rz: -60, color: WOOD },
      // foliage pads, stacked towards the apex
      { c: [-11.5, 28, 1], s: [11, 5, 9], color: LEAF },
      { c: [11, 36, -1], s: [11, 5, 9], color: LEAF },
      { c: [7, 22, 2], s: [8, 4, 7], color: LEAF },
      { c: [-6, 41, 0], s: [9, 4.5, 8], color: LEAF },
      { c: [1, 47, 0], s: [12, 5, 10], color: LEAF },
    ],
  },
  {
    id: "keyboard", group: "desk",
    at: [-1, DESK_Y, 19],
    parts: [
      { c: [-10, 1, 0], s: [14, 2, 9.5], yaw: 12 },
      { c: [10, 1, 0], s: [14, 2, 9.5], yaw: -12 },
    ],
  },
  {
    id: "mouse", group: "desk",
    at: [27, DESK_Y, 20], yaw: -8,
    parts: [
      { c: [0, 0.75, 0], s: [8, 1.5, 12] },
      { c: [0.6, 4.5, 0.5], s: [4.5, 7, 10.5], rz: -18 },
    ],
  },
  { id: "sony", group: "desk", at: [65, DESK_Y, 19], yaw: -28, parts: headphones(8, [6.5, 3, 8]) },
  {
    // the Aeron is mesh: its edges show, but it hides nothing behind it
    id: "chair", group: "desk",
    at: [1, 0, 53], yaw: 0, ghost: true,
    parts: [
      ...[0, 1, 2, 3, 4].map((k) => {
        const a = (k * 72 + 18) * (Math.PI / 180);
        return { c: [15 * Math.cos(a), 5, -15 * Math.sin(a)], s: [30, 3, 4], yaw: k * 72 + 18 };
      }),
      { c: [0, 22, 0], s: [5, 32, 5] },
      { c: [0, 45, 0], s: [50, 6, 46] },
      { c: [0, 78, 24], s: [47, 58, 4], rx: 10 },
      { c: [-25, 56, 6], s: [3, 18, 4] },
      { c: [25, 56, 6], s: [3, 18, 4] },
      { c: [-25, 65.5, 2], s: [7, 2, 24] },
      { c: [25, 65.5, 2], s: [7, 2, 24] },
    ],
  },
  { id: "pc", group: "desk", label: "Lian Li Lancool 216", at: [0, 0, 4], parts: [{ c: [0, 24.5, 0], s: [23.5, 49, 48] }] },
  { id: "audio", group: "desk", at: [0, 49, 6], yaw: -15, parts: headphones(8.5, [7, 3.5, 9]) },

  // ── homelab ───────────────────────────────────────────
  { id: "m900", group: "homelab", at: [122, 0, -6], yaw: -6, parts: [{ c: [0, 4.4, 0], s: [33.8, 8.8, 35.7] }] },
  {
    // an upright router on a small foot
    id: "router", group: "homelab", label: "router to be upgraded",
    at: [118, 8.8, -8], yaw: -6,
    parts: [
      { c: [0, 0.5, 0], s: [8, 1, 14] },
      { c: [0, 12, 0], s: [3.5, 22, 16] },
    ],
  },
  { id: "sidetable", group: "homelab", at: [168, 0, -2], parts: table(36, 32, 32, 2.5) },
  {
    id: "thinkpad", group: "homelab",
    at: [168, 32, 0], yaw: -14,
    parts: [
      { c: [0, 1, 0], s: [33, 2, 23] },
      { c: [0, 12.6, -12.6], s: [33, 22, 0.7], rx: -14 },
    ],
  },
];
setDesk(DESK.w, DESK.d);

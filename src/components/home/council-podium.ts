/* The podium on the Central Student Council's Student Government landing (csc-backdrop.tsx places and animates
   it): a grand round podium of polished black stone, three tiers high, that the three banners stand on. A gold
   nosing rounds every step, a line of light is set into the top just inside its edge and light is tucked under
   every nosing to wash the riser below, and the floor around it is black glass. Two spotlights hang high behind
   it at the corners and cross the room with their beams through a warm haze: the heading stays in the dark
   between them, the beams land on the podium where the banners stand and throw their shadows forward over its
   polished top, and dust turns in the light.
   It stands in a hall like a court's: a colonnade of fluted marble columns on gilt bases curves round behind it,
   each column lit from the floor and rising into the dark. Behind them the walls are panelled in dark walnut, a
   wainscot and tall raised panels over a chair rail, washed with light from the floor between the columns; in the
   middle bay, behind the heading, hangs a deep velvet drape, as behind a bench, and it stays dark.
   Drawn with WebGL2 (scene-gl.ts has the plumbing). The tiers are turned on a lathe; the spots light them with
   soft shadows cast by the banners and by the tiers above, and every polished surface reflects the room; the haze
   is marched through each beam per pixel, at a third of the size, both in view and in its reflection in the floor
   and the podium's top; the brightest light blooms. The camera is solved from the page's layout (CSS pixels) so
   the podium's top meets the banners' feet. */

import {
  BLUR_FRAGMENT, HEADER, MESH_VERTEX, MIRROR, SCREEN_VERTEX, aroundY, cross, identity, lathe, lens, link, multiply,
  noiseVolume, normalMatrix, normalize, target, trace, transform, translation, turnX, unload, untarget, upload,
  type Buffers, type Mark, type Program, type Target, Mesh,
} from "./scene-gl";

export type PodiumLayout = {
  /** The canvas's size. */
  width: number;
  height: number;
  /** Where the podium's axis stands, from the canvas's left edge. */
  centerX: number;
  /** The line the banners stand on: the podium's top, seen through its axis. */
  floorY: number;
  /** The banners' artwork (1200 × 820, stretched to fit) as left, top, width, height: their shadows are cut from it. */
  stage: [number, number, number, number];
  /** The heading and lede, as left, top, right, bottom: the haze is kept thin over them. */
  textBox: [number, number, number, number];
};

export type PodiumPose = {
  /** Seconds since the scene started: drives the haze, the dust and the lights' slow drift. */
  time: number;
  /** The camera's push in as the scene comes up, 0–1: it starts a little further back and lower. */
  rise: number;
  /** The room coming up: the haze, and the glow behind the podium. */
  glow: number;
  /** Each tier's light, 0–1, drawn round from the back of the podium to its front. */
  rings: [number, number, number];
  /** Each spot's level, struck with a flicker and a flare. */
  spots: [number, number];
  /** How far each spot is swung out from its mark, in radians. */
  swing: [number, number];
  /** The hall's lights coming up, 0–1: each column's lamp in turn, from the middle out. */
  hall: number;
};

export type CouncilPodium = {
  resize(layout: PodiumLayout, dpr: number): void;
  render(pose: PodiumPose): void;
  dispose(): void;
};

/* ——— The podium ——— */

/** Surfaces: the tops of the tiers, their risers, the gold nosings, the light strips tucked under them, and the
    nosings' undersides. Each vertex carries its surface plus ten times its tier, so the shader knows
    whose light it is. */
const TOP = 0, RISER = 1, GOLD = 2, STRIP = 3, UNDER = 4;

/** The camera stands `DISTANCE` in front of the podium's axis with its eye `RAISE` above the top, looking down on it
    a little as a product shot would; a long lens (`LENS` times the canvas's height) keeps the rings round. */
const DISTANCE = 1000;
const RAISE = DISTANCE * Math.tan((12 * Math.PI) / 180);
const LENS = 1.3;

/** Solves the camera for a layout: its tilt puts the middle of the podium's top on the banners' feet. */
function solveCamera(layout: PodiumLayout, distance = DISTANCE) {
  const focal = layout.height * LENS;
  const cx = layout.centerX, cy = layout.height * 0.5;
  const pitch = Math.atan((layout.floorY - cy) / focal) - Math.atan(RAISE / distance);
  /** How far along the line of sight a point on the podium's top is, in the plane through the axis facing the camera. */
  const depth = distance * Math.cos(pitch) - RAISE * Math.sin(pitch);
  /** A length across the screen at the podium's top, in the scene's units. */
  const across = (px: number) => (px * depth) / focal;
  return { focal, cx, cy, pitch, depth, across, distance };
}

type Camera = ReturnType<typeof solveCamera>;

/** The podium for a layout, standing on the floor with its axis at x = 0, and the spots' lamps and marks. */
function buildPodium(layout: PodiumLayout) {
  const camera = solveCamera(layout);
  // The top reaches well past the outer banners, so the line of light round it passes outside the section's
  // footer; each tier below steps out a little further.
  const r1 = camera.across(layout.stage[2] * 0.68);
  const radii = [r1, r1 * 1.13, r1 * 1.26];
  const rise = r1 * 0.052;
  const top = rise * 3;
  // A nosing: a rounded gold edge over a short gold band, overhanging the riser, with the light strip under it.
  const round = rise * 0.13, band = rise * 0.08, under = rise * 0.2, strip = rise * 0.12;

  const mesh = new Mesh();
  radii.forEach((radius, tier) => {
    const y0 = top - tier * rise, y1 = y0 - rise;
    const m = (surface: number) => surface + tier * 10;
    const foot = radius - under;
    // Traced from the riser's foot up and round the nosing, then in across the top to where the tier above stands.
    const marks: Mark[] = tier === 2 ? [[0, 0, m(RISER)], [foot, 0, m(RISER), true]] : [[foot, y1, m(RISER)]];
    marks.push([foot, y0 - round - band - strip, m(RISER), true]);
    marks.push([foot, y0 - round - band, m(STRIP), true]);
    marks.push([radius, y0 - round - band, m(UNDER), true]);
    marks.push([radius, y0 - round, m(GOLD)]);
    for (let i = 1; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2);
      marks.push([radius - round + round * Math.cos(a), y0 - round + round * Math.sin(a), m(GOLD)]);
    }
    marks[marks.length - 1][3] = true;
    marks.push([tier === 0 ? 0 : radii[tier - 1] - under, y0, m(TOP)]);
    lathe(mesh, trace(marks), 360, aroundY);
  });

  // The lamps hang high behind the podium, out past its sides, each aimed at the top a little in from its edge.
  const lamps = [-1, 1].map((side) => [side * r1 * 1.3, top + r1 * 2.6, -r1 * 1.4]);
  const marks = [-1, 1].map((side) => [side * r1 * 0.32, top, r1 * 0.05]);
  const reach = Math.hypot(marks[0][0] - lamps[0][0], marks[0][1] - lamps[0][1], marks[0][2] - lamps[0][2]);
  const cone = Math.atan((r1 * 0.44) / reach);

  // The camera at rest, which places the banners and the columns.
  const rest = multiply(
    lens(camera.focal, camera.cx, camera.cy, layout.width, layout.height, 20, 40000),
    turnX(-camera.pitch),
    translation(0, -(top + RAISE), -DISTANCE),
  );

  return { camera, rest, mesh, radii, rise, top, trim: [round, band, under, strip], lamps, marks, reach, cone, hall: buildHall(layout, rest, r1) };
}

/* ——— The hall ——— */

/** The hall's surfaces: the columns' marble, their gilt bases and capitals, and the wall behind them. */
const MARBLE = 0, GILT = 1, WALL = 2;

/** How many rounded flutes are cut round a column. */
const FLUTES = 24;

/** A column standing on the floor round its axis, `height` tall: a gilt base (a plinth under a round moulding), a
    marble shaft cut in flutes and easing in as it rises, and a gilt capital (a ring, a flared echinus, a slab). */
function column(r: number, height: number) {
  const mesh = new Mesh();
  const foot = r * 0.62, neck = height - r * 0.9, narrow = 0.86;
  const base: Mark[] = [[0, 0, GILT], [r * 1.42, 0, GILT, true], [r * 1.42, r * 0.24, GILT, true], [r * 1.2, r * 0.24, GILT, true]];
  for (let i = 1; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    base.push([r * 1.2 + r * 0.17 * Math.cos(a), r * 0.41 + r * 0.17 * Math.sin(a), GILT]);
  }
  base[base.length - 1][3] = true;
  base.push([r * 1.04, r * 0.58, GILT, true], [r * 1.04, foot, GILT, true], [0, foot, GILT]);
  lathe(mesh, trace(base), 40, aroundY);

  // The shaft, its radius easing in toward the top; each flute a shallow rounded groove between narrow fillets.
  const radius = (y: number) => r * (1 - (1 - narrow) * Math.min(1, Math.max(0, (y - foot) / (neck - foot))) ** 1.6);
  const groove = (phi: number) => {
    const u = (((phi / (Math.PI * 2)) * FLUTES) % 1 + 1) % 1 - 0.5;
    return Math.abs(u) < 0.42 ? Math.cos((u / 0.42) * (Math.PI / 2)) : 0;
  };
  const at = (phi: number, y: number) => {
    const rr = radius(y) * (1 - 0.05 * groove(phi));
    return [rr * Math.cos(phi), y, rr * Math.sin(phi)];
  };
  const steps = FLUTES * 6, rows = 14;
  let previous = -1;
  for (let j = 0; j <= rows; j++) {
    const y = foot + ((neck - foot) * j) / rows;
    const first = mesh.count;
    for (let i = 0; i <= steps; i++) {
      const phi = (i / steps) * Math.PI * 2, e = 1e-3;
      const [ax, , az] = at(phi + e, y), [bx, , bz] = at(phi - e, y), [cx, , cz] = at(phi, y + 1), [dx, , dz] = at(phi, y - 1);
      const n = normalize(cross([cx - dx, 2, cz - dz], [ax - bx, 0, az - bz]));
      const [x, , z] = at(phi, y);
      mesh.vertex(x, y, z, n[0], n[1], n[2], MARBLE);
    }
    if (previous >= 0) mesh.band(previous, first, steps + 1);
    previous = first;
  }

  const top = r * narrow;
  const capital: Mark[] = [[0, neck, GILT], [top, neck, GILT, true]];
  for (let i = 1; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * Math.PI;
    capital.push([top + r * 0.08 * Math.cos(a), neck + r * 0.08 + r * 0.08 * Math.sin(a), GILT]);
  }
  capital[capital.length - 1][3] = true;
  capital.push([top * 0.98, neck + r * 0.3, GILT]);
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    capital.push([top * 0.98 + (r * 1.38 - top * 0.98) * Math.sin(a), neck + r * 0.3 + r * 0.32 * (1 - Math.cos(a)), GILT]);
  }
  capital[capital.length - 1][3] = true;
  capital.push([r * 1.5, neck + r * 0.62, GILT, true], [r * 1.5, height, GILT, true], [0, height, GILT]);
  lathe(mesh, trace(capital), 40, aroundY);
  return mesh;
}

/** The wall round the back of the hall at `radius`, from `from` to `to` radians off the back, facing in. It is a
    smooth curve: its panelling, and the drape in the middle bay, are worked by the shader. */
function wall(radius: number, height: number, from: number, to: number) {
  const mesh = new Mesh();
  const steps = Math.ceil((to - from) * 96), rows = 12;
  let previous = -1;
  // Rows from the top down, so that each band winds anticlockwise seen from inside the hall.
  for (let j = rows; j >= 0; j--) {
    const y = height * (j / rows) ** 1.6;
    const first = mesh.count;
    for (let i = 0; i <= steps; i++) {
      const theta = from + ((to - from) * i) / steps;
      mesh.vertex(radius * Math.sin(theta), y, -radius * Math.cos(theta), -Math.sin(theta), 0, Math.cos(theta), WALL);
    }
    if (previous >= 0) mesh.band(previous, first, steps + 1);
    previous = first;
  }
  return mesh;
}

/** The hall for a layout: a colonnade round the back of the podium and the wall behind it. The first pair of
    columns stands just clear of the heading on screen, so its bay is open behind the words; the rest follow out
    at even steps. Where the heading spans the screen, the first pair stands just inside its edges instead. */
function buildHall(layout: PodiumLayout, rest: Float32Array, r1: number) {
  const radius = r1 * 2.15, columnRadius = r1 * 0.085, height = r1 * 4.2;
  const step = (14 * Math.PI) / 180;
  const onCanvas = (point: number[]) => {
    const [x, y, , w] = transform(rest, point);
    return [((x / w + 1) / 2) * layout.width, ((1 - y / w) / 2) * layout.height];
  };
  const [left, top, right, bottom] = layout.textBox;
  const clear = Math.max(layout.centerX - left, right - layout.centerX) + 24;
  // How close to the middle a column at this angle comes on screen, over the rows the heading and lede take.
  const reach = (theta: number) => {
    const foot = onCanvas([radius * Math.sin(theta), 0, -radius * Math.cos(theta)]);
    const head = onCanvas([radius * Math.sin(theta), height, -radius * Math.cos(theta)]);
    return Math.min(...[top, bottom].map((row) => {
      const t = (row - foot[1]) / (head[1] - foot[1] || 1);
      return Math.abs(foot[0] + (head[0] - foot[0]) * t - layout.centerX);
    })) - (columnRadius * layout.height * LENS) / DISTANCE;
  };
  /** The least angle at which a column comes no nearer the middle than `px`. */
  const angleFor = (px: number) => {
    let low = 0.12, high = 1.3;
    for (let i = 0; i < 24; i++) {
      const mid = (low + high) / 2;
      if (reach(mid) < px) low = mid;
      else high = mid;
    }
    return high;
  };
  const first = Math.min(angleFor(clear), angleFor(layout.width / 2 - 12) * 0.9);
  // The columns that show on the canvas (allowing for the camera's push in), each with its place in the order.
  const columns: Array<{ x: number; z: number; order: number }> = [];
  const margin = (columnRadius * 2.5 * layout.height * LENS) / DISTANCE;
  for (let k = 0; first + k * step < 1.75; k++)
    for (const side of [-1, 1]) {
      const theta = side * (first + k * step);
      const x = radius * Math.sin(theta), z = -radius * Math.cos(theta);
      const ends = [onCanvas([x, 0, z])[0], onCanvas([x, height, z])[0]];
      if (Math.max(...ends) > -margin && Math.min(...ends) < layout.width + margin) columns.push({ x, z, order: k });
    }
  const back = radius + r1 * 0.5;
  return {
    radius, columnRadius, height, first, step, columns, back,
    column: column(columnRadius, height),
    wall: wall(back, r1 * 5.5, -2.2, 2.2),
    perSide: Math.max(1, Math.ceil(columns.length / 2)),
  };
}

/* ——— Shaders ——— */

/** The room: the spots, the tiers and their light, and the banners' shadows. */
const ROOM = `
uniform vec3 uCamera;
// Each spot: its lamp and level; the way it points and how far its mark is; and a way across its beam.
uniform vec4 uLamp[2];
uniform vec4 uAim[2];
uniform vec3 uAcross[2];
// The spots' half angle, and their lamps' size for the banners' shadows (in the artwork's units) and the tiers'.
uniform vec4 uCone;
// The tiers' radii out to their nosings and the height of a riser; the tiers' tops and how far the floor reaches;
// the nosing's round, its gold band, its overhang and the light strip under it; and each tier's light.
uniform vec4 uTiers;
uniform vec4 uTops;
uniform vec4 uTrim;
uniform vec3 uRings;
uniform float uGlow;
uniform float uTime;
// The camera at rest, and the banners' artwork on the canvas: where their shadows are cut from.
uniform mat4 uRest;
uniform vec4 uStage;
uniform vec2 uSize;
// The camera for the frame, and the heading and lede on the canvas.
uniform mat4 uProjection;
uniform mat4 uView;
uniform vec4 uText;
// The hall: the colonnade's radius, a column's radius, the wall's radius, and how high its light reaches; the
// first column's angle off the back, the angle between columns, how many stand a side, and its light coming up.
uniform vec4 uHall;
uniform vec4 uBays;
// The pass's pixels per CSS pixel.
uniform float uPixel;
uniform float uBloom;
uniform float uBloomScale;
uniform mediump sampler3D uNoise;

const float PI = 3.14159265;
const vec3 SPOT = vec3(1.0, 0.76, 0.46);
const vec3 LED = vec3(1.0, 0.78, 0.5);

float tierRadius(int k) { return k == 0 ? uTiers.x : k == 1 ? uTiers.y : uTiers.z; }
float tierTop(int k) { return k == 0 ? uTops.x : k == 1 ? uTops.y : uTops.z; }
float tierLevel(int k) { return k == 0 ? uRings.x : k == 1 ? uRings.y : uRings.z; }

// How strongly spot i lights Q: a beam with a soft edge and a hotter core, brighter toward its lamp. In the haze
// (streaked) it is faintly streaked along its length, as a lens leaves it.
float beam(int i, vec3 Q, bool streaked) {
  vec3 a = uAim[i].xyz, w = Q - uLamp[i].xyz;
  float dist = length(w);
  // The angle off the axis, as a share of the beam's half angle (small enough that 2 − 2 cos is its square).
  float x = sqrt(max(2.0 - 2.0 * dot(w, a) / dist, 0.0)) / uCone.x;
  if (x >= 1.0) return 0.0;
  float shape = (1.0 - smoothstep(0.74, 1.0, x)) * (0.42 + 0.58 * exp(-x * x * 5.0)) + 0.5 * exp(-x * x * 30.0);
  if (streaked) {
    vec3 u = uAcross[i], v = cross(a, u);
    float turn = atan(dot(w, v), dot(w, u)) / 6.2832;
    shape *= 0.62 + 0.76 * texture(uNoise, vec3(turn * 3.0, 0.31 + float(i) * 0.5, uTime * 0.004)).r * smoothstep(0.05, 0.3, x);
  }
  return shape * min(pow(uAim[i].w / dist, 0.8), 2.2) * uLamp[i].w;
}

// How much of the light from S gets past the three banners to P. They stand in the plane z = 0, cut to their
// artwork: panels on x = 120…360, 460…740 and 840…1080 of 1200, from their feet on y = 690 up to the circle of
// radius 1000 round (600, −720) that their tops share. The penumbra widens the further the shadow falls.
float banners(vec3 P, vec3 S) {
  if (P.z <= 0.0 || S.z >= 0.0) return 1.0;
  float t = P.z / (P.z - S.z);
  vec4 clip = uRest * vec4(mix(P, S, t), 1.0);
  vec2 css = vec2(clip.x / clip.w * 0.5 + 0.5, 0.5 - clip.y / clip.w * 0.5) * uSize;
  vec2 art = (css - uStage.xy) / uStage.zw * vec2(1200.0, 820.0);
  float top = -720.0 + sqrt(max(1.0e6 - (art.x - 600.0) * (art.x - 600.0), 0.0));
  float across = min(min(abs(art.x - 240.0) - 120.0, abs(art.x - 600.0) - 140.0), abs(art.x - 960.0) - 120.0);
  float d = max(max(across, top - art.y), art.y - 690.0);
  float soft = 3.0 + uCone.y * t / max(1.0 - t, 0.02);
  return 1.0 - 0.92 * (1.0 - smoothstep(-soft, soft, d));
}

// How much of the light from S gets past the tiers to P. Each tier is a round block standing on the floor; P is
// only shadowed by the tiers above the one it is on (below is 3, for the floor and the air).
float tiers(vec3 P, vec3 S, int below) {
  vec3 d = S - P;
  float lit = 1.0;
  for (int k = 0; k < 3; k++) {
    if (k >= below) break;
    float R = tierRadius(k) - uTrim.z, top = tierTop(k);
    if (P.y >= top) continue;
    vec2 o = P.xz, v = d.xz;
    float a = max(dot(v, v), 1e-6), b = dot(o, v), c = dot(o, o) - R * R;
    float closest = clamp(-b / a, 0.0, 1.0);
    float miss = length(o + v * closest) - R;
    float disc = b * b - a * c;
    float enter = disc > 0.0 ? max((-b - sqrt(disc)) / a, 0.0) : closest;
    float under = top - (P.y + d.y * enter);
    float soft = uTiers.w * 0.15 + uCone.z * enter / max(1.0 - enter, 0.05);
    lit *= 1.0 - smoothstep(-soft, soft, -miss) * smoothstep(-soft, soft, under);
  }
  return lit;
}

// Tier k's light at angle a round the podium (0 at the back, ±π at the front). As the tier comes up its light is
// drawn round from the back to the front with a spark running at its leading edge; once lit, a soft swell circles.
float ring(int k, float a) {
  float p = tierLevel(k);
  float edge = p * (PI + 0.5) - abs(a);
  float lit = smoothstep(0.0, 0.2, edge);
  float spark = exp(-edge * edge / 0.006) * (1.0 - smoothstep(0.8, 1.0, p)) * step(0.001, p) * 2.5;
  float swell = pow(0.5 + 0.5 * cos(a + uTime * 0.42 + float(k) * 2.1), 24.0) * 0.4;
  return lit * (1.0 + swell) + spark;
}

// How far the hall's light has come up on column (or bay) k, counted out from the middle.
float coming(float k) {
  return smoothstep(0.0, 1.0, clamp(uBays.w * (uBays.z + 1.5) * 1.15 - k, 0.0, 1.0));
}

float phase(float c) {
  const float g = 0.25;
  return (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5) * 0.25;
}

// What a polished surface at P sees in direction d: the dark of the room, the glow round each lamp and its beam in
// the haze, and the warm haze lying low round the podium. (The lamps' own glints are the spots' direct light.)
vec3 room(vec3 d, float rough, vec3 P) {
  float spread = 1.0 / (1.0 + rough * 8.0);
  vec3 c = vec3(0.0014, 0.0011, 0.0009) * (0.7 + 0.3 * d.y);
  for (int i = 0; i < 2; i++) {
    vec3 S = uLamp[i].xyz, a = uAim[i].xyz;
    float toward = max(dot(d, normalize(S - P)), 0.0);
    c += SPOT * uLamp[i].w * pow(toward, 12.0) * 0.05;
    // The nearest the ray comes to the beam's axis, between the lamp and a little past its mark.
    vec3 w = P - S;
    float b = dot(d, a);
    float u = clamp((dot(a, w) - b * dot(d, w)) / max(1.0 - b * b, 1e-4), 0.0, uAim[i].w * 1.15);
    float t = max(dot(S + a * u - P, d), 0.0);
    float miss = length(P + d * t - S - a * u) / (uTiers.x * 0.5 * (0.3 + u / uAim[i].w));
    c += SPOT * uLamp[i].w * 0.11 * exp(-miss * miss) * spread * uGlow;
  }
  c += vec3(1.0, 0.6, 0.3) * 0.022 * uGlow * exp(-abs(d.y) * 7.0) * (0.4 + 0.6 * spread);
  return c;
}
`;

/** How a colour leaves a fragment shader. */
const TONE = `
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

float dither(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }

// The glow pass keeps only light past white; the picture is tone mapped and dithered against banding.
vec4 finish(vec3 hdr, float alpha) {
  if (uBloom > 0.5) return vec4(max(hdr - 1.0, 0.0) * uBloomScale, alpha);
  vec3 c = pow(aces(hdr), vec3(1.0 / 2.2));
  return vec4(c + dither(gl_FragCoord.xy) / 255.0, alpha);
}
`;

/** The podium: polished black tops and risers, the risers washed by the strips above them, gold nosings, and the
    strips. In the mirror pass it is lit upright and faded out below the floor. */
const PODIUM_FRAGMENT = `${HEADER}
in vec3 vWorld;
in vec3 vNormal;
in float vMaterial;
uniform float uMirror;
uniform float uFade;
out vec4 outColor;
${ROOM}
${TONE}

// Polished black stone with a faint cloud in its depth.
float cloud(vec3 p) {
  return texture(uNoise, p * 0.6).r * 0.7 + texture(uNoise, p * 1.9 + 0.23).r * 0.3;
}

void main() {
  vec3 P = vWorld;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamera - P);
  if (uMirror > 0.5) { P.y = -P.y; N.y = -N.y; V.y = -V.y; }
  float tierF = floor(vMaterial / 10.0 + 0.05);
  int tier = int(tierF);
  float surface = vMaterial - tierF * 10.0;
  float rise = uTiers.w;
  float a = atan(P.x, -P.z);
  float r = length(P.xz);
  float NdotV = max(dot(N, V), 1e-3);
  float aa = clamp(length(fwidth(N)) * 0.8, 0.0, 0.45);
  // Worked out before branching on the surface, where the screen's derivatives still hold.
  float depth = cloud(P / uTiers.x * 1.1);
  float fr = fwidth(r);

  vec3 albedo = vec3(0.0), F0 = vec3(0.04), emit = vec3(0.0);
  float rough = 0.3;
  if (surface < 0.5) {
    // A tier's top: the line of light inlaid near the top tier's edge, and the strip above each lower tread
    // spilling over it from the riser's foot.
    albedo = vec3(0.012, 0.011, 0.01) * (0.6 + 0.8 * depth);
    rough = 0.07;
    if (tier == 0) {
      float at = uTiers.x - uTrim.x - rise * 0.34;
      float w = rise * 0.035 + fr * 0.5;
      float line = 1.0 - smoothstep(w * 0.5, w * 0.5 + fr * 1.5, abs(r - at));
      float level = ring(0, a);
      emit += LED * level * (line * 2.6 + 0.05 * exp(-abs(r - at) / (rise * 0.1)));
      emit += albedo * LED * level * 1.5 * exp(-abs(r - at) / (rise * 0.4));
    } else {
      float from = tierRadius(tier - 1) - uTrim.z;
      emit += (albedo * 3.0 + 0.012) * LED * ring(tier - 1, a) * exp(-max(r - from, 0.0) / (rise * 0.4));
    }
  } else if (surface < 1.5) {
    // A riser, polished, washed from the top by the strip under its nosing.
    albedo = vec3(0.011, 0.01, 0.009) * (0.6 + 0.8 * depth);
    rough = 0.08;
    float foot = tierTop(tier) - uTrim.x - uTrim.y - uTrim.w;
    float wash = exp(-max(foot - P.y, 0.0) / (rise * 0.3));
    emit += (albedo * 3.0 + 0.03) * LED * ring(tier, a) * wash;
    // At the glow pass's half size the strip itself is thinner than a pixel and would bloom in dashes, so there it
    // glows from a broader band of the riser just under it.
    if (uBloom > 0.5) emit += LED * ring(tier, a) * 2.4 * exp(-max(foot - P.y, 0.0) / (rise * 0.22));
  } else if (surface < 2.5) {
    F0 = vec3(1.0, 0.76, 0.38);
    rough = 0.12;
  } else if (surface < 3.5) {
    emit += LED * ring(tier, a) * (uBloom > 0.5 ? 1.2 : 5.0);
    rough = 0.4;
  } else {
    // The nosing's underside, lit only by the strip just under it.
    F0 = vec3(0.55, 0.4, 0.2);
    rough = 0.45;
    emit += LED * ring(tier, a) * 0.5;
  }
  rough = max(rough, aa);

  vec3 color = emit;
  for (int i = 0; i < 2; i++) {
    if (uMirror > 0.5) break;
    vec3 S = uLamp[i].xyz;
    vec3 L = S - P;
    float dist = length(L);
    L /= dist;
    float NdotL = dot(N, L);
    if (NdotL <= 0.0) continue;
    float lit = beam(i, P, false);
    if (lit <= 0.0) continue;
    lit *= banners(P, S) * tiers(P, S, tier);
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    float alpha = rough * rough;
    float D = alpha * alpha / (PI * pow(NdotH * NdotH * (alpha * alpha - 1.0) + 1.0, 2.0));
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
    float k = alpha * 0.5;
    float G = NdotL / (NdotL * (1.0 - k) + k) * NdotV / (NdotV * (1.0 - k) + k);
    vec3 spec = min(D * G / (4.0 * NdotL * NdotV), 60.0) * F;
    color += (albedo / PI * (1.0 - F) + spec) * SPOT * lit * NdotL * 9.0;
  }
  vec3 Fr = F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0);
  color += Fr * room(reflect(-V, N), rough, P);
  color += albedo * vec3(0.05, 0.035, 0.022) * uGlow;
  outColor = finish(color, 1.0);
  // The reflection fades out the further it lies below the floor; its y is negative. It's drawn premultiplied.
  if (uMirror > 0.5) {
    float seen = exp(vWorld.y / uFade) * 0.9;
    outColor = vec4(outColor.rgb * seen, seen);
  }
}`;

const FLOOR_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
uniform mat4 uProjection;
uniform mat4 uView;
out vec3 vWorld;
void main() {
  vWorld = aPosition;
  gl_Position = uProjection * uView * vec4(aPosition, 1.0);
}`;

/** Black glass underfoot: where the beams spill past the podium they pool on it, the bottom tier's strip lights a
    band round its foot, and it mirrors the room. Drawn over the podium's reflection, which shows through it. */
const FLOOR_FRAGMENT = `${HEADER}
in vec3 vWorld;
out vec4 outColor;
${ROOM}
${TONE}
void main() {
  vec3 P = vWorld;
  vec3 V = normalize(uCamera - P);
  vec3 light = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec3 S = uLamp[i].xyz;
    vec3 L = normalize(S - P);
    light += SPOT * beam(i, P, false) * banners(P, S) * tiers(P, S, 3) * max(L.y, 0.0) * 9.0;
  }
  float r = length(P.xz);
  float foot = uTiers.z - uTrim.z;
  light += LED * ring(2, atan(P.x, -P.z)) * exp(-max(r - foot, 0.0) / (uTiers.w * 1.1)) * 1.6;
  // The pool of light round the lamp at the foot of the nearest column.
  float a = abs(atan(P.x, -P.z));
  float k = max(floor((a - uBays.x) / uBays.y + 0.5), 0.0);
  float theta = (uBays.x + k * uBays.y) * sign(P.x);
  vec2 lamp = vec2(sin(theta), -cos(theta)) * (uHall.x - uHall.y * 3.0);
  float pool = length(P.xz - lamp) / (uHall.y * 3.2);
  light += LED * coming(k) * exp(-pool * pool) * 3.0 * step(k, uBays.z - 1.0);
  vec3 color = vec3(0.02, 0.018, 0.016) * light / PI;
  float F = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
  color += F * room(reflect(-V, vec3(0.0, 1.0, 0.0)), 0.06, P) * 0.6;
  float fade = exp(-pow(length(P.xz * vec2(0.55, 1.0)) / uTops.w, 2.0));
  float mirror = clamp(0.3 + F * 1.4, 0.0, 0.88);
  outColor = finish(color, fade * (1.0 - mirror));
}`;

/** The hall. A column is lit by a lamp on the floor just in front of it, which throws its light up the shaft so the
    flutes and fillets catch it and it fades as it climbs. The walnut panelling is washed from the floor between the
    columns, so the bevels round its panels catch the light from below; the drape in the middle bay barely shows,
    its velvet pile catching what light there is where its folds turn away. Behind the heading the hall stays dark. */
const HALL_FRAGMENT = `${HEADER}
in vec3 vWorld;
in vec3 vNormal;
in float vMaterial;
// The column being drawn: its foot (x, z), and its lamp's level.
uniform vec3 uColumn;
out vec4 outColor;
${ROOM}
${TONE}

const vec3 MARBLE = vec3(0.7, 0.6, 0.45);
const vec3 WALNUT = vec3(0.075, 0.04, 0.021);
const vec3 DRAPE = vec3(0.07, 0.014, 0.018);

// A raised panel spanning lo to hi: how the surface slopes at p, toward the panel's nearest edge on the bevel round
// its field (zero on the field, and outside the panel).
vec2 raised(vec2 p, vec2 lo, vec2 hi, float bevel) {
  vec4 d = vec4(p - lo, hi - p);
  if (min(min(d.x, d.y), min(d.z, d.w)) < 0.0) return vec2(0.0);
  float m = min(min(d.x, d.y), min(d.z, d.w));
  if (m > bevel) return vec2(0.0);
  vec2 slope = m == d.x ? vec2(-1.0, 0.0) : m == d.z ? vec2(1.0, 0.0) : m == d.y ? vec2(0.0, -1.0) : vec2(0.0, 1.0);
  return slope * 0.75;
}

void main() {
  vec3 P = vWorld;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamera - P);
  float NdotV = max(dot(N, V), 1e-3);
  float rc = uHall.y, high = uHall.w;
  vec3 color;
  if (vMaterial < 1.5) {
    // The lamp stands on the floor a little in front of the column, toward the podium.
    vec2 foot = uColumn.xy;
    vec2 near = foot - normalize(foot) * rc * 3.0;
    vec3 lamp = vec3(near.x, rc * 0.35, near.y);
    vec3 L = lamp - P;
    float d = length(L);
    L /= d;
    float NdotL = max(dot(N, L), 0.0);
    // It throws upward only, and falls off as it climbs.
    float spill = smoothstep(-rc * 0.4, rc * 1.2, P.y - lamp.y) * uColumn.z * 20.0 / (1.0 + pow(d / (rc * 2.2), 2.0));
    spill += uColumn.z * 0.35 * exp(-P.y / (high * 0.55));
    vec3 albedo, F0;
    float rough;
    if (vMaterial < 0.5) {
      // Marble, cream with a faint gold vein.
      float vein = texture(uNoise, P / rc * 0.045 + vec3(0.0, P.y / rc * 0.01, 0.0)).r;
      albedo = MARBLE * (0.8 + 0.35 * vein);
      F0 = vec3(0.04);
      rough = 0.22;
    } else {
      albedo = vec3(0.0);
      F0 = vec3(1.0, 0.76, 0.38);
      rough = 0.28;
    }
    vec3 H = normalize(L + V);
    float NdotH = max(dot(N, H), 0.0);
    float alpha = rough * rough;
    float D = alpha * alpha / (PI * pow(NdotH * NdotH * (alpha * alpha - 1.0) + 1.0, 2.0));
    vec3 F = F0 + (1.0 - F0) * pow(1.0 - max(dot(H, V), 0.0), 5.0);
    vec3 spec = min(D / (4.0 * max(NdotL, 0.05) * NdotV), 30.0) * F;
    color = (albedo / PI * (1.0 - F) + spec) * LED * spill * NdotL;
    color += (F0 + (1.0 - F0) * pow(1.0 - NdotV, 5.0)) * room(reflect(-V, N), rough, P) * 0.6;
  } else {
    // The wall: washed from the floor in the middle of each bay, with a glow round each column's foot.
    float theta = atan(P.x, -P.z), a = abs(theta);
    float bay = (a - uBays.x) / uBays.y;
    float wash = a < uBays.x
      ? 0.1 * coming(0.0) * exp(-pow(a / uBays.x, 2.0) * 2.0)
      : exp(-pow((fract(bay) - 0.5) / 0.32, 2.0)) * coming(floor(bay));
    float halo = a < uBays.x - uBays.y * 0.3 ? 0.0 : exp(-pow((bay - floor(bay + 0.5)) / 0.11, 2.0)) * 0.4 * coming(floor(bay + 0.5));
    float rise = exp(-P.y / (high * 0.24)) * wash + exp(-P.y / (high * 0.4)) * halo;
    // High up, and out of the light, the wall is simply dark.
    if (rise * uGlow < 0.002) {
      outColor = finish(vec3(0.0), 1.0);
      return;
    }
    vec3 inward = vec3(-sin(theta), 0.0, cos(theta)), along = vec3(cos(theta), 0.0, sin(theta));
    vec2 slope = vec2(0.0);
    vec3 albedo, sheen = vec3(0.0);
    float rough;
    if (a < uBays.x - uBays.y * 0.22) {
      // The drape in the middle bay: deep pleats, the pile catching the light at their turns.
      float s = theta * uHall.z / (rc * 1.9);
      slope.x = cos(s * 6.2832) * 0.7 + cos(s * 6.2832 * 2.1 + 1.3) * 0.3;
      albedo = DRAPE * (0.75 + 0.5 * sin(s * 6.2832 + 0.4));
      rough = 0.6;
      sheen = vec3(0.9, 0.4, 0.35) * 0.35;
    } else {
      // Walnut panelling: a stile behind each column; a wainscot panel under a rounded chair rail; a tall panel above.
      float width = uBays.y * uHall.z;
      vec2 p = vec2((a - uBays.x) * uHall.z - floor(bay) * width, P.y);
      float stile = width * 0.1, bevel = rc * 0.55;
      slope += raised(p, vec2(stile, rc * 1.1), vec2(width - stile, high * 0.16), bevel);
      slope += raised(p, vec2(stile, high * 0.2), vec2(width - stile, high * 0.62), bevel);
      // The chair rail: a round moulding along the wall.
      float rail = (P.y - high * 0.18) / (rc * 0.45);
      if (abs(rail) < 1.0) slope.y += rail * 0.9;
      // The panels on the left of the hall mirror the right's, so the slopes across turn over with them.
      slope.x *= sign(theta);
      float grain = texture(uNoise, vec3(p.x / rc * 0.35, P.y / rc * 0.02, a * 3.0)).r;
      albedo = WALNUT * (0.65 + 0.7 * grain) * (abs(rail) < 1.0 ? 1.4 : 1.0);
      rough = 0.38;
    }
    vec3 Nw = normalize(inward + along * slope.x + vec3(0.0, 1.0, 0.0) * slope.y);
    // The light comes from low in front of the wall.
    vec3 L = normalize(vec3(-P.x, high * 0.06 - P.y * 0.6, -P.z));
    float NdotL = max(dot(Nw, L), 0.0);
    vec3 H = normalize(L + V);
    float gloss = pow(max(dot(Nw, H), 0.0), 2.0 / (rough * rough * rough)) * (1.0 - rough) * 0.5;
    float pile = pow(1.0 - max(dot(Nw, V), 0.0), 3.0);
    color = (albedo * (0.2 + 0.8 * NdotL) + gloss * 0.06 + sheen * pile * NdotL) * LED * rise * 1.6;
  }
  color *= uGlow;
  // The hall is kept dark behind the heading and lede.
  vec2 css = vec2(gl_FragCoord.x, 0.0) / uPixel + vec2(0.0, uSize.y - gl_FragCoord.y / uPixel);
  vec2 beyond = max(max(uText.xy - css, css - uText.zw), 0.0);
  color *= mix(1.0, 0.12, 1.0 - smoothstep(0.0, 110.0, length(beyond)));
  outColor = finish(color, 1.0);
}`;

/** The dark behind the podium: warm black, lifting toward the floor, with the podium's light bouncing into the haze
    behind it. */
const BACKDROP_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform vec4 uFrame;
out vec4 outColor;
${ROOM}
${TONE}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec3 color = mix(vec3(0.0009, 0.0008, 0.0008), vec3(0.0026, 0.002, 0.0015), smoothstep(0.1, 0.95, p.y / uSize.y));
  vec2 q = (p - uFrame.xy) / uSize.y;
  color += vec3(1.0, 0.56, 0.24) * uGlow * 0.028 * exp(-q.x * q.x * 2.4 - q.y * q.y * (q.y < 0.0 ? 22.0 : 60.0));
  outColor = finish(color, 1.0);
}`;

/** The haze, at a third of the size: each pixel's ray is marched through each beam where it crosses it, up to the
    podium or the floor, gathering the light the haze throws toward the camera; where it lands on glass or on the
    podium's top, its reflection is marched too. */
const HAZE_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uForward;
uniform vec3 uLens;
out vec4 outColor;
${ROOM}

float density(vec3 Q) {
  vec3 p = Q / uTiers.x;
  float n = texture(uNoise, p * 0.5 + vec3(uTime * 0.011, -uTime * 0.005, uTime * 0.008)).r * 0.65
    + texture(uNoise, p * 1.3 + vec3(-uTime * 0.018, uTime * 0.009, 0.37)).r * 0.35;
  float low = exp(-max(Q.y - uTops.x, 0.0) / (uTiers.x * 0.7));
  return (0.12 + 2.2 * n * n * n) * (0.3 + 1.1 * low);
}

// Where the ray O + t d is inside spot i's beam, as (enter, leave); leave < enter when it misses.
vec2 inBeam(vec3 O, vec3 d, int i) {
  vec3 a = uAim[i].xyz, w = O - uLamp[i].xyz;
  float c = cos(uCone.x * 1.04), cc = c * c;
  float da = dot(d, a), wa = dot(w, a);
  float A = da * da - cc, B = 2.0 * (da * wa - cc * dot(d, w)), C = wa * wa - cc * dot(w, w);
  float disc = B * B - 4.0 * A * C;
  if (disc < 0.0 || abs(A) < 1e-6) return vec2(1.0, -1.0);
  float s = sqrt(disc);
  float t1 = (-B - s) / (2.0 * A), t2 = (-B + s) / (2.0 * A);
  if (t1 > t2) { float x = t1; t1 = t2; t2 = x; }
  if (A < 0.0) return dot(w + d * (0.5 * (t1 + t2)), a) > 0.0 ? vec2(t1, t2) : vec2(1.0, -1.0);
  return dot(w + d * (t2 + 1.0), a) > 0.0 ? vec2(t2, 1e6) : vec2(-1e6, t1);
}

// The first thing the ray meets: its distance, and what it is (1 the floor, 2 a tier's top, 3 a tier's side, 0
// nothing).
vec2 meet(vec3 O, vec3 d) {
  float best = 1e6, kind = 0.0;
  if (d.y < 0.0 && O.y > 0.0) { best = -O.y / d.y; kind = 1.0; }
  for (int k = 0; k < 3; k++) {
    float R = tierRadius(k), top = tierTop(k);
    if (d.y < 0.0 && O.y > top) {
      float t = (top - O.y) / d.y;
      vec2 at = O.xz + d.xz * t;
      if (t < best && dot(at, at) < R * R) { best = t; kind = 2.0; }
    }
    R -= uTrim.z;
    float a = max(dot(d.xz, d.xz), 1e-6), b = dot(O.xz, d.xz), c = dot(O.xz, O.xz) - R * R;
    float disc = b * b - a * c;
    if (disc > 0.0 && c > 0.0) {
      float t = (-b - sqrt(disc)) / a;
      float y = O.y + d.y * t;
      if (t > 0.0 && t < best && y < top && y > 0.0) { best = t; kind = 3.0; }
    }
  }
  return vec2(best, kind);
}

vec3 shaft(vec3 O, vec3 d, vec2 span, int i, float jitter, int steps) {
  vec3 S = uLamp[i].xyz;
  float dt = (span.y - span.x) / float(steps);
  vec3 sum = vec3(0.0);
  for (int s = 0; s < 18; s++) {
    if (s >= steps) break;
    vec3 Q = O + d * (span.x + (float(s) + jitter) * dt);
    float lit = beam(i, Q, true);
    if (lit <= 0.0) continue;
    lit *= banners(Q, S);
    if (Q.y < uTops.x) lit *= tiers(Q, S, 3);
    sum += lit * density(Q) * phase(dot(normalize(Q - S), -d));
  }
  return SPOT * sum * dt * 0.0024;
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec3 d = normalize(uRight * (px.x - uLens.y) + uUp * (uLens.z - px.y) + uForward * uLens.x);
  vec2 hit = meet(uCamera, d);
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  vec3 L = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec2 span = inBeam(uCamera, d, i);
    span = vec2(max(span.x, 0.0), min(span.y, hit.x));
    if (span.y > span.x) L += shaft(uCamera, d, span, i, jitter, 18);
  }
  vec3 P = uCamera + d * hit.x;
  // Only the floor and the podium's top mirror it; the narrow treads below are left out.
  if ((hit.y > 0.5 && hit.y < 1.5) || (hit.y > 1.5 && hit.y < 2.5 && P.y > uTops.y + uTiers.w * 0.5)) {
    vec3 r = reflect(d, vec3(0.0, 1.0, 0.0));
    float F = 0.04 + 0.96 * pow(1.0 - abs(d.y), 5.0);
    float gloss = hit.y < 1.5 ? clamp(0.3 + F * 1.4, 0.0, 0.88) : 0.45 + F;
    vec2 back = meet(P + r * 0.5, r);
    vec3 seen = vec3(0.0);
    for (int i = 0; i < 2; i++) {
      vec2 span = inBeam(P, r, i);
      span = vec2(max(span.x, 0.0), min(span.y, back.x));
      if (span.y > span.x) seen += shaft(P, r, span, i, jitter, 8);
    }
    L += seen * gloss;
  }
  outColor = vec4(L * (0.35 + 0.65 * uGlow), 1.0);
}`;

/** The haze over the picture, blended as light is (a screen), kept thin over the heading and lede. In the glow
    pass, only its brightest. */
const HAZE_OVER_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uHaze;
uniform vec4 uText;
uniform vec2 uSize;
uniform float uBloom;
uniform float uBloomScale;
out vec4 outColor;
void main() {
  vec3 h = texture(uHaze, vUv).rgb;
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec2 beyond = max(max(uText.xy - p, p - uText.zw), 0.0);
  h *= mix(1.0, 0.5, 1.0 - smoothstep(0.0, 80.0, length(beyond)));
  if (uBloom > 0.5) { outColor = vec4(max(h - 0.6, 0.0) * 0.5 * uBloomScale, 1.0); return; }
  vec3 c = pow(1.0 - exp(-h), vec3(1.0 / 2.2));
  outColor = vec4(c + (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0, 1.0);
}`;

/** Dust hanging in the air where the beams cross it, drifting and sinking slowly: each mote shows only while a
    beam catches it, and now and then one turns and glints. */
const DUST_VERTEX = `${HEADER}
layout(location = 0) in vec4 aSeed;
uniform float uDpr;
uniform vec3 uMarks[2];
out float vGlow;
${ROOM}
void main() {
  // A place in one beam's path as the spot rests: so far along from its lamp, and out from its axis.
  int i = aSeed.x < 0.5 ? 0 : 1;
  vec3 S = uLamp[i].xyz, axis = normalize(uMarks[i] - S);
  vec3 u = normalize(cross(axis, vec3(0.0, 0.0, 1.0))), v = cross(axis, u);
  float along = mix(0.18, 1.02, fract(aSeed.x * 2.0)) * uAim[i].w;
  float off = sqrt(aSeed.z) * tan(uCone.x) * along * 1.1, turn = aSeed.w * 6.2832 + uTime * 0.02;
  vec3 p = S + axis * along + (u * cos(turn) + v * sin(turn)) * off;
  float R = uTiers.x, seed = aSeed.y * 97.0;
  p += vec3(sin(uTime * 0.21 + seed), sin(uTime * 0.17 + seed * 1.3) * 0.6, cos(uTime * 0.19 + seed * 0.7)) * R * 0.035;
  p.y -= fract(aSeed.y + uTime * 0.006) * R * 0.25;
  gl_Position = uProjection * uView * vec4(p, 1.0);
  vec3 toEye = normalize(uCamera - p);
  float lit = 0.0;
  for (int i = 0; i < 2; i++) lit += beam(i, p, true) * phase(dot(normalize(p - uLamp[i].xyz), toEye)) * banners(p, uLamp[i].xyz);
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.3 + aSeed.w * 2.7) + aSeed.x * 60.0);
  float glint = pow(max(sin(uTime * (0.5 + aSeed.z * 0.8) + aSeed.y * 90.0), 0.0), 60.0) * 6.0;
  vGlow = lit * (twinkle + glint) * uGlow * 2.6;
  gl_PointSize = vGlow > 0.004 ? (1.0 + aSeed.w * aSeed.w * 2.2) * uDpr : 0.0;
}`;

const DUST_FRAGMENT = `${HEADER}
in float vGlow;
uniform float uBloom;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  vec3 c = vec3(1.0, 0.84, 0.6) * vGlow * exp(-r * 3.5);
  outColor = vec4(c * (uBloom > 0.5 ? 0.6 : 1.0), 1.0);
}`;

/** Adds the glow over the picture, rolled off so it never clips. */
const LIGHT_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uNear;
uniform sampler2D uFar;
uniform float uScale;
out vec4 outColor;
void main() {
  vec3 glow = (texture(uNear, vUv).rgb * 0.9 + texture(uFar, vUv).rgb * 1.4) / uScale;
  outColor = vec4(1.0 - exp(-glow * 0.75), 1.0);
}`;

/** Darkens the corners, multiplied over the picture. */
const VIGNETTE_FRAGMENT = `${HEADER}
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.0, 1.25);
  outColor = vec4(vec3(1.0 - 0.55 * smoothstep(0.32, 0.95, length(p))), 1.0);
}`;

/* ——— The scene ——— */

const DUST = 700;

/** Starts the scene on a canvas, or returns null where WebGL2 isn't available. */
export function createCouncilPodium(canvas: HTMLCanvasElement): CouncilPodium | null {
  const context = canvas.getContext("webgl2", { alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  // Half floats keep the light past white; where they can't be drawn to, it's packed into bytes.
  const float = !!gl.getExtension("EXT_color_buffer_float");
  const bloomScale = float ? 1 : 0.25;

  let programs: Record<"podium" | "hall" | "floor" | "backdrop" | "haze" | "hazeOver" | "dust" | "blur" | "light" | "vignette", Program>;
  try {
    programs = {
      podium: link(gl, MESH_VERTEX, PODIUM_FRAGMENT),
      hall: link(gl, MESH_VERTEX, HALL_FRAGMENT),
      floor: link(gl, FLOOR_VERTEX, FLOOR_FRAGMENT),
      backdrop: link(gl, SCREEN_VERTEX, BACKDROP_FRAGMENT),
      haze: link(gl, SCREEN_VERTEX, HAZE_FRAGMENT),
      hazeOver: link(gl, SCREEN_VERTEX, HAZE_OVER_FRAGMENT),
      dust: link(gl, DUST_VERTEX, DUST_FRAGMENT),
      blur: link(gl, SCREEN_VERTEX, BLUR_FRAGMENT),
      light: link(gl, SCREEN_VERTEX, LIGHT_FRAGMENT),
      vignette: link(gl, SCREEN_VERTEX, VIGNETTE_FRAGMENT),
    };
  } catch (error) {
    console.error(error);
    return null;
  }

  const screen = gl.createVertexArray()!;
  const noise = noiseVolume(gl);

  // The dust's seeds never change: four random numbers each.
  const dust = gl.createVertexArray()!;
  const seeds = gl.createBuffer()!;
  gl.bindVertexArray(dust);
  gl.bindBuffer(gl.ARRAY_BUFFER, seeds);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Array.from({ length: DUST * 4 }, Math.random)), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // The floor: one wide quad, built per layout.
  const floor = gl.createVertexArray()!;
  const floorBuffer = gl.createBuffer()!;
  gl.bindVertexArray(floor);
  gl.bindBuffer(gl.ARRAY_BUFFER, floorBuffer);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  let layout: PodiumLayout | null = null;
  let shape: ReturnType<typeof buildPodium> | null = null;
  let podium: Buffers | null = null;
  let hall: { column: Buffers; wall: Buffers } | null = null;
  let targets: Record<"haze" | "hazeSwap" | "scene" | "near" | "nearSwap" | "far" | "farSwap", Target> | null = null;
  let dpr = 1;
  // The camera at rest, which places the banners; and the camera, lamps and beams for the frame being drawn.
  let rest = identity();
  let camera: Camera | null = null;
  let eye = [0, 0, DISTANCE];
  let projection = identity();
  let view = identity();
  const lamps = new Float32Array(8);
  const aims = new Float32Array(8);
  const acrosses = new Float32Array(6);

  const release = () => {
    if (podium) unload(gl, podium);
    if (hall) for (const part of Object.values(hall)) unload(gl, part);
    if (targets) for (const t of Object.values(targets)) untarget(gl, t);
    podium = null;
    hall = null;
    targets = null;
  };

  function resize(next: PodiumLayout, ratio: number) {
    layout = next;
    dpr = ratio;
    canvas.width = Math.max(1, Math.round(next.width * ratio));
    canvas.height = Math.max(1, Math.round(next.height * ratio));
    release();
    shape = buildPodium(next);
    podium = upload(gl, shape.mesh);
    hall = { column: upload(gl, shape.hall.column), wall: upload(gl, shape.hall.wall) };
    rest = shape.rest;

    const wide = shape.radii[2] * 14, deep = shape.radii[2] * 40;
    gl.bindBuffer(gl.ARRAY_BUFFER, floorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-wide, 0, -deep, wide, 0, -deep, -wide, 0, DISTANCE - 25, wide, 0, -deep, wide, 0, DISTANCE - 25, -wide, 0, DISTANCE - 25]), gl.STATIC_DRAW);

    const size = (divide: number) => [Math.max(1, Math.ceil(next.width / divide)), Math.max(1, Math.ceil(next.height / divide))] as const;
    const [hw, hh] = size(3), [nw, nh] = size(2), [fw, fh] = size(8);
    targets = {
      haze: target(gl, hw, hh, float),
      hazeSwap: target(gl, hw, hh, float),
      scene: target(gl, nw, nh, float, true),
      near: target(gl, nw, nh, float),
      nearSwap: target(gl, nw, nh, float),
      far: target(gl, fw, fh, float),
      farSwap: target(gl, fw, fh, float),
    };
  }

  /** Sets the camera and the spots for a pose. While the scene comes up the camera stands further back, the podium's
      top held on the banners' feet, and pushes in; each spot swings in from outside onto its mark. */
  function aim(pose: PodiumPose) {
    if (!shape || !layout) return;
    camera = solveCamera(layout, DISTANCE * (1 + (1 - pose.rise) * 0.09));
    eye = [0, shape.top + RAISE, camera.distance];
    projection = lens(camera.focal, camera.cx, camera.cy, layout.width, layout.height, 20, 40000);
    view = multiply(turnX(-camera.pitch), translation(-eye[0], -eye[1], -eye[2]));
    const r1 = shape.radii[0];
    [-1, 1].forEach((side, i) => {
      const lamp = shape!.lamps[i], mark = shape!.marks[i];
      // A slow drift on the stand, and the swing in when struck.
      const drift = Math.sin(pose.time * 0.21 + i * 1.9) * 0.018 + Math.sin(pose.time * 0.13 + i * 4.1) * 0.01;
      const out = (pose.swing[i] + drift) * shape!.reach;
      const toward = normalize([mark[0] + side * out - lamp[0], mark[1] - lamp[1], mark[2] + Math.sin(pose.time * 0.17 + i) * r1 * 0.04 - lamp[2]]);
      lamps.set([lamp[0], lamp[1], lamp[2], pose.spots[i]], i * 4);
      aims.set([...toward, shape!.reach], i * 4);
      acrosses.set(normalize(cross(toward, [0, 0, 1])), i * 3);
    });
  }

  function room(program: Program, pose: PodiumPose, bloom: boolean) {
    if (!shape || !layout) return;
    const u = program.uniforms;
    const [round, band, under, strip] = shape.trim;
    u.uCamera?.(eye);
    u.uLamp?.(lamps);
    u.uAim?.(aims);
    u.uAcross?.(acrosses);
    u.uCone?.([shape.cone, 40, shape.radii[0] * 0.05, 0]);
    u.uTiers?.([...shape.radii, shape.rise]);
    u.uTops?.([shape.top, shape.top - shape.rise, shape.top - 2 * shape.rise, shape.radii[2] * 4.5]);
    u.uTrim?.([round, band, under, strip]);
    u.uRings?.(pose.rings);
    u.uGlow?.(pose.glow);
    u.uTime?.(pose.time);
    u.uRest?.(rest);
    u.uStage?.(layout.stage);
    u.uText?.(layout.textBox);
    const { radius, columnRadius, back, height, first, step, perSide } = shape.hall;
    u.uHall?.([radius, columnRadius, back, height]);
    u.uBays?.([first, step, perSide, pose.hall]);
    u.uSize?.([layout.width, layout.height]);
    u.uBloom?.(bloom ? 1 : 0);
    u.uBloomScale?.(bloomScale);
    u.uPixel?.(bloom ? 0.5 : dpr);
    u.uNoise?.(1);
    u.uProjection?.(projection);
    u.uView?.(view);
  }

  function screenPass(program: Program, pose: PodiumPose, bloom: boolean) {
    gl.useProgram(program.program);
    room(program, pose, bloom);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function drawPodium(pose: PodiumPose, mirror: boolean, bloom: boolean) {
    if (!shape || !podium) return;
    const { uniforms: u, program } = programs.podium;
    gl.useProgram(program);
    room(programs.podium, pose, bloom);
    u.uMirror?.(mirror ? 1 : 0);
    u.uFade?.(shape.top * 1.6);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    if (mirror) {
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    }
    const model = mirror ? MIRROR : identity();
    u.uModel?.(model);
    u.uNormalMatrix?.(normalMatrix(model));
    // The tiers are closed, so what faces away is always hidden; the mirror turns the winding over.
    gl.enable(gl.CULL_FACE);
    gl.cullFace(mirror ? gl.FRONT : gl.BACK);
    gl.bindVertexArray(podium.vao);
    gl.drawElements(gl.TRIANGLES, podium.count, gl.UNSIGNED_INT, 0);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  /** The hall: each column where it stands, lit as its turn comes, then the wall behind them (but not in the glow,
      where nothing on the wall is ever bright enough to show). */
  function drawHall(pose: PodiumPose, bloom: boolean) {
    if (!shape || !hall) return;
    const { uniforms: u, program } = programs.hall;
    const { perSide, columns } = shape.hall;
    gl.useProgram(program);
    room(programs.hall, pose, bloom);
    u.uNormalMatrix?.(normalMatrix(identity()));
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.bindVertexArray(hall.column.vao);
    const coming = (order: number) => Math.min(1, Math.max(0, pose.hall * (perSide + 1.5) * 1.15 - order));
    for (const { x, z, order } of columns) {
      const level = coming(order);
      u.uColumn?.([x, z, level * level * (3 - 2 * level)]);
      u.uModel?.(translation(x, 0, z));
      gl.drawElements(gl.TRIANGLES, hall.column.count, gl.UNSIGNED_INT, 0);
    }
    if (!bloom) {
      u.uModel?.(identity());
      gl.bindVertexArray(hall.wall.vao);
      gl.drawElements(gl.TRIANGLES, hall.wall.count, gl.UNSIGNED_INT, 0);
    }
    gl.disable(gl.CULL_FACE);
  }

  function drawFloor(pose: PodiumPose, bloom: boolean) {
    const { program } = programs.floor;
    gl.useProgram(program);
    room(programs.floor, pose, bloom);
    // Drawn after the podium and its reflection: the podium stands in front of it, and the reflection, which lies
    // beneath it, shows through.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.bindVertexArray(floor);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
  }

  function drawDust(pose: PodiumPose, bloom: boolean) {
    const { uniforms: u, program } = programs.dust;
    gl.useProgram(program);
    room(programs.dust, pose, bloom);
    u.uDpr?.(bloom ? 0.5 : dpr);
    u.uMarks?.(shape ? shape.marks.flat() : []);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(dust);
    gl.drawArrays(gl.POINTS, 0, DUST);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
  }

  function drawHaze(pose: PodiumPose, bloom: boolean) {
    if (!layout || !targets) return;
    const { uniforms: u, program } = programs.hazeOver;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets.haze.texture);
    u.uHaze?.(0);
    u.uText?.(layout.textBox);
    u.uSize?.([layout.width, layout.height]);
    u.uBloom?.(bloom ? 1 : 0);
    u.uBloomScale?.(bloomScale);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // In the picture the haze lightens what's under it as light does (a screen); in the glow it simply adds.
    if (bloom) gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFunc(gl.ONE_MINUS_DST_COLOR, gl.ONE);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  function into(t: Target | null) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.framebuffer : null);
    gl.viewport(0, 0, t ? t.width : canvas.width, t ? t.height : canvas.height);
  }

  function blur(from: Target, to: Target, dx: number, dy: number) {
    const { uniforms: u, program } = programs.blur;
    into(to);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, from.texture);
    u.uImage?.(0);
    u.uStep?.([dx / from.width, dy / from.height]);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render(pose: PodiumPose) {
    if (!layout || !targets || !shape) return;
    const t = targets;
    aim(pose);
    if (!camera) return;
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);
    // The noise volume stays on unit 1 for every pass that reads it.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, noise);
    gl.activeTexture(gl.TEXTURE0);

    // The haze, marched at a third of the size and softened.
    into(t.haze);
    gl.disable(gl.DEPTH_TEST);
    {
      const { uniforms: u, program } = programs.haze;
      gl.useProgram(program);
      room(programs.haze, pose, false);
      const c = Math.cos(camera.pitch), s = Math.sin(camera.pitch);
      u.uRight?.([1, 0, 0]);
      u.uUp?.([0, c, s]);
      u.uForward?.([0, s, -c]);
      u.uLens?.([camera.focal, camera.cx, camera.cy]);
      gl.bindVertexArray(screen);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    blur(t.haze, t.hazeSwap, 1, 0);
    blur(t.hazeSwap, t.haze, 0, 1);

    // The glow: the scene again at half size keeping only what's past white, then blurred near and far.
    into(t.scene);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    drawPodium(pose, false, true);
    drawHall(pose, true);
    drawFloor(pose, true);
    drawHaze(pose, true);
    drawDust(pose, true);
    gl.disable(gl.DEPTH_TEST);
    blur(t.scene, t.nearSwap, 1, 0);
    blur(t.nearSwap, t.near, 0, 1);
    blur(t.near, t.farSwap, 2, 0);
    blur(t.farSwap, t.far, 0, 2);
    for (let i = 0; i < 2; i++) {
      blur(t.far, t.farSwap, 1.5, 0);
      blur(t.farSwap, t.far, 0, 1.5);
    }

    // The picture: the dark, the podium, its reflection, the hall, the floor, the haze, the dust. The podium goes
    // first, so that what it hides of its reflection, the hall and the floor is never shaded.
    into(null);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    // The glow behind the podium sits on its back edge.
    const [, y, , w] = transform(multiply(projection, view), [0, shape.top, -shape.radii[0]]);
    gl.useProgram(programs.backdrop.program);
    programs.backdrop.uniforms.uFrame?.([layout.centerX, ((1 - y / w) / 2) * layout.height, 0, 0]);
    screenPass(programs.backdrop, pose, false);
    drawPodium(pose, false, false);
    drawPodium(pose, true, false);
    drawHall(pose, false);
    drawFloor(pose, false);
    drawHaze(pose, false);
    drawDust(pose, false);

    // The glow on top, then the corners darkened.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const { uniforms: u, program } = programs.light;
    gl.useProgram(program);
    [t.near, t.far].forEach((from, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, from.texture);
    });
    u.uNear?.(0);
    u.uFar?.(1);
    u.uScale?.(bloomScale);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    gl.useProgram(programs.vignette.program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  function dispose() {
    release();
    for (const { program } of Object.values(programs)) gl.deleteProgram(program);
    gl.deleteVertexArray(screen);
    gl.deleteVertexArray(dust);
    gl.deleteVertexArray(floor);
    gl.deleteBuffer(seeds);
    gl.deleteBuffer(floorBuffer);
    gl.deleteTexture(noise);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  return { resize, render, dispose };
}

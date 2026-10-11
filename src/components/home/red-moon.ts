/* The red moon on the Student Organizations Coordinating Council's Student Government landing (socc-backdrop.tsx
   places and animates it). A colossal red moon hangs over the three banners, so near that its lower edge is the
   arc their tops are cut from. A star stands just behind it and is breaking out at its lower right, beside the
   Council's banner: its light runs round the moon's thin air as a ring of fire, white at the star and reddening
   away from it; it burns at the edge as a diamond, rakes a hairline crescent of crater rims, and streams out past
   the edge into a sky of stars and crimson gas, where satellites circle the moon and now and then a star shoots.
   Below lies a plain of black glass that mirrors it all to the horizon, rocks drift above it, and the banners throw
   long shadows across it toward the viewer.
   Drawn with WebGL2 (scene-gl.ts has the plumbing). The moon, the sky and the plain are worked out per pixel. The
   moon's relief and ground are baked once into a cube map (craters of four sizes, dark seas, and the rays of a few
   young craters), then lit, with shadows marched across the relief along the crescent. Everything in the sky is
   at infinity and the camera is level, so the plain mirrors it by turning the screen over at the horizon. The
   rocks are meshes, drawn again upside down for their reflections. The star's light streams out in shafts (its
   glow blurred outward from it past the moon, the rocks and the banners), blooms, and leaves a streak and ghosts
   across the lens. The camera is solved from the page's layout (CSS pixels), so the moon is exactly the banners'
   circle and their feet stand on the plain. */

import {
  BLUR_FRAGMENT, HEADER, MIRROR, NOISE, SCREEN_VERTEX, cross, identity, lens, linkLater, linked, multiply,
  noiseVolume, normalMatrix, normalize, target, translation, unload, untarget, upload,
  type Buffers, type Mat4, type Program, type Target, type Vec, Mesh,
} from "./scene-gl";

export type MoonLayout = {
  /** The canvas's size. */
  width: number;
  height: number;
  /** The banners' artwork (1200 × 820, stretched to fit) as left, top, width, height: the moon is the circle their
      tops are cut from, and their shadows are cut from it too. */
  stage: [number, number, number, number];
  /** The heading and lede, as left, top, right, bottom: the sky is kept quiet behind them. */
  textBox: [number, number, number, number];
};

export type MoonPose = {
  /** Seconds since the scene started: drives the gas, the shimmer, the rocks, the dust and the moon's turn. */
  time: number;
  /** The camera settling as the scene comes up, 0–1: it starts a little further back and higher. */
  rise: number;
  /** The night coming up: the stars, the gas, the dark of the moon's face and the glass. */
  glow: number;
  /** The light round the moon's edge, 0–1, drawn round from the star both ways. */
  ring: number;
  /** The star's own light: the diamond, the crescent, the shafts and the sheen on the glass. */
  sun: number;
  /** The burst as the star breaks the edge, 0–1. */
  flare: number;
};

export type RedMoon = {
  resize(layout: MoonLayout, dpr: number): void;
  /** Draws a frame, first baking up to `faces` more faces of the moon's surface if it isn't done. */
  render(pose: MoonPose, faces?: number): void;
  dispose(): void;
};

/* ——— The layout ——— */

/** The banners' artwork is 1200 × 820: their feet are on y = 690, and their tops share the circle of radius 1000
    round (600, −720), which is the moon's edge. */
const FEET = 690 / 820;
/** The horizon's row down the artwork: a little under the moon's lowest point (y = 280), behind the middle banner. */
const HORIZON = 336 / 820;
/** Where the star breaks the moon's edge, in radians round from its right (negative is below): just out past the
    outer top corner of the Council's banner, which is at −61°. */
const STAR = (-56 * Math.PI) / 180;
/** How far the star stands out to the side behind the moon: the larger, the wider the crescent it lights. */
const CRESCENT = 0.27;
/** The camera stands `DISTANCE` in front of the banners, level, with a lens `LENS` times the canvas's height. */
const DISTANCE = 1000;
const LENS = 1;
/** The moon's turn: about a tilted axis, once in forty minutes, from where it starts. */
const AXIS = normalize([0.28, 0.93, 0.24]);
const TURN = (2 * Math.PI) / 2400;
const FACE = 2.1;

/** The rocks drifting over the glass. Each is placed on screen at rest: on which side of the banners, how far out
    from them toward the canvas's edge (0–1), how high over the horizon (a share of the moon's radius), how big
    (a share of the stage's width), how far beyond the banners it floats (in `DISTANCE`s; negative is nearer the
    camera), which of the shapes it is, and how fast it tumbles. */
const ROCKS = [
  { side: -1, out: 0.6, up: 0.18, size: 0.07, depth: -0.35, shape: 0, spin: 0.05 },
  { side: -1, out: 0.18, up: 0.06, size: 0.022, depth: 1.7, shape: 1, spin: -0.08 },
  { side: -1, out: 0.88, up: 0.5, size: 0.03, depth: 1.2, shape: 2, spin: 0.07 },
  { side: 1, out: 0.62, up: 0.36, size: 0.042, depth: 0.9, shape: 1, spin: -0.06 },
  { side: 1, out: 0.22, up: 0.045, size: 0.014, depth: 3.2, shape: 2, spin: 0.1 },
  { side: 1, out: 0.9, up: 0.1, size: 0.06, depth: -0.25, shape: 0, spin: 0.04 },
] as const;

/** The satellites circling the moon, many round the one: how far out each orbits (in moon radii), how far its orbit
    is tipped toward the camera and turned on the screen, how fast it goes round (radians a second; negative is the
    other way) and where it starts. Each shows a dim running light and a red beacon that flashes; behind the moon or
    below the horizon it's hidden. */
const SATELLITES = [
  { radius: 1.07, tilt: 0.35, node: 0.2, speed: 0.02, phase: 4.0 },
  { radius: 1.16, tilt: -0.55, node: -0.35, speed: -0.016, phase: 5.1 },
  { radius: 1.28, tilt: 0.25, node: 0.6, speed: 0.013, phase: 4.3 },
  { radius: 1.12, tilt: -0.75, node: 0.1, speed: 0.018, phase: 5.4 },
  { radius: 1.22, tilt: 0.45, node: -0.5, speed: -0.015, phase: 3.9 },
] as const;

/** A shooting star crosses the dark at one side or the other at most once in this many seconds. */
const METEOR_EVERY = 8;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A turn about a unit axis, as a column-major 3×3. */
function rotation([x, y, z]: Vec, angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return new Float32Array([
    t * x * x + c, t * x * y + s * z, t * x * z - s * y,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c,
  ]);
}

/** Solves the scene for a layout: the lens and the camera's height (it's level, its middle row on the horizon,
    so the banners' feet land on the glass), the moon and the star on the canvas, which way the star's light
    comes, and where the rocks float. */
function solve(layout: MoonLayout) {
  const [sx, sy, sw, sh] = layout.stage;
  const focal = layout.height * LENS;
  const cx = sx + sw / 2;
  const horizon = sy + sh * HORIZON;
  const eye = (DISTANCE * (sy + sh * FEET - horizon)) / focal;
  const moon = [cx, sy - (sh * 720) / 820, (sw * 1000) / 1200, (sh * 1000) / 820];
  // The star just outside the edge, so the part of it the moon doesn't hide is a bead on the limb.
  const radius = Math.max(2.2, moon[2] * 0.0042);
  const out = 1 + (radius * 0.4) / moon[2];
  const bead = [moon[0] + Math.cos(STAR) * moon[2] * out, moon[1] - Math.sin(STAR) * moon[3] * out];
  const toStar = normalize([bead[0] - cx, horizon - bead[1], -focal]);
  const sun = normalize([Math.cos(STAR) * CRESCENT, Math.sin(STAR) * CRESCENT, -1]);
  const rest = multiply(lens(focal, cx, horizon, layout.width, layout.height, 10, 200000), translation(0, -eye, -DISTANCE));

  // Each rock where its spec puts it on screen, unless that would put it over the words or under the glass.
  const [left, top, right, bottom] = layout.textBox;
  const rocks: Array<{ at: number[]; size: number; shape: number; spin: number; seed: number }> = [];
  ROCKS.forEach((spec, index) => {
    const inner = spec.side < 0 ? sx + sw * 0.1 : sx + sw * 0.9;
    const edge = spec.side < 0 ? 0 : layout.width;
    const x = inner + (edge - inner) * spec.out;
    const y = horizon - spec.up * moon[2];
    const r = spec.size * sw;
    const nearX = Math.max(left - x, x - right, 0), nearY = Math.max(top - y, y - bottom, 0);
    if (Math.hypot(nearX, nearY) < r * 1.6 + 30) return;
    const d = DISTANCE * (1 + spec.depth);
    const world = [((x - cx) * d) / focal, eye + ((horizon - y) * d) / focal, DISTANCE - d];
    const size = (r * d) / focal;
    if (world[1] < size * 1.6) world[1] = size * 1.6;
    rocks.push({ at: world, size, shape: spec.shape, spin: spec.spin, seed: index });
  });

  return { focal, cx, horizon, eye, moon, bead, radius, toStar, sun, rest, rocks };
}

type Shape = ReturnType<typeof solve>;

/* ——— The rocks ——— */

/** A seeded random sequence (mulberry32), so each rock keeps its shape from visit to visit. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 3D value noise over a seeded lattice. */
function valueNoise(random: () => number) {
  const values = Float32Array.from({ length: 256 }, random);
  const order = Uint8Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const at = (x: number, y: number, z: number) => values[order[(order[(order[x & 255] + y) & 255] + z) & 255]];
  const ease = (t: number) => t * t * (3 - 2 * t);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = ease(x - xi), fy = ease(y - yi), fz = ease(z - zi);
    return mix(
      mix(mix(at(xi, yi, zi), at(xi + 1, yi, zi), fx), mix(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), fx), fy),
      mix(mix(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), fx), mix(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), fx), fy),
      fz);
  };
}

/** A rock about two units across: a ball subdivided from an icosahedron, pushed in and out by noise, drawn out of
    round, and sheared flat in a few places where it broke away. */
function buildRock(seed: number) {
  const random = seeded(seed);
  const noise = valueNoise(random);
  const fbm = (x: number, y: number, z: number) => {
    let v = 0, a = 0.5;
    for (let i = 0; i < 5; i++) {
      v += a * noise(x, y, z);
      x = x * 2.03 + 17.1; y = y * 2.03 + 3.7; z = z * 2.03 + 9.3;
      a *= 0.5;
    }
    return v;
  };
  const g = (1 + Math.sqrt(5)) / 2;
  const points: Vec[] = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]].map(normalize);
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let level = 0; level < 4; level++) {
    const middles = new Map<number, number>();
    const middle = (a: number, b: number) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      let index = middles.get(key);
      if (index === undefined) {
        index = points.length;
        points.push(normalize([points[a][0] + points[b][0], points[a][1] + points[b][1], points[a][2] + points[b][2]]));
        middles.set(key, index);
      }
      return index;
    };
    faces = faces.flatMap(([a, b, c]) => {
      const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a);
      return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]];
    });
  }
  const stretch = [1.1 + random() * 0.5, 0.66 + random() * 0.24, 0.8 + random() * 0.35];
  const cuts = Array.from({ length: 5 + Math.floor(random() * 3) }, () => [...normalize([random() - 0.5, random() - 0.5, random() - 0.5]), 0.52 + random() * 0.26]);
  const o = [random() * 40, random() * 40, random() * 40];
  const shaped = points.map(([x, y, z]) => {
    let r = 1 + 0.5 * (fbm(x * 1.05 + o[0], y * 1.05 + o[1], z * 1.05 + o[2]) - 0.5);
    // Ridges where the noise folds over, for sharp crests between the hollows.
    const ridge = 1 - Math.abs(2 * fbm(x * 2.6 + o[2], y * 2.6 + o[0], z * 2.6 + o[1]) - 1);
    r += 0.09 * (ridge - 0.6) + 0.05 * (fbm(x * 6.5 + o[1], y * 6.5 + o[2], z * 6.5 + o[0]) - 0.5);
    // Where a plane cuts it, the surface is pulled in along its ray onto the plane: a flat broken face.
    for (const [nx, ny, nz, depth] of cuts) {
      const reach = (x * nx + y * ny + z * nz) * r;
      if (reach > depth) r *= depth / reach;
    }
    return [x * r * stretch[0], y * r * stretch[1], z * r * stretch[2]];
  });
  const normals = shaped.map(() => [0, 0, 0]);
  for (const [a, b, c] of faces) {
    const n = cross(
      [shaped[b][0] - shaped[a][0], shaped[b][1] - shaped[a][1], shaped[b][2] - shaped[a][2]],
      [shaped[c][0] - shaped[a][0], shaped[c][1] - shaped[a][1], shaped[c][2] - shaped[a][2]],
    );
    for (const i of [a, b, c]) for (let k = 0; k < 3; k++) normals[i][k] += n[k];
  }
  const mesh = new Mesh();
  shaped.forEach((p, i) => {
    const n = normalize(normals[i]);
    mesh.vertex(p[0], p[1], p[2], n[0], n[1], n[2], 0);
  });
  for (const face of faces) mesh.indices.push(...face);
  return mesh;
}

/** The young craters that throw rays across the moon: where each is, and its radius (radians). */
function rayedCraters() {
  const random = seeded(2026);
  const list: number[] = [];
  for (let i = 0; i < 8; i++) list.push(...normalize([random() - 0.5, random() - 0.5, random() - 0.5]), 0.016 + random() * 0.03);
  return new Float32Array(list);
}

/* ——— Shaders ——— */

/** Bakes one face of the moon's surface: its height (in moon radii) and how pale its ground is. The ground is red
    uplands broken by dark lowland seas; craters of four sizes overlap across it, the biggest flat-floored with a
    central peak, each with a raised rim and a skirt of thrown-out ground; a few young ones are pale, and eight
    throw bright rays. */
const BAKE_FRAGMENT = `${HEADER}
uniform float uFace;
uniform float uFaceSize;
uniform vec2 uEncode;
uniform vec4 uRayed[8];
out vec4 outColor;
${NOISE}

vec4 hash43(vec3 p) {
  vec4 p4 = fract(vec4(p.xyzx) * vec4(0.1031, 0.103, 0.0973, 0.1099));
  p4 += dot(p4, p4.wzxy + 33.33);
  return fract((p4.xxyz + p4.yzzw) * p4.zywx);
}

// The direction through a texel of the face being baked, by the cube map's own layout.
vec3 faceDirection(vec2 st) {
  vec2 c = st * 2.0 - 1.0;
  int f = int(uFace + 0.5);
  if (f == 0) return vec3(1.0, -c.y, -c.x);
  if (f == 1) return vec3(-1.0, -c.y, c.x);
  if (f == 2) return vec3(c.x, 1.0, c.y);
  if (f == 3) return vec3(c.x, -1.0, -c.y);
  if (f == 4) return vec3(c.x, -c.y, 1.0);
  return vec3(-c.x, -c.y, -1.0);
}

float smin(float a, float b, float k) {
  float h = clamp((b - a + k) / (2.0 * k), 0.0, 1.0);
  return a * h + b * (1.0 - h) - k * h * (1.0 - h);
}

// A crater's section at x radii from its middle: a bowl, flat-floored with a central peak when it's big, rising to a
// rounded rim and falling away outside it as a skirt of thrown-out ground (gone by 1.7 radii). Every change of slope
// is eased, so the relief stays smooth at the surface's resolution.
float profile(float x, float big) {
  float floorDepth = mix(1.0, 0.45, big);
  float bowl = -smin(1.0 - x * x, floorDepth, 0.25);
  float outside = min(x - 1.7, 0.0);
  float rim = 0.42 * outside * outside;
  return smin(bowl, rim, 0.3) + big * 0.4 * exp(-pow(x / 0.16, 2.0));
}

// One size of craters. p is the point on a sphere of radius scale, in cells; each cell holds at most one crater, near
// its middle, so only the cells round the point are looked at (the 2 × 2 × 2 nearest for the small sizes).
void craters(vec3 p, float scale, float chance, float fresh, float big, float depth, float sea, bool wide, inout float height, inout float pale) {
  vec3 cell = floor(p), f = p - cell;
  vec3 lo = wide ? vec3(-1.0) : step(0.5, f) - 1.0;
  int n = wide ? 3 : 2;
  int count = n * n * n;
  for (int k = 0; k < 27; k++) {
    if (k >= count) break;
    vec3 c = cell + lo + vec3(float(k % n), float((k / n) % n), float(k / (n * n)));
    vec4 h = hash43(c);
    if (h.w > chance) continue;
    vec3 middle = c + 0.5 + (h.xyz - 0.5) * 0.6;
    float radius = mix(0.18, 0.42, pow(fract(h.x * 7.13 + h.y * 3.71), 2.2));
    float x = length(p - middle) / radius;
    if (x > 1.7) continue;
    // Each a little deeper or shallower than the next; in the seas, half drowned.
    height += profile(x, big) * radius / scale * depth * (0.45 + 0.55 * fract(h.y * 13.7 + h.z)) * (1.0 - 0.5 * sea);
    float young = step(fract(h.z * 9.17 + h.w * 4.31), fresh);
    pale += young * 0.18 * (1.0 - smoothstep(0.7, 1.6, x)) - (1.0 - young) * 0.04 * (1.0 - smoothstep(0.6, 1.1, x));
  }
}

void main() {
  vec3 d = normalize(faceDirection(gl_FragCoord.xy / uFaceSize));
  float sea = smoothstep(0.5, 0.6, fbm(d * 1.5 + vec3(3.1, 1.7, 5.3)));
  float height = -0.004 * sea + 0.004 * (fbm(d * 5.0 + 1.3) - 0.5) + 0.0006 * (fbm(d * 40.0 + 7.1) - 0.5);
  float pale = 0.5 - 0.4 * sea + 0.22 * (fbm(d * 7.0 + 2.9) - 0.5);
  craters(d * 2.6, 2.6, 0.5, 0.0, 1.0, 0.1, sea, true, height, pale);
  craters(d * 6.0, 6.0, 0.55, 0.1, 0.6, 0.3, sea, true, height, pale);
  craters(d * 14.0, 14.0, 0.6, 0.12, 0.15, 0.4, sea, true, height, pale);
  craters(d * 33.0, 33.0, 0.5, 0.0, 0.0, 0.42, sea, false, height, pale);
  for (int i = 0; i < 8; i++) {
    vec3 c = uRayed[i].xyz;
    float rad = uRayed[i].w;
    float x = acos(clamp(dot(d, c), -1.0, 1.0)) / rad;
    if (x > 16.0) continue;
    if (x < 1.7) height += profile(x, 0.8) * rad * 0.42;
    vec3 u = normalize(cross(c, abs(c.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 v = cross(c, u);
    float around = atan(dot(d, v), dot(d, u));
    float streak = pow(valueNoise(vec3(cos(around) * 5.0, sin(around) * 5.0, float(i) * 7.3 + x * 0.12)), 3.0);
    pale += 1.3 * streak * exp(-max(x - 1.0, 0.0) / 2.4) * smoothstep(0.9, 1.5, x) + 0.45 * (1.0 - smoothstep(0.8, 1.4, x));
  }
  outColor = vec4(height * uEncode.x + uEncode.y, pale, 0.0, 1.0);
}`;

/** What the passes share: the layout and the light; the sky at infinity (the stars, the gas, the moon with its
    ring and its star); the glass; and the shadows the banners and rocks throw. */
const SCENE = `
uniform vec2 uSize;
// The pass's pixels per CSS pixel.
uniform float uPixel;
// The moon on the canvas: its middle and radii (CSS px); the star where it breaks the edge (CSS px), its angle round
// the edge and its radius; and its light at the moon, in the moon's own view (x right, y up, z toward the camera).
uniform vec4 uMoon;
uniform vec4 uStar;
uniform vec3 uSun;
// Turns the face as seen into the baked surface, as the moon turns.
uniform mat3 uSpin;
// The night, the ring, the star and its burst; and the time.
uniform vec4 uLevels;
uniform float uTime;
uniform vec4 uText;
// The lens (its focal length, its middle across, and the horizon's row), the camera, and the way to the star.
uniform vec3 uLens;
uniform vec3 uEye;
uniform vec3 uToStar;
// The camera at rest, and the banners' artwork on the canvas: where their shadows are cut from.
uniform mat4 uRest;
uniform vec4 uStage;
// Each rock's middle and size, for its shadow.
uniform vec4 uRocks[6];
// Each satellite on the canvas (CSS px), its running light and its beacon's flash; and a shooting star, its head
// (CSS px), the angle it travels at and its light.
uniform vec4 uSats[5];
uniform vec4 uMeteor;
uniform vec2 uEncode;
uniform float uFaceSize;
// 0 the picture, 1 the glow (only light past white), 2 the source of the shafts.
uniform float uMode;
uniform float uBloomScale;
uniform mediump sampler3D uNoise;
uniform highp samplerCube uSurface;

const float PI = 3.14159265;
// How much the moon's relief is drawn up, for the light to find it.
const float RELIEF = 1.7;
const vec3 STARLIGHT = vec3(1.0, 0.9, 0.84) * 3.2;
const vec3 CRIMSON = vec3(0.42, 0.018, 0.035);
const vec3 EMBER = vec3(1.0, 0.2, 0.07);
const vec3 HOT = vec3(1.0, 0.66, 0.42);
const vec3 WHITE = vec3(1.0, 0.93, 0.88);
const vec3 PEARL = vec3(1.0, 0.8, 0.82);
// The moon's ground: dark seas, red uplands, and the pale ground thrown out of young craters.
const vec3 SEA = vec3(0.07, 0.012, 0.012);
const vec3 UPLAND = vec3(0.3, 0.06, 0.045);
const vec3 EJECTA = vec3(0.6, 0.24, 0.17);

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
float noise3(vec3 p) { return texture(uNoise, p).r; }

// How far p is in behind the heading and lede: 1 over the words, falling away softly round them in an ellipse a
// little larger than their box, as shading would.
float behindText(vec2 p) {
  vec2 d = (p - (uText.xy + uText.zw) * 0.5) / ((uText.zw - uText.xy) * 0.5 + vec2(170.0, 110.0));
  return exp(-pow(dot(d, d), 1.6) * 1.2);
}

/* The sky */

// A layer of stars on a grid of \`cell\` px. Each cell holds at most one, kept clear of its edges, so only the
// pixel's own cell is looked at. Mirrored in the glass (\`blur\`), they spread and dim.
vec3 starLayer(vec2 p, float cell, float chance, float level, vec2 blur, float seed) {
  vec2 g = floor(p / cell);
  vec3 h = hash32(g + seed);
  if (h.x > chance) return vec3(0.0);
  vec2 d = p - (g + 0.15 + 0.7 * h.yz) * cell;
  float core = 0.42 + 0.3 / uPixel;
  vec2 size = sqrt(core * core + blur * blur);
  float lum = level * pow(hash12(g + seed + 17.0), 3.0) * core * core / (size.x * size.y);
  float tone = hash12(g + seed + 5.3);
  vec3 tint = tone < 0.3 ? vec3(0.72, 0.82, 1.0) : tone < 0.85 ? vec3(1.0, 0.96, 0.92) : vec3(1.0, 0.76, 0.58);
  float twinkle = 1.0 + 0.3 * sin(uTime * (0.6 + 2.0 * h.y) + h.z * 50.0);
  d /= size;
  return tint * lum * twinkle * exp(-0.5 * dot(d, d));
}

// A few brighter stars, each with a soft halo and, seen directly, faint spikes from the lens.
vec3 brightStars(vec2 p, vec2 blur) {
  const float cell = 150.0;
  vec3 c = vec3(0.0);
  vec2 g0 = floor(p / cell);
  float sharp = 1.0 - step(0.01, blur.y);
  for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
      vec2 g = g0 + vec2(float(i), float(j));
      vec3 h = hash32(g + 41.0);
      if (h.x > 0.55) continue;
      vec2 d = p - (g + 0.1 + 0.8 * h.yz) * cell;
      if (dot(d, d) > 900.0 + blur.y * blur.y * 9.0) continue;
      vec2 s = 0.75 + blur;
      vec2 e = d / s;
      float lum = 0.35 + 2.6 * pow(hash12(g + 7.7), 5.0);
      float core = exp(-0.5 * dot(e, e)) * 0.5625 / (s.x * s.y);
      float halo = exp(-length(d) / (3.5 + blur.y)) * 0.06;
      float spikes = (exp(-abs(d.y) * 1.8) * exp(-abs(d.x) / 11.0) + exp(-abs(d.x) * 1.8) * exp(-abs(d.y) / 11.0)) * 0.1 * sharp * lum;
      vec3 tint = h.z < 0.45 ? vec3(0.78, 0.86, 1.0) : vec3(1.0, 0.9, 0.82);
      c += tint * lum * (core + halo + spikes) * (0.88 + 0.12 * sin(uTime * (1.2 + h.y) + h.z * 30.0));
    }
  return c;
}

// Gas in the dark round the moon: crimson and rose, lanes of dust through it and a cold violet deeper in. It is
// richest out at the sides and thins toward the middle, so the banners stand clear of it; the star lights what
// lies near it.
vec3 nebula(vec2 p, float blur) {
  vec2 u = mat2(0.94, 0.34, -0.34, 0.94) * (p - vec2(uSize.x * 0.5, uLens.z)) / uSize.y;
  float t = uTime * 0.004;
  vec2 warp = vec2(noise3(vec3(u * 0.45, 0.11 + t)), noise3(vec3(u * 0.45 + 0.41, 0.63 - t))) - 0.5;
  vec3 q = vec3(u * 0.95 + warp * 0.22, 0.37 + t * 0.6);
  float gas = 0.0, amp = 0.5;
  vec3 r = q;
  int octaves = blur > 6.0 ? 3 : 5;
  for (int i = 0; i < 5; i++) {
    if (i >= octaves) break;
    gas += amp * noise3(r);
    r = r * 2.13 + vec3(0.17, 0.33, 0.41);
    amp *= 0.5;
  }
  float bank = smoothstep(0.32, 0.72, noise3(vec3(u * 0.32 + 0.2, 0.9)));
  float cloud = pow(smoothstep(0.3, 0.95, gas), 1.5) * bank;
  float lane = smoothstep(0.55, 0.75, noise3(q * 2.2 + vec3(0.6, 0.1, 0.3))) * 0.8;
  float side = smoothstep(0.1, 0.75, abs(p.x - uSize.x * 0.5) / (uSize.x * 0.5));
  float violet = smoothstep(0.5, 0.8, noise3(q * 0.7 + vec3(0.9, 0.4, 0.2)));
  vec3 col = mix(vec3(0.16, 0.012, 0.03), vec3(0.12, 0.02, 0.07), noise3(q * 1.7 + 0.5));
  col = mix(col, vec3(0.02, 0.02, 0.085), violet * 0.7);
  float lit = 1.0 + 2.0 * exp(-length(p - uStar.xy) / (uSize.y * 0.25));
  return col * cloud * (1.0 - 0.75 * lane) * (0.2 + 0.8 * side) * lit;
}

vec3 space(vec2 p, vec2 blur, float quiet) {
  // Mirrored, only the brighter stars show, softened round rather than smeared.
  vec3 stars = blur.y > 0.0
    ? starLayer(p, 28.0, 0.5, 1.5, vec2(max(blur.x, blur.y * 0.4)), 13.0) + brightStars(p, vec2(max(blur.x, blur.y * 0.4)))
    : starLayer(p, 9.0, 0.25, 1.0, blur, 0.0) + starLayer(p, 28.0, 0.5, 1.8, blur, 13.0) + brightStars(p, blur);
  return (vec3(0.0004, 0.0003, 0.0009) + nebula(p, blur.y) * (1.0 - 0.6 * quiet) + stars * (1.0 - 0.75 * quiet)) * uLevels.x;
}

/* The moon */

// The ground of the face point n (in the moon's view): its height (moon radii) and how pale it is.
vec2 ground(vec3 n, float lod) {
  vec2 g = textureLod(uSurface, uSpin * n, lod).rg;
  return vec2((g.x - uEncode.y) / uEncode.x, g.y);
}

// How fine a level of the surface to read where the face turns away by nz, and seen blurred by \`blur\` px.
float surfaceLod(float nz, float blur) {
  float pixel = 1.0 / (uMoon.z * uPixel * sqrt(max(nz, 0.03)));
  return max(log2(pixel * uFaceSize * 0.5), 0.0) + log2(1.0 + blur * 0.4);
}

// The ring's light at angle a round the edge: white-hot at the star, burning orange then deep crimson away from
// it, and only as far round as it has been drawn yet, a spark running at its front. Its nearness to the star in a.
vec4 ringAt(float a) {
  float d = abs(mod(a - uStar.z + PI, 2.0 * PI) - PI);
  float near = exp(-d * d / 0.018), mid = exp(-d * d / 0.5);
  float reach = uLevels.y * (PI + 0.8);
  float drawn = smoothstep(0.0, 0.3, reach - d);
  float spark = exp(-pow(reach - d, 2.0) / 0.0025) * step(0.001, uLevels.y) * (1.0 - smoothstep(0.7, 1.0, uLevels.y));
  float shimmer = 0.8 + 0.4 * noise3(vec3(cos(a) * 0.9, sin(a) * 0.9, uTime * 0.01));
  vec3 color = mix(mix(CRIMSON, EMBER, mid * 0.75), HOT, near);
  return vec4(color * (0.7 + 2.2 * mid + 5.0 * near) * shimmer * drawn + HOT * spark * 7.0, near);
}

// How much of the star's light reaches the face point n past the relief between: marched toward the star across
// the surface, the ray rising at the star's height over the local level as the round moon falls away beneath it.
float craterShadow(vec3 n, float h0, float lod, float e) {
  vec3 along = uSun - n * dot(uSun, n);
  float len = length(along);
  if (len < 1e-4) return 1.0;
  along /= len;
  float rise = dot(uSun, n) / len;
  float lit = 1.0;
  for (int i = 1; i <= 7; i++) {
    float t = e * float(i * i) * 0.8;
    float hs = ground(normalize(n + along * t), lod).x;
    float ray = h0 + (rise * t + 0.5 * t * t) / RELIEF;
    lit = min(lit, smoothstep(-0.0006, 0.0003, ray - hs));
  }
  return lit;
}

// How high up the moon q is (moon radii, y up): 0 down at its burning lower edge, by the banners, to 1 up where it
// meets the top of the page. The moon falls into the night as it rises, so its top stays dark.
float risen(vec2 q) {
  return smoothstep(-0.9, -0.3, q.y);
}

// The face at q (moon radii, y up; r = |q| < 1). The star lights a hairline crescent at the lower right (a moon is
// no darker at its edge, so the crescent burns right out to the limb), the crater walls throwing their shadows
// across it; the ring grazes the face just inside the edge; and planetshine thrown up off the glass lets the
// ground be made out across the dark. All but the crescent fade as the face rises.
vec3 moonFace(vec2 q, float r, vec2 blur, float quiet) {
  vec3 n = vec3(q, sqrt(max(1.0 - r * r, 0.0)));
  float lod = surfaceLod(n.z, max(blur.x, blur.y));
  float e = 2.0 / uFaceSize * exp2(lod) * 1.25;
  vec3 t1 = normalize(abs(n.z) < 0.9 ? vec3(-n.y, n.x, 0.0) : vec3(0.0, -n.z, n.y));
  vec3 t2 = cross(n, t1);
  vec2 here = ground(n, lod);
  float hx = ground(normalize(n + t1 * e), lod).x, hy = ground(normalize(n + t2 * e), lod).x;
  vec3 N = normalize(n - RELIEF * ((hx - here.x) * t1 + (hy - here.x) * t2) / e);
  vec3 albedo = mix(SEA, UPLAND, smoothstep(0.12, 0.55, here.y));
  albedo = mix(albedo, EJECTA, smoothstep(0.62, 1.1, here.y));
  vec3 c = vec3(0.0);
  float day = dot(n, uSun);
  if (day > -0.06 && uLevels.z > 0.0) {
    float mu0 = max(dot(N, uSun), 0.0), mu = max(N.z, 0.03);
    float lit = 2.0 * mu0 / (mu0 + mu) * smoothstep(-0.05, 0.05, day);
    if (lit > 0.002) lit *= craterShadow(n, here.x, lod, e);
    c += albedo * STARLIGHT * 0.75 * lit * uLevels.z;
  }
  float high = risen(q);
  // A band about a twenty-fifth of the radius deep.
  float edge = exp(-(1.0 - r) / 0.037);
  if (edge > 0.01) {
    vec3 from = normalize(vec3(q / max(r, 1e-4), -0.35));
    c += albedo * ringAt(atan(q.y, q.x)).rgb * max(dot(N, from), 0.0) * edge * 0.22 * (1.0 - 0.6 * high);
  }
  // The eclipse: the star's light, bent red round through the moon's air, falls dimly over the whole face, strongest
  // on the side toward the star. It's what makes the moon read red in the dark; it's held down behind the words.
  vec2 toward = vec2(cos(uStar.z), sin(uStar.z));
  float side = smoothstep(-1.1, 1.0, dot(q, toward));
  vec3 bent = normalize(vec3(toward * 0.35, 1.0));
  c += albedo * vec3(1.0, 0.32, 0.26) * (0.07 + 0.22 * side) * (0.35 + 0.65 * max(dot(N, bent), 0.0)) * uLevels.y * (1.0 - 0.5 * quiet) * (1.0 - 0.82 * high);
  vec3 shine = normalize(vec3(0.15, -0.5, 1.0));
  c += albedo * vec3(0.5, 0.56, 0.72) * 0.04 * (0.3 + max(dot(N, shine), 0.0)) * uLevels.x * (1.0 - 0.45 * quiet) * (1.0 - 0.7 * high);
  return c;
}

// The ring itself: the moon's thin air lit from behind, a fine bright line along the edge with a soft halo
// outside, and inside the edge the same air seen against the face. It quietens toward the top too.
vec3 limbLight(vec2 q, float r, vec2 blur) {
  vec4 ring = ringAt(atan(q.y, q.x));
  float k = uMoon.z / 700.0, b = blur.y;
  float h = (r - 1.0) * uMoon.z;
  float thin = k * (2.0 + 5.0 * ring.a) + b;
  float line = h > 0.0 ? exp(-h / thin) : exp(h / (thin * 0.75));
  float halo = h > 0.0 ? exp(-h / (k * (14.0 + 24.0 * ring.a) + b)) : exp(h / (k * (6.0 + 8.0 * ring.a) + b)) * 0.7;
  return ring.rgb * (line + halo * 0.2) * (1.0 - 0.45 * risen(q));
}

// The star where the moon doesn't hide it: a blinding bead on the edge, and its corona streaming out round it.
vec3 starLight(vec2 p, float outside, vec2 blur) {
  vec2 d = p - uStar.xy;
  float dist = length(d), k = uMoon.z / 700.0;
  vec2 s = uStar.w + blur;
  vec2 e = d / s;
  float bead = exp(-0.5 * dot(e, e)) * uStar.w * uStar.w / (s.x * s.y);
  float around = atan(d.y, d.x);
  float streamers = 0.45 + 1.1 * pow(noise3(vec3(cos(around) * 1.6, sin(around) * 1.6, dist / (k * 400.0) - uTime * 0.012)), 2.0);
  float corona = (exp(-dist / (20.0 * k + blur.y)) * 0.7 + exp(-dist / (90.0 * k + blur.y)) * 0.12) * streamers;
  return (WHITE * bead * 26.0 + PEARL * corona) * outside * uLevels.z * (1.0 + 2.5 * uLevels.w);
}

// The satellites circling the moon: a dim running light each, and a red beacon that flashes now and then.
vec3 traffic(vec2 p, vec2 blur) {
  vec3 c = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec4 sat = uSats[i];
    if (sat.z + sat.w <= 0.0) continue;
    vec2 d = p - sat.xy;
    float r2 = dot(d, d);
    if (r2 > 900.0) continue;
    vec2 size = 0.7 + blur;
    vec2 e = d / size;
    float core = exp(-0.5 * dot(e, e)) * 0.49 / (size.x * size.y);
    c += vec3(1.0, 0.92, 0.8) * sat.z * core + vec3(1.0, 0.18, 0.14) * sat.w * (core * 2.0 + exp(-sqrt(r2) / 3.5) * 0.08);
  }
  return c;
}

// A shooting star: a hot head and a tail that cools and spreads as it trails.
vec3 meteor(vec2 p) {
  if (uMeteor.w <= 0.0) return vec3(0.0);
  vec2 dir = vec2(cos(uMeteor.z), sin(uMeteor.z));
  vec2 d = p - uMeteor.xy;
  float back = -dot(d, dir), across = dot(d, vec2(-dir.y, dir.x));
  if (back < -4.0 || back > 160.0) return vec3(0.0);
  float trail = max(back, 0.0);
  float tail = exp(-trail / 48.0) * exp(-across * across / (0.35 + trail * 0.012));
  float head = exp(-dot(d, d) / 2.2);
  return (mix(EMBER, HOT, exp(-trail / 22.0)) * tail * 0.9 + WHITE * head * 2.2) * uMeteor.w;
}

// Everything at infinity seen at p on the canvas (CSS px): space, the moon over it, its ring and its star.
// \`blur\` spreads it as the glass's gloss does; \`shade\` is how much of the star's light reaches where it's mirrored.
vec3 sky(vec2 p, vec2 blur, float shade, float quiet) {
  vec2 q = vec2(p.x - uMoon.x, uMoon.y - p.y) / uMoon.zw;
  float r = length(q);
  float soft = (0.6 / uPixel + blur.y) / uMoon.z;
  float inside = 1.0 - smoothstep(1.0 - soft, 1.0 + soft, r);
  vec3 c = vec3(0.0);
  if (inside < 1.0) c += space(p, blur, quiet) * (1.0 - inside);
  if (inside > 0.0) c += moonFace(q, min(r, 0.9999), blur, quiet) * inside;
  c += limbLight(q, r, blur);
  c += starLight(p, 1.0 - inside, blur) * shade;
  c += (traffic(p, blur) + meteor(p)) * (1.0 - 0.85 * quiet);
  return c;
}

/* The ground */

// How far into the banners a point of the canvas is: 1 inside their artwork, 0 outside, \`soft\` units of the
// artwork either side of the edge. They stand on y = 690 of 1200 × 820, in panels at x = 120…360, 460…740 and
// 840…1080, up to the circle of radius 1000 round (600, −720) their tops share.
float banner(vec2 css, float soft) {
  vec2 art = (css - uStage.xy) / uStage.zw * vec2(1200.0, 820.0);
  float top = -720.0 + sqrt(max(1.0e6 - (art.x - 600.0) * (art.x - 600.0), 0.0));
  float across = min(min(abs(art.x - 240.0) - 120.0, abs(art.x - 600.0) - 140.0), abs(art.x - 960.0) - 120.0);
  float d = max(max(across, top - art.y), art.y - 690.0);
  return 1.0 - smoothstep(-soft, soft, d);
}

// How much of the star's light reaches P: what the banners (standing in the plane z = 0) and the rocks leave.
float sunShadow(vec3 P) {
  vec3 L = uToStar;
  float lit = 1.0;
  if (P.z > 0.0) {
    float t = -P.z / L.z;
    vec4 clip = uRest * vec4(P + L * t, 1.0);
    vec2 css = vec2(clip.x / clip.w * 0.5 + 0.5, 0.5 - clip.y / clip.w * 0.5) * uSize;
    lit *= 1.0 - 0.92 * banner(css, 2.0 + t * 0.006);
  }
  for (int i = 0; i < 6; i++) {
    vec4 rock = uRocks[i];
    if (rock.w <= 0.0) continue;
    vec3 to = rock.xyz - P;
    float along = dot(to, L);
    if (along <= 0.0) continue;
    float miss = length(to - L * along);
    lit *= mix(0.12, 1.0, smoothstep(rock.w * 0.55, rock.w * 1.05 + along * 0.004, miss));
  }
  return lit;
}

// The black glass at P seen from V: its own faint red dark in rgb, and how much it mirrors in a. Patches dulled as if
// by frost mirror less and blur more (\`rough\`). \`sheen\` is the star's reflection spread wide by the gloss, cut by
// \`shade\`: it's part of what the glass mirrors, so a rock's reflection hides it.
vec4 glass(vec3 P, vec3 V, float shade, out float rough, out vec3 sheen) {
  float dull = smoothstep(0.48, 0.8, noise3(vec3(P.xz * 0.0004, 0.31)) * 0.65 + noise3(vec3(P.xz * 0.0019, 0.77)) * 0.35);
  rough = mix(0.0005, 0.012, dull);
  float cosV = clamp(V.y, 0.001, 1.0);
  float F = 0.045 + 0.955 * pow(1.0 - cosV, 5.0);
  vec3 H = normalize(uToStar + V);
  float a = mix(0.012, 0.04, dull);
  float k = H.y * H.y * (a - 1.0) + 1.0;
  float lobe = a * a / (k * k);
  sheen = STARLIGHT * 0.08 * lobe * shade * uLevels.z;
  return vec4(vec3(0.0022, 0.001, 0.0012) * uLevels.x, min(F * mix(1.0, 0.5, dull), 0.94));
}

// A thin haze lying on the glass at the horizon, lit red by the ring and warmest under the star.
vec3 mist(vec2 p) {
  float y = abs(p.y - uLens.z) / (uSize.y / 900.0);
  float under = exp(-pow((p.x - uStar.x) / (uSize.x * 0.2), 2.0));
  float span = 0.3 + 0.7 * smoothstep(1.3, 0.5, abs(p.x - uMoon.x) / uMoon.z);
  vec3 tint = mix(CRIMSON * 1.3, EMBER, 0.5 * under);
  return tint * (exp(-y / 3.0) * 0.05 + exp(-y / 24.0) * 0.045) * (span * uLevels.y + under * 1.6 * uLevels.z) * uLevels.x;
}
`;

/** How a colour leaves a fragment shader. */
const TONE = `
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float dither(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }

// The glow keeps only light past white; the picture is tone mapped and dithered against banding.
vec4 finish(vec3 hdr) {
  if (uMode > 0.5) return vec4(max(hdr - 1.0, 0.0) * uBloomScale, 1.0);
  return vec4(pow(aces(hdr), vec3(1.0 / 2.2)) + dither(gl_FragCoord.xy) / 255.0, 1.0);
}
`;

/** The sky, the moon and the glass, per pixel: above the horizon the sky; below it the glass, mirroring the sky
    turned over at the horizon. For the shafts, only the star's light outside the moon and the banners. */
const SKY_FRAGMENT = `${HEADER}
in vec2 vUv;
out vec4 outColor;
${SCENE}
${TONE}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  if (uMode > 1.5) {
    vec3 source = vec3(0.0);
    if (p.y < uLens.z) {
      vec2 q = vec2(p.x - uMoon.x, uMoon.y - p.y) / uMoon.zw;
      float outside = smoothstep(1.0, 1.0 + 3.0 / uMoon.z, length(q));
      source = starLight(p, outside, vec2(0.0)) * (1.0 - banner(p, 2.0)) * 0.035;
    }
    outColor = vec4(source, 1.0);
    return;
  }
  vec3 color;
  if (p.y < uLens.z) {
    color = sky(p, vec2(0.0), 1.0, behindText(p));
  } else {
    vec3 d = normalize(vec3(p.x - uLens.y, min(uLens.z - p.y, -0.02), -uLens.x));
    vec3 P = uEye + d * (uEye.y / -d.y);
    float shade = sunShadow(P), rough;
    vec3 sheen;
    vec4 g = glass(P, -d, shade, rough, sheen);
    vec2 blur = 0.7 + 2.0 * rough * uLens.x * vec2(-d.y, 1.0);
    color = g.rgb * (1.0 - g.a) + (sky(vec2(p.x, 2.0 * uLens.z - p.y), blur, shade, 0.0) + sheen) * g.a;
  }
  outColor = finish(color + mist(p));
}`;

const ROCK_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vLocal;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = uNormalMatrix * aNormal;
  vLocal = aPosition;
  gl_Position = uProjection * uView * world;
}`;

/** A rock: dark stone with a grain that turns with it. The star behind finds only the faces turned from the
    camera, so it draws a hot rim round the far side; the moon's burning edge lights it red from above and the
    glass from below. In the reflection it's lit upright and the glass laid over it. For the shafts, it's black. */
const ROCK_FRAGMENT = `${HEADER}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vLocal;
uniform float uMirror;
uniform mat3 uTurn;
out vec4 outColor;
${SCENE}
${TONE}
void main() {
  if (uMode > 1.5) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 P = vWorld, N = normalize(vNormal), eye = uEye;
  if (uMirror > 0.5) { P.y = -P.y; N.y = -N.y; eye.y = -eye.y; }
  vec3 g = vLocal * 1.1;
  const float e = 0.04;
  float n0 = noise3(g);
  vec3 bump = uTurn * (vec3(noise3(g + vec3(e, 0.0, 0.0)), noise3(g + vec3(0.0, e, 0.0)), noise3(g + vec3(0.0, 0.0, e))) - n0) / e;
  if (uMirror > 0.5) bump.y = -bump.y;
  N = normalize(N - bump * 0.025);
  vec3 albedo = vec3(0.038, 0.026, 0.024) * (0.75 + 0.5 * n0) * (0.75 + 0.5 * noise3(vLocal * 0.7 + 0.3));
  vec3 V = normalize(eye - P), L = uToStar, H = normalize(L + V);
  float NdotV = max(dot(N, V), 1e-3), NdotL = max(dot(N, L), 0.0), NdotH = max(dot(N, H), 0.0);
  const float a = 0.2;
  float k = NdotH * NdotH * (a - 1.0) + 1.0;
  float D = a / (PI * k * k);
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(H, V), 0.0), 5.0);
  float spec = min(D * F / (4.0 * NdotV * max(NdotL, 0.05)), 3.0) * NdotL;
  // The star from behind: a little on the faces it reaches, and a hot line round the edge that's turned to it.
  float shade = sunShadow(P) * uLevels.z;
  float rim = pow(1.0 - NdotV, 4.0) * smoothstep(-0.1, 0.5, dot(N, L));
  vec3 c = (albedo / PI * NdotL * 0.55 + spec * 0.3) * mix(STARLIGHT, HOT * 3.0, 0.5) * shade + mix(HOT, WHITE, 0.3) * rim * 1.5 * shade;
  c += albedo * mix(CRIMSON, EMBER, 0.4) * pow(max(dot(N, normalize(vec3(0.0, 0.7, -0.7))), 0.0), 2.0) * 0.6 * uLevels.y;
  c += albedo * CRIMSON * max(-N.y, 0.0) * 0.3 * uLevels.x;
  c += pow(1.0 - NdotV, 5.0) * mix(CRIMSON, EMBER, 0.3) * 0.18 * uLevels.y;
  vec2 css = vec2(gl_FragCoord.x, uSize.y * uPixel - gl_FragCoord.y) / uPixel;
  if (uMirror > 0.5) {
    // Where this is seen in the glass, and the glass's own colour laid over it as far as it doesn't mirror.
    vec3 d = normalize(vWorld - uEye);
    vec3 Q = uEye + d * (uEye.y / max(-d.y, 1e-4));
    float rough;
    vec3 sheen;
    vec4 glassAt = glass(Q, -d, sunShadow(Q), rough, sheen);
    c = glassAt.rgb * (1.0 - glassAt.a) + c * glassAt.a + mist(css);
  }
  outColor = finish(c);
}`;

/** Dust drifting in the air in front of the banners: each mote glows as it crosses the star's light toward the
    camera, and catches a little of the ring's red otherwise. Out of focus near the camera, it spreads into discs. */
const DUST_VERTEX = `${HEADER}
layout(location = 0) in vec4 aSeed;
uniform mat4 uProjection;
uniform mat4 uView;
uniform vec3 uVolume;
uniform float uFocus;
uniform float uDpr;
out float vGlow;
out float vBlur;
out float vWarm;
${SCENE}
void main() {
  vec3 p = vec3((aSeed.x - 0.5) * 2.0 * uVolume.x, uVolume.y * fract(aSeed.y + uTime * 0.004 * (0.5 + aSeed.w)), uVolume.z * (aSeed.z - 0.4));
  p.x += sin(uTime * 0.07 + aSeed.w * 40.0) * uVolume.x * 0.02;
  p.z += cos(uTime * 0.05 + aSeed.x * 30.0) * uVolume.z * 0.02;
  vec4 view = uView * vec4(p, 1.0);
  gl_Position = uProjection * view;
  float depth = max(-view.z, 1.0);
  vBlur = clamp(abs(depth - uFocus) / (uFocus * 0.6), 0.0, 1.0);
  float c = dot(-uToStar, normalize(uEye - p));
  const float g = 0.78;
  float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * c, 1.5);
  float twinkle = 0.6 + 0.4 * sin(uTime * (0.8 + aSeed.w * 2.0) + aSeed.x * 70.0);
  float sun = phase * 0.018 * sunShadow(p) * uLevels.z;
  vWarm = sun / (sun + 0.004 * uLevels.y + 1e-5);
  vGlow = (sun + 0.004 * uLevels.y) * twinkle / (1.0 + vBlur * 4.0);
  gl_PointSize = (1.0 + aSeed.w * 1.6) * (1.0 + vBlur * 3.0) * clamp(uFocus / depth, 0.3, 3.0) * uDpr;
}`;

const DUST_FRAGMENT = `${HEADER}
in float vGlow;
in float vBlur;
in float vWarm;
uniform float uMode;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float a = mix(exp(-r * 4.0), smoothstep(1.0, 0.6, r) * (0.55 + 0.45 * r), vBlur);
  vec3 c = mix(vec3(1.0, 0.25, 0.2), vec3(1.0, 0.86, 0.8), vWarm) * vGlow * a;
  outColor = vec4(c * (uMode > 0.5 ? 0.6 : 1.0), 1.0);
}`;

/** The shafts: each pixel gathers the star's light along its way to the star, so whatever stands in the way leaves
    its shadow in them. */
const RAYS_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uSource;
out vec4 outColor;
void main() {
  const int SAMPLES = 64;
  vec2 step = (vUv - uSource) * (0.96 / float(SAMPLES));
  vec2 uv = vUv;
  float weight = 1.0, total = 0.0;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < SAMPLES; i++) {
    uv -= step;
    sum += texture(uImage, uv).rgb * weight;
    total += weight;
    weight *= 0.965;
  }
  outColor = vec4(sum / total, 1.0);
}`;

/** The lens's streak: the brightest light smeared out sideways, a little further each pass. */
const STREAK_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uStep;
uniform float uThreshold;
out vec4 outColor;
void main() {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = -8; i <= 8; i++) {
    float w = exp(-float(i * i) / 22.0);
    sum += max(texture(uImage, vUv + uStep * float(i)).rgb - uThreshold, 0.0) * w;
    total += w;
  }
  outColor = vec4(sum / total, 1.0);
}`;

/** Adds the glow, the shafts, the streak and the lens's ghosts of the star over the picture, rolled off so they
    never clip, and kept off the heading and lede. */
const LIGHT_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uNear;
uniform sampler2D uFar;
uniform sampler2D uRays;
uniform sampler2D uStreak;
uniform float uScale;
uniform vec2 uSize;
uniform vec4 uText;
// The star on the canvas (CSS px), its light, and its burst.
uniform vec4 uFlare;
out vec4 outColor;
const vec3 TINTS[5] = vec3[5](vec3(1.0, 0.35, 0.3), vec3(0.9, 0.55, 0.25), vec3(0.5, 0.35, 0.9), vec3(0.3, 0.7, 0.8), vec3(1.0, 0.4, 0.6));
const float AT[5] = float[5](0.35, 0.62, 1.15, 1.45, 1.8);
const float SIZE[5] = float[5](0.025, 0.06, 0.035, 0.11, 0.05);
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec2 beyond = max(max(uText.xy - p, p - uText.zw), 0.0);
  float covered = 1.0 - smoothstep(0.0, 100.0, length(beyond));
  vec3 glow = (texture(uNear, vUv).rgb * 0.9 + texture(uFar, vUv).rgb * 1.4) / uScale;
  vec3 rays = texture(uRays, vUv).rgb * vec3(1.0, 0.72, 0.68) * 1.6 * uFlare.z * mix(1.0, 0.12, covered);
  vec3 streak = texture(uStreak, vUv).rgb / uScale * vec3(1.0, 0.4, 0.45) * 0.9 * mix(1.0, 0.3, covered);
  vec2 axis = uSize * 0.5 - uFlare.xy;
  vec3 ghosts = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float d = length(p - uFlare.xy - axis * AT[i]) / (SIZE[i] * uSize.y);
    ghosts += TINTS[i] * smoothstep(1.0, 0.82, d) * (0.35 + 0.65 * d * d);
  }
  ghosts *= 0.02 * uFlare.z * (1.0 + 4.0 * uFlare.w) * mix(1.0, 0.25, covered);
  // The star's spikes, from the lens's six blades: fine rays through it that fade as they reach out.
  vec2 d = p - uFlare.xy;
  float dist = length(d), around = atan(d.y, d.x) + 0.3;
  float spikes = 0.0;
  for (int i = 0; i < 3; i++) spikes += exp(-abs(sin(around + float(i) * 1.0472)) * dist / 0.8);
  spikes *= exp(-dist / (52.0 + 90.0 * uFlare.w)) * uFlare.z * (1.0 + 2.0 * uFlare.w) * 1.4 * mix(1.0, 0.2, covered);
  outColor = vec4(1.0 - exp(-(glow + rays + streak + ghosts + vec3(1.0, 0.86, 0.82) * spikes)), 1.0);
}`;

/** Darkens the corners, multiplied over the picture. */
const VIGNETTE_FRAGMENT = `${HEADER}
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.0, 1.25);
  outColor = vec4(vec3(1.0 - 0.5 * smoothstep(0.34, 0.95, length(p))), 1.0);
}`;

/* ——— The scene ——— */

const DUST = 500;

/** Starts the scene on a canvas, or returns null where WebGL2 isn't available. */
export function createRedMoon(canvas: HTMLCanvasElement): RedMoon | null {
  const context = canvas.getContext("webgl2", { alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  // Half floats keep the light past white; where they can't be drawn to, it's packed into bytes, and the moon's
  // surface is baked coarser into bytes too.
  const float = !!gl.getExtension("EXT_color_buffer_float");
  const bloomScale = float ? 1 : 0.25;

  // Every program starts compiling at once (on other threads, where the browser can) while the rocks and the noise
  // are made; then each is collected.
  gl.getExtension("KHR_parallel_shader_compile");
  let programs: Record<"bake" | "sky" | "rock" | "dust" | "rays" | "streak" | "blur" | "light" | "vignette", Program>;
  let noise: WebGLTexture, shapes: Buffers[];
  try {
    const pending = {
      bake: linkLater(gl, SCREEN_VERTEX, BAKE_FRAGMENT),
      sky: linkLater(gl, SCREEN_VERTEX, SKY_FRAGMENT),
      rock: linkLater(gl, ROCK_VERTEX, ROCK_FRAGMENT),
      dust: linkLater(gl, DUST_VERTEX, DUST_FRAGMENT),
      rays: linkLater(gl, SCREEN_VERTEX, RAYS_FRAGMENT),
      streak: linkLater(gl, SCREEN_VERTEX, STREAK_FRAGMENT),
      blur: linkLater(gl, SCREEN_VERTEX, BLUR_FRAGMENT),
      light: linkLater(gl, SCREEN_VERTEX, LIGHT_FRAGMENT),
      vignette: linkLater(gl, SCREEN_VERTEX, VIGNETTE_FRAGMENT),
    };
    gl.flush();
    noise = noiseVolume(gl);
    shapes = [buildRock(11), buildRock(23), buildRock(37)].map((mesh) => upload(gl, mesh));
    programs = Object.fromEntries(Object.entries(pending).map(([name, program]) => [name, linked(gl, program)])) as typeof programs;
  } catch (error) {
    console.error(error);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }

  const screen = gl.createVertexArray()!;

  // The dust's seeds never change: four random numbers each.
  const dust = gl.createVertexArray()!;
  const seeds = gl.createBuffer()!;
  gl.bindVertexArray(dust);
  gl.bindBuffer(gl.ARRAY_BUFFER, seeds);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Array.from({ length: DUST * 4 }, Math.random)), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // The moon's surface: a cube map baked a face at a time, then given its mipmaps.
  const faceSize = float ? 1024 : 512;
  const encode = float ? [1, 0] : [6, 0.5];
  const surface = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, surface);
  gl.texStorage2D(gl.TEXTURE_CUBE_MAP, Math.log2(faceSize) + 1, float ? gl.RG16F : gl.RGBA8, faceSize, faceSize);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  const bakery = gl.createFramebuffer()!;
  const rayed = rayedCraters();
  let baked = 0;

  let layout: MoonLayout | null = null;
  let shape: Shape | null = null;
  let targets: Record<"scene" | "near" | "nearSwap" | "far" | "farSwap" | "streak" | "streakSwap" | "source" | "rays", Target> | null = null;
  let dpr = 1;
  let projection = identity();
  let view = identity();
  let eye = [0, 0, DISTANCE];
  const rocks = new Float32Array(24);
  const sats = new Float32Array(SATELLITES.length * 4);
  const meteor = new Float32Array(4);
  let placed: Array<{ model: Mat4; turn: Float32Array; shape: number }> = [];

  const release = () => {
    if (targets) for (const t of Object.values(targets)) untarget(gl, t);
    targets = null;
  };

  function resize(next: MoonLayout, ratio: number) {
    layout = next;
    dpr = ratio;
    canvas.width = Math.max(1, Math.round(next.width * ratio));
    canvas.height = Math.max(1, Math.round(next.height * ratio));
    release();
    shape = solve(next);
    projection = lens(shape.focal, shape.cx, shape.horizon, next.width, next.height, 10, 200000);
    const size = (x: number, y = x) => [Math.max(1, Math.ceil(next.width / x)), Math.max(1, Math.ceil(next.height / y))] as const;
    const [nw, nh] = size(2), [fw, fh] = size(8), [sw, sh] = size(8, 2), [rw, rh] = size(4);
    targets = {
      scene: target(gl, nw, nh, float, true),
      near: target(gl, nw, nh, float),
      nearSwap: target(gl, nw, nh, float),
      far: target(gl, fw, fh, float),
      farSwap: target(gl, fw, fh, float),
      streak: target(gl, sw, sh, float),
      streakSwap: target(gl, sw, sh, float),
      source: target(gl, rw, rh, false),
      rays: target(gl, rw, rh, false),
    };
  }

  /** Bakes up to `count` more faces of the moon's surface, and gives it its mipmaps once all six are done. */
  function bake(count: number) {
    const { uniforms: u, program } = programs.bake;
    gl.useProgram(program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bakery);
    gl.viewport(0, 0, faceSize, faceSize);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    u.uFaceSize?.(faceSize);
    u.uEncode?.(encode);
    u.uRayed?.(rayed);
    gl.bindVertexArray(screen);
    for (let i = 0; i < count && baked < 6; i++, baked++) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + baked, surface, 0);
      u.uFace?.(baked);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (baked === 6) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, surface);
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    }
  }

  /** Sets the camera, the rocks, the satellites and any shooting star for a pose. While the scene comes up the camera
      stands further back and higher in the same proportion, so the banners' feet stay planted on the glass while
      everything nearer and further slides past them; the rocks bob and tumble. */
  function aim(pose: MoonPose) {
    if (!shape || !layout) return;
    // The satellites where their orbits have carried them, hidden behind the moon and under the horizon.
    const [mx, my, rx, ry] = shape.moon;
    SATELLITES.forEach((sat, i) => {
      const a = sat.phase + pose.time * sat.speed;
      const x = Math.cos(a) * sat.radius, round = Math.sin(a) * sat.radius;
      const y = round * Math.cos(sat.tilt), z = round * Math.sin(sat.tilt);
      const qx = x * Math.cos(sat.node) - y * Math.sin(sat.node), qy = x * Math.sin(sat.node) + y * Math.cos(sat.node);
      const at = [mx + qx * rx, my - qy * ry];
      const seen = (z < 0 ? clamp01((Math.hypot(qx, qy) - 1) / 0.006) : 1) * clamp01((shape!.horizon - at[1]) / 3) * pose.glow;
      const beat = (pose.time + i * 0.61) % 1.9;
      sats.set([at[0], at[1], 0.5 * seen, 3 * Math.exp(-((beat / 0.05) ** 2)) * seen], i * 4);
    });
    // Now and then a shooting star, out in the dark at one side, after the scene has come up.
    meteor.fill(0);
    const slot = Math.floor(pose.time / METEOR_EVERY);
    const random = seeded(slot * 7919 + 17);
    const age = pose.time - slot * METEOR_EVERY - random() * (METEOR_EVERY - 1.2);
    if (slot > 0 && random() < 0.75 && age > 0 && age < 0.9) {
      const side = random() < 0.5 ? -1 : 1;
      const [sx, , sw] = layout.stage;
      const inner = side < 0 ? sx + sw * 0.08 : sx + sw * 0.92, edge = side < 0 ? 0 : layout.width;
      const x0 = inner + (edge - inner) * (0.25 + random() * 0.6);
      const y0 = layout.height * 0.08 + (shape.horizon - 140 - layout.height * 0.08) * random();
      const angle = side < 0 ? Math.PI - (0.35 + random() * 0.5) : 0.35 + random() * 0.5;
      const travel = (320 + random() * 260) * age;
      meteor.set([x0 + Math.cos(angle) * travel, y0 + Math.sin(angle) * travel, angle, Math.sin((Math.PI * age) / 0.9) * pose.glow]);
    }
    const back = 1 + (1 - pose.rise) * 0.12;
    eye = [0, shape.eye * back, DISTANCE * back];
    view = translation(-eye[0], -eye[1], -eye[2]);
    rocks.fill(0);
    placed = shape.rocks.map((rock, i) => {
      const turn = rotation(normalize([Math.sin(rock.seed * 2.1), 0.6, Math.cos(rock.seed * 1.3)]), rock.seed * 1.7 + pose.time * rock.spin);
      const at = [rock.at[0], rock.at[1] + Math.sin(pose.time * 0.32 + rock.seed * 1.9) * rock.size * 0.12 - (1 - pose.rise) * rock.size * 0.5, rock.at[2]];
      const s = rock.size;
      rocks.set([at[0], at[1], at[2], s * 0.9], i * 4);
      const model = new Float32Array([
        turn[0] * s, turn[1] * s, turn[2] * s, 0,
        turn[3] * s, turn[4] * s, turn[5] * s, 0,
        turn[6] * s, turn[7] * s, turn[8] * s, 0,
        at[0], at[1], at[2], 1,
      ]);
      return { model, turn, shape: rock.shape };
    });
  }

  /** Every uniform the shared chunk reads, for a pass drawn at `pixel` pixels per CSS pixel in `mode`. */
  function common(program: Program, pose: MoonPose, mode: number, pixel: number) {
    if (!shape || !layout) return;
    const u = program.uniforms;
    gl.useProgram(program.program);
    u.uSize?.([layout.width, layout.height]);
    u.uPixel?.(pixel);
    u.uMoon?.(shape.moon);
    u.uStar?.([shape.bead[0], shape.bead[1], STAR, shape.radius]);
    u.uSun?.(shape.sun);
    u.uSpin?.(rotation(AXIS, FACE + pose.time * TURN));
    u.uLevels?.([pose.glow, pose.ring, pose.sun, pose.flare]);
    u.uTime?.(pose.time);
    u.uText?.(layout.textBox);
    u.uLens?.([shape.focal, shape.cx, shape.horizon]);
    u.uEye?.(eye);
    u.uToStar?.(shape.toStar);
    u.uRest?.(shape.rest);
    u.uStage?.(layout.stage);
    u.uRocks?.(rocks);
    u.uSats?.(sats);
    u.uMeteor?.(meteor);
    u.uEncode?.(encode);
    u.uFaceSize?.(faceSize);
    u.uMode?.(mode);
    u.uBloomScale?.(bloomScale);
    u.uNoise?.(1);
    u.uSurface?.(2);
    u.uProjection?.(projection);
    u.uView?.(view);
  }

  function drawSky(pose: MoonPose, mode: number, pixel: number) {
    common(programs.sky, pose, mode, pixel);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);
  }

  /** The rocks, or their reflections; for the shafts, only their silhouettes. */
  function drawRocks(pose: MoonPose, mode: number, pixel: number, mirror: boolean) {
    const { uniforms: u } = programs.rock;
    common(programs.rock, pose, mode, pixel);
    u.uMirror?.(mirror ? 1 : 0);
    if (mode === 2) gl.disable(gl.DEPTH_TEST);
    else {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
    }
    gl.enable(gl.CULL_FACE);
    gl.cullFace(mirror ? gl.FRONT : gl.BACK);
    for (const rock of placed) {
      const model = mirror ? multiply(MIRROR, rock.model) : rock.model;
      u.uModel?.(model);
      u.uNormalMatrix?.(normalMatrix(model));
      u.uTurn?.(rock.turn);
      const part = shapes[rock.shape];
      gl.bindVertexArray(part.vao);
      gl.drawElements(gl.TRIANGLES, part.count, gl.UNSIGNED_INT, 0);
    }
    gl.disable(gl.CULL_FACE);
  }

  function drawDust(pose: MoonPose, mode: number, pixel: number) {
    if (!shape) return;
    const { uniforms: u } = programs.dust;
    common(programs.dust, pose, mode, pixel);
    u.uDpr?.(pixel);
    u.uVolume?.([DISTANCE * 1.1, shape.eye * 2.2, DISTANCE * 0.9]);
    u.uFocus?.(DISTANCE * 0.8);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(dust);
    gl.drawArrays(gl.POINTS, 0, DUST);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
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

  function streak(from: Target, to: Target, step: number, threshold: number) {
    const { uniforms: u, program } = programs.streak;
    into(to);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, from.texture);
    u.uImage?.(0);
    u.uStep?.([step / from.width, 0]);
    u.uThreshold?.(threshold);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function render(pose: MoonPose, faces = 2) {
    if (!layout || !targets || !shape) return;
    const t = targets;
    if (baked < 6) bake(faces);
    aim(pose);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 1);
    // The noise stays on unit 1 and the moon's surface on unit 2 for every pass that reads them.
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, noise);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, surface);
    gl.activeTexture(gl.TEXTURE0);

    // The shafts: the star's light with the rocks' silhouettes over it, blurred outward from the star.
    into(t.source);
    gl.clear(gl.COLOR_BUFFER_BIT);
    drawSky(pose, 2, 0.25);
    drawRocks(pose, 2, 0.25, false);
    into(t.rays);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(programs.rays.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.source.texture);
    programs.rays.uniforms.uImage?.(0);
    programs.rays.uniforms.uSource?.([shape.bead[0] / layout.width, 1 - shape.bead[1] / layout.height]);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // The glow: the scene again at half size keeping only what's past white, blurred near and far; and the streak
    // drawn sideways out of its brightest.
    into(t.scene);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawSky(pose, 1, 0.5);
    drawRocks(pose, 1, 0.5, false);
    drawDust(pose, 1, 0.5);
    gl.disable(gl.DEPTH_TEST);
    blur(t.scene, t.nearSwap, 1, 0);
    blur(t.nearSwap, t.near, 0, 1);
    blur(t.near, t.farSwap, 2, 0);
    blur(t.farSwap, t.far, 0, 2);
    for (let i = 0; i < 2; i++) {
      blur(t.far, t.farSwap, 1.5, 0);
      blur(t.farSwap, t.far, 0, 1.5);
    }
    streak(t.scene, t.streak, 2, 5 * bloomScale);
    streak(t.streak, t.streakSwap, 5, 0);
    streak(t.streakSwap, t.streak, 14, 0);

    // The picture: the sky and the glass, the rocks' reflections, the rocks, the dust.
    into(null);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawSky(pose, 0, dpr);
    drawRocks(pose, 0, dpr, true);
    drawRocks(pose, 0, dpr, false);
    drawDust(pose, 0, dpr);

    // The light over it all, then the corners darkened.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const { uniforms: u, program } = programs.light;
    gl.useProgram(program);
    [t.near, t.far, t.rays, t.streak].forEach((from, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, from.texture);
    });
    u.uNear?.(0);
    u.uFar?.(1);
    u.uRays?.(2);
    u.uStreak?.(3);
    u.uScale?.(bloomScale);
    u.uSize?.([layout.width, layout.height]);
    u.uText?.(layout.textBox);
    u.uFlare?.([shape.bead[0], shape.bead[1], pose.sun, pose.flare]);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    gl.useProgram(programs.vignette.program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    // Units 2 and 3 held the moon's surface and the streak; leave unit 0 active as the other passes expect.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  function dispose() {
    release();
    for (const { program } of Object.values(programs)) gl.deleteProgram(program);
    for (const part of shapes) unload(gl, part);
    gl.deleteVertexArray(screen);
    gl.deleteVertexArray(dust);
    gl.deleteBuffer(seeds);
    gl.deleteTexture(noise);
    gl.deleteTexture(surface);
    gl.deleteFramebuffer(bakery);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  return { resize, render, dispose };
}

/* The three pillars of the Student Government landing as monoliths of solid gold (monoliths.tsx places and animates
   them). Each is a thick slab cut to its banner's outline, the three tops sharing the arc of one great circle. Their
   faces and sides are satin-brushed, the grain running up the faces and along the tops and faintly mottled as cast,
   and every edge is a polished chamfer, so the studio's strips draw clean lines of light round each one while the
   faces carry broad, soft reflections the words can sit on. Before each one, a card lights its face, brightest
   toward its top left, and a tall strip lays a soft band of light down it; both lean after the pointer. A long strip
   overhead lines the tops; strips at the sides line the outer edges; and a warm light low behind them glows on their
   tops and inner sides, slips through the gaps onto the black glass they stand on and throws their shadows toward
   the camera. The glass mirrors them, blurring with depth, and the brightest glints bloom. Every so often a strip of
   light passes across all three. When a banner is pointed at, its monolith takes a spot of its own, the others fall
   back, and the rims take the colour of that body's scene.
   Drawn with WebGL2 (scene-gl.ts has the shared plumbing). The camera looks square at the slabs' fronts, which lie
   in the plane of the page's artwork, so every face lands exactly on its banner and the words sit on it; the slabs
   run back from there, so the camera, a little above their tops, sees the inner sides of the outer two and a
   sliver of every top. The canvas is transparent: the sky, or the scene of the body pointed at, shows round them. */

import {
  BLUR_FRAGMENT, HEADER, NOISE, SCREEN_VERTEX, lens, link, target, translation, untarget,
  type Mat4, type Program, type Target,
} from "./scene-gl";

export type MonolithLayout = {
  /** The canvas's size, in CSS pixels. */
  width: number;
  height: number;
  /** The banners' artwork (1200 × 820, stretched to fit) on the canvas, as left, top, width, height. */
  stage: [number, number, number, number];
};

export type MonolithPose = {
  /** Seconds since the scene started: the glow behind drifts with it. */
  time: number;
  /** The lights coming up, 0–1. */
  rise: number;
  /** How far the light has climbed each monolith's edges from its feet, 0–1: it meets itself over the top at 1. */
  trace: number;
  /** Which way the light leans, after the pointer: across and up, each −1–1. */
  lean: [number, number];
  /** How much each monolith is pointed at, 0–1. */
  focus: [number, number, number];
  /** Where the strip of light passing across is, as the tangent of its angle from straight ahead (about −0.6 is clear
      of the three to the left, 0.6 to the right); null while none is passing. */
  sweep: number | null;
};

export type GoldMonoliths = {
  resize(layout: MonolithLayout, dpr: number): void;
  render(pose: MonolithPose): void;
  dispose(): void;
};

/* ——— The monoliths ——— */

/** The banners' artwork is 1200 × 820. Their feet are on y = 690 and their tops on the circle about (600, −720) of
    radius 1000; each spans these columns. */
const ART = [1200, 820] as const;
const FEET = 690;
const CIRCLE = { x: 600, y: -720, r: 1000 };
const SPANS = [[120, 360], [460, 740], [840, 1080]] as const;
const topAt = (x: number) => CIRCLE.y + Math.sqrt(CIRCLE.r ** 2 - (x - CIRCLE.x) ** 2);

/** The camera's eye is level with this row of the artwork, a little above every top, and over its middle. Its lens is
    `LENS` times the stage's width: long enough to keep the slabs square, short enough to show their depth. */
const EYE = 110;
const LENS = 1.05;
/** Where the strip of light passing across (a pose's `sweep`) crosses the artwork's plane, across from the middle of
    a stage this wide, in CSS pixels: the page's headline glints there as it passes. */
export const bandAt = (sweep: number, stageWidth: number) => sweep * stageWidth * LENS;

/** Each slab's depth, and the width of its chamfers, as shares of the stage's width. */
const DEPTH = 0.09;
const BEVEL = 0.0095;
const ARC_STEPS = 48;

/** A mesh whose every vertex also carries which monolith it belongs to, how polished it is (0 brushed, 1 polished)
    and how far up its edge from the nearer foot it lies (0–1, meeting over the top). */
class Slabs {
  positions: number[] = [];
  normals: number[] = [];
  info: number[] = [];
  indices: number[] = [];

  vertex(p: number[], n: number[], info: number[]) {
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.info.push(info[0], info[1], info[2]);
    return this.positions.length / 3 - 1;
  }
}

type Outline = { point: number[]; normal: number[]; inset: number[]; climb: number }[][];

/** The camera and the monoliths for a layout. The world is in CSS pixels: x to the right and y up from the camera's
    eye, z toward the camera, whose eye is `focal` in front of the artwork's plane, so that plane lands on the canvas
    exactly as the page lays the banners out. */
function build(layout: MonolithLayout) {
  const [left, top, width, height] = layout.stage;
  const eye = [left + width / 2, top + (EYE / ART[1]) * height];
  const focal = width * LENS;
  const world = (x: number, y: number) => [left + (x / ART[0]) * width - eye[0], eye[1] - (top + (y / ART[1]) * height)];
  const floor = world(0, FEET)[1];
  const bevel = Math.max(2.2, width * BEVEL);
  const depth = width * DEPTH;
  const back = -(depth - bevel);

  /* Across a chamfer, along a side and over the back chamfer: each point of an outline is carried round this, from
     the face's edge to the back's. [inset, z, the normal's turn from facing the camera (degrees), polish] */
  const profile: [number, number, number, number][] = [
    [bevel, bevel, 0, 0],
    [bevel * 0.8, bevel * 0.8, 45, 1],
    [bevel * 0.2, bevel * 0.2, 45, 1],
    [0, 0, 90, 0],
    [0, back + bevel, 90, 0],
    [bevel * 0.2, back + bevel * 0.8, 135, 1],
    [bevel * 0.8, back + bevel * 0.2, 135, 1],
    [bevel, back, 180, 0],
  ];

  const mesh = new Slabs();
  const faces: number[][] = [];
  SPANS.forEach(([x0, x1], pillar) => {
    // The outline in three runs, each smooth: up the left side, over the top, down the right side.
    const runs = [
      [world(x0, FEET), world(x0, topAt(x0))],
      Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
        const x = x0 + ((x1 - x0) * i) / ARC_STEPS;
        return world(x, topAt(x));
      }),
      [world(x1, topAt(x1)), world(x1, FEET)],
    ];
    // Each point's outward normal from its run's own tangent (the outline runs clockwise, so out is the tangent turned
    // a quarter anticlockwise), and how far along the whole outline it is.
    let run = 0;
    const lengths: number[][] = runs.map((points) => points.map((p, i) => (run += i ? Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) : 0)));
    const total = run;
    const outline: Outline = runs.map((points, r) => points.map((point, i) => {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const t = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const normal = [-(b[1] - a[1]) / t, (b[0] - a[0]) / t];
      const along = lengths[r][i];
      return { point, normal, inset: normal, climb: Math.min(along, total - along) / (total / 2) };
    }));
    // Where runs meet, the chamfers are mitred: inset along the bisector, far enough to keep each side's width.
    for (let r = 0; r + 1 < outline.length; r++) {
      const a = outline[r][outline[r].length - 1], b = outline[r + 1][0];
      const dot = a.normal[0] * b.normal[0] + a.normal[1] * b.normal[1];
      const miter = [(a.normal[0] + b.normal[0]) / (1 + dot), (a.normal[1] + b.normal[1]) / (1 + dot)];
      a.inset = miter;
      b.inset = miter;
    }

    // The chamfers and sides: a ring of the profile at every point, joined to the next along each run.
    for (const points of outline) {
      let previous = -1;
      for (const { point, normal, inset, climb } of points) {
        const first = mesh.positions.length / 3;
        for (const [ins, z, turn, polish] of profile) {
          const a = (turn * Math.PI) / 180, s = Math.sin(a), c = Math.cos(a);
          mesh.vertex([point[0] - inset[0] * ins, point[1] - inset[1] * ins, z], [normal[0] * s, normal[1] * s, c], [pillar, polish, climb]);
        }
        if (previous >= 0)
          for (let j = 0; j + 1 < profile.length; j++)
            mesh.indices.push(previous + j, first + j, previous + j + 1, previous + j + 1, first + j, first + j + 1);
        previous = first;
      }
    }

    // The face: the chamfers' inner edge all round, fanned from the middle of its foot.
    const middle = mesh.vertex([(world(x0, FEET)[0] + world(x1, FEET)[0]) / 2, floor, bevel], [0, 0, 1], [pillar, 0, 0]);
    const rim = outline.flat().map(({ point, inset, climb }) =>
      mesh.vertex([point[0] - inset[0] * bevel, point[1] - inset[1] * bevel, bevel], [0, 0, 1], [pillar, 0, climb]));
    for (let i = 0; i + 1 < rim.length; i++) mesh.indices.push(middle, rim[i + 1], rim[i]);

    // Which way the face mirrors from its middle, and its span: for the lights set before each monolith, and the floor.
    const [fx0] = world(x0, FEET), [fx1] = world(x1, FEET);
    const mid = world((x0 + x1) / 2, (topAt((x0 + x1) / 2) + FEET) / 2);
    const aim = [mid[0], mid[1], focal - bevel];
    const length = Math.hypot(aim[0], aim[1], aim[2]);
    faces.push([fx0, fx1, ...aim.map((v) => v / length)]);
  });

  return { eye, focal, floor, bevel, back, mesh, faces, width };
}

/* ——— Shaders ——— */

/** The studio: what every gold surface mirrors, how a colour leaves the shader, and the monoliths' lights. */
const ROOM = `
uniform vec3 uCamera;
uniform float uFloor;
uniform float uScale;
uniform vec2 uLean;
uniform float uSweep;
uniform vec4 uFocus;
uniform vec3 uTint;
uniform vec3 uAim[3];
uniform float uRise;
uniform float uBloom;
uniform float uBloomScale;

const vec3 GOLD = vec3(1.0, 0.45, 0.08);
const vec3 WHITE = vec3(1.0, 0.94, 0.86);

// Where d points on a light's plane: tangents of the angles across and up from its centre, and how squarely it
// faces the light (0 or less when it points away).
vec3 onLight(vec3 d, vec3 center, vec3 up) {
  float facing = dot(d, center);
  vec3 x = normalize(cross(up, center));
  vec3 y = cross(center, x);
  return vec3(vec2(dot(d, x), dot(d, y)) / max(facing, 1e-4), facing);
}

// A rectangular light of half width and height size (as tangents), its edges blurred by soft.
float box(vec3 q, vec2 size, float soft) {
  if (q.z <= 0.0) return 0.0;
  vec2 e = 1.0 - smoothstep(size - soft, size + soft, abs(q.xy));
  return e.x * e.y;
}

// What a ray leaving monolith i in direction d meets, for a surface this rough.
vec3 studio(vec3 d, float rough, int i) {
  float soft = 0.006 + rough * 0.6;
  float spread = 1.0 / (1.0 + rough * 4.0);
  vec3 up = vec3(0.0, 1.0, 0.0);
  float focus = uFocus[i];
  // The room is dark: a little warmth comes up off the floor, and a dim wash falls from the ceiling.
  vec3 c = vec3(0.012, 0.008, 0.005) * (1.0 - smoothstep(-0.6, 0.4, d.y)) + WHITE * 0.07 * smoothstep(0.1, 0.95, d.y);
  // Before each monolith, the card its face mirrors (q is measured from straight off the face's middle): lit most at
  // its top left and falling away to the right and toward the floor, so the face carries a slow gradient. In it, a
  // strip left of square on lays a soft band of light down the face. Both lean after the pointer.
  vec3 q = onLight(d, uAim[i], up);
  q.xy -= vec2(uLean.x, -uLean.y) * vec2(0.055, 0.03);
  float grade = 0.3 + 0.3 * smoothstep(0.1, -0.1, q.x) + 0.45 * smoothstep(-0.24, 0.2, q.y);
  c += WHITE * grade * box(q, vec2(0.34, 0.5), 0.12 + soft);
  float band = box(q - vec3(-0.034 + float(i) * 0.01, 0.0, 0.0), vec2(0.013, 0.6), soft);
  c += WHITE * 2.2 * spread * band * (0.5 + 0.5 * smoothstep(-0.24, 0.18, q.y));
  // Overhead, a long strip just in front of the tops, that lines their front edges.
  c += WHITE * 2.2 * spread * box(onLight(d, normalize(vec3(0.0, 1.0, 0.13)), vec3(0.0, 0.0, -1.0)), vec2(2.8, 0.1), soft);
  // At the sides, strips that line the outer edges, taking the colour of the scene behind.
  vec3 rim = mix(WHITE, uTint, uFocus.w);
  float sides = box(onLight(d, normalize(vec3(-1.0, 0.06, 0.2)), up), vec2(0.05, 1.5), soft)
    + box(onLight(d, normalize(vec3(1.0, 0.06, 0.2)), up), vec2(0.05, 1.5), soft);
  c += rim * 1.3 * spread * sides;
  // Behind, low: the warm light the tops and the inner sides catch.
  vec3 b = onLight(d, normalize(vec3(0.0, 0.14, -1.0)), up);
  c += mix(vec3(1.0, 0.76, 0.5), uTint, uFocus.w) * 0.42 * spread * box(b, vec2(0.7, 0.2), 0.14 + soft);
  // A spot high in front of the monolith pointed at.
  c += WHITE * 0.9 * focus * box(onLight(d, normalize(uAim[i] + vec3(0.0, 0.17, 0.0)), up), vec2(0.13, 0.1), 0.12 + soft);
  // The strip passing across, leaning a little.
  if (uSweep > -5.0)
    c += WHITE * 2.0 * spread * box(onLight(d, normalize(vec3(uSweep, -0.26, 1.0)), normalize(vec3(0.32, 1.0, 0.0))), vec2(0.007, 1.4), soft);
  return c;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

float dither(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }

// The glow pass keeps only light past white, warmed toward white-gold so the gold's glints don't bloom red; the
// picture is tone mapped and dithered against banding.
vec3 finish(vec3 hdr) {
  if (uBloom > 0.5) return vec3(1.0, 0.86, 0.62) * max(dot(hdr, vec3(0.2126, 0.7152, 0.0722)) - 0.9, 0.0) * uBloomScale;
  return pow(aces(hdr), vec3(1.0 / 2.2)) + dither(gl_FragCoord.xy) / 255.0;
}
`;

const SLAB_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec3 aInfo;
uniform mat4 uProjection;
uniform mat4 uView;
uniform float uMirror;
uniform float uFloor;
out vec3 vWorld;
out vec3 vNormal;
out vec3 vInfo;
void main() {
  vWorld = aPosition;
  vNormal = aNormal;
  vInfo = aInfo;
  vec3 p = aPosition;
  // The reflection: the monolith turned over about the floor. It's lit upright, just as the monolith itself is seen.
  if (uMirror > 0.5) p.y = 2.0 * uFloor - p.y;
  gl_Position = uProjection * uView * vec4(p, 1.0);
}`;

const SLAB_FRAGMENT = `${HEADER}
in vec3 vWorld;
in vec3 vNormal;
in vec3 vInfo;
uniform float uMirror;
uniform float uTrace;
uniform float uFocal;
out vec4 outColor;
${NOISE}
${ROOM}
void main() {
  int pillar = int(vInfo.x + 0.5);
  float polish = vInfo.y;
  vec3 P = vWorld;
  vec3 N = normalize(vNormal);
  // The reflection is lit just as the monolith is seen, then turned over: the glass shows the gold as it looks.
  vec3 V = normalize(uCamera - P);
  float height = P.y - uFloor;
  float brushed = 1.0 - polish;

  // The grain runs up the faces and sides and along the tops, so a highlight spreads across it.
  vec3 along = abs(N.y) < 0.75 ? normalize(vec3(0.0, 1.0, 0.0) - N * N.y) : normalize(cross(N, vec3(0.0, 0.0, 1.0)));
  vec3 across = normalize(cross(N, along));
  float u = dot(P, across), v = dot(P, along);
  float seed = float(pillar) * 17.0;
  // The grooves fade where they'd be finer than a pixel.
  float px = fwidth(u);
  float coarse = 1.0 - smoothstep(0.9, 1.6, px * 0.38 * 2.0);
  float fine = 1.0 - smoothstep(0.35, 0.8, px * 1.1);
  float grain = 0.5 + (valueNoise(vec3(u * 0.38, v * 0.0035, seed)) - 0.5) * 0.6 * coarse + (valueNoise(vec3(u * 1.15, v * 0.009, seed + 5.0)) - 0.5) * 0.4 * fine;
  // A slow unevenness over each face, as if finished by hand: the faintest ripple in what it mirrors.
  vec2 ripple = vec2(0.0);
  ripple += vec2(0.011, 0.004) * cos(P.x * 0.011 + P.y * 0.004 + seed);
  ripple += vec2(-0.006, 0.013) * cos(-P.x * 0.006 + P.y * 0.013 + seed * 1.7);
  ripple += vec2(0.017, -0.009) * 0.5 * cos(P.x * 0.017 - P.y * 0.009 + seed * 2.3);
  float face = smoothstep(0.9, 0.99, N.z);
  N = normalize(N + (across * (grain - 0.5) * 0.018 + vec3(ripple * 0.45 * face, 0.0)) * brushed);

  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  // Where the normal turns fast across a pixel, the reflection blurs to match, so the edges don't sparkle.
  float aa = clamp(length(fwidth(N)) * 0.8, 0.0, 0.45);
  // As cast, the gold is a little more polished in some places than others: soft patches in what it mirrors.
  float poured = valueNoise(vec3(P.xy * 0.006, seed + 2.0)) * 0.6 + valueNoise(vec3(P.xy * 0.017, seed + 9.0)) * 0.4;
  float rough = max(mix(0.032 * (0.7 + 0.6 * grain) * (0.75 + 0.6 * poured), 0.03, polish), aa);
  // The gold whitens toward grazing, less so where it's brushed, so the tops stay gold.
  vec3 F = GOLD + (1.0 - GOLD) * pow(1.0 - NdotV, 5.0) * mix(0.3, 1.0, polish);
  // Brushed, a highlight is drawn out across the grooves: four looks spread that way.
  float stretch = 0.016 * brushed;
  vec3 env = vec3(0.0);
  for (int k = 0; k < 4; k++) env += studio(normalize(R + across * stretch * (float(k) - 1.5) / 1.5), rough, pillar);
  vec3 color = F * env * 0.25;
  // The grooves themselves: each catches the light a little more or less than the next.
  color *= (1.0 + (grain - 0.5) * 0.13 * brushed) * (1.0 + (poured - 0.5) * 0.1 * brushed);

  // The floor shades the foot of each monolith.
  color *= mix(0.6, 1.0, smoothstep(0.0, uScale * 0.022, height));
  // The ones not pointed at step back.
  float focus = uFocus[pillar];
  color *= 1.0 - (uFocus.w - focus) * mix(0.5, 0.68, uFocus.y);

  // The strip passing across catches each edge as it crosses it.
  if (uSweep > -5.0) {
    vec3 w = onLight(normalize(vec3(P.xy, uFocal)), normalize(vec3(uSweep, -0.26, 1.0)), normalize(vec3(0.32, 1.0, 0.0)));
    color += vec3(1.0, 0.92, 0.75) * 3.0 * polish * exp(-w.x * w.x / 0.0012);
  }

  // As the lights come up the faces rise out of the dark, and the light climbs each edge from its feet: a spark with
  // a short trail behind it. Once it has passed, the edge keeps its light.
  float climbed = 1.0 - smoothstep(uTrace - 0.012, uTrace + 0.012, vInfo.z);
  float running = 1.0 - smoothstep(0.96, 1.0, uTrace);
  float head = exp(-pow((vInfo.z - uTrace) / 0.016, 2.0)) * running;
  float trail = exp(-max(uTrace - vInfo.z, 0.0) / 0.07) * climbed * running;
  color *= mix(uRise * uRise, 1.0, polish * climbed);
  color += vec3(1.0, 0.9, 0.72) * polish * (4.0 * head + 0.9 * trail);

  outColor = vec4(finish(color), 1.0);
  // In the reflection, the glass shows less of it the further it lies below the floor. It's drawn premultiplied, to
  // be laid over the glass.
  if (uMirror > 0.5) {
    float seen = 0.42 * exp(-height / (uScale * 0.06));
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

/** Fades whatever is drawn round the monoliths out before the canvas's edges, so it never shows where it ends. */
const EDGES = `
uniform vec2 uViewport;
float edges() {
  vec2 e = gl_FragCoord.xy / uViewport;
  return smoothstep(0.0, 0.1, e.x) * smoothstep(0.0, 0.1, 1.0 - e.x) * smoothstep(0.0, 0.14, e.y) * smoothstep(0.0, 0.1, 1.0 - e.y);
}
`;

/** The black glass the monoliths stand on. Only its light and shadow are drawn, over whatever the page shows beneath:
    the warm light low behind them where it slips through the gaps, with their shadows thrown toward the camera; the
    gold's own glow on the glass before each face; and the dark at their feet. */
const FLOOR_FRAGMENT = `${HEADER}
in vec3 vWorld;
uniform vec4 uStage;
uniform vec3 uBack;
uniform vec2 uSlab;
uniform vec4 uFaces[3];
out vec4 outColor;
${ROOM}
${EDGES}
// How far inside a banner's outline a point of the artwork's plane is, in artwork units (negative outside).
float inside(vec2 p) {
  float ax = (p.x - uStage.x) / uStage.z * 1200.0;
  float ay = (uStage.y - p.y) / uStage.w * 820.0;
  float top = -720.0 + sqrt(max(1e6 - (ax - 600.0) * (ax - 600.0), 0.0));
  float across = max(max(min(ax - 120.0, 360.0 - ax), min(ax - 460.0, 740.0 - ax)), min(ax - 840.0, 1080.0 - ax));
  return min(across, ay - top);
}
void main() {
  vec3 P = vWorld;
  // Is the way to the light behind blocked by a monolith? Tested where it crosses the slabs' front and back, the
  // shadow softening the further the monolith is from here.
  vec3 toLight = uBack - P;
  float lit = 1.0;
  for (int k = 0; k < 2; k++) {
    float t = ((k == 0 ? uSlab.x : uSlab.y) - P.z) / toLight.z;
    if (t > 0.0 && t < 1.0) {
      float pen = 3.0 + t * 70.0;
      lit = min(lit, 1.0 - smoothstep(-pen, pen, inside((P + toLight * t).xy)));
    }
  }
  vec2 reach = (P.xz - uBack.xz) / (uScale * vec2(0.42, 0.3));
  vec3 light = vec3(1.0, 0.7, 0.4) * 0.16 * exp(-dot(reach, reach)) * lit * uRise * (1.0 - uFocus.w);
  // The gold's glow on the glass before each face, and the dark at every foot.
  float shade = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 f = uFaces[i];
    float lateral = max(max(f.x - P.x, P.x - f.y), 0.0);
    float ahead = max(P.z, 0.0);
    float lift = (1.0 - (uFocus.w - uFocus[i]) * 0.6) * uRise;
    light += vec3(1.0, 0.62, 0.22) * 0.07 * exp(-ahead / (uScale * 0.035)) * exp(-lateral / (uScale * 0.012)) * lift;
    vec2 off = max(vec2(f.x - P.x, uSlab.y - P.z), vec2(P.x - f.y, P.z - uSlab.x));
    float d = length(max(off, 0.0));
    shade = max(shade, 0.75 * exp(-d / (uScale * 0.006)) + 0.3 * exp(-d / (uScale * 0.03)));
  }
  float fade = edges();
  outColor = vec4(finish(light) * fade, clamp(shade, 0.0, 1.0) * fade * uRise);
}`;

/** The warm glow low behind the monoliths, drifting a little; it gives way when a body's scene comes up. Added
    over the page, so it's pure light. */
const HALO_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform vec2 uSize;
uniform vec4 uFrame;
uniform vec4 uFocus;
uniform float uRise;
uniform float uTime;
out vec4 outColor;
${EDGES}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec2 c = vec2(uFrame.x + uFrame.z * 0.5, uFrame.y + uFrame.w * (600.0 / 820.0));
  vec2 q = (p - c) / vec2(uFrame.z * (0.42 + 0.015 * sin(uTime * 0.3)), uFrame.w * 0.3);
  float glow = exp(-dot(q, q) * 1.6);
  outColor = vec4(vec3(1.0, 0.64, 0.28) * 0.06 * glow * uRise * (1.0 - 0.85 * uFocus.w) * edges(), 0.0);
}`;

/** Lays the reflection (drawn on its own, at half size) over the glass. The glass is polished but not perfect, so the
    reflection blurs the further it lies below the feet. */
const REFLECT_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uTexel;
uniform float uFeet;
out vec4 outColor;
void main() {
  float r = max(uFeet - vUv.y, 0.0) / uTexel.y * 0.07;
  vec4 sum = texture(uImage, vUv);
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 2.39996, d = sqrt((float(i) + 0.5) / 12.0);
    sum += texture(uImage, vUv + vec2(cos(a), sin(a)) * d * r * uTexel);
  }
  outColor = sum / 13.0;
}`;

/** Adds the bloom over the picture, rolled off so it never clips. Pure light: the canvas's alpha is left alone. */
const LIGHT_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uNear;
uniform sampler2D uFar;
uniform float uScale;
out vec4 outColor;
void main() {
  vec3 glow = (texture(uNear, vUv).rgb * 0.7 + texture(uFar, vUv).rgb * 0.6) / uScale;
  outColor = vec4(1.0 - exp(-glow), 0.0);
}`;

/* ——— The scene ——— */

type Mesh = { vao: WebGLVertexArrayObject; buffers: WebGLBuffer[]; count: number };

/** Starts the monoliths on a canvas, or returns null where WebGL2 isn't available. */
export function createGoldMonoliths(canvas: HTMLCanvasElement): GoldMonoliths | null {
  const context = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false, powerPreference: "high-performance" });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  // Half floats keep the glow's light past white; where they can't be drawn to, it's packed into bytes.
  const float = !!gl.getExtension("EXT_color_buffer_float");
  const bloomScale = float ? 1 : 0.25;

  let programs: Record<"slab" | "floor" | "halo" | "reflect" | "blur" | "light", Program>;
  try {
    programs = {
      slab: link(gl, SLAB_VERTEX, SLAB_FRAGMENT),
      floor: link(gl, FLOOR_VERTEX, FLOOR_FRAGMENT),
      halo: link(gl, SCREEN_VERTEX, HALO_FRAGMENT),
      reflect: link(gl, SCREEN_VERTEX, REFLECT_FRAGMENT),
      blur: link(gl, SCREEN_VERTEX, BLUR_FRAGMENT),
      light: link(gl, SCREEN_VERTEX, LIGHT_FRAGMENT),
    };
  } catch (error) {
    console.error(error);
    return null;
  }

  const screen = gl.createVertexArray()!;
  let layout: MonolithLayout | null = null;
  let shape: ReturnType<typeof build> | null = null;
  let slabs: Mesh | null = null;
  let floor: Mesh | null = null;
  let targets: Record<"scene" | "mirror" | "near" | "nearSwap" | "far" | "farSwap", Target> | null = null;
  let projection: Mat4 = new Float32Array(16);
  let view: Mat4 = new Float32Array(16);

  const attribute = (location: number, data: number[], size: number) => {
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    return buffer;
  };
  const free = (mesh: Mesh | null) => {
    if (!mesh) return;
    gl.deleteVertexArray(mesh.vao);
    for (const buffer of mesh.buffers) gl.deleteBuffer(buffer);
  };
  const release = () => {
    free(slabs);
    free(floor);
    if (targets) for (const t of Object.values(targets)) untarget(gl, t);
    slabs = floor = targets = null;
  };

  function resize(next: MonolithLayout, ratio: number) {
    layout = next;
    canvas.width = Math.max(1, Math.round(next.width * ratio));
    canvas.height = Math.max(1, Math.round(next.height * ratio));
    release();
    shape = build(next);
    const { mesh, eye, focal } = shape;

    let vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffers = [attribute(0, mesh.positions, 3), attribute(1, mesh.normals, 3), attribute(2, mesh.info, 3)];
    const index = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mesh.indices), gl.STATIC_DRAW);
    slabs = { vao, buffers: [...buffers, index], count: mesh.indices.length };

    // The glass: one wide quad at the monoliths' feet, from well behind them to well in front.
    const reach = shape.width * 1.8, far = -shape.width * 3, near = focal * 0.7, y = shape.floor;
    vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const quad = attribute(0, [-reach, y, far, reach, y, far, -reach, y, near, reach, y, far, reach, y, near, -reach, y, near], 3);
    floor = { vao, buffers: [quad], count: 6 };
    gl.bindVertexArray(null);

    projection = lens(focal, eye[0], eye[1], next.width, next.height, 10, 40000);
    view = translation(0, 0, -focal);

    const [w, h] = [Math.max(1, Math.ceil(canvas.width / 2)), Math.max(1, Math.ceil(canvas.height / 2))];
    const [fw, fh] = [Math.max(1, Math.ceil(canvas.width / 8)), Math.max(1, Math.ceil(canvas.height / 8))];
    targets = {
      scene: target(gl, w, h, float, true),
      mirror: target(gl, w, h, false, true),
      near: target(gl, w, h, float),
      nearSwap: target(gl, w, h, float),
      far: target(gl, fw, fh, float),
      farSwap: target(gl, fw, fh, float),
    };
  }

  /** Sets what every pass shares: the camera, the lights and the pose. */
  function room(program: Program, pose: MonolithPose, bloom: boolean) {
    if (!shape) return;
    const u = program.uniforms;
    const [f0, f1, f2] = pose.focus;
    const most = Math.max(f0, f1, f2);
    // The rims take the colour of the scene behind: the Council's warm spots, the Commission's cold light from above,
    // the organisations' red moon.
    const sum = f0 + f1 + f2 || 1;
    const tint = [0, 1, 2].map((c) => (f0 * [1, 0.76, 0.48][c] + f1 * [0.7, 0.82, 1][c] + f2 * [1, 0.3, 0.26][c]) / sum);
    u.uProjection?.(projection);
    u.uView?.(view);
    u.uCamera?.([0, 0, shape.focal]);
    u.uFloor?.(shape.floor);
    u.uScale?.(shape.width);
    u.uLean?.(pose.lean);
    u.uSweep?.(pose.sweep ?? -10);
    u.uFocus?.([f0, f1, f2, most]);
    u.uTint?.(tint);
    u.uAim?.(shape.faces.flatMap((face) => face.slice(2)));
    u.uRise?.(pose.rise);
    u.uBloom?.(bloom ? 1 : 0);
    u.uBloomScale?.(bloomScale);
    u.uViewport?.([canvas.width, canvas.height]);
  }

  function drawSlabs(pose: MonolithPose, mirror: boolean, bloom: boolean) {
    if (!slabs || !shape) return;
    const { uniforms: u, program } = programs.slab;
    gl.useProgram(program);
    room(programs.slab, pose, bloom);
    u.uMirror?.(mirror ? 1 : 0);
    u.uTrace?.(pose.trace);
    u.uFocal?.(shape.focal);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(slabs.vao);
    gl.drawElements(gl.TRIANGLES, slabs.count, gl.UNSIGNED_INT, 0);
  }

  function drawFloor(pose: MonolithPose) {
    if (!floor || !shape || !layout) return;
    const { uniforms: u, program } = programs.floor;
    gl.useProgram(program);
    room(programs.floor, pose, false);
    const [left, top, width, height] = layout.stage;
    u.uStage?.([left - shape.eye[0], shape.eye[1] - top, width, height]);
    // The light behind sits low, back from the middle monolith.
    u.uBack?.([0, shape.floor + height * 0.3, shape.back - width * 0.32]);
    u.uSlab?.([shape.bevel, shape.back]);
    u.uFaces?.(shape.faces.flatMap((face) => [face[0], face[1], 0, 0]));
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(floor.vao);
    gl.drawArrays(gl.TRIANGLES, 0, floor.count);
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

  function render(pose: MonolithPose) {
    if (!layout || !targets || !shape) return;
    const t = targets;
    gl.disable(gl.CULL_FACE);

    // The glow: the monoliths and their reflection at half size keeping only what's past white, blurred near and far.
    into(t.scene);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawSlabs(pose, true, true);
    drawSlabs(pose, false, true);
    gl.disable(gl.DEPTH_TEST);
    blur(t.scene, t.nearSwap, 1, 0);
    blur(t.nearSwap, t.near, 0, 1);
    blur(t.near, t.farSwap, 2, 0);
    blur(t.farSwap, t.far, 0, 2);
    for (let i = 0; i < 2; i++) {
      blur(t.far, t.farSwap, 1.5, 0);
      blur(t.farSwap, t.far, 0, 1.5);
    }

    // The reflection on its own, so it can be laid over the glass whole and blurred.
    into(t.mirror);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawSlabs(pose, true, false);

    // The picture: the glow behind, the glass, the reflection, the monoliths.
    into(null);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
    const halo = programs.halo;
    gl.useProgram(halo.program);
    room(halo, pose, false);
    halo.uniforms.uSize?.([layout.width, layout.height]);
    halo.uniforms.uFrame?.(layout.stage);
    halo.uniforms.uTime?.(pose.time);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    drawFloor(pose);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const reflect = programs.reflect;
    gl.useProgram(reflect.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.mirror.texture);
    reflect.uniforms.uImage?.(0);
    reflect.uniforms.uTexel?.([1 / t.mirror.width, 1 / t.mirror.height]);
    reflect.uniforms.uFeet?.(1 - (shape.eye[1] - shape.floor) / layout.height);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
    drawSlabs(pose, false, false);

    // The bloom on top.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
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
    gl.disable(gl.BLEND);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  function dispose() {
    release();
    for (const { program } of Object.values(programs)) gl.deleteProgram(program);
    gl.deleteVertexArray(screen);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  return { resize, render, dispose };
}

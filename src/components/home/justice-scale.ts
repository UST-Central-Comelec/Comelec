/* The justice scale on the Central Comelec's Student Government landing (comelec-backdrop.tsx places and
   animates it): a colossal balance of black stone, obsidian and gold, seen from the floor so it towers over the
   three banners. A blinding light high above and behind it is eclipsed by the beam: the light pours down past
   the arms in shafts, through the chains and over the pans, while the heading underneath stays in the beam's
   shadow. The plinth stands in fog lit warm from below, embers rise through it, and the obsidian floor mirrors
   the base and takes the long shadows thrown toward the viewer.
   Drawn with WebGL2. The parts are turned on a lathe (the column, beam and plinth cut into flat facets); the
   surfaces reflect the room's lights; the shafts are the light's glow blurred outward from the light past the
   scale's silhouette; the brightest glints bloom. The camera is solved from the page's layout (CSS pixels), so
   the floor meets the banners' feet and the beam crosses where the layout leaves room for it. The plumbing is
   shared with the Central Student Council's scene (scene-gl.ts). */

import {
  BLUR_FRAGMENT, HEADER, MESH_VERTEX, MIRROR, NOISE, SCREEN_VERTEX, aroundX, aroundY, cross, identity, lathe, lens, link, mirrored,
  multiply, normalMatrix, normalize, ring, target, trace, transform, translation, turnX, turnY, turnZ, unload, untarget, upload,
  type Buffers, type Mark, type Mat4, type Program, type Target, type Vec, Mesh,
} from "./scene-gl";

export type ScaleLayout = {
  /** The canvas's size. */
  width: number;
  height: number;
  /** Where the column stands, from the canvas's left edge. */
  centerX: number;
  /** The floor line the banners stand on. */
  floorY: number;
  /** The beam's line, in the band between the navbar and the heading. */
  beamY: number;
  /** The heading and lede, as left, top, right, bottom: the light is kept off them. */
  textBox: [number, number, number, number];
  /** The foot of the lede. The column's ornaments go below it. */
  ledeY: number;
  /** The Comelec banner's top, which hides the column below it. */
  bannerY: number;
  /** How far each pan's centre is from the column, its rim's height, and its radius, all on screen. */
  panX: number;
  panY: number;
  panRadius: number;
  /** Half widths on screen, at the floor: the plinth's and the column's. */
  baseRadius: number;
  shaftRadius: number;
};

export type ScalePose = {
  /** Seconds since the scene started; drives the fog, the shafts and the embers. */
  time: number;
  /** The beam's tilt and each pan's swing from plumb, in radians (positive turns anticlockwise). */
  beam: number;
  left: number;
  right: number;
  /** A slight turn of the whole scale about its column, in radians. */
  turn: number;
  /** The camera's crane as the scene comes up, 0–1: it starts a little low and back, and rises to rest. */
  rise: number;
  /** How far each light has come up: the warm glow from the fog below, the light above, and its shafts. */
  glow: number;
  light: number;
  shafts: number;
};

/** What the swinging needs, in the scene's own units: the beam's half length and the pans' pendulum length. */
export type ScaleRig = { arm: number; reach: number };

export type JusticeScale = {
  resize(layout: ScaleLayout, dpr: number): ScaleRig;
  render(pose: ScalePose): void;
  dispose(): void;
};

/* ——— Geometry ——— */

/** Surfaces: polished obsidian, polished gold, dark bronze for the chains, and honed black basalt for the plinth. */
const OBSIDIAN = 0, GOLD = 1, BRONZE = 2, BASALT = 3;

/** A chain between two points: heavy links, each turned a quarter to the one before, so they hook through. */
function chain(mesh: Mesh, from: Vec, to: Vec, link: number) {
  const span = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length = Math.hypot(span[0], span[1], span[2]);
  const along = normalize(span);
  const first = normalize(cross(along, [0, 0, 1]));
  const second = cross(along, first);
  const count = Math.max(2, Math.round(length / (link * 2)));
  const step = length / count;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) * step;
    ring(mesh, [from[0] + along[0] * t, from[1] + along[1] * t, from[2] + along[2] * t], along, i % 2 ? second : first, link * 0.95, link * 0.5, link * 0.19, BRONZE, 16, 6);
  }
}

/* ——— The camera ——— */

/** The camera stands `DISTANCE` in front of the scale with its eye `EYE` above the floor, tilted up at it. Those
    two fix the scene's units; everything else is measured off the screen. */
const DISTANCE = 1000;
const EYE = 50;

/** Solves the camera for a layout: its tilt puts the floor under the scale on the banners' feet, and its lens is
    about as long as the canvas is tall, wide enough that the uprights lean in as they rise. */
function solveCamera(layout: ScaleLayout) {
  const focal = layout.height * 0.95;
  const cx = layout.centerX, cy = layout.height * 0.5;
  const pitch = Math.atan((layout.floorY - cy) / focal) - Math.atan(EYE / DISTANCE);
  /** The height of a point on the column's plane that lands on screen row y. */
  const heightAt = (y: number) => EYE + DISTANCE * Math.tan(Math.min(pitch + Math.atan((cy - y) / focal), 1.4));
  /** How far a point at a height on that plane is from the camera, along its line of sight. */
  const depthAt = (height: number) => (height - EYE) * Math.sin(pitch) + DISTANCE * Math.cos(pitch);
  /** A length across the screen at a height, in the scene's units. */
  const across = (px: number, height: number) => (px * depthAt(height)) / focal;
  return { focal, cx, cy, pitch, heightAt, depthAt, across };
}

/** The scale's parts for a layout: the plinth and column (standing on the floor, the axis at x = 0), the beam (level,
    about its pivot) and a pan (at rest, about the foot of its hook), with the measures the scene needs. */
function buildScale(layout: ScaleLayout) {
  const camera = solveCamera(layout);
  const pivot = camera.heightAt(layout.beamY);
  const rim = camera.heightAt(layout.panY);
  const arm = camera.across(layout.panX, rim);
  const panRadius = camera.across(layout.panRadius, rim);
  const base = camera.across(layout.baseRadius, 0);
  const foot = camera.across(layout.shaftRadius, 0);
  const crown = foot * 0.6;
  const thick = camera.across(Math.max(13, layout.height * 0.028), pivot);
  const hidden = camera.heightAt(layout.bannerY);
  const lede = camera.heightAt(layout.ledeY);
  const textTop = camera.heightAt(layout.textBox[1]);

  /* The plinth: three octagonal steps of black basalt, each edged in gold. */
  const plinth = new Mesh();
  const band = pivot * 0.007;
  const s1 = pivot * 0.05, s2 = s1 + pivot * 0.044, s3 = s2 + pivot * 0.038;
  lathe(plinth, trace([
    [0, 0, BASALT], [base, 0, BASALT, true], [base, s1 - band, BASALT, true], [base, s1, GOLD, true],
    [base * 0.8, s1, BASALT, true], [base * 0.8, s2 - band, BASALT, true], [base * 0.8, s2, GOLD, true],
    [base * 0.62, s2, BASALT, true], [base * 0.62, s3 - band, BASALT, true], [base * 0.62, s3, GOLD, true], [0, s3, BASALT],
  ]), 8, aroundY, true);

  /* The column: an obsidian obelisk narrowing as it rises, a gold collar in the gap above the banner, and a capital
     stepping out in three tiers to hold the beam, crowned with a gold point. */
  const column = new Mesh();
  const capital = pivot - pivot * 0.085;
  const width = (y: number) => foot + (crown - foot) * Math.min(1, Math.max(0, (y - s3) / (capital - s3)));
  const collar = Math.min(hidden + (lede - hidden) * 0.45, capital - pivot * 0.12);
  const ring1 = pivot * 0.022;
  lathe(column, trace([
    [0, s3, GOLD], [foot * 1.38, s3, GOLD, true], [foot * 1.38, s3 + band * 2.2, GOLD, true], [foot * 1.1, s3 + band * 3.6, GOLD, true],
    [foot, s3 + band * 4, OBSIDIAN, true],
    [width(collar), collar, OBSIDIAN, true],
    [width(collar) * 1.22, collar + ring1 * 0.25, GOLD, true], [width(collar) * 1.22, collar + ring1 * 0.75, GOLD, true],
    [width(collar + ring1), collar + ring1, GOLD, true],
    [crown, capital, OBSIDIAN, true],
    [crown * 1.5, capital, OBSIDIAN, true], [crown * 1.5, capital + pivot * 0.022, OBSIDIAN, true], [crown * 1.5, capital + pivot * 0.028, GOLD, true],
    [crown * 1.85, capital + pivot * 0.028, OBSIDIAN, true], [crown * 1.85, capital + pivot * 0.055, OBSIDIAN, true], [crown * 1.85, capital + pivot * 0.061, GOLD, true],
    [crown * 2.15, capital + pivot * 0.061, OBSIDIAN, true], [crown * 2.15, pivot + pivot * 0.05, OBSIDIAN, true], [crown * 2.15, pivot + pivot * 0.057, GOLD, true],
    [crown * 1.25, pivot + pivot * 0.075, OBSIDIAN, true], [crown * 0.5, pivot + pivot * 0.16, OBSIDIAN, true], [0, pivot + pivot * 0.2, GOLD],
  ]), 8, aroundY, true);

  /* The beam: an octagonal bar thickening into the capital, with heavy gold-banded blocks at its ends and the
     rings the pans hang from. */
  const beam = new Mesh();
  const end = arm + thick * 0.7;
  lathe(beam, trace(mirrored([
    [0, -end, OBSIDIAN], [thick * 1.2, -end, OBSIDIAN, true], [thick * 1.42, -end + thick * 0.18, GOLD, true], [thick * 1.42, -end + thick * 0.34, GOLD, true],
    [thick * 1.42, -end + thick * 1.06, OBSIDIAN, true], [thick * 1.42, -end + thick * 1.22, GOLD, true], [thick * 1.2, -end + thick * 1.4, GOLD, true],
    [thick * 0.64, -end + thick * 1.56, OBSIDIAN, true], [thick * 0.8, -arm * 0.5, OBSIDIAN], [thick, -crown * 2, OBSIDIAN], [thick, 0, OBSIDIAN],
  ])), 8, aroundX, true);
  const loop = thick * 0.62;
  for (const side of [-1, 1]) ring(beam, [side * arm, -thick * 1.42 - loop * 0.8, 0], [0, 1, 0], [1, 0, 0], 0, loop, loop * 0.3, GOLD, 22, 9);
  const hang = thick * 1.42 + loop * 1.8 + loop * 0.3;

  /* A pan: a deep obsidian bowl with a heavy gold lip and a gold point beneath, on three chains that meet in a
     ring under the hook. */
  const drop = Math.max(pivot - hang - rim, panRadius * 0.6);
  const depth = panRadius * 0.42;
  const lip = panRadius * 0.045;
  const skin = depth * 0.12;
  // The bowl is a cap of a sphere: its lip's foot at the rim, its bottom `depth` below.
  const cap = Math.max(depth - 2 * lip, depth * 0.3), wide = panRadius - lip;
  const sphere = (wide * wide + cap * cap) / (2 * cap);
  const outer = (r: number) => -drop - depth + (sphere - Math.sqrt(Math.max(0, sphere * sphere - r * r)));
  const pan = new Mesh();
  const spike = panRadius * 0.3, root = panRadius * 0.11;
  const bowl: Mark[] = [[0, -drop - depth - spike, GOLD], [root * 0.55, -drop - depth - spike * 0.35, GOLD], [root, outer(root), GOLD, true]];
  for (let i = 1; i <= 30; i++) {
    const r = root + ((wide - root) * i) / 30;
    bowl.push([r, outer(r), OBSIDIAN]);
  }
  bowl[bowl.length - 1][3] = true;
  for (let i = 1; i <= 14; i++) {
    const a = -Math.PI / 2 + (i / 14) * Math.PI * 1.5;
    bowl.push([wide + lip * Math.cos(a), outer(wide) + lip + lip * Math.sin(a), GOLD]);
  }
  bowl[bowl.length - 1][3] = true;
  for (let i = 0; i <= 30; i++) {
    const r = (wide - lip) * (1 - i / 30);
    bowl.push([r, outer(r) + skin, OBSIDIAN]);
  }
  lathe(pan, trace(bowl), 120, aroundY);
  const top = outer(wide) + lip * 2;
  const crownRing = loop * 0.9;
  ring(pan, [0, -crownRing, 0], [0, 1, 0], [0, 0, 1], 0, crownRing, crownRing * 0.3, GOLD, 22, 9);
  const link = camera.across(Math.max(7, layout.height * 0.012), (pivot + rim) / 2);
  for (const angle of [Math.PI, 0, -Math.PI / 2]) chain(pan, [0, -crownRing * 1.9, 0], [wide * Math.cos(angle), top - lip * 0.5, wide * Math.sin(angle)], link);

  return {
    camera, plinth, column, beam, pan, pivot, arm, hang, rim, panRadius, base, foot, lede, textTop,
    reach: drop + depth * 0.45,
  };
}

/* ——— Shaders ——— */

/** The room: what every surface reflects, and how a colour leaves the shader. */
const STUDIO = `
uniform vec3 uCamera;
uniform vec3 uLight;
uniform vec3 uLevels;
uniform vec4 uZones;
uniform float uBloom;
uniform float uBloomScale;

// A rectangular light, seen from the middle of the room. size is its half width and height, as tangents of the
// angles they span; soft is how blurred its edges look (rougher surfaces blur them more).
float softbox(vec3 d, vec3 center, vec3 up, vec2 size, float soft) {
  float facing = dot(d, center);
  if (facing <= 0.0) return 0.0;
  vec3 x = normalize(cross(up, center));
  vec3 y = cross(center, x);
  vec2 p = abs(vec2(dot(d, x), dot(d, y)) / facing);
  vec2 e = 1.0 - smoothstep(size - soft, size + soft, p);
  return e.x * e.y;
}

// What a ray leaving the point P in direction d meets: the cold light high above and behind, cold rims from
// behind, and the warm glow coming up off the fog, strongest near the floor. The rims are kept low on the column
// where it stands behind the heading (uZones.x to uZones.y), so the light doesn't draw lines through the words.
vec3 studio(vec3 d, float rough, vec3 P, float fill) {
  float soft = 0.015 + rough * 1.5;
  float spread = 1.0 / (1.0 + rough * 5.0);
  vec3 cold = vec3(0.76, 0.85, 1.0);
  vec3 warm = vec3(1.0, 0.56, 0.2);
  vec3 c = vec3(0.0012, 0.0017, 0.004) * (0.5 + 0.5 * d.y);
  // The column and capital behind the heading stay a silhouette: the light only finds them at their edges.
  float behindText = smoothstep(uZones.x - 40.0, uZones.x + 40.0, P.y) * (1.0 - smoothstep(uZones.y - 40.0, uZones.y + 40.0, P.y))
    * (1.0 - smoothstep(uZones.w * 2.4, uZones.w * 3.2, length(P.xz)));
  float quiet = 1.0 - 0.88 * behindText;
  vec3 above = normalize(vec3(0.0, 1.0, -0.62));
  c += cold * (12.0 * softbox(d, above, vec3(0.0, 0.0, -1.0), vec2(0.34, 0.16), soft) + 0.7 * softbox(d, above, vec3(0.0, 0.0, -1.0), vec2(1.2, 0.6), 0.4 + soft)) * uLevels.y * spread * quiet;
  float rims = softbox(d, normalize(vec3(-0.95, 0.12, -0.3)), vec3(0.0, 1.0, 0.0), vec2(0.05, 1.8), soft)
    + softbox(d, normalize(vec3(0.95, 0.12, -0.3)), vec3(0.0, 1.0, 0.0), vec2(0.05, 1.8), soft);
  c += cold * 3.4 * uLevels.y * spread * rims * quiet;
  // A long strip straight overhead: it draws a hard line along every edge that faces up, like the beam's top.
  c += cold * 4.0 * uLevels.y * spread * quiet * softbox(d, normalize(vec3(0.0, 1.0, 0.06)), vec3(0.0, 0.0, -1.0), vec2(2.4, 0.07), soft);
  float low = 0.05 + 0.95 * exp(-max(P.y, 0.0) / uZones.z);
  c += warm * 3.4 * uLevels.x * low * spread * softbox(d, normalize(vec3(0.0, -1.0, 0.32)), vec3(0.0, 0.0, 1.0), vec2(1.8, 1.1), soft + 0.15);
  // A faint cold fill from the front so the faces aren't dead black, and a warm card that mostly the gold shows.
  c += vec3(0.02, 0.028, 0.042) * softbox(d, normalize(vec3(0.0, 0.15, 1.0)), vec3(0.0, 1.0, 0.0), vec2(1.1, 0.8), 0.5);
  c += vec3(1.0, 0.8, 0.55) * 0.5 * fill * max(uLevels.x, uLevels.y) * softbox(d, normalize(vec3(-0.15, 0.05, 1.0)), vec3(0.0, 1.0, 0.0), vec2(0.8, 0.5), 0.35 + soft);
  return c;
}

vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

float dither(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }

// The glow pass keeps only light past white; the picture is tone mapped and dithered against banding.
vec4 finish(vec3 hdr, float alpha) {
  if (uBloom > 0.5) return vec4(max(hdr - 0.8, 0.0) * uBloomScale, alpha);
  vec3 c = pow(aces(hdr), vec3(1.0 / 2.2));
  return vec4(c + dither(gl_FragCoord.xy) / 255.0, alpha);
}
`;

const MESH_FRAGMENT = `${HEADER}
in vec3 vWorld;
in vec3 vNormal;
in float vMaterial;
uniform float uMirror;
uniform float uFade;
uniform float uOcclude;
out vec4 outColor;
${STUDIO}
${NOISE}
void main() {
  // For the shafts, the scale is only a silhouette against the light.
  if (uOcclude > 0.5) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  vec3 P = vWorld;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamera - P);
  // The reflection is lit as the scale itself is: turn it back upright before lighting it.
  if (uMirror > 0.5) { P.y = -P.y; N.y = -N.y; V.y = -V.y; }
  float NdotV = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  // Where the normal turns fast across a pixel, blur the reflection to match, so edges don't sparkle.
  float aa = clamp(length(fwidth(N)) * 0.8, 0.0, 0.45);
  float edge = pow(1.0 - NdotV, 5.0);
  vec3 color;
  if (vMaterial < 0.5) {
    float F = 0.04 + 0.96 * edge;
    color = F * (studio(R, max(0.035, aa), P, 0.0) + 0.18 * studio(R, max(0.3, aa), P, 0.0));
  } else if (vMaterial < 1.5) {
    vec3 F0 = vec3(1.0, 0.76, 0.36);
    color = (F0 + (1.0 - F0) * edge) * studio(R, max(0.17, aa), P, 1.0);
  } else if (vMaterial < 2.5) {
    vec3 F0 = vec3(0.4, 0.29, 0.17);
    color = (F0 + (1.0 - F0) * edge) * studio(R, max(0.28, aa), P, 0.12);
  } else {
    // Honed basalt: a dull sheen over a grain that shows where the warm light from the fog reaches it.
    float grain = fbm(P * 0.045) * 0.7 + valueNoise(P * 0.4) * 0.3;
    float F = 0.035 + 0.965 * edge;
    color = F * studio(R, max(0.38 + grain * 0.15, aa), P, 0.0) * 0.7;
    vec3 albedo = vec3(0.034, 0.031, 0.028) * (0.55 + 0.9 * grain);
    float low = exp(-max(P.y, 0.0) / uZones.z);
    color += albedo * (vec3(1.0, 0.56, 0.2) * 2.4 * uLevels.x * low * (0.4 + 0.6 * max(N.z, 0.0)) + vec3(0.76, 0.85, 1.0) * 0.8 * uLevels.y * max(N.y, 0.0));
  }
  // A glint where the light above catches an edge.
  vec3 L = normalize(uLight - P);
  float shine = vMaterial < 0.5 ? 900.0 : 220.0;
  float glint = pow(max(dot(N, normalize(L + V)), 0.0), shine) * shine * 0.01 * max(dot(N, L), 0.0) * uLevels.y;
  color += glint * (vMaterial < 0.5 ? vec3(0.08) : vec3(1.0, 0.85, 0.6));
  outColor = finish(color, 1.0);
  // The reflection fades out (rather than darkening, which would hide the floor) the further it lies below the
  // floor; its y is negative. It's drawn premultiplied.
  if (uMirror > 0.5) {
    float seen = exp(vWorld.y / uFade) * (1.0 - smoothstep(0.0, uFade * 2.5, -vWorld.y)) * 0.8;
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

/** Polished obsidian underfoot: a warm pool round the plinth from the fog, cold light from above further out, and
    the long shadows the column and pans throw toward the camera. Drawn over the scale's reflection. */
const FLOOR_FRAGMENT = `${HEADER}
in vec3 vWorld;
uniform vec4 uRig;
uniform vec2 uBody;
out vec4 outColor;
${STUDIO}
void main() {
  vec3 P = vWorld;
  vec3 V = normalize(uCamera - P);
  vec3 toLight = uLight - P;
  float lit = 1.0;
  // The column, an upright cylinder on the axis: does the way to the light pass close enough to it, low enough?
  vec2 way = normalize(toLight.xz);
  float along = -dot(P.xz, way);
  if (along > 0.0) {
    float miss = length(P.xz + way * along);
    float rise = along / length(toLight.xz) * toLight.y;
    float wide = mix(uBody.x, uBody.y, smoothstep(0.0, uRig.x * 0.14, rise));
    lit *= 1.0 - 0.9 * (1.0 - smoothstep(wide * 0.8, wide * 1.2 + along * 0.05, miss)) * (1.0 - smoothstep(uRig.x * 0.95, uRig.x * 1.1, rise));
  }
  // The pans, discs hung at their rims' height.
  for (int i = 0; i < 2; i++) {
    vec2 at = P.xz + toLight.xz * (uRig.z / max(toLight.y, 1.0));
    float d = length(at - vec2((i == 0 ? -1.0 : 1.0) * uRig.y, 0.0));
    lit *= 1.0 - 0.85 * (1.0 - smoothstep(uRig.w * 0.75, uRig.w * 1.1 + uRig.z * 0.12, d));
  }
  float r = length(P.xz);
  float pool = exp(-pow(r / (uBody.x * 2.4), 2.0));
  float wash = (1.0 - exp(-pow(r / (uBody.x * 1.3), 2.0))) * exp(-pow(r / (uRig.y * 2.4), 2.0));
  vec3 light = vec3(1.0, 0.56, 0.22) * 1.7 * pool * uLevels.x + vec3(0.74, 0.84, 1.0) * 0.6 * wash * lit * uLevels.y;
  vec3 color = vec3(0.03, 0.03, 0.032) * light;
  float F = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
  color += F * studio(reflect(-V, vec3(0.0, 1.0, 0.0)), 0.25, P, 0.0) * 0.22;
  float fade = exp(-pow(length(P.xz * vec2(0.55, 1.0)) / (uRig.y * 2.6), 2.0));
  float mirror = clamp(F * 1.2, 0.0, 0.62);
  outColor = finish(color, fade * (1.0 - mirror));
}`;

/** The dark behind the scale: the light above spilling cold over the top edge, and fog lying on the floor, lit
    warm from below at the middle. */
const BACKDROP_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform vec2 uSize;
uniform vec4 uFrame;
uniform float uTime;
out vec4 outColor;
${STUDIO}
${NOISE}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float dx = (p.x - uFrame.x) / uSize.x;
  vec3 color = mix(vec3(0.0032, 0.0042, 0.0088), vec3(0.0011, 0.0012, 0.002), smoothstep(0.0, 1.0, p.y / uSize.y));
  color += vec3(0.7, 0.8, 1.0) * uLevels.y * (0.04 * exp(-p.y / (uSize.y * 0.2)) * exp(-dx * dx * 3.0) + 0.16 * exp(-p.y / (uSize.y * 0.07)) * exp(-dx * dx * 40.0));
  float band = exp(-pow((p.y - uFrame.z + uSize.y * 0.02) / (uSize.y * 0.085), 2.0));
  float drift = fbm(vec3(p.x * 0.0025 - uTime * 0.02, p.y * 0.006, uTime * 0.03));
  color += mix(vec3(0.5, 0.62, 0.8) * 0.016, vec3(1.0, 0.56, 0.22) * 0.07, exp(-dx * dx * 9.0)) * band * (0.5 + 0.9 * drift) * uLevels.x;
  outColor = finish(color, 1.0);
}`;

/** The light for the shafts: its glow, from above the frame, broken by gaps in the haze up there. The scale is
    drawn over this in black, and the result is blurred outward from the light. */
const SKY_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform vec2 uSource;
uniform vec2 uAspect;
uniform float uTime;
out vec4 outColor;
${NOISE}
void main() {
  vec2 d = (vUv - uSource) * uAspect;
  float r = length(d);
  float glow = exp(-r * 2.2) * 1.5 + exp(-r * 6.0) * 2.0;
  float angle = atan(d.x, -d.y);
  float gaps = 0.55 * valueNoise(vec3(angle * 11.0, uTime * 0.05, 0.0)) + 0.45 * valueNoise(vec3(angle * 29.0, -uTime * 0.04, 4.0));
  outColor = vec4(vec3(glow * (0.12 + 0.88 * smoothstep(0.38, 0.78, gaps))), 1.0);
}`;

/** The shafts: each pixel gathers the light along its way to the light, so the scale's silhouette leaves its
    shadow in them. */
const RAYS_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uSource;
out vec4 outColor;
void main() {
  const int SAMPLES = 72;
  vec2 step = (vUv - uSource) * (0.94 / float(SAMPLES));
  vec2 uv = vUv;
  float weight = 1.0, total = 0.0;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < SAMPLES; i++) {
    uv -= step;
    sum += texture(uImage, uv).rgb * weight;
    total += weight;
    weight *= 0.97;
  }
  outColor = vec4(sum / total, 1.0);
}`;

/** Fog in front of the plinth and the floor, rolling slowly. */
const FOG_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform vec2 uSize;
uniform vec4 uFrame;
uniform float uTime;
out vec4 outColor;
${STUDIO}
${NOISE}
void main() {
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  float above = (uFrame.z - p.y) / (uSize.y * 0.15);
  float thick = (1.0 - smoothstep(0.0, 1.0, above)) * (1.0 - 0.55 * smoothstep(0.0, 0.9, -above));
  float drift = fbm(vec3(p.x * 0.003 - uTime * 0.035, p.y * 0.012 + uTime * 0.01, uTime * 0.04));
  thick *= smoothstep(0.18, 0.85, drift) * 1.45;
  float dx = (p.x - uFrame.x) / uSize.x;
  vec3 tint = mix(vec3(0.5, 0.6, 0.78) * 0.05, vec3(1.0, 0.58, 0.24) * 0.16, exp(-dx * dx * 8.0));
  outColor = vec4(finish(tint, 1.0).rgb, clamp(thick, 0.0, 1.0) * 0.6 * uLevels.x);
}`;

/** Embers rising out of the fog, flickering and cooling as they climb. Near the camera they spread into soft
    discs. */
const EMBER_VERTEX = `${HEADER}
layout(location = 0) in vec4 aSeed;
uniform mat4 uProjection;
uniform mat4 uView;
uniform float uTime;
uniform float uDpr;
uniform float uFocus;
uniform vec3 uVolume;
uniform vec3 uLevels;
out float vGlow;
out float vBlur;
out float vHeat;
void main() {
  float life = 6.0 + aSeed.w * 7.0;
  float age = fract(uTime / life + aSeed.y);
  vec3 p;
  p.x = (aSeed.x - 0.5) * 2.0 * uVolume.x * mix(0.25, 1.0, aSeed.z * aSeed.z) + sin(uTime * 0.9 + aSeed.y * 37.0) * 0.03 * uVolume.y * age;
  p.y = age * uVolume.y * (0.55 + 0.45 * aSeed.w);
  p.z = (fract(aSeed.x * 7.3 + aSeed.w) - 0.5) * 2.0 * uVolume.z + cos(uTime * 0.7 + aSeed.x * 29.0) * 0.02 * uVolume.y * age;
  vec4 view = uView * vec4(p, 1.0);
  gl_Position = uProjection * view;
  float depth = -view.z;
  vBlur = clamp(abs(depth - uFocus) / (uFocus * 0.16), 0.0, 1.0);
  gl_PointSize = (1.3 + aSeed.w * 1.6) * (1.0 + vBlur * 2.5) * (uFocus / depth) * uDpr;
  float flicker = 0.6 + 0.4 * sin(uTime * (6.0 + aSeed.w * 9.0) + aSeed.x * 50.0);
  vHeat = flicker * (1.0 - age);
  vGlow = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.5, 1.0, age)) * flicker * uLevels.x / (1.0 + vBlur * 5.0);
}`;

const EMBER_FRAGMENT = `${HEADER}
in float vGlow;
in float vBlur;
in float vHeat;
uniform float uBloom;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float a = mix(exp(-r * 5.0), smoothstep(1.0, 0.7, r) * (0.5 + 0.5 * r), vBlur);
  vec3 c = mix(vec3(1.0, 0.32, 0.08), vec3(1.0, 0.78, 0.4), vHeat) * vGlow * a;
  outColor = vec4(c * (uBloom > 0.5 ? 0.8 : 1.1), 1.0);
}`;

/** Adds the glow and the shafts over the picture, rolled off so they never clip. The shafts are kept off the
    heading and lede. */
const LIGHT_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uNear;
uniform sampler2D uFar;
uniform sampler2D uRays;
uniform float uScale;
uniform float uShafts;
uniform vec2 uSize;
uniform vec4 uText;
out vec4 outColor;
void main() {
  vec3 glow = (texture(uNear, vUv).rgb * 0.9 + texture(uFar, vUv).rgb * 1.3) / uScale;
  vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec2 beyond = max(max(uText.xy - p, p - uText.zw), 0.0);
  float covered = 1.0 - smoothstep(0.0, 90.0, length(beyond));
  vec3 rays = texture(uRays, vUv).rgb * vec3(0.72, 0.82, 1.0) * uShafts * mix(1.0, 0.22, covered);
  outColor = vec4(1.0 - exp(-(glow * 1.1 + rays * 0.5)), 1.0);
}`;

/** Darkens the corners, multiplied over the picture. */
const VIGNETTE_FRAGMENT = `${HEADER}
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = (vUv - 0.5) * vec2(1.0, 1.2);
  outColor = vec4(vec3(1.0 - 0.6 * smoothstep(0.3, 0.95, length(p))), 1.0);
}`;

const EMBERS = 90;

/** Starts the scene on a canvas, or returns null where WebGL2 isn't available. */
export function createJusticeScale(canvas: HTMLCanvasElement): JusticeScale | null {
  const context = canvas.getContext("webgl2", { alpha: false, antialias: true, depth: true, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  // Half floats keep the glow's light past white; where they can't be drawn to, it's packed into bytes.
  const float = !!gl.getExtension("EXT_color_buffer_float");
  const bloomScale = float ? 1 : 0.25;

  let programs: Record<"mesh" | "floor" | "backdrop" | "sky" | "rays" | "fog" | "embers" | "blur" | "light" | "vignette", Program>;
  try {
    programs = {
      mesh: link(gl, MESH_VERTEX, MESH_FRAGMENT),
      floor: link(gl, FLOOR_VERTEX, FLOOR_FRAGMENT),
      backdrop: link(gl, SCREEN_VERTEX, BACKDROP_FRAGMENT),
      sky: link(gl, SCREEN_VERTEX, SKY_FRAGMENT),
      rays: link(gl, SCREEN_VERTEX, RAYS_FRAGMENT),
      fog: link(gl, SCREEN_VERTEX, FOG_FRAGMENT),
      embers: link(gl, EMBER_VERTEX, EMBER_FRAGMENT),
      blur: link(gl, SCREEN_VERTEX, BLUR_FRAGMENT),
      light: link(gl, SCREEN_VERTEX, LIGHT_FRAGMENT),
      vignette: link(gl, SCREEN_VERTEX, VIGNETTE_FRAGMENT),
    };
  } catch (error) {
    console.error(error);
    return null;
  }

  const screen = gl.createVertexArray()!;

  // The embers' seeds never change: four random numbers each.
  const embers = gl.createVertexArray()!;
  const seeds = gl.createBuffer()!;
  gl.bindVertexArray(embers);
  gl.bindBuffer(gl.ARRAY_BUFFER, seeds);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Array.from({ length: EMBERS * 4 }, Math.random)), gl.STATIC_DRAW);
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

  let layout: ScaleLayout | null = null;
  let shape: ReturnType<typeof buildScale> | null = null;
  let parts: Record<"plinth" | "column" | "beam" | "pan", Buffers> | null = null;
  let targets: Record<"scene" | "near" | "nearSwap" | "far" | "farSwap" | "sky" | "rays", Target> | null = null;
  let dpr = 1;
  let projection = identity();
  // The camera for the frame being drawn: where it stands and its view; where the light lands, as the shafts see
  // it; and the screen rows the beam and the floor fall on now.
  let eye = [0, EYE, DISTANCE];
  let view = identity();
  let source = [0.5, 1.4];
  let lines = [0, 0];

  const release = () => {
    if (parts) for (const part of Object.values(parts)) unload(gl, part);
    if (targets) for (const t of Object.values(targets)) untarget(gl, t);
    parts = null;
    targets = null;
  };

  function resize(next: ScaleLayout, ratio: number): ScaleRig {
    layout = next;
    dpr = ratio;
    canvas.width = Math.max(1, Math.round(next.width * ratio));
    canvas.height = Math.max(1, Math.round(next.height * ratio));
    release();
    shape = buildScale(next);
    parts = { plinth: upload(gl, shape.plinth), column: upload(gl, shape.column), beam: upload(gl, shape.beam), pan: upload(gl, shape.pan) };

    // A lens with its centre where the camera solve put it; the tilt goes in the view.
    const { focal, cx, cy } = shape.camera;
    projection = lens(focal, cx, cy, next.width, next.height, 20, 30000);

    const reach = shape.arm * 8;
    gl.bindBuffer(gl.ARRAY_BUFFER, floorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-reach, 0, -12000, reach, 0, -12000, -reach, 0, DISTANCE - 25, reach, 0, -12000, reach, 0, DISTANCE - 25, -reach, 0, DISTANCE - 25]), gl.STATIC_DRAW);

    const size = (divide: number) => [Math.max(1, Math.ceil(next.width / divide)), Math.max(1, Math.ceil(next.height / divide))] as const;
    const [nw, nh] = size(2), [fw, fh] = size(8), [sw, sh] = size(4);
    targets = {
      scene: target(gl, nw, nh, float, true),
      near: target(gl, nw, nh, float),
      nearSwap: target(gl, nw, nh, float),
      far: target(gl, fw, fh, float),
      farSwap: target(gl, fw, fh, float),
      sky: target(gl, sw, sh, false),
      rays: target(gl, sw, sh, false),
    };
    return { arm: shape.arm, reach: shape.reach };
  }

  const lightAt = () => [0, (shape?.pivot ?? 800) * 2.6, -DISTANCE * 0.6];

  /** Sets the camera for a pose. While the scene comes up it stands a little further back and tilted further up,
      so the scale starts low and rises into place. */
  function aim(pose: ScalePose) {
    if (!shape || !layout) return;
    const settle = 1 - pose.rise;
    eye = [0, EYE, DISTANCE * (1 + settle * 0.07)];
    view = multiply(turnX(-(shape.camera.pitch + settle * 0.04)), translation(-eye[0], -eye[1], -eye[2]));
    const camera = multiply(projection, view);
    const onScreen = (point: number[]) => {
      const [x, y, , w] = transform(camera, point);
      return [x / w, y / w, w];
    };
    const [lx, ly, lw] = onScreen(lightAt());
    source = lw > 0 ? [(lx + 1) / 2, (ly + 1) / 2] : [0.5, 1.4];
    lines = [onScreen([0, shape.pivot, 0])[1], onScreen([0, 0, 0])[1]].map((y) => ((1 - y) / 2) * layout!.height);
  }

  function room(program: Program, pose: ScalePose, bloom: boolean) {
    if (!shape) return;
    const u = program.uniforms;
    u.uCamera?.(eye);
    u.uLight?.(lightAt());
    u.uLevels?.([pose.glow, pose.light, pose.shafts]);
    u.uZones?.([shape.lede, Math.max(shape.textTop, shape.pivot * 1.12), shape.pivot * 0.28, shape.foot]);
    u.uBloom?.(bloom ? 1 : 0);
    u.uBloomScale?.(bloomScale);
    u.uProjection?.(projection);
    u.uView?.(view);
  }

  function screenPass(program: Program, pose: ScalePose, bloom: boolean) {
    if (!layout) return;
    const u = program.uniforms;
    gl.useProgram(program.program);
    room(program, pose, bloom);
    u.uSize?.([layout.width, layout.height]);
    u.uFrame?.([layout.centerX, lines[0], lines[1], layout.panX]);
    u.uTime?.(pose.time);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** The scale's parts in place for a pose, each as [buffers, model]. */
  function placed(pose: ScalePose): Array<[Buffers, Mat4]> {
    if (!parts || !shape) return [];
    const { pivot, hang, arm } = shape;
    const turn = turnY(pose.turn);
    const c = Math.cos(pose.beam), s = Math.sin(pose.beam);
    // Each hook's foot is carried round the pivot by the beam's tilt; its pan swings from there.
    const hangs = (side: -1 | 1, swing: number) =>
      multiply(turn, translation(c * side * arm + s * hang, pivot + s * side * arm - c * hang, 0), turnZ(swing));
    return [
      [parts.plinth, turn],
      [parts.column, turn],
      [parts.beam, multiply(turn, translation(0, pivot, 0), turnZ(pose.beam))],
      [parts.pan, hangs(-1, pose.left)],
      [parts.pan, hangs(1, pose.right)],
    ];
  }

  function drawScale(pose: ScalePose, mode: "picture" | "mirror" | "glow" | "silhouette") {
    if (!shape) return;
    const { uniforms: u, program } = programs.mesh;
    gl.useProgram(program);
    room(programs.mesh, pose, mode === "glow");
    u.uMirror?.(mode === "mirror" ? 1 : 0);
    u.uOcclude?.(mode === "silhouette" ? 1 : 0);
    u.uFade?.(shape.pivot * 0.05);
    if (mode === "silhouette") gl.disable(gl.DEPTH_TEST);
    else {
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
    }
    if (mode === "mirror") {
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    }
    for (const [buffers, model] of placed(pose)) {
      const m = mode === "mirror" ? multiply(MIRROR, model) : model;
      u.uModel?.(m);
      u.uNormalMatrix?.(normalMatrix(m));
      gl.bindVertexArray(buffers.vao);
      gl.drawElements(gl.TRIANGLES, buffers.count, gl.UNSIGNED_INT, 0);
    }
    gl.disable(gl.BLEND);
  }

  function drawFloor(pose: ScalePose) {
    if (!shape) return;
    const { uniforms: u, program } = programs.floor;
    gl.useProgram(program);
    room(programs.floor, pose, false);
    u.uRig?.([shape.pivot, shape.arm, shape.rim, shape.panRadius]);
    u.uBody?.([shape.base, shape.foot]);
    // The floor overwrites the reflection's depth (the reflection lies beneath it) and lets it show through.
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.ALWAYS);
    gl.depthMask(true);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.bindVertexArray(floor);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disable(gl.BLEND);
    gl.depthFunc(gl.LEQUAL);
  }

  function drawEmbers(pose: ScalePose, bloom: boolean) {
    if (!shape) return;
    const { uniforms: u, program } = programs.embers;
    gl.useProgram(program);
    room(programs.embers, pose, bloom);
    u.uTime?.(pose.time);
    u.uDpr?.(bloom ? 0.5 : dpr);
    u.uFocus?.(shape.camera.depthAt(0));
    u.uVolume?.([shape.arm * 1.25, shape.pivot * 0.5, 260]);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(embers);
    gl.drawArrays(gl.POINTS, 0, EMBERS);
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

  function render(pose: ScalePose) {
    if (!layout || !targets) return;
    const t = targets;
    aim(pose);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);

    // The shafts: the light's glow with the scale's silhouette over it, blurred outward from the light.
    into(t.sky);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(programs.sky.program);
    programs.sky.uniforms.uSource?.(source);
    programs.sky.uniforms.uAspect?.([layout.width / layout.height, 1]);
    programs.sky.uniforms.uTime?.(pose.time);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    drawScale(pose, "silhouette");
    into(t.rays);
    gl.useProgram(programs.rays.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t.sky.texture);
    programs.rays.uniforms.uImage?.(0);
    programs.rays.uniforms.uSource?.(source);
    gl.bindVertexArray(screen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // The glow: the scene again at half size keeping only what's past white, then blurred near and far.
    into(t.scene);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    screenPass(programs.backdrop, pose, true);
    drawScale(pose, "glow");
    drawEmbers(pose, true);
    gl.disable(gl.DEPTH_TEST);
    blur(t.scene, t.nearSwap, 1, 0);
    blur(t.nearSwap, t.near, 0, 1);
    blur(t.near, t.farSwap, 2, 0);
    blur(t.farSwap, t.far, 0, 2);
    for (let i = 0; i < 2; i++) {
      blur(t.far, t.farSwap, 1.5, 0);
      blur(t.farSwap, t.far, 0, 1.5);
    }

    // The picture: the dark, the floor's reflection, the floor, the scale, the fog in front, the embers.
    into(null);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    screenPass(programs.backdrop, pose, false);
    drawScale(pose, "mirror");
    drawFloor(pose);
    drawScale(pose, "picture");
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    screenPass(programs.fog, pose, false);
    gl.disable(gl.BLEND);
    drawEmbers(pose, false);

    // The glow and the shafts on top, then the corners darkened.
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const { uniforms: u, program } = programs.light;
    gl.useProgram(program);
    [t.near, t.far, t.rays].forEach((from, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, from.texture);
    });
    u.uNear?.(0);
    u.uFar?.(1);
    u.uRays?.(2);
    u.uScale?.(bloomScale);
    u.uShafts?.(pose.shafts);
    u.uSize?.([layout.width, layout.height]);
    u.uText?.(layout.textBox);
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
    gl.deleteVertexArray(embers);
    gl.deleteVertexArray(floor);
    gl.deleteBuffer(seeds);
    gl.deleteBuffer(floorBuffer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  return { resize, render, dispose };
}

/* What the Student Government landing's WebGL2 scenes share (justice-scale.ts draws the Central Comelec's,
   council-podium.ts the Central Student Council's, red-moon.ts the Student Organizations Coordinating Council's):
   a little column-major linear algebra, meshes turned on a lathe, the shader chunks every pass starts from, and
   the plumbing that compiles programs, uploads meshes and makes render targets and noise. */

/* ——— Small linear algebra (column-major, as GLSL reads it) ——— */

export type Mat4 = Float32Array;

export const identity = (): Mat4 => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function multiply(...matrices: Mat4[]): Mat4 {
  return matrices.reduce((a, b) => {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column++)
      for (let row = 0; row < 4; row++)
        out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    return out;
  });
}

export function translation(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

/** A turn about the x axis: the camera's tilt. */
export function turnX(angle: number): Mat4 {
  const m = identity(), c = Math.cos(angle), s = Math.sin(angle);
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
}

/** A turn about the y axis (upright). */
export function turnY(angle: number): Mat4 {
  const m = identity(), c = Math.cos(angle), s = Math.sin(angle);
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
}

/** A turn about the z axis (the camera's line of sight). */
export function turnZ(angle: number): Mat4 {
  const m = identity(), c = Math.cos(angle), s = Math.sin(angle);
  m[0] = c; m[1] = s; m[4] = -s; m[5] = c;
  return m;
}

/** Turns the world upside down about the floor, for its reflection. */
export const MIRROR = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** The normals' matrix. The models only turn, move and mirror, so it's their upper 3×3. */
export const normalMatrix = (m: Mat4) => new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);

/** Where a point lands, in clip space. */
export function transform(m: Mat4, [x, y, z]: number[]) {
  return [0, 1, 2, 3].map((row) => m[row] * x + m[4 + row] * y + m[8 + row] * z + m[12 + row]);
}

/** A lens for a canvas of w × h with its focal length and centre (cx, cy) in the canvas's own pixels, so a scene
    can put its middle wherever the page's layout needs it. */
export function lens(focal: number, cx: number, cy: number, w: number, h: number, near: number, far: number): Mat4 {
  return new Float32Array([
    (2 * focal) / w, 0, 0, 0,
    0, (2 * focal) / h, 0, 0,
    1 - (2 * cx) / w, (2 * cy) / h - 1, -(far + near) / (far - near), -1,
    0, 0, (-2 * far * near) / (far - near), 0,
  ]);
}

/* ——— Geometry ——— */

export type Point = [number, number];
/** One smooth stretch of a lathe profile in one material. Normals are shared along a run and broken between runs. */
type Run = { material: number; points: Point[] };

export class Mesh {
  positions: number[] = [];
  normals: number[] = [];
  materials: number[] = [];
  indices: number[] = [];

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, material: number) {
    this.positions.push(x, y, z);
    this.normals.push(nx, ny, nz);
    this.materials.push(material);
  }

  /** Joins two rows of vertices, each `count` long, into a band of quads. */
  band(a: number, b: number, count: number) {
    for (let i = 0; i < count - 1; i++) this.indices.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1);
  }

  get count() {
    return this.positions.length / 3;
  }
}

/** A lathe profile: points are (radius, height), traced from the axis at one end to the axis at the other going
    round the outside, so that every normal faces out of the solid. */
export class Profile {
  runs: Run[];
  private last: Point;

  constructor(start: Point, material: number) {
    this.last = start;
    this.runs = [{ material, points: [start] }];
  }

  /** Carries on smoothly to a point. */
  to(r: number, y: number) {
    this.last = [Math.max(0, r), y];
    this.runs[this.runs.length - 1].points.push(this.last);
    return this;
  }

  /** A sharp edge here, and from here on, optionally, another material. */
  corner(material = this.runs[this.runs.length - 1].material) {
    this.runs.push({ material, points: [this.last] });
    return this;
  }
}

/** A point of a traced outline: the material of the stretch arriving at it, and whether it's a sharp edge. */
export type Mark = [radius: number, height: number, material: number, sharp?: boolean];

/** Builds a profile from marks, breaking it at sharp edges and wherever the material changes. */
export function trace(marks: Mark[]) {
  const p = new Profile([marks[0][0], marks[0][1]], marks[1][2]);
  for (let i = 1; i < marks.length; i++) {
    if (i > 1 && (marks[i][2] !== marks[i - 1][2] || marks[i - 1][3])) p.corner(marks[i][2]);
    p.to(marks[i][0], marks[i][1]);
  }
  return p;
}

/** The same outline traced back the other way, mirrored end for end: how a symmetric part is finished. */
export function mirrored(marks: Mark[]): Mark[] {
  const back: Mark[] = [];
  for (let i = marks.length - 2; i >= 0; i--) back.push([marks[i][0], -marks[i][1], marks[i + 1][2], marks[i][3]]);
  return [...marks, ...back];
}

/** Where a lathe puts (radius, height) at a given angle round its axis. Linear in radius and height, so it turns
    the profile's 2D normals too. */
type Place = (radius: number, height: number, cos: number, sin: number) => [number, number, number];

export const aroundY: Place = (r, h, c, s) => [r * c, h, r * s];
export const aroundX: Place = (r, h, c, s) => [h, r * c, r * s];

/** Turns a profile round an axis. With `facets`, the sides are flat: each one faces the middle of its span, so the
    light breaks across the edges between them. */
export function lathe(mesh: Mesh, profile: Profile, segments: number, place: Place, facets = false) {
  for (const run of profile.runs) {
    const points = run.points.filter((point, i, all) => i === 0 || Math.hypot(point[0] - all[i - 1][0], point[1] - all[i - 1][1]) > 1e-4);
    if (points.length < 2) continue;
    // The outward normal of the profile at each point: its tangent turned a quarter clockwise.
    const normals = points.map((_, i) => {
      const [r0, y0] = points[Math.max(0, i - 1)];
      const [r1, y1] = points[Math.min(points.length - 1, i + 1)];
      const length = Math.hypot(r1 - r0, y1 - y0) || 1;
      return [(y1 - y0) / length, -(r1 - r0) / length];
    });
    if (!facets) {
      let previous = -1;
      points.forEach(([r, y], i) => {
        const first = mesh.count;
        for (let s = 0; s <= segments; s++) {
          const a = (s / segments) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
          const [x, yy, z] = place(r, y, c, sn);
          const [nx, ny, nz] = place(normals[i][0], normals[i][1], c, sn);
          mesh.vertex(x, yy, z, nx, ny, nz, run.material);
        }
        if (previous >= 0) mesh.band(previous, first, segments + 1);
        previous = first;
      });
      continue;
    }
    for (let side = 0; side < segments; side++) {
      const a0 = (side / segments) * Math.PI * 2, a1 = ((side + 1) / segments) * Math.PI * 2, mid = (a0 + a1) / 2;
      let previous = -1;
      points.forEach(([r, y], i) => {
        const first = mesh.count;
        const [nx, ny, nz] = place(normals[i][0], normals[i][1], Math.cos(mid), Math.sin(mid));
        for (const a of [a0, a1]) {
          const [x, yy, z] = place(r, y, Math.cos(a), Math.sin(a));
          mesh.vertex(x, yy, z, nx, ny, nz, run.material);
        }
        if (previous >= 0) mesh.band(previous, first, 2);
        previous = first;
      });
    }
  }
}

export type Vec = number[];
export const normalize = (v: Vec) => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};
export const cross = (a: Vec, b: Vec) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** A ring of wire round a stadium (two half circles joined by straights) lying in the plane of `along` and
    `across`. Chain links are these; a round ring is one with no straight. */
export function ring(mesh: Mesh, center: Vec, along: Vec, across: Vec, straight: number, bend: number, wire: number, material: number, steps = 20, sides = 7) {
  const normal = cross(along, across);
  const curve = Math.PI * bend;
  const perimeter = 2 * straight + 2 * curve;
  const rows: number[] = [];
  for (let i = 0; i <= steps; i++) {
    // Where round the stadium this row is, and which way is out from its middle there.
    let d = (i / steps) * perimeter;
    let u: number, v: number, ou: number, ov: number;
    if (d < straight) { u = -straight / 2 + d; v = bend; ou = 0; ov = 1; }
    else if ((d -= straight) < curve) { const a = Math.PI / 2 - d / bend; u = straight / 2 + bend * Math.cos(a); v = bend * Math.sin(a); ou = Math.cos(a); ov = Math.sin(a); }
    else if ((d -= curve) < straight) { u = straight / 2 - d; v = -bend; ou = 0; ov = -1; }
    else { d -= straight; const a = -Math.PI / 2 - d / bend; u = -straight / 2 + bend * Math.cos(a); v = bend * Math.sin(a); ou = Math.cos(a); ov = Math.sin(a); }
    rows.push(mesh.count);
    for (let k = 0; k <= sides; k++) {
      const b = (k / sides) * Math.PI * 2, cb = Math.cos(b), sb = Math.sin(b);
      const n = [0, 1, 2].map((j) => cb * (ou * along[j] + ov * across[j]) + sb * normal[j]);
      mesh.vertex(
        center[0] + u * along[0] + v * across[0] + wire * n[0],
        center[1] + u * along[1] + v * across[1] + wire * n[1],
        center[2] + u * along[2] + v * across[2] + wire * n[2],
        n[0], n[1], n[2], material,
      );
    }
  }
  for (let i = 0; i < steps; i++) mesh.band(rows[i], rows[i + 1], sides + 1);
}

/* ——— Shader chunks ——— */

export const HEADER = `#version 300 es
precision highp float;
`;

export const NOISE = `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float valueNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 4; i++) { v += a * valueNoise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
`;

export const MESH_VERTEX = `${HEADER}
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in float aMaterial;
uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat3 uNormalMatrix;
out vec3 vWorld;
out vec3 vNormal;
out float vMaterial;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = uNormalMatrix * aNormal;
  vMaterial = aMaterial;
  gl_Position = uProjection * uView * world;
}`;

export const SCREEN_VERTEX = `${HEADER}
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** A 9-tap Gaussian along one direction, read with linear filtering so five taps do the work of nine. */
export const BLUR_FRAGMENT = `${HEADER}
in vec2 vUv;
uniform sampler2D uImage;
uniform vec2 uStep;
out vec4 outColor;
void main() {
  vec3 c = texture(uImage, vUv).rgb * 0.2270270270;
  c += (texture(uImage, vUv + uStep * 1.3846153846).rgb + texture(uImage, vUv - uStep * 1.3846153846).rgb) * 0.3162162162;
  c += (texture(uImage, vUv + uStep * 3.2307692308).rgb + texture(uImage, vUv - uStep * 3.2307692308).rgb) * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;

/* ——— WebGL plumbing ——— */

type Value = number | Float32Array | number[];
type Uniforms = Record<string, (value: Value) => void>;
export type Program = { program: WebGLProgram; uniforms: Uniforms };

/** A program on its way: compiling and linking, perhaps on other threads, while other work goes on. */
export type Pending = { program: WebGLProgram; shaders: WebGLShader[] };

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Couldn't create a shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

/** Starts a program compiling and linking without waiting on it. Several started together compile at once where the
    browser can (KHR_parallel_shader_compile, once it's asked for), and `linked` collects each when it's needed. */
export function linkLater(gl: WebGL2RenderingContext, vertex: string, fragment: string): Pending {
  const program = gl.createProgram();
  if (!program) throw new Error("Couldn't create a program.");
  const shaders = [compile(gl, gl.VERTEX_SHADER, vertex), compile(gl, gl.FRAGMENT_SHADER, fragment)];
  for (const shader of shaders) gl.attachShader(program, shader);
  gl.linkProgram(program);
  return { program, shaders };
}

export function link(gl: WebGL2RenderingContext, vertex: string, fragment: string): Program {
  return linked(gl, linkLater(gl, vertex, fragment));
}

/** Finishes a program `linkLater` started: waits for it if it must, fails with the compiler's log, and finds its
    uniforms. */
export function linked(gl: WebGL2RenderingContext, { program, shaders }: Pending): Program {
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = shaders.filter((shader) => !gl.getShaderParameter(shader, gl.COMPILE_STATUS)).map((shader) => gl.getShaderInfoLog(shader)).join("\n");
    throw new Error(log || gl.getProgramInfoLog(program) || "The program didn't link.");
  }
  for (const shader of shaders) gl.deleteShader(shader);
  const uniforms: Uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    const location = info && gl.getUniformLocation(program, info.name);
    if (!info || !location) continue;
    const list = (v: Value) => v as Float32Array;
    const set: Record<number, (v: Value) => void> = {
      [gl.FLOAT]: (v) => gl.uniform1f(location, v as number),
      [gl.FLOAT_VEC2]: (v) => gl.uniform2fv(location, list(v)),
      [gl.FLOAT_VEC3]: (v) => gl.uniform3fv(location, list(v)),
      [gl.FLOAT_VEC4]: (v) => gl.uniform4fv(location, list(v)),
      [gl.FLOAT_MAT3]: (v) => gl.uniformMatrix3fv(location, false, list(v)),
      [gl.FLOAT_MAT4]: (v) => gl.uniformMatrix4fv(location, false, list(v)),
      [gl.SAMPLER_2D]: (v) => gl.uniform1i(location, v as number),
      [gl.SAMPLER_3D]: (v) => gl.uniform1i(location, v as number),
      [gl.SAMPLER_CUBE]: (v) => gl.uniform1i(location, v as number),
    };
    // An array is set whole through its first element, under its plain name.
    if (set[info.type]) uniforms[info.name.replace(/\[0\]$/, "")] = set[info.type];
  }
  return { program, uniforms };
}

export type Buffers = { vao: WebGLVertexArrayObject; buffers: WebGLBuffer[]; count: number };

export function upload(gl: WebGL2RenderingContext, mesh: Mesh): Buffers {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffers: WebGLBuffer[] = [];
  const attribute = (location: number, data: number[], size: number) => {
    const buffer = gl.createBuffer()!;
    buffers.push(buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  };
  attribute(0, mesh.positions, 3);
  attribute(1, mesh.normals, 3);
  attribute(2, mesh.materials, 1);
  const index = gl.createBuffer()!;
  buffers.push(index);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mesh.indices), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, buffers, count: mesh.indices.length };
}

/** Frees what `upload` made. */
export function unload(gl: WebGL2RenderingContext, part: Buffers) {
  gl.deleteVertexArray(part.vao);
  for (const buffer of part.buffers) gl.deleteBuffer(buffer);
}

export type Target = { framebuffer: WebGLFramebuffer; texture: WebGLTexture; depth: WebGLRenderbuffer | null; width: number; height: number };

export function target(gl: WebGL2RenderingContext, width: number, height: number, float: boolean, depth = false): Target {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, width, height, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  let renderbuffer: WebGLRenderbuffer | null = null;
  if (depth) {
    renderbuffer = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer, texture, depth: renderbuffer, width, height };
}

/** Frees what `target` made. */
export function untarget(gl: WebGL2RenderingContext, t: Target) {
  gl.deleteFramebuffer(t.framebuffer);
  gl.deleteTexture(t.texture);
  if (t.depth) gl.deleteRenderbuffer(t.depth);
}

/** A small cube of smoothed random values that tiles, for haze, gas and grain to drift through. */
export function noiseVolume(gl: WebGL2RenderingContext) {
  const size = 32;
  let values = Float32Array.from({ length: size ** 3 }, Math.random);
  // Three passes of a box blur along each axis, wrapping round, soften it into rolling lumps.
  for (let axis = 0; axis < 3; axis++) {
    const stride = size ** axis;
    const next = new Float32Array(values.length);
    for (let i = 0; i < values.length; i++) {
      const at = Math.floor(i / stride) % size;
      const back = i + (((at + size - 1) % size) - at) * stride, on = i + (((at + 1) % size) - at) * stride;
      next[i] = (values[back] + values[i] * 2 + values[on]) / 4;
    }
    values = next;
  }
  let low = Infinity, high = -Infinity;
  for (const v of values) { low = Math.min(low, v); high = Math.max(high, v); }
  const bytes = Uint8Array.from(values, (v) => Math.round(((v - low) / (high - low || 1)) * 255));
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_3D, texture);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, size, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, bytes);
  for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, wrap, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.bindTexture(gl.TEXTURE_3D, null);
  return texture;
}

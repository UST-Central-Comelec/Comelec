"use client";

// Adapted from React Bits Side Rays: https://reactbits.dev/backgrounds/side-rays
import { useEffect, useRef } from "react";
import { Renderer, Program, Triangle, Mesh } from "ogl";

type Origin = 'top-center' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface SideRaysProps {
  active?: boolean;
  speed?: number;
  rayColor1?: string;
  rayColor2?: string;
  intensity?: number;
  spread?: number;
  origin?: Origin;
  tilt?: number;
  saturation?: number;
  blend?: number;
  falloff?: number;
  opacity?: number;
  className?: string;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [1, 1, 1];
};

const originToFlip = (origin: Origin): [number, number] => {
  switch (origin) {
    case 'top-left': return [1, 0];
    case 'bottom-right': return [0, 1];
    case 'bottom-left': return [1, 1];
    default: return [0, 0];
  }
};

const vert = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const frag = `precision highp float;

uniform float iTime;
uniform vec2 iResolution;
uniform float iSpeed;
uniform vec3 iRayColor1;
uniform vec3 iRayColor2;
uniform float iIntensity;
uniform float iSpread;
uniform float iFlipX;
uniform float iFlipY;
uniform float iCenter;
uniform float iTilt;
uniform float iSaturation;
uniform float iBlend;
uniform float iFalloff;
uniform float iOpacity;

float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
  vec2 sourceToCoord = coord - raySource;
  float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);
  return clamp(
    (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
    (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
    0.0, 1.0) *
    clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  if (iFlipX > 0.5) fragCoord.x = iResolution.x - fragCoord.x;
  if (iFlipY > 0.5) fragCoord.y = iResolution.y - fragCoord.y;

  vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  vec2 rayPos = vec2(iResolution.x * mix(1.1, 0.5, iCenter), -0.5 * iResolution.y);

  float tiltRad = iTilt * 3.14159265 / 180.0;
  float cs = cos(tiltRad);
  float sn = sin(tiltRad);
  vec2 rel = coord - rayPos;
  vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;

  float halfSpread = iSpread * 0.275;
  float direction = mix(0.785398, 1.570796, iCenter);
  vec2 rayRefDir1 = normalize(vec2(cos(direction + halfSpread), sin(direction + halfSpread)));
  vec2 rayRefDir2 = normalize(vec2(cos(direction - halfSpread), sin(direction - halfSpread)));

  vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
  vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);

  vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;

  float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
  float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);
  color.rgb *= brightness;

  float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  color.rgb = mix(vec3(gray), color.rgb, iSaturation);

  color.a = max(color.r, max(color.g, color.b)) * iOpacity;
  gl_FragColor = color;
}`;

export default function SideRays({
  active = true, speed = 2.5, rayColor1 = "#EAB308", rayColor2 = "#96c8ff",
  intensity = 2, spread = 2, origin = "top-right", tilt = 0, saturation = 1.5,
  blend = 0.75, falloff = 1.6, opacity = 1, className = ""
}: SideRaysProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const syncRef = useRef<(() => void) | null>(null);
  useEffect(() => { activeRef.current = active; syncRef.current?.(); }, [active]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: Renderer;
    try { renderer = new Renderer({ alpha: true, dpr: 1 }); }
    catch { return; }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    container.appendChild(gl.canvas);
    const [flipX, flipY] = originToFlip(origin);
    const uniforms = {
      iTime: { value: 0 }, iResolution: { value: [1, 1] }, iSpeed: { value: speed },
      iRayColor1: { value: hexToRgb(rayColor1) }, iRayColor2: { value: hexToRgb(rayColor2) },
      iIntensity: { value: intensity }, iSpread: { value: spread }, iFlipX: { value: flipX },
      iFlipY: { value: flipY }, iTilt: { value: tilt }, iSaturation: { value: saturation },
      iCenter: { value: origin === "top-center" ? 1 : 0 },
      iBlend: { value: blend }, iFalloff: { value: falloff }, iOpacity: { value: opacity }
    };
    const geometry = new Triangle(gl);
    const program = new Program(gl, { vertex: vert, fragment: frag, uniforms });
    const mesh = new Mesh(gl, { geometry, program });
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0, lastTime = 0, elapsed = 0;
    let hasSize = false, onScreen = false, contextLost = false;
    const render = () => { if (hasSize && !contextLost) renderer.render({ scene: mesh }); };
    const shouldAnimate = () => activeRef.current && onScreen && hasSize && !document.hidden && !motion.matches && !contextLost;
    const update = (time: number) => {
      frame = 0;
      if (!shouldAnimate()) return;
      elapsed += lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      uniforms.iTime.value = elapsed;
      render();
      frame = requestAnimationFrame(update);
    };
    const sync = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; lastTime = 0;
      if (activeRef.current && onScreen && !document.hidden) render();
      if (shouldAnimate()) frame = requestAnimationFrame(update);
    };
    syncRef.current = sync;
    const resize = () => {
      const width = container.clientWidth, height = container.clientHeight;
      hasSize = width > 0 && height > 0;
      if (hasSize) {
        renderer.dpr = Math.min(window.devicePixelRatio || 1, 1.5, 1200 / Math.max(width, height));
        renderer.setSize(width, height);
        gl.canvas.style.width = "100%"; gl.canvas.style.height = "100%";
        uniforms.iResolution.value = [gl.canvas.width, gl.canvas.height];
      }
      sync();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); });
    intersectionObserver.observe(container);
    const handleContextLost = (event: Event) => { event.preventDefault(); contextLost = true; sync(); };
    gl.canvas.addEventListener("webglcontextlost", handleContextLost);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);
    resize();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      syncRef.current = null;
      resizeObserver.disconnect(); intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
      gl.canvas.removeEventListener("webglcontextlost", handleContextLost);
      geometry.remove(); program.remove(); gl.canvas.remove();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [speed, rayColor1, rayColor2, intensity, spread, origin, tilt, saturation, blend, falloff, opacity]);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}

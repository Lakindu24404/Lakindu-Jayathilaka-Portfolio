"use client";

import { useEffect, useRef } from "react";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "@/lib/particleFieldShaders";
import { poissonDisc } from "@/lib/poisson";

/**
 * Radial dash field — the hero background from https://antigravity.google.
 *
 * A few thousand Poisson-scattered dashes lie along the radius of a slow
 * drifting ring, brightening and pushing outward as the ring sweeps past them
 * and settling back into an ambient noise field behind it. Everything is one
 * `gl.POINTS` draw call; the per-particle motion is solved in the vertex
 * shader (see `particleFieldShaders`), so there is no simulation state, no
 * float render targets and no 3D library.
 *
 * Field space (where the ring radius and noise frequencies live) is scaled so
 * the canvas height spans ±FIELD_HALF_HEIGHT. Widening the viewport reveals
 * more field rather than stretching it; below 1:1 the framing switches to the
 * width, which keeps the ring on screen on a portrait phone instead of
 * letting it fall outside the viewport entirely.
 */

/** Half the canvas height in field units — the reference camera's framing. */
const FIELD_HALF_HEIGHT = 0.2256;

/** Overscan, so displaced dashes never reveal the edge of the point cloud. */
const FIELD_MARGIN = 0.03;

/** Must match `FIELD_ZOOM` in the vertex shader. */
const FIELD_ZOOM = 1.25;

/** Rebuilding the cloud on every resize would pop, so build with headroom. */
const FIELD_HEADROOM = 1.35;

/** How much of the canvas half-height one field unit covers, per aspect. */
const fieldHalfHeight = (aspect: number) =>
  FIELD_HALF_HEIGHT / Math.min(aspect, 1);

/** Half-extents of field the canvas can see, before overscan. */
const visibleHalf = (aspect: number) => {
  const half = fieldHalfHeight(aspect);
  return { x: (half * aspect) / FIELD_ZOOM, y: half / FIELD_ZOOM };
};

type Props = {
  className?: string;
  /**
   * Three-stop gradient the dashes are coloured from. Antigravity's own light
   * theme is `["#2c64ed", "#f84242", "#ffcf03"]`.
   */
  colors?: readonly [string, string, string];
  /** 100–300. Higher packs the dashes closer together. Reference hero: 230. */
  density?: number;
  /** Multiplier on dash size. */
  particleScale?: number;
  /** Width of the thin bright ring line. */
  ringWidth?: number;
  /** Width of the broad band that swells and pushes the dashes outward. */
  ringWidth2?: number;
  /** How far that band throws dashes away from the ring centre. */
  ringDisplacement?: number;
  /** How much slow dashes are darkened toward the background. 0 = flat colour. */
  darken?: number;
  opacity?: number;
  /** Let the pointer drag the ring around. */
  interactive?: boolean;
};

/** Framer-style range remap, as the reference maps density to spacing. */
const remap = (v: number, a1: number, a2: number, b1: number, b2: number) =>
  ((v - a1) * (b2 - b1)) / (a2 - a1) + b1;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Smoothed 1D value noise — drives the ring's idle wander. */
function hash1(i: number) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function noise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash1(i) * (1 - u) + hash1(i + 1) * u;

  const x2 = x * 2.3 + 7.1;
  const i2 = Math.floor(x2);
  const f2 = x2 - i2;
  const u2 = f2 * f2 * (3 - 2 * f2);
  const b = hash1(i2) * (1 - u2) + hash1(i2 + 1) * u2;

  return a * 0.65 + b * 0.35;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      `ParticleField ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader:`,
      gl.getShaderInfoLog(shader),
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Poisson field, centred on the origin, in field space. */
function buildField(density: number, halfX: number, halfY: number) {
  const points = poissonDisc({
    width: halfX * 2,
    height: halfY * 2,
    minDistance: remap(density, 0, 300, 10, 2) / 250,
    maxDistance: remap(density, 0, 300, 11, 3) / 250,
  });
  for (let i = 0; i < points.length; i += 2) {
    points[i] -= halfX;
    points[i + 1] -= halfY;
  }
  return points;
}

export function ParticleField({
  className,
  colors = ["#6670ff", "#f94706", "#0a0a0a"],
  density = 230,
  particleScale = 0.75,
  ringWidth = 0.006,
  ringWidth2 = 0.107,
  ringDisplacement = 0.62,
  darken = 1,
  opacity = 0.9,
  interactive = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Read inside the draw loop, so prop tweaks apply without rebuilding the
  // GL program or the point cloud.
  const options = useRef({
    colors,
    particleScale,
    ringWidth,
    ringWidth2,
    ringDisplacement,
    darken,
    opacity,
    interactive,
  });
  useEffect(() => {
    options.current = {
      colors,
      particleScale,
      ringWidth,
      ringWidth2,
      ringDisplacement,
      darken,
      opacity,
      interactive,
    };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const attrs: WebGLContextAttributes = {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
      // Keeps the frame readable after the draw call, so the hero survives a
      // screenshot / print pass instead of capturing blank.
      preserveDrawingBuffer: true,
    };
    const gl = (canvas.getContext("webgl2", attrs) ||
      canvas.getContext("webgl", attrs)) as WebGLRenderingContext | null;
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const u = {
      time: gl.getUniformLocation(program, "uTime"),
      ring: gl.getUniformLocation(program, "uRing"),
      ringRadius: gl.getUniformLocation(program, "uRingRadius"),
      ringWidth: gl.getUniformLocation(program, "uRingWidth"),
      ringWidth2: gl.getUniformLocation(program, "uRingWidth2"),
      ringDisplacement: gl.getUniformLocation(program, "uRingDisplacement"),
      aspect: gl.getUniformLocation(program, "uAspect"),
      fieldScale: gl.getUniformLocation(program, "uFieldScale"),
      pointScale: gl.getUniformLocation(program, "uPointScale"),
      color1: gl.getUniformLocation(program, "uColor1"),
      color2: gl.getUniformLocation(program, "uColor2"),
      color3: gl.getUniformLocation(program, "uColor3"),
      darken: gl.getUniformLocation(program, "uDarken"),
      alpha: gl.getUniformLocation(program, "uAlpha"),
    };

    const aRef = gl.getAttribLocation(program, "aRef");
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(aRef);
    gl.vertexAttribPointer(aRef, 2, gl.FLOAT, false, 0, 0);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );
    gl.clearColor(0, 0, 0, 0);

    let count = 0;
    const built = { x: 0, y: 0 };
    const fitField = (forAspect: number) => {
      const need = visibleHalf(forAspect);
      if (need.x <= built.x && need.y <= built.y) return;
      built.x = need.x * FIELD_HEADROOM + FIELD_MARGIN;
      built.y = need.y * FIELD_HEADROOM + FIELD_MARGIN;
      const points = buildField(density, built.x, built.y);
      count = points.length / 2;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    };

    let aspect = 1;
    let half = FIELD_HALF_HEIGHT;
    let pointScale = 1;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Layout size, not `getBoundingClientRect()`: an ancestor may be
      // CSS-scaled (the Get in touch wall scales on scroll), and the canvas
      // should be rasterised for its untransformed box.
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      aspect = width / height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      half = fieldHalfHeight(aspect);
      gl.uniform1f(u.aspect, aspect);
      gl.uniform1f(u.fieldScale, 1 / half);
      // Dash size tracks viewport width as the reference does, with a floor so
      // the field stays legible on phones.
      pointScale = 3.5 * dpr * Math.min(Math.max(width, 720) / 2000, 1);
      fitField(aspect);
    };

    resize();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const ring = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0, over: false };
    let elapsed = 0;
    let last = 0;
    let frame = 0;
    let onScreen = true;

    const draw = (dt: number) => {
      const o = options.current;
      elapsed += dt;

      // The reference's ±0.2 / ±0.1 wander and its 0.875 cursor tracking are
      // both fractions of the framing, so they hold at any aspect.
      const wanderX = (noise1(elapsed * 0.66 + 94.234) - 0.5) * 2 * half;
      const wanderY = (noise1(elapsed * 0.75 + 21.028) - 0.5) * 2 * half;

      const chasing = o.interactive && pointer.over;
      const track = half * 0.875;
      const targetX = chasing ? pointer.x * track + wanderX * 0.443 : wanderX * 0.886;
      const targetY = chasing ? pointer.y * track + wanderY * 0.443 : wanderY * 0.443;
      // Frame-rate independent form of the reference's per-frame 0.02 / 0.01 lerp.
      const k = 1 - Math.exp(-(chasing ? 1.2 : 0.6) * dt);
      ring.x += (targetX - ring.x) * k;
      ring.y += (targetY - ring.y) * k;

      const [c1, c2, c3] = o.colors;
      gl.uniform3fv(u.color1, hexToRgb(c1));
      gl.uniform3fv(u.color2, hexToRgb(c2));
      gl.uniform3fv(u.color3, hexToRgb(c3));
      gl.uniform1f(u.darken, o.darken);
      gl.uniform1f(u.alpha, o.opacity);
      gl.uniform1f(u.pointScale, pointScale * o.particleScale);
      gl.uniform1f(u.ringWidth, o.ringWidth);
      gl.uniform1f(u.ringWidth2, o.ringWidth2);
      gl.uniform1f(u.ringDisplacement, o.ringDisplacement);
      gl.uniform1f(u.time, elapsed);
      gl.uniform2f(u.ring, ring.x, ring.y);
      gl.uniform1f(
        u.ringRadius,
        0.175 + Math.sin(elapsed) * 0.03 + Math.cos(elapsed * 3) * 0.02,
      );

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, count);
    };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!onScreen || document.hidden) {
        last = now;
        return;
      }
      draw(Math.min((now - last) / 1000, 0.05));
      last = now;
    };

    const start = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!frame) return;
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const applyMotionPreference = () => {
      // Always paint one frame up front: no blank hero on the first paint, and
      // a still field on tabs where rAF never runs.
      if (reduceMotion.matches) {
        stop();
        elapsed = 0;
        ring.x = 0;
        ring.y = 0;
        draw(0);
      } else {
        draw(0);
        start();
      }
    };

    // Browser zoom and monitor changes move devicePixelRatio without changing
    // the layout size, so ResizeObserver alone would leave the canvas blurry.
    let dprQuery: MediaQueryList | null = null;
    const onDprChange = () => {
      resize();
      if (reduceMotion.matches) draw(0);
      watchDpr();
    };
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener("change", onDprChange);
    };
    watchDpr();

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((((event.clientY - rect.top) / rect.height) * 2) - 1);
      pointer.over = nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
      pointer.x = nx * aspect;
      pointer.y = ny;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (reduceMotion.matches) draw(0);
    });
    resizeObserver.observe(canvas);

    const onVisibility = () => {
      last = performance.now();
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      stop();
    };

    canvas.addEventListener("webglcontextlost", onContextLost);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    reduceMotion.addEventListener("change", applyMotionPreference);
    applyMotionPreference();

    return () => {
      stop();
      observer.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onPointerMove);
      reduceMotion.removeEventListener("change", applyMotionPreference);
      dprQuery?.removeEventListener("change", onDprChange);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      // Deliberately no `WEBGL_lose_context.loseContext()`: a canvas only ever
      // hands out one context, so losing it here would leave the element dead
      // for the next mount (React Strict Mode, Fast Refresh).
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}

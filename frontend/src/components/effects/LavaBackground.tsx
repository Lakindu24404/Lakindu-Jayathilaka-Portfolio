"use client";

import { useEffect, useRef } from "react";
import styles from "./LavaBackground.module.css";

const MAX_RENDER_PIXELS = 400_000;
const FRAME_MS = 1000 / 30;
const SPEED = 0.15;
const BLEND = 1;
const COLORS = ["#ff1a00", "#ff1a00", "#ff1a00", "#ffefcc", "#0040ff"] as const;

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_speed;
  uniform float u_blend;
  uniform float u_blue_focus;
  uniform vec3 u_col1;
  uniform vec3 u_col2;
  uniform vec3 u_col3;
  uniform vec3 u_col4;
  uniform vec3 u_col5;

  // smooth metaball blending
  float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
  }

  // capsule SDF — the stretched lava blobs
  float sdCapsule( vec3 p, vec3 a, vec3 b, float r ) {
      vec3 pa = p - a, ba = b - a;
      float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
      return length( pa - ba*h ) - r;
  }

  float map(vec3 p) {
      float t = u_time * u_speed;

      // warp space so the capsules flow organically
      vec3 q = p;
      q.x += sin(p.y * 0.5 + t) * 1.0;
      q.z += cos(p.x * 0.4 + t * 0.8) * 1.0;

      float d = 100.0;
      float k = u_blend;

      // central dense column — guarantees no empty void
      vec3 a0 = vec3(sin(t*0.2)*1.0, -100.0, cos(t*0.3)*1.0);
      vec3 b0 = vec3(sin(t*0.4)*1.0, 100.0, cos(t*0.5)*1.0);
      d = smin(d, sdCapsule(q, a0, b0, 2.0), k);

      // drifting blobs spawn far outside the screen (-40..+40 vertical loop)
      vec3 a1 = vec3(sin(t*0.5)*3.0, -40.0 + fract(t*0.15 + 0.0)*80.0, sin(t*0.6)*2.0);
      vec3 b1 = a1 + vec3(cos(t*0.7)*3.0, 6.0, sin(t*0.5)*-2.0);
      d = smin(d, sdCapsule(q, a1, b1, 1.8), k);

      vec3 a2 = vec3(cos(t*0.6)*-4.0, -40.0 + fract(t*0.17 + 0.3)*80.0, cos(t*0.4)*1.5);
      vec3 b2 = a2 + vec3(sin(t*0.9)*2.5, 4.5, cos(t*0.8)*2.5);
      d = smin(d, sdCapsule(q, a2, b2, 1.5), k);

      vec3 a3 = vec3(sin(t*0.4)*-3.5, -40.0 + fract(t*0.16 + 0.6)*80.0, 0.0);
      vec3 b3 = a3 + vec3(sin(t*0.8)*1.5, 7.0, cos(t*0.5)*-1.5);
      d = smin(d, sdCapsule(q, a3, b3, 1.0), k);

      vec3 a4 = vec3(cos(t*0.8)*4.5, -40.0 + fract(t*0.18 + 0.8)*80.0, sin(t*0.9)*-2.5);
      vec3 b4 = a4 + vec3(cos(t*1.1)*-2.0, 3.5, sin(t*1.2)*2.0);
      d = smin(d, sdCapsule(q, a4, b4, 1.2), k);

      vec3 a5 = vec3(sin(t*1.1)*-1.5, -40.0 + fract(t*0.2 + 0.1)*80.0, cos(t*0.7)*-1.5);
      vec3 b5 = a5 + vec3(4.0, 1.0 + sin(t)*2.0, 0.0);
      d = smin(d, sdCapsule(q, a5, b5, 1.3), k);

      vec3 a6 = vec3(cos(t*1.3)*-2.5, -40.0 + fract(t*0.19 + 0.5)*80.0, sin(t*1.2)*1.5);
      vec3 b6 = a6 + vec3(0.0, 5.0, 0.0);
      d = smin(d, sdCapsule(q, a6, b6, 2.0), k);

      vec3 a7 = vec3(sin(t*0.9)*2.5, -40.0 + fract(t*0.21 + 0.4)*80.0, cos(t*1.4)*-1.0);
      vec3 b7 = a7 + vec3(0.0, 3.0, 0.0);
      d = smin(d, sdCapsule(q, a7, b7, 0.8), k);

      vec3 a8 = vec3(cos(t*0.7)*3.5, -40.0 + fract(t*0.14 + 0.7)*80.0, sin(t*0.5)*1.5);
      vec3 b8 = a8 + vec3(sin(t*1.5)*-2.0, 4.0, cos(t*0.9)*2.0);
      d = smin(d, sdCapsule(q, a8, b8, 1.6), k);

      // compensate the space warp to avoid raymarch artefacts
      return d * 0.6;
  }

  // tetrahedral normals — 4 map() calls instead of 6
  vec3 calcNormal(vec3 p) {
      vec2 e = vec2(0.01, -0.01);
      return normalize(
          e.xyy * map(p + e.xyy) +
          e.yyx * map(p + e.yyx) +
          e.yxy * map(p + e.yxy) +
          e.xxx * map(p + e.xxx)
      );
  }

  void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);

      vec3 ro = vec3(0.0, 0.0, 9.0);
      vec3 rd = normalize(vec3(uv, -1.0));

      // 48 steps + early exit is enough — shapes are soft and sit under blur
      float dO = 0.0;
      vec3 p;
      for(int i = 0; i < 48; i++) {
          p = ro + rd * dO;
          float dS = map(p);
          dO += dS;
          if(dS < 0.02 || dO > 20.0) break;
      }

      vec3 col = vec3(0.0);

      if(dO < 20.0) {
          vec3 n = calcNormal(p);

          vec3 baseColor = mix(u_col1, u_col2, smoothstep(-5.0, 5.0, p.y));
          baseColor = mix(baseColor, u_col4, smoothstep(-2.0, 4.0, p.x));
          baseColor = mix(baseColor, u_col5, smoothstep(2.0, 6.0, p.x + p.y));
          baseColor = mix(baseColor, u_col3, smoothstep(3.0, 6.0, -p.x));

          vec3 lightDir1 = normalize(vec3(1.0, 1.0, 1.0));
          vec3 lightDir2 = normalize(vec3(-1.0, -1.0, -0.5));
          vec3 lightDir3 = normalize(vec3(0.0, 1.0, -1.0));

          float diff = max(dot(n, lightDir1), 0.0);
          float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
          float ao = clamp(map(p + n * 0.5) / 0.5, 0.0, 1.0);

          col = baseColor * (diff * 0.7 + 0.5) * ao;
          col += u_col4 * max(dot(n, lightDir2), 0.0) * fresnel * 1.2;
          col += u_col3 * max(dot(n, lightDir3), 0.0) * fresnel * 1.0;
      }

      col = pow(col, vec3(1.0/1.8));

      // Scroll-controlled cobalt grade. It keeps the raymarched luminance,
      // so the blue passage is still made of moving light, shadow and blobs
      // instead of becoming a flat colour wash.
      float luminance = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 cobalt = vec3(0.0, 0.251, 1.0) * (0.08 + luminance * 1.15);
      col = mix(col, cobalt, u_blue_focus * 0.88);

      gl_FragColor = vec4(col, 1.0);
  }
`;

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return new Float32Array([0, 0, 0]);
  return new Float32Array([
    Number.parseInt(result[1], 16) / 255,
    Number.parseInt(result[2], 16) / 255,
    Number.parseInt(result[3], 16) / 255,
  ]);
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

type LavaBackgroundProps = {
  blueStartId?: string;
  blueEndId?: string;
};

const smoothStep = (edge0: number, edge1: number, value: number) => {
  const progress = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return progress * progress * (3 - 2 * progress);
};

export function LavaBackground({
  blueStartId,
  blueEndId,
}: LavaBackgroundProps = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return;
    }
    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
    const timeLocation = gl.getUniformLocation(program, "u_time");
    const blueFocusLocation = gl.getUniformLocation(program, "u_blue_focus");
    gl.uniform1f(gl.getUniformLocation(program, "u_speed"), SPEED);
    gl.uniform1f(gl.getUniformLocation(program, "u_blend"), BLEND);
    COLORS.forEach((color, index) => {
      gl.uniform3fv(
        gl.getUniformLocation(program, `u_col${index + 1}`),
        hexToRgb(color),
      );
    });

    const resizeCanvas = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scale = Math.min(
        1,
        Math.sqrt(MAX_RENDER_PIXELS / (rect.width * rect.height)),
      );
      canvas.width = Math.max(1, Math.round(rect.width * scale));
      canvas.height = Math.max(1, Math.round(rect.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    let visible = true;
    let animationFrame = 0;
    let startTime: number | null = null;
    let lastFrame = -FRAME_MS;
    let targetBlueFocus = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const measureBlueFocus = () => {
      if (!blueStartId || !blueEndId) return 0;
      const start = document.getElementById(blueStartId);
      const end = document.getElementById(blueEndId);
      if (!start || !end) return 0;

      const viewportCenter = window.scrollY + window.innerHeight * 0.5;
      const startTop = window.scrollY + start.getBoundingClientRect().top;
      const endBottom = window.scrollY + end.getBoundingClientRect().bottom;
      const fadeDistance = window.innerHeight * 0.85;
      const fadeIn = smoothStep(
        startTop - fadeDistance,
        startTop + window.innerHeight * 0.08,
        viewportCenter,
      );
      const fadeOut = 1 - smoothStep(
        endBottom - window.innerHeight * 0.12,
        endBottom + fadeDistance,
        viewportCenter,
      );
      return fadeIn * fadeOut;
    };

    const draw = (time: number) => {
      if (startTime === null) startTime = time;
      // Lenis-driven anchor jumps do not consistently emit a native scroll
      // event, so sample the live document position with the render itself.
      // The spatial smoothstep above supplies the transition easing.
      targetBlueFocus = measureBlueFocus();
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, (time - startTime) / 1000);
      gl.uniform1f(blueFocusLocation, targetBlueFocus);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const updateBlueFocus = () => {
      targetBlueFocus = measureBlueFocus();
      if (reducedMotion) draw(performance.now());
    };

    const render = (time: number) => {
      if (visible && time - lastFrame >= FRAME_MS) {
        lastFrame = time;
        draw(time);
      }
      animationFrame = window.requestAnimationFrame(render);
    };

    resizeCanvas();
    updateBlueFocus();
    draw(0);

    window.addEventListener("scroll", updateBlueFocus, { passive: true });
    window.addEventListener("resize", updateBlueFocus);

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
      if (reducedMotion) draw(0);
    });
    resizeObserver.observe(root);

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    visibilityObserver.observe(root);

    if (!reducedMotion) {
      animationFrame = window.requestAnimationFrame(render);
    }

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", updateBlueFocus);
      window.removeEventListener("resize", updateBlueFocus);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      if (positionBuffer) gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [blueStartId, blueEndId]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.grain} />
    </div>
  );
}

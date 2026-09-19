/**
 * The lava's GPU pipeline, kept free of React so `LavaBackground` only owns
 * its lifecycle.
 *
 * The look is the original single-pass ray-march shown through
 * `filter: blur(40px)`. That blur removes every detail finer than ~80 CSS px,
 * so marching the scene once per CSS pixel spent nearly all of its work on
 * detail the blur then threw away — on a mid-range phone, the difference
 * between a smooth page and ~15 FPS. The same picture is now built in three
 * cheap passes:
 *
 *   1. march — the unchanged scene, sampled every few CSS px (~5px on a
 *              phone) into a small buffer
 *   2. blur  — the same 40px Gaussian, separable, on that small buffer
 *   3. final — a smooth B-spline upsample to the canvas, composited over the
 *              red the old blur faded into at the edges
 *
 * Everything that defined the old picture is reproduced rather than re-tuned:
 * the overscanned box the canvas used to be stretched over (including the
 * slightly non-uniform stretch that came with it), the gamma curve and blue
 * grade applied before the blur, and the transparent edge the blur faded into.
 */

const SPEED = 0.15;
const BLEND = 1;
const COLORS = ["#ff1a00", "#ff1a00", "#ff1a00", "#ffefcc", "#0040ff"] as const;
/** Matches `.root`'s background, which showed through the old blur's edges. */
const BACKDROP = "#ff1a00";

/** Standard deviation of the old `filter: blur(40px)`, in CSS px. */
const BLUR_SIGMA = 40;
/** How far the old canvas overscanned each viewport edge, in CSS px. */
const OVERSCAN = 80;
/**
 * How far the canvas element itself extends past each viewport edge, in CSS
 * px. Flush to the edge, fractional device pixel ratios (2.625, 2.75…)
 * anti-alias the red fallback behind it into a hairline seam. Must match
 * `.canvas` in LavaBackground.module.css.
 */
export const CANVAS_BLEED = 4;
/**
 * Transparent padding around the overscanned box. The old blur faded into
 * transparency past the canvas edge, and 3σ from the viewport edge reaches
 * 40px beyond the box, so 48px of zeros reproduces that fall-off.
 */
const MARGIN = 48;
/**
 * The old backing-store budget. It no longer sizes anything that is drawn,
 * but the old uv mapping was derived from the backing store it produced.
 */
const LEGACY_MAX_PIXELS = 400_000;
/** March samples per frame the base texel size aims for. */
const TARGET_MARCH_SAMPLES = 24_000;
const MIN_TEXEL = 3;
const MAX_BASE_TEXEL = 6;
const MAX_TEXEL = 10;
/**
 * Coarser march grids the frame governor can step through, as multiples of
 * the base texel. Even the last step samples every ~10 CSS px, still well
 * inside what a 40px blur can resolve.
 */
export const QUALITY_STEPS = [1, 1.3, 1.6, 2] as const;
/** The canvas only ever shows the blurred result, so CSS px is plenty. */
const FINAL_MAX_PIXELS = 400_000;
const CAPSULES = 9;
const RADII = [2.0, 1.8, 1.5, 1.0, 1.2, 1.3, 2.0, 0.8, 1.6] as const;
/**
 * Beyond its radius, how far a capsule can influence the march: the blend
 * width, the ±1 space warp, and the AO probe plus normal offsets.
 */
const CULL_REACH = BLEND + 1 + 1;
/** Rays start at z = 9 and stop after travelling 20. */
const CAMERA_Z = 9;
const FAR_Z = CAMERA_Z - 20;

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    Number.parseInt(result[1], 16) / 255,
    Number.parseInt(result[2], 16) / 255,
    Number.parseInt(result[3], 16) / 255,
  ];
}

function vec3(hex: string) {
  return `vec3(${hexToRgb(hex).map((channel) => channel.toFixed(6)).join(", ")})`;
}

const PRECISION = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
`;

const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

/**
 * The original scene, unchanged except that the capsule endpoints — which
 * depend only on time — arrive as uniforms instead of being recomputed by
 * every `map()` call (up to 53 per sample, ~34 trig calls each).
 */
const MARCH_SHADER = `
  ${PRECISION}
  uniform vec4 u_capA[${CAPSULES}];
  uniform vec4 u_capBA[${CAPSULES}];
  uniform int u_capCount;
  uniform float u_t;
  uniform float u_blue_focus;
  uniform float u_texel;
  uniform vec2 u_box;
  uniform vec2 u_uvScale;

  const float MARGIN = ${MARGIN.toFixed(1)};
  const float BLEND = ${BLEND.toFixed(1)};
  const vec3 COL1 = ${vec3(COLORS[0])};
  const vec3 COL2 = ${vec3(COLORS[1])};
  const vec3 COL3 = ${vec3(COLORS[2])};
  const vec3 COL4 = ${vec3(COLORS[3])};
  const vec3 COL5 = ${vec3(COLORS[4])};

  // smooth metaball blending
  float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
  }

  // capsule SDF — the stretched lava blobs. a.w is the radius and
  // ba.w is 1 / dot(ba, ba).
  float sdCapsule(vec3 p, vec4 a, vec4 ba) {
      vec3 pa = p - a.xyz;
      float h = clamp(dot(pa, ba.xyz) * ba.w, 0.0, 1.0);
      return length(pa - ba.xyz * h) - a.w;
  }

  float map(vec3 p) {
      // warp space so the capsules flow organically
      vec3 q = p;
      q.x += sin(p.y * 0.5 + u_t) * 1.0;
      q.z += cos(p.x * 0.4 + u_t * 0.8) * 1.0;

      float d = 100.0;
      for (int i = 0; i < ${CAPSULES}; i++) {
          if (i >= u_capCount) break;
          d = smin(d, sdCapsule(q, u_capA[i], u_capBA[i]), BLEND);
      }

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
      // Texel centre -> position in the overscanned box the old canvas was
      // stretched over. Outside the box stays transparent, as it was.
      vec2 boxPos = gl_FragCoord.xy * u_texel - MARGIN;
      if (boxPos.x < 0.0 || boxPos.y < 0.0 || boxPos.x > u_box.x || boxPos.y > u_box.y) {
          gl_FragColor = vec4(0.0);
          return;
      }
      vec2 uv = (boxPos / u_box - 0.5) * u_uvScale;

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

          vec3 baseColor = mix(COL1, COL2, smoothstep(-5.0, 5.0, p.y));
          baseColor = mix(baseColor, COL4, smoothstep(-2.0, 4.0, p.x));
          baseColor = mix(baseColor, COL5, smoothstep(2.0, 6.0, p.x + p.y));
          baseColor = mix(baseColor, COL3, smoothstep(3.0, 6.0, -p.x));

          vec3 lightDir1 = normalize(vec3(1.0, 1.0, 1.0));
          vec3 lightDir2 = normalize(vec3(-1.0, -1.0, -0.5));
          vec3 lightDir3 = normalize(vec3(0.0, 1.0, -1.0));

          float diff = max(dot(n, lightDir1), 0.0);
          float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
          float ao = clamp(map(p + n * 0.5) / 0.5, 0.0, 1.0);

          col = baseColor * (diff * 0.7 + 0.5) * ao;
          col += COL4 * max(dot(n, lightDir2), 0.0) * fresnel * 1.2;
          col += COL3 * max(dot(n, lightDir3), 0.0) * fresnel * 1.0;
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

/**
 * One axis of a truncated Gaussian, pairing neighbouring taps into a single
 * bilinear fetch. Values are premultiplied, so the transparent margin blends
 * in exactly as the CSS blur's transparent surroundings did.
 */
const BLUR_SHADER = `
  ${PRECISION}
  uniform sampler2D u_source;
  uniform vec2 u_invSize;
  uniform vec2 u_axis;
  uniform float u_sigma;
  uniform int u_radius;

  void main() {
      vec2 uv = gl_FragCoord.xy * u_invSize;
      vec2 axis = u_axis * u_invSize;
      float falloff = -0.5 / (u_sigma * u_sigma);
      vec4 sum = texture2D(u_source, uv);
      float total = 1.0;
      for (int i = 1; i < 128; i += 2) {
          if (i > u_radius) break;
          float a = float(i);
          float b = a + 1.0;
          float wa = exp(a * a * falloff);
          float wb = i + 1 <= u_radius ? exp(b * b * falloff) : 0.0;
          float w = wa + wb;
          vec2 offset = axis * ((a * wa + b * wb) / w);
          sum += w * (texture2D(u_source, uv + offset) + texture2D(u_source, uv - offset));
          total += 2.0 * w;
      }
      gl_FragColor = sum / total;
  }
`;

/**
 * Upsamples the blurred buffer with a cubic B-spline (four bilinear fetches),
 * so no texel grid can show through the gradients, then lays it over the
 * backdrop colour wherever the blur faded towards transparency.
 */
const FINAL_SHADER = `
  ${PRECISION}
  uniform sampler2D u_source;
  uniform vec2 u_sourceSize;
  uniform vec2 u_cssPerPixel;
  uniform float u_texel;
  uniform float u_offset;

  const vec3 BACKDROP = ${vec3(BACKDROP)};

  vec4 cubic(float v) {
      vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
      vec4 s = n * n * n;
      float x = s.x;
      float y = s.y - 4.0 * s.x;
      float z = s.z - 4.0 * s.y + 6.0 * s.x;
      float w = 6.0 - x - y - z;
      return vec4(x, y, z, w) * (1.0 / 6.0);
  }

  vec4 sampleBSpline(vec2 texel) {
      vec2 coord = texel - 0.5;
      vec2 f = fract(coord);
      coord -= f;
      vec4 xc = cubic(f.x);
      vec4 yc = cubic(f.y);
      vec4 c = coord.xxyy + vec2(-0.5, 1.5).xyxy;
      vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
      vec4 offset = (c + vec4(xc.yw, yc.yw) / s) / u_sourceSize.xxyy;
      vec4 s0 = texture2D(u_source, offset.xz);
      vec4 s1 = texture2D(u_source, offset.yz);
      vec4 s2 = texture2D(u_source, offset.xw);
      vec4 s3 = texture2D(u_source, offset.yw);
      float sx = s.x / (s.x + s.y);
      float sy = s.z / (s.z + s.w);
      return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
  }

  void main() {
      vec2 css = gl_FragCoord.xy * u_cssPerPixel;
      vec4 blurred = sampleBSpline((css + u_offset) / u_texel);
      gl_FragColor = vec4(blurred.rgb + (1.0 - blurred.a) * BACKDROP, 1.0);
  }
`;

const fract = (value: number) => value - Math.floor(value);

/** Capsule endpoints, [ax, ay, az, bx, by, bz] per capsule. */
const endpoints = new Float64Array(CAPSULES * 6);

function put(
  index: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
) {
  const o = index * 6;
  endpoints[o] = ax;
  endpoints[o + 1] = ay;
  endpoints[o + 2] = az;
  endpoints[o + 3] = bx;
  endpoints[o + 4] = by;
  endpoints[o + 5] = bz;
}

/** The capsule placement from the original `map()`, ported term for term. */
function placeCapsules(t: number) {
  const { sin, cos } = Math;

  // central dense column — guarantees no empty void
  put(0, sin(t * 0.2) * 1.0, -100.0, cos(t * 0.3) * 1.0, sin(t * 0.4) * 1.0, 100.0, cos(t * 0.5) * 1.0);

  // drifting blobs spawn far outside the screen (-40..+40 vertical loop)
  let ax = sin(t * 0.5) * 3.0;
  let ay = -40.0 + fract(t * 0.15 + 0.0) * 80.0;
  let az = sin(t * 0.6) * 2.0;
  put(1, ax, ay, az, ax + cos(t * 0.7) * 3.0, ay + 6.0, az + sin(t * 0.5) * -2.0);

  ax = cos(t * 0.6) * -4.0;
  ay = -40.0 + fract(t * 0.17 + 0.3) * 80.0;
  az = cos(t * 0.4) * 1.5;
  put(2, ax, ay, az, ax + sin(t * 0.9) * 2.5, ay + 4.5, az + cos(t * 0.8) * 2.5);

  ax = sin(t * 0.4) * -3.5;
  ay = -40.0 + fract(t * 0.16 + 0.6) * 80.0;
  az = 0.0;
  put(3, ax, ay, az, ax + sin(t * 0.8) * 1.5, ay + 7.0, az + cos(t * 0.5) * -1.5);

  ax = cos(t * 0.8) * 4.5;
  ay = -40.0 + fract(t * 0.18 + 0.8) * 80.0;
  az = sin(t * 0.9) * -2.5;
  put(4, ax, ay, az, ax + cos(t * 1.1) * -2.0, ay + 3.5, az + sin(t * 1.2) * 2.0);

  ax = sin(t * 1.1) * -1.5;
  ay = -40.0 + fract(t * 0.2 + 0.1) * 80.0;
  az = cos(t * 0.7) * -1.5;
  put(5, ax, ay, az, ax + 4.0, ay + 1.0 + sin(t) * 2.0, az);

  ax = cos(t * 1.3) * -2.5;
  ay = -40.0 + fract(t * 0.19 + 0.5) * 80.0;
  az = sin(t * 1.2) * 1.5;
  put(6, ax, ay, az, ax, ay + 5.0, az);

  ax = sin(t * 0.9) * 2.5;
  ay = -40.0 + fract(t * 0.21 + 0.4) * 80.0;
  az = cos(t * 1.4) * -1.0;
  put(7, ax, ay, az, ax, ay + 3.0, az);

  ax = cos(t * 0.7) * 3.5;
  ay = -40.0 + fract(t * 0.14 + 0.7) * 80.0;
  az = sin(t * 0.5) * 1.5;
  put(8, ax, ay, az, ax + sin(t * 1.5) * -2.0, ay + 4.0, az + cos(t * 0.9) * 2.0);
}

/**
 * Packs the capsules the marched volume can reach, in their original order —
 * `smin` is not associative, so order is part of the look. The column is
 * always kept. A drifting capsule is dropped only when it sits wholly outside
 * the view frustum by more than its reach: there, `smin` would return the
 * running minimum unchanged, so skipping it shortens nothing but the work.
 */
function packCapsules(
  uvHalfX: number,
  uvHalfY: number,
  capA: Float32Array,
  capBA: Float32Array,
) {
  let count = 0;
  for (let index = 0; index < CAPSULES; index++) {
    const o = index * 6;
    const ax = endpoints[o];
    const ay = endpoints[o + 1];
    const az = endpoints[o + 2];
    const bx = endpoints[o + 3];
    const by = endpoints[o + 4];
    const bz = endpoints[o + 5];
    const radius = RADII[index];

    if (index > 0) {
      const reach = radius + CULL_REACH;
      // The frustum is widest at the capsule's deepest point.
      const depth = CAMERA_Z - Math.max(FAR_Z, Math.min(az, bz) - reach);
      if (depth > 0) {
        const halfX = depth * uvHalfX;
        const halfY = depth * uvHalfY;
        if (
          Math.min(ay, by) - reach > halfY ||
          Math.max(ay, by) + reach < -halfY ||
          Math.min(ax, bx) - reach > halfX ||
          Math.max(ax, bx) + reach < -halfX
        ) {
          continue;
        }
      }
    }

    const bax = bx - ax;
    const bay = by - ay;
    const baz = bz - az;
    const i = count * 4;
    capA[i] = ax;
    capA[i + 1] = ay;
    capA[i + 2] = az;
    capA[i + 3] = radius;
    capBA[i] = bax;
    capBA[i + 1] = bay;
    capBA[i + 2] = baz;
    capBA[i + 3] = 1 / (bax * bax + bay * bay + baz * baz);
    count++;
  }
  return count;
}

type Program = {
  program: WebGLProgram;
  uniform: (name: string) => WebGLUniformLocation | null;
};

type Target = {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
};

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
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

function linkProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentSource: string,
): Program | null {
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.bindAttribLocation(program, 0, "position");
  gl.linkProgram(program);
  // Flag the shader for deletion; it lives on until the program does.
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const locations = new Map<string, WebGLUniformLocation | null>();
  return {
    program,
    uniform: (name) => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      return locations.get(name) ?? null;
    },
  };
}

function createTarget(
  gl: WebGLRenderingContext,
  width: number,
  height: number,
): Target | null {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const complete =
    gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!complete) {
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    return null;
  }
  return { texture, framebuffer };
}

function deleteTarget(gl: WebGLRenderingContext, target: Target | null) {
  if (!target) return;
  gl.deleteFramebuffer(target.framebuffer);
  gl.deleteTexture(target.texture);
}

export type LavaRenderer = {
  /** Sizes the pipeline to the viewport, in CSS px. */
  resize: (width: number, height: number) => void;
  /** Index into `QUALITY_STEPS`; coarser march grids for struggling GPUs. */
  setQuality: (step: number) => void;
  /** Marches, blurs and presents one frame. `time` is in seconds. */
  render: (time: number, blueFocus: number) => void;
  dispose: () => void;
};

/** The page's canvas, or the same canvas handed to a worker. */
export type LavaCanvas = HTMLCanvasElement | OffscreenCanvas;

type GetWebGL = (
  contextId: "webgl",
  attributes: WebGLContextAttributes,
) => WebGLRenderingContext | null;

export function createLavaRenderer(canvas: LavaCanvas): LavaRenderer | null {
  // Both canvas kinds share this overload; TypeScript cannot call it through
  // the union directly.
  const gl = (canvas.getContext as GetWebGL).call(canvas, "webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) return null;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  if (!vertexShader) return null;
  const march = linkProgram(gl, vertexShader, MARCH_SHADER);
  const blur = linkProgram(gl, vertexShader, BLUR_SHADER);
  const final = linkProgram(gl, vertexShader, FINAL_SHADER);
  gl.deleteShader(vertexShader);
  if (!march || !blur || !final) {
    for (const program of [march, blur, final]) {
      if (program) gl.deleteProgram(program.program);
    }
    return null;
  }

  // One oversized triangle covers the viewport for every pass.
  const triangle = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.BLEND);
  gl.disable(gl.DEPTH_TEST);

  const capA = new Float32Array(CAPSULES * 4);
  const capBA = new Float32Array(CAPSULES * 4);

  let cssWidth = 0;
  let cssHeight = 0;
  let quality = 0;
  let texel = MIN_TEXEL;
  let bufferWidth = 0;
  let bufferHeight = 0;
  let boxWidth = 0;
  let boxHeight = 0;
  let uvScaleX = 1;
  let uvScaleY = 1;
  // `primary` holds the march and, after the vertical pass, the blur result.
  let primary: Target | null = null;
  let secondary: Target | null = null;

  const configure = () => {
    if (!cssWidth || !cssHeight) return;
    boxWidth = cssWidth + OVERSCAN * 2;
    boxHeight = cssHeight + OVERSCAN * 2;

    const baseTexel = Math.min(
      MAX_BASE_TEXEL,
      Math.max(MIN_TEXEL, Math.sqrt((boxWidth * boxHeight) / TARGET_MARCH_SAMPLES)),
    );
    texel = Math.min(MAX_TEXEL, baseTexel * QUALITY_STEPS[quality]);

    // The old shader's uv came from a backing store sized to the viewport
    // (capped at LEGACY_MAX_PIXELS) and stretched over the overscanned box.
    const legacyScale = Math.min(1, Math.sqrt(LEGACY_MAX_PIXELS / (cssWidth * cssHeight)));
    const legacyWidth = Math.max(1, Math.round(cssWidth * legacyScale));
    const legacyHeight = Math.max(1, Math.round(cssHeight * legacyScale));
    const legacyMin = Math.min(legacyWidth, legacyHeight);
    uvScaleX = legacyWidth / legacyMin;
    uvScaleY = legacyHeight / legacyMin;

    const canvasWidth = cssWidth + CANVAS_BLEED * 2;
    const canvasHeight = cssHeight + CANVAS_BLEED * 2;
    const finalScale = Math.min(1, Math.sqrt(FINAL_MAX_PIXELS / (canvasWidth * canvasHeight)));
    const finalWidth = Math.max(1, Math.round(canvasWidth * finalScale));
    const finalHeight = Math.max(1, Math.round(canvasHeight * finalScale));
    if (canvas.width !== finalWidth) canvas.width = finalWidth;
    if (canvas.height !== finalHeight) canvas.height = finalHeight;

    const width = Math.ceil((boxWidth + MARGIN * 2) / texel);
    const height = Math.ceil((boxHeight + MARGIN * 2) / texel);
    if (width !== bufferWidth || height !== bufferHeight || !primary || !secondary) {
      deleteTarget(gl, primary);
      deleteTarget(gl, secondary);
      primary = createTarget(gl, width, height);
      secondary = createTarget(gl, width, height);
      bufferWidth = width;
      bufferHeight = height;
    }
  };

  const drawBlur = (source: Target, destination: Target, axisX: number, axisY: number) => {
    // The B-spline upsample adds a variance of texel² / 3; take it out here
    // so the total spread still matches the 40px CSS blur.
    const sigma =
      Math.sqrt(Math.max(1, BLUR_SIGMA * BLUR_SIGMA - (texel * texel) / 3)) / texel;
    gl.bindFramebuffer(gl.FRAMEBUFFER, destination.framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform2f(blur.uniform("u_axis"), axisX, axisY);
    gl.uniform1f(blur.uniform("u_sigma"), sigma);
    gl.uniform1i(blur.uniform("u_radius"), Math.min(127, Math.ceil(sigma * 3)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    resize(width, height) {
      if (width === cssWidth && height === cssHeight) return;
      cssWidth = width;
      cssHeight = height;
      configure();
    },

    setQuality(step) {
      const next = Math.max(0, Math.min(QUALITY_STEPS.length - 1, step));
      if (next === quality) return;
      quality = next;
      configure();
    },

    render(time, blueFocus) {
      if (!primary || !secondary) return;
      const t = time * SPEED;
      placeCapsules(t);
      const capsuleCount = packCapsules(uvScaleX * 0.5, uvScaleY * 0.5, capA, capBA);

      gl.viewport(0, 0, bufferWidth, bufferHeight);
      gl.activeTexture(gl.TEXTURE0);

      gl.useProgram(march.program);
      gl.bindFramebuffer(gl.FRAMEBUFFER, primary.framebuffer);
      gl.uniform4fv(march.uniform("u_capA"), capA);
      gl.uniform4fv(march.uniform("u_capBA"), capBA);
      gl.uniform1i(march.uniform("u_capCount"), capsuleCount);
      gl.uniform1f(march.uniform("u_t"), t);
      gl.uniform1f(march.uniform("u_blue_focus"), blueFocus);
      gl.uniform1f(march.uniform("u_texel"), texel);
      gl.uniform2f(march.uniform("u_box"), boxWidth, boxHeight);
      gl.uniform2f(march.uniform("u_uvScale"), uvScaleX, uvScaleY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.useProgram(blur.program);
      gl.uniform1i(blur.uniform("u_source"), 0);
      gl.uniform2f(blur.uniform("u_invSize"), 1 / bufferWidth, 1 / bufferHeight);
      drawBlur(primary, secondary, 1, 0);
      drawBlur(secondary, primary, 0, 1);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(final.program);
      gl.bindTexture(gl.TEXTURE_2D, primary.texture);
      gl.uniform1i(final.uniform("u_source"), 0);
      gl.uniform2f(final.uniform("u_sourceSize"), bufferWidth, bufferHeight);
      gl.uniform2f(
        final.uniform("u_cssPerPixel"),
        (cssWidth + CANVAS_BLEED * 2) / canvas.width,
        (cssHeight + CANVAS_BLEED * 2) / canvas.height,
      );
      gl.uniform1f(final.uniform("u_texel"), texel);
      gl.uniform1f(final.uniform("u_offset"), OVERSCAN + MARGIN - CANVAS_BLEED);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    dispose() {
      deleteTarget(gl, primary);
      deleteTarget(gl, secondary);
      primary = null;
      secondary = null;
      gl.deleteBuffer(triangle);
      gl.deleteProgram(march.program);
      gl.deleteProgram(blur.program);
      gl.deleteProgram(final.program);
    },
  };
}

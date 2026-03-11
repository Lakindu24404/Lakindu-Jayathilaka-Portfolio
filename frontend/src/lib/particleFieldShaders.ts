/**
 * Shaders for the radial dash field (see `ParticleField`).
 *
 * Written against GLSL ES 1.00 so one pair of shaders runs on both WebGL 1
 * and WebGL 2 contexts.
 *
 * Space: `aRef` is a Poisson point in *field space*, where the canvas height
 * spans ±`FIELD_HALF_HEIGHT`. The ring radius, widths and noise frequencies
 * are all expressed in that space, which is what keeps the look identical at
 * every viewport size — only how much of the field is on screen changes.
 */

/** Ashima Arts / Ian McEwan simplex noise (MIT, github.com/ashima/webgl-noise). */
const SIMPLEX_3D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

/**
 * One vertex per particle. Everything — displacement, scale, dash angle and
 * colour — is a pure function of the particle's rest position and the clock,
 * so there is no simulation state to keep and the motion is frame-rate
 * independent.
 *
 * The reference feeds positions through a ping-pong framebuffer, reading back
 * last frame's *output* position each time:
 *
 *   pos   = 0.8 * prevOut + push
 *   out   = ref + disp + 0.25 * pos
 *
 * which settles at `out = 1.25 * (ref + disp) + 0.3125 * push` — a 1.25×
 * zoom on the field plus a fraction of the push. Solving it in closed form
 * here costs one multiply instead of a second render target. The velocity
 * trail (`v = 0.5v + 0.25s`) settles at half the scale the same way.
 */
export const VERTEX_SHADER = /* glsl */ `
precision highp float;

attribute vec2 aRef;

uniform float uTime;
uniform vec2 uRing;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uRingWidth2;
uniform float uRingDisplacement;
uniform float uAspect;
uniform float uFieldScale;
uniform float uPointScale;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uDarken;

varying float vScale;
varying float vAngle;
varying vec3 vColor;

${SIMPLEX_3D}

/** Field zoom baked into the reference's position feedback (see above). */
#define FIELD_ZOOM 1.25

void main() {
  vec2 ref = aRef;
  float time = uTime * 0.5;

  // --- Ring bands -----------------------------------------------------
  float dist = distance(ref, uRing);
  float noise0 = snoise(vec3(ref * 0.2 + vec2(18.4924, 72.9744), time * 0.5));
  float dist1 = distance(ref + noise0 * 0.005, uRing);

  float t = smoothstep(uRingRadius - (uRingWidth * 2.0), uRingRadius, dist)
          - smoothstep(uRingRadius, uRingRadius + uRingWidth, dist1);
  float t2 = smoothstep(uRingRadius - (uRingWidth2 * 2.0), uRingRadius, dist)
           - smoothstep(uRingRadius, uRingRadius + uRingWidth2, dist1);
  float t3 = smoothstep(uRingRadius + uRingWidth2, uRingRadius, dist);

  t = pow(max(t, 0.0), 2.0);
  t2 = pow(max(t2, 0.0), 3.0);

  t += t2 * 3.0;
  t += t3 * 0.4;
  t += snoise(vec3(ref * 30.0 + vec2(11.4924, 12.9744), time * 0.5)) * t3 * 0.5;

  // Ambient scale, so the field never goes fully quiet outside the ring.
  float nS = snoise(vec3(ref * 2.0 + vec2(18.4924, 72.9744), time * 0.5));
  t += pow((nS + 1.5) * 0.5, 2.0) * 0.6;

  // --- Drift ----------------------------------------------------------
  float noise1 = snoise(vec3(ref * 4.0 + vec2(88.494, 32.4397), time * 0.35));
  float noise2 = snoise(vec3(ref * 4.0 + vec2(50.904, 120.947), time * 0.35));
  float noise3 = snoise(vec3(ref * 20.0 + vec2(18.4924, 72.9744), time * 0.5));
  float noise4 = snoise(vec3(ref * 20.0 + vec2(50.904, 120.947), time * 0.5));

  vec2 disp = vec2(noise1, noise2) * 0.03;
  disp += vec2(noise3, noise4) * 0.005;
  disp.x += sin((ref.x * 20.0) + (time * 4.0)) * 0.02 * clamp(dist, 0.0, 1.0);
  disp.y += cos((ref.y * 20.0) + (time * 3.0)) * 0.02 * clamp(dist, 0.0, 1.0);

  // Steady state of the reference's feedback push, outward from the ring.
  vec2 push = (ref + disp - uRing) * pow(t2, 0.75) * uRingDisplacement * 0.3125;
  vec2 pos = (ref + disp) * FIELD_ZOOM + push;

  // --- Per-particle look ----------------------------------------------
  float noiseAngle = snoise(vec3(ref * 10.0 + vec2(18.4924, 72.9744), uTime * 0.85));
  float noiseColor = snoise(vec3(ref * 2.0 + vec2(74.664, 91.556), uTime * 0.5));
  noiseColor = (noiseColor + 1.0) * 0.5;

  float h = 0.8;
  float progress = smoothstep(0.0, 0.75, pow(noiseColor, 2.0));
  vec3 color = mix(
    mix(uColor1, uColor2, progress / h),
    mix(uColor2, uColor3, (progress - h) / (1.0 - h)),
    step(h, progress)
  );

  // Velocity trail settles at half the scale; on a light ground it reads as
  // "slower particles sit further back".
  float velocity = t * 0.5;
  vColor = mix(clamp(color, 0.0, 1.0), clamp(color, 0.0, 1.0) * clamp(velocity, 0.0, 1.0), uDarken);

  // Dashes lie along the radius out of the ring centre, with a little wobble.
  vAngle = -atan(ref.y - uRing.y, ref.x - uRing.x) + (noiseAngle * 0.5);
  vScale = t;

  vec2 unit = pos * uFieldScale;
  gl_Position = vec4(unit.x / uAspect, unit.y, 0.0, 1.0);
  gl_PointSize = clamp(vScale * uPointScale, 0.0, 64.0);
}
`;

/** A rounded capsule inside the point sprite, rotated to face outward. */
export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uAlpha;

varying float vScale;
varying float vAngle;
varying vec3 vColor;

float sdRoundBox(in vec2 p, in vec2 b, in float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

vec2 rotate(vec2 v, float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, s, -s, c) * v;
}

void main() {
  vec2 uv = gl_PointCoord.xy - vec2(0.5);
  uv.y *= -1.0;
  uv = rotate(uv, vAngle);

  float dash = sdRoundBox(uv, vec2(0.5, 0.2), 0.25);
  dash = smoothstep(0.1, 0.0, dash);

  float a = uAlpha * dash * smoothstep(0.1, 0.2, vScale);
  if (a < 0.01) discard;

  gl_FragColor = vec4(vColor, clamp(a, 0.0, 1.0));
}
`;

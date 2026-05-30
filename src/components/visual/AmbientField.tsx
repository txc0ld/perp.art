"use client";

/**
 * AmbientField - ambient atmospheric depth behind hero/auth surfaces (design prompt §7).
 *
 * A performant, raw-WebGL full-screen fragment shader: a slow, dark, "engineered
 * nebula" - deep-space dust + a faint volumetric gradient + a barely-there
 * particle lattice. Near-black (#050505 base), very low contrast, with a whisper
 * of orchid-pink (#fe93ed) and a cool surface tone drifting in at ~8% intensity.
 *
 * It is ALWAYS a supporting background layer (pointer-events: none). Content above.
 *
 * Resilience / performance (all mandatory, all guarded in useEffect so SSR only
 * ever emits the static fallback markup):
 *   - Caps device pixel ratio at 1.5.
 *   - Pauses the RAF when the tab is hidden (visibilitychange) AND when the
 *     canvas is scrolled offscreen (IntersectionObserver). Resumes when visible.
 *   - Respects prefers-reduced-motion: renders ONE static frame, never animates.
 *   - Falls back to a static CSS radial-gradient if WebGL is unavailable or the
 *     context is lost - identical look to the original stub.
 *   - Handles resize via ResizeObserver; cleans up every listener, the RAF, and
 *     the GL program/buffers on unmount.
 *
 * Export signature is load-bearing - several pages import { AmbientField } and
 * the default. Do not change it.
 */

import * as React from "react";

// The static fallback - identical to the original stub, also used as the SSR/
// reduced-motion/no-WebGL background underneath the canvas.
const FALLBACK_GRADIENT =
  "radial-gradient(120% 80% at 50% 0%, #15140f 0%, #0a0a0b 45%, #050505 100%)";

// ---------------------------------------------------------------------------
// GLSL
// ---------------------------------------------------------------------------

// Minimal pass-through vertex shader for a single full-screen triangle.
const VERT_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Fragment shader. Layered value-noise (fbm) builds a soft volumetric "dust"
// field; a faint lattice adds the engineered-particle signal; two tints (cool
// surface + orchid pink) drift through at very low intensity. Everything is
// deliberately near-black and low-contrast - a whisper, not a light show.
const FRAG_SRC = `
precision highp float;

uniform vec2  u_res;    // canvas resolution (px)
uniform float u_time;   // accumulating seconds
uniform float u_motion; // 1.0 animated, 0.0 static (reduced-motion)

// --- hash / value noise -----------------------------------------------------
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  // smootherstep for soft, organic gradients
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian motion - stacked octaves of value noise.
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80); // de-correlate octaves
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = rot * p * 2.0;
    amp *= 0.5;
  }
  return v;
}

void main() {
  // Aspect-corrected, centered coords so the field doesn't stretch on resize.
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 p = uv;
  p.x *= u_res.x / u_res.y;

  float t = u_time * 0.02 * u_motion; // very slow drift

  // Domain-warp the noise so the dust folds over itself organically.
  vec2 q = vec2(fbm(p * 1.6 + vec2(0.0, t)),
                fbm(p * 1.6 + vec2(5.2, -t)));
  float dust = fbm(p * 2.4 + q * 1.4 + vec2(t * 0.5, 0.0));

  // Faint engineered particle lattice - a slowly drifting dot grid, masked so
  // it only reads in the upper field and never becomes a hard pattern.
  vec2 g = p * 14.0 + vec2(t * 0.8, t * 0.3);
  vec2 cell = fract(g) - 0.5;
  float dots = smoothstep(0.06, 0.0, length(cell));
  float latticeMask = smoothstep(1.0, 0.2, uv.y) * 0.5;
  float lattice = dots * latticeMask;

  // Base near-black canvas (#050505).
  vec3 col = vec3(0.0196, 0.0196, 0.0196);

  // Cool surface-tone haze low in the field.
  vec3 cool = vec3(0.094, 0.094, 0.106); // ~#18181B
  col = mix(col, cool, dust * 0.5);

  // Orchid-pink whisper, strongest toward the top-center, gated by the dust
  // so it pools in the denser wisps rather than washing flat.
  vec3 accent = vec3(0.996, 0.576, 0.929); // #fe93ed
  float accentField = smoothstep(0.85, 0.15, distance(uv, vec2(0.5, 0.0)));
  col += accent * accentField * dust * 0.06; // ~8% peak intensity

  // Lattice picks up a touch of the accent as engineered glints.
  col += accent * lattice * 0.05;

  // Gentle top-down vignette so content above always sits on the darkest area.
  float vignette = smoothstep(1.15, 0.1, length((uv - vec2(0.5, 0.18)) * vec2(1.0, 1.3)));
  col *= mix(0.65, 1.0, vignette);

  // A faint film grain to kill banding in the deep darks.
  float grain = (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.012;
  col += grain;

  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// GL helpers
// ---------------------------------------------------------------------------

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function buildProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vert = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
  const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vert || !frag) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  // Shaders are linked into the program; flag for delete so they free with it.
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AmbientField({ className }: { className?: string }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  // When true, hide the canvas and show only the CSS fallback.
  const [degraded, setDegraded] = React.useState(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Reduced-motion: render exactly one static frame, never animate.
    const reduceMotionQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const prefersReducedMotion = reduceMotionQuery?.matches ?? false;

    // Acquire a context. Bail to the CSS fallback if unavailable.
    const gl = (canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
      failIfMajorPerformanceCaveat: false,
    }) ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;

    if (!gl) {
      setDegraded(true);
      return;
    }

    const program = buildProgram(gl);
    if (!program) {
      setDegraded(true);
      return;
    }

    // Full-screen triangle (covers the clip space with one primitive).
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );

    const aPos = gl.getAttribLocation(program, "a_pos");
    const uRes = gl.getUniformLocation(program, "u_res");
    const uTime = gl.getUniformLocation(program, "u_time");
    const uMotion = gl.getUniformLocation(program, "u_motion");

    gl.useProgram(program);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(uMotion, prefersReducedMotion ? 0 : 1);

    // ---- sizing ----
    const cap = 1.5; // cap pixel ratio for performance
    function resize() {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, cap);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }

    // ---- render ----
    let raf = 0;
    let running = false;
    let startTime = 0;
    let accumulated = 0; // seconds of elapsed animation, paused-aware

    function drawFrame(seconds: number) {
      if (!gl) return;
      gl.uniform1f(uTime, seconds);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function loop(now: number) {
      if (!running) return;
      accumulated = (now - startTime) / 1000;
      drawFrame(accumulated);
      raf = window.requestAnimationFrame(loop);
    }

    // Visibility gating: animate only when the tab is visible, the canvas is
    // onscreen, and motion is allowed.
    let tabVisible = !document.hidden;
    let onScreen = true;

    function shouldRun() {
      return !prefersReducedMotion && tabVisible && onScreen;
    }

    function start() {
      if (running || !shouldRun()) return;
      running = true;
      // Offset start so the accumulated clock resumes where it paused.
      startTime = performance.now() - accumulated * 1000;
      raf = window.requestAnimationFrame(loop);
    }

    function stop() {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    }

    function evaluate() {
      if (shouldRun()) start();
      else stop();
    }

    // ---- observers + listeners ----
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            resize();
            // Repaint a static frame even while paused so resizes don't tear.
            if (!running) drawFrame(accumulated);
          })
        : null;
    resizeObserver?.observe(canvas);

    const intersectionObserver =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              onScreen = entries.some((e) => e.isIntersecting);
              evaluate();
            },
            { threshold: 0 },
          )
        : null;
    intersectionObserver?.observe(canvas);

    function onVisibility() {
      tabVisible = !document.hidden;
      evaluate();
    }
    document.addEventListener("visibilitychange", onVisibility);

    function onMotionChange() {
      // If the user toggles reduced-motion live, repaint static and stop.
      gl?.uniform1f(uMotion, reduceMotionQuery?.matches ? 0 : 1);
      evaluate();
      if (reduceMotionQuery?.matches) {
        stop();
        resize();
        drawFrame(accumulated);
      }
    }
    reduceMotionQuery?.addEventListener?.("change", onMotionChange);

    // Graceful degradation if the GPU drops the context.
    function onContextLost(e: Event) {
      e.preventDefault();
      stop();
      setDegraded(true);
    }
    canvas.addEventListener("webglcontextlost", onContextLost);

    // ---- first paint ----
    resize();
    if (prefersReducedMotion) {
      // One static frame, no loop.
      drawFrame(0);
    } else {
      drawFrame(0); // immediate content while RAF spins up
      evaluate();
    }

    // ---- cleanup ----
    return () => {
      stop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotionQuery?.removeEventListener?.("change", onMotionChange);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      // Free GL resources.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        // The CSS gradient is always present beneath the canvas. It is the SSR
        // markup, the reduced-motion/no-WebGL fallback, and a backstop tone if
        // the canvas ever shows nothing - so there is never a flash of black.
        background: FALLBACK_GRADIENT,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {!degraded ? (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      ) : null}
    </div>
  );
}

export default AmbientField;

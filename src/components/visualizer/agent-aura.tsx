"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";

import { useAgentActivityStore } from "@/lib/stores/agent-activity-store";

/**
 * Background "aura": a gradient glow that hugs the viewport edges and comes
 * alive while the agent is thinking or streaming a reply (text or voice).
 * Phase + live audio amplitude are read from `agent-activity-store`.
 */

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Fill clip space directly so the quad always covers the screen,
    // independent of the camera.
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uPresence;    // eased 0..1 overall presence (kept subtle)
  uniform float uAudio;       // eased 0..1 live agent audio amplitude
  uniform float uFlPhase;     // integrated shimmer phase (see JS: phase += speed*dt)
  uniform float uColorShift;  // integrated palette drift, quickens with impulses
  uniform float uReduceMotion;
  uniform vec2  uResolution;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.02 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  // Smooth multicolor ramp: indigo -> azure -> teal -> violet -> rose.
  // Intentionally NOT the blue/purple Gemini palette; teal + rose set it apart.
  vec3 palette(float t) {
    t = fract(t);
    vec3 c0 = vec3(0.28, 0.26, 0.80);
    vec3 c1 = vec3(0.18, 0.55, 0.95);
    vec3 c2 = vec3(0.15, 0.80, 0.70);
    vec3 c3 = vec3(0.62, 0.34, 0.95);
    vec3 c4 = vec3(0.98, 0.42, 0.68);
    vec3 c = mix(c0, c1, smoothstep(0.0, 0.28, t));
    c = mix(c, c2, smoothstep(0.24, 0.5, t));
    c = mix(c, c3, smoothstep(0.5, 0.72, t));
    c = mix(c, c4, smoothstep(0.7, 0.95, t));
    c = mix(c, c0, smoothstep(0.93, 1.0, t));
    return c;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = uv * vec2(aspect, 1.0);

    float motion = 1.0 - uReduceMotion * 0.85;
    float t = uTime * motion;

    // Domain warping -> organic, irregular (but smooth) field.
    float warpAmt = 0.24 + 0.18 * uPresence;
    vec2 warp = vec2(
      fbm(p * 2.2 + vec2(0.0, t * 0.045)),
      fbm(p * 2.2 + vec2(6.4, t * 0.038))
    );
    float n = fbm(p * 1.7 + warp * warpAmt + vec2(t * 0.022, 0.0));

    // Distance from a ROUNDED rectangle border (signed-distance to a round box)
    // so the glow curves smoothly around the corners instead of creasing where
    // the x and y bands meet. Identical to min-of-edges along the straight runs.
    float cornerR = 0.08;
    vec2 q = abs(uv - 0.5) - (vec2(0.5) - cornerR);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cornerR;
    float edge = -sd; // 0 at the rounded border, grows inward

    // Irregular, organic border thickness driven by the same field, so the
    // glow swells and recedes around the perimeter instead of a uniform band.
    float thick = 0.17 + 0.12 * n;
    float band = pow(1.0 - clamp(edge / thick, 0.0, 1.0), 2.3);

    // Multicolor coordinate. The palette drifts via an integrated phase
    // (uColorShift) that quickens with impulses, and audio subtly rescales the
    // noise so the *proportions* of each colour shift, not just their position.
    float ct = n * (1.05 + 0.30 * uAudio)
             + 0.18 * (uv.x - uv.y)
             + 0.10 * uPresence
             + uColorShift;
    vec3 col = palette(ct);

    // Randomized but smooth waving: fbm sampled along the integrated phase axis
    // (uFlPhase), with neighbouring regions rippling independently so it never
    // looks periodic. High floor keeps it from blinking to invisible.
    float wave = fbm(vec2(n * 2.4 + (uv.x - uv.y) * 1.3, uFlPhase));
    float wave2 = fbm(vec2(n * 1.2 - (uv.x + uv.y) * 0.8, uFlPhase * 0.6 + 4.0));
    float fl = 0.70 + 0.42 * mix(wave, wave2, 0.5);

    float baseAlpha = 0.92;
    float alpha = band * uPresence * baseAlpha * fl;
    alpha *= 1.0 + 0.3 * uAudio;
    alpha = clamp(alpha, 0.0, 0.78);

    col *= 0.8 + 0.35 * fl;

    // Premultiplied alpha (matches the default WebGL context).
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

// Gentle, symmetric fade so appearing/disappearing feels calm (not a pop).
const PRESENCE_EASE_RATE = 1.7;
const AUDIO_EASE_RATE = 10;
// Keep rendering long enough for the slow fade-out to fully settle to ~0.
const FADE_OUT_TAIL_MS = 2600;

function subscribeReducedMotion(callback: () => void): () => void {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function createUniforms() {
  return {
    uTime: { value: 0 },
    uPresence: { value: 0 },
    uAudio: { value: 0 },
    uFlPhase: { value: 0 },
    uColorShift: { value: 0 },
    uReduceMotion: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  };
}

function AuraQuad({ reduceMotion }: { reduceMotion: boolean }) {
  const { size } = useThree();
  const intensityRef = useRef(0);
  const audioRef = useRef(0);
  const flPhaseRef = useRef(0);
  const colorPhaseRef = useRef(0);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Stable uniforms object: created once, mutated only via the material ref.
  const [uniforms] = useState(createUniforms);

  useEffect(() => {
    const material = materialRef.current;
    if (material) {
      material.uniforms.uResolution.value.set(size.width, size.height);
    }
  }, [size.width, size.height]);

  useEffect(() => {
    const material = materialRef.current;
    if (material) {
      material.uniforms.uReduceMotion.value = reduceMotion ? 1 : 0;
    }
  }, [reduceMotion]);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) {
      return;
    }

    // Dev-only: recover from Fast Refresh leaving stale uniform keys in `useState`.
    if (
      process.env.NODE_ENV === "development" &&
      (material.uniforms.uPresence === undefined ||
        material.uniforms.uColorShift === undefined)
    ) {
      const fresh = createUniforms();
      fresh.uResolution.value.set(size.width, size.height);
      fresh.uReduceMotion.value = reduceMotion ? 1 : 0;
      material.uniforms = fresh;
    }

    const dt = Math.min(delta, 0.05);
    const { phase, audioLevel } = useAgentActivityStore.getState();

    // Kept deliberately low: the aura is an ambient hint, not a spotlight.
    const target =
      phase === "responding" ? 0.72 : phase === "thinking" ? 0.5 : 0.0;

    intensityRef.current +=
      (target - intensityRef.current) * (1 - Math.exp(-dt * PRESENCE_EASE_RATE));
    audioRef.current +=
      (audioLevel - audioRef.current) * (1 - Math.exp(-dt * AUDIO_EASE_RATE));

    const audio = phase === "responding" ? audioRef.current : 0;

    // Integrate the shimmer + colour-drift phases so their speed can change
    // smoothly without a frequency lurch while presence ramps in / out. Both
    // quicken on impulses (presence + audio); colour drifts more slowly.
    const motionFactor = reduceMotion ? 0.15 : 1.0;
    const flSpeed =
      (0.1 + 0.4 * intensityRef.current + 0.55 * audio) * motionFactor;
    const colorSpeed =
      (0.012 + 0.05 * intensityRef.current + 0.12 * audio) * motionFactor;
    flPhaseRef.current += flSpeed * dt;
    colorPhaseRef.current += colorSpeed * dt;

    const u = material.uniforms;
    u.uTime.value += dt;
    u.uPresence.value = intensityRef.current;
    u.uAudio.value = audio;
    u.uFlPhase.value = flPhaseRef.current;
    u.uColorShift.value = colorPhaseRef.current;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export function AgentAura() {
  const reduceMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(false);

  // Render only while the agent is busy (plus a short tail for the fade-out),
  // so the GPU is idle on a quiet page.
  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;

    const evaluate = (phase: string) => {
      if (phase !== "idle") {
        clearTimeout(fadeTimer);
        setActive(true);
        return;
      }
      fadeTimer = setTimeout(() => setActive(false), FADE_OUT_TAIL_MS);
    };

    evaluate(useAgentActivityStore.getState().phase);
    const unsubscribe = useAgentActivityStore.subscribe((state, prev) => {
      if (state.phase !== prev.phase) {
        evaluate(state.phase);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, premultipliedAlpha: true }}
        orthographic
        camera={{ position: [0, 0, 1] }}
      >
        <AuraQuad reduceMotion={reduceMotion} />
      </Canvas>
    </div>
  );
}

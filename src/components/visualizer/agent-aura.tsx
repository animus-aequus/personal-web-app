"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useAgentActivityStore } from "@/lib/stores/agent-activity-store";
import { buildAuraPaletteGlsl } from "@/lib/visualizer/aura-palette";

/**
 * Background "aura": a gradient glow that hugs the chat panel edges and comes
 * alive while the agent is thinking or streaming a reply (text or voice).
 * Phase + live audio amplitude are read from `agent-activity-store`.
 *
 * Mounted inside the chat panel stacking context above the semi-transparent
 * chrome wash (so the message-fade trick is not revealed through the glow)
 * but below the interactive control bar. Always `pointer-events-none`.
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

const FRAGMENT_SHADER_HEAD = /* glsl */ `
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

  // Ocean Tide ramp — colors from lib/visualizer/aura-palette.
`;

const FRAGMENT_SHADER_TAIL = /* glsl */ `

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = uv * vec2(aspect, 1.0);

    float motion = 1.0 - uReduceMotion * 0.85;
    float t = uTime * motion;
    // Horizontal current: always a calm baseline while visible, plus presence boost.
    // Avoids a "frozen" look during stream gaps (no tokens / no audio).
    float flow = t * (0.055 + 0.09 * uPresence);
    vec2 flowVec = vec2(flow * 1.15, flow * 0.22);

    // Domain warping -> soft organic water field (secondary to sine swell/ripples).
    float warpAmt = 0.22 + 0.28 * uPresence;
    vec2 warp = vec2(
      fbm(p * 2.0 + vec2(flowVec.x * 1.1, 0.0)),
      fbm(p * 2.0 + vec2(5.8, flowVec.x * 0.55))
    );
    float n = fbm(p * 1.55 + warp * warpAmt + flowVec * vec2(1.0, 0.35));

    // Distance from a ROUNDED rectangle border (signed-distance to a round box)
    // so the glow curves smoothly around the corners instead of creasing where
    // the x and y bands meet. Identical to min-of-edges along the straight runs.
    float cornerR = 0.08;
    vec2 q = abs(uv - 0.5) - (vec2(0.5) - cornerR);
    float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - cornerR;
    float edge = -sd; // 0 at the rounded border, grows inward

    // Perimeter coordinate for layered ocean waves (swell + ripples).
    // uTime (t) keeps a default tide alive even when uFlPhase boosts are quiet.
    float along = uv.x * 1.15 + uv.y * 0.35;
    float swell = sin(along * 6.28318 * 0.55 + uFlPhase * 0.85 + t * 0.55)
                + 0.45 * sin(along * 6.28318 * 0.28 - uFlPhase * 0.4 + t * 0.32);
    float ripples = sin(along * 6.28318 * 2.1 + uFlPhase * 2.4 + n * 3.0 + t * 1.1)
                  * (0.55 + 0.45 * uPresence);
    float tide = 0.55 * swell + 0.35 * ripples;

    // Band thickness swells like surf along the perimeter.
    float thick = 0.16 + 0.11 * n + 0.05 * tide + 0.04 * uAudio;
    float edgeWaved = edge - 0.025 * tide;
    float band = pow(1.0 - clamp(edgeWaved / thick, 0.0, 1.0), 2.3);

    // Caustics-lite: hue shear rides the tide phase, not a rigid diagonal gradient.
    float colorNoise = fbm(vec2(along * 2.2 + n * 1.0 + tide * 0.8, uColorShift * 1.35));
    float ct = n * (1.2 + 0.35 * uAudio + 0.4 * uPresence)
             + along * 0.75
             + 0.7 * uColorShift
             + 0.45 * colorNoise
             + 0.22 * tide;
    vec3 col = palette(ct);

    // Soft luminance ripple (high floor so the glow never blinks out).
    float wave = fbm(vec2(n * 2.2 + along * 1.1, uFlPhase * 0.9));
    float wave2 = fbm(vec2(n * 1.1 - along * 0.7, uFlPhase * 0.65 + 4.0));
    float fl = 0.64 + 0.28 * mix(wave, wave2, 0.5) + 0.18 * (0.5 + 0.5 * tide);

    float baseAlpha = 0.92;
    float alpha = band * uPresence * baseAlpha * fl;
    alpha *= 1.0 + 0.3 * uAudio;
    alpha = clamp(alpha, 0.0, 0.78);

    col *= 0.8 + 0.35 * fl;

    // Premultiplied alpha (matches the default WebGL context).
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

const FRAGMENT_SHADER =
  FRAGMENT_SHADER_HEAD + buildAuraPaletteGlsl() + FRAGMENT_SHADER_TAIL;

// Gentle, symmetric fade so appearing/disappearing feels calm (not a pop).
const PRESENCE_EASE_RATE = 1.7;
const AUDIO_EASE_RATE = 10;
// Keep rendering long enough for the slow fade-out to fully settle to ~0.
const FADE_OUT_TAIL_MS = 2600;

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
    // Text streaming has no audioLevel — drive motion from presence/phase too.
    const respondingBoost = phase === "responding" ? 1 : 0;
    // Calmer tide while thinking; quicker swell when responding / audio.
    const thinkingCalm = phase === "thinking" ? 0.72 : 1.0;

    // Integrate the shimmer + colour-drift phases so their speed can change
    // smoothly without a frequency lurch while presence ramps in / out.
    const motionFactor = reduceMotion ? 0.15 : 1.0;
    const intensity = intensityRef.current;
    // Calm default tide whenever the glow is on screen — stream token gaps and
    // TTS pauses must not look like a freeze (boosts only add energy on top).
    const visible = intensity > 0.02 ? 1 : 0;
    const flSpeed =
      (0.28 * visible +
        0.45 * intensity +
        0.7 * audio +
        0.35 * respondingBoost) *
      motionFactor *
      thinkingCalm;
    const colorSpeed =
      (0.1 * visible +
        0.14 * intensity +
        0.22 * audio +
        0.18 * respondingBoost) *
      motionFactor *
      thinkingCalm;
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
    <div
      aria-hidden
      data-agent-aura
      className="absolute inset-0 z-[18] [&_canvas]:pointer-events-none [&_div]:pointer-events-none"
      style={{ pointerEvents: "none" }}
    >
      <Canvas
        style={{ pointerEvents: "none" }}
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, premultipliedAlpha: true }}
        orthographic
        camera={{ position: [0, 0, 1] }}
        onCreated={({ gl }) => {
          gl.domElement.style.pointerEvents = "none";
          const root = gl.domElement.parentElement;
          if (root) {
            root.style.pointerEvents = "none";
          }
        }}
      >
        <AuraQuad reduceMotion={reduceMotion} />
      </Canvas>
    </div>
  );
}

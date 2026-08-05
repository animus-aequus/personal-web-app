"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";

import { AURA_PALETTE } from "@/lib/visualizer/aura-palette";

/**
 * Low-tier greeting backdrop: a soft centered radial aura (the inverse of the
 * edge-hugging AgentAura). One fullscreen shader quad — much cheaper than the
 * 3D water blob, still alive with gentle shimmer and drift.
 *
 * Colors: oceanic mid + turquoise from the shared Ocean Tide / brand palette.
 */

/** Oceanic mid ≈ logo #0099FF */
const OCEAN_RGB = AURA_PALETTE[1].rgb;
/** Turquoise–ocean hero mid */
const TURQUOISE_RGB = AURA_PALETTE[2].rgb;

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform float uTime;
  uniform float uScale;
  uniform vec2  uResolution;
  uniform vec3  uOcean;
  uniform vec3  uTurquoise;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    return 0.65 * noise(p) + 0.35 * noise(p * 2.07 + 3.1);
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 uv = (vUv - vec2(0.5, 0.48)) * vec2(aspect, 1.0);

    float t = uTime;

    vec2 warp = vec2(
      fbm(uv * 1.4 + vec2(t * 0.18, t * 0.14)),
      fbm(uv * 1.4 + vec2(4.1, -t * 0.15))
    );
    vec2 p = uv + (warp - 0.5) * 0.2 * uScale;

    vec2 center = vec2(
      0.06 * uScale * sin(t * 0.7),
      0.052 * uScale * cos(t * 0.58)
    );
    float dist = length(p - center);

    // Calm breath — the whole disc gently expands / contracts.
    float breath = 1.0 + 0.11 * sin(t * 1.25);
    float extent = 0.55 * uScale * breath;

    float fill = 1.0 - smoothstep(0.0, extent, dist);
    fill = pow(fill, 1.3);

    // Soft radial waves traveling outward (radiate), without carving a hollow.
    float waveA = sin(dist * 14.0 - t * 2.4);
    float waveB = sin(dist * 8.0 - t * 1.65 + 1.3);
    float radiate = 1.0 + 0.18 * waveA + 0.12 * waveB;
    // Stronger on the mid/outer disc so motion reads as emission from the core.
    float waveMask = smoothstep(0.04 * uScale, 0.42 * uScale, dist);
    fill *= mix(1.0, radiate, waveMask);

    float caustic = fbm(p * 2.5 + vec2(t * 0.42, -t * 0.34) + warp);
    float edge = smoothstep(0.0, extent * 0.85, dist);

    float pulse = 0.9 + 0.1 * sin(t * 1.1);
    float oceanW = fill * (0.52 + 0.14 * caustic) * (1.0 - 0.4 * edge) * pulse;
    float turqW = fill * (0.24 + 0.18 * caustic) * (0.35 + 0.65 * edge) * pulse;

    vec3 premul = uOcean * oceanW + uTurquoise * turqW;
    float alpha = clamp(oceanW + turqW, 0.0, 0.68);

    gl_FragColor = vec4(premul, alpha);
  }
`;

const LAPTOP_VIEWPORT = { width: 1440, height: 900 };

function scaleForScreen(width: number, height: number): number {
  const factor = Math.sqrt(
    (width / LAPTOP_VIEWPORT.width) * (height / LAPTOP_VIEWPORT.height),
  );
  return THREE.MathUtils.clamp(factor, 0.55, 1.35);
}

function subscribePageVisible(callback: () => void): () => void {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribePageVisible,
    () => document.visibilityState === "visible",
    () => true,
  );
}

function createUniforms() {
  return {
    uTime: { value: 0 },
    uScale: { value: 1 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uOcean: { value: new THREE.Vector3(...OCEAN_RGB) },
    uTurquoise: { value: new THREE.Vector3(...TURQUOISE_RGB) },
  };
}

function RadialAuraQuad() {
  const { size } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => createUniforms(), []);

  useEffect(() => {
    const material = materialRef.current;
    if (!material) {
      return;
    }
    material.uniforms.uResolution.value.set(size.width, size.height);
    material.uniforms.uScale.value = scaleForScreen(size.width, size.height);
  }, [size.width, size.height]);

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) {
      return;
    }
    const dt = Math.min(delta, 0.08);
    material.uniforms.uTime.value += dt * 1.45;
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

/** Cap redraws — full-viewport WebGL at 60fps dominates GPU more than shader complexity. */
const RADIAL_AURA_FPS = 24;

function RadialAuraFrameDriver({ enabled }: { enabled: boolean }) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = window.setInterval(
      () => invalidate(),
      1000 / RADIAL_AURA_FPS,
    );
    invalidate();
    return () => window.clearInterval(id);
  }, [enabled, invalidate]);

  return null;
}

type GreetingRadialAuraProps = {
  active: boolean;
};

export function GreetingRadialAura({ active }: GreetingRadialAuraProps) {
  const pageVisible = usePageVisible();
  const running = active && pageVisible;

  if (!active) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="absolute inset-0 [&_canvas]:pointer-events-none [&_div]:pointer-events-none"
      style={{ pointerEvents: "none" }}
    >
      <Canvas
        style={{ pointerEvents: "none" }}
        // Demand + capped invalidate: avoid the 60fps full-screen WebGL tax.
        frameloop={running ? "demand" : "never"}
        dpr={0.75}
        gl={{
          antialias: false,
          alpha: true,
          premultipliedAlpha: true,
          powerPreference: "low-power",
        }}
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
        <RadialAuraFrameDriver enabled={running} />
        <RadialAuraQuad />
      </Canvas>
    </div>
  );
}

"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import * as THREE from "three";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { GreetingRadialAura } from "@/components/visualizer/greeting-radial-aura";
import {
  degradePerformanceTier,
  type PerformanceTier,
} from "@/lib/device-profile";
import { useDeviceProfileStore } from "@/lib/stores/device-profile-store";
import { AURA_PALETTE } from "@/lib/visualizer/aura-palette";

/** Deep ocean / oceanic mid / turquoise — brand water body. */
const DEEP_OCEAN_RGB = AURA_PALETTE[0].rgb;
const OCEAN_RGB = AURA_PALETTE[1].rgb;
const TURQUOISE_RGB = AURA_PALETTE[2].rgb;

/**
 * 3D water blob behind the empty-state greeting.
 * Desktop + tier `high` only. Mobile always uses `GreetingRadialAura`.
 * On desktop `high`, a sustained low-FPS trend steps the tier down and swaps to the aura.
 */

type BlobRenderQuality = {
  detail: 3 | 4 | 5;
  /** Shader LOD: 0 low / 1 medium / 2 high. */
  shaderQuality: 0 | 1 | 2;
  dpr: [number, number];
  antialias: boolean;
};

/** Full-quality 3D blob settings — desktop + tier `high` only. */
function blobQualityFor(): BlobRenderQuality {
  return {
    detail: 5,
    shaderQuality: 2,
    dpr: [1, 1.25],
    antialias: true,
  };
}

const VERTEX_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uQuality;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vDisplace;
  varying float vRipple;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), u.x),
        u.y
      ),
      mix(
        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), u.x),
        u.y
      ),
      u.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return v;
  }

  float spreadingRipple(vec3 p, vec3 seed, float t, float phase) {
    vec3 a = normalize(p);
    vec3 b = normalize(seed);
    float dist = acos(clamp(dot(a, b), -1.0, 1.0));
    float travel = mod(t * 0.62 + phase, 3.1);
    float front = dist - travel;
    float envelope = exp(-front * front * 28.0);
    float ring = sin(dist * 22.0 - t * 3.4 + phase * 6.28318);
    float fade = exp(-dist * 0.85) * (1.0 - smoothstep(2.2, 3.0, travel));
    return ring * envelope * fade;
  }

  float displace(vec3 p, float t, out float rippleOut) {
    float bulk =
      0.55 * sin(p.x * 1.55 + t * 0.45) * cos(p.y * 1.3 - t * 0.34) +
      0.40 * sin(p.y * 1.85 + t * 0.32 + 1.3) * cos(p.z * 1.45 + t * 0.27) +
      0.35 * sin(p.z * 1.65 - t * 0.38 + 0.7) * cos(p.x * 1.4 + t * 0.24);

    float poke =
      0.45 * sin(dot(p, normalize(vec3(1.0, 0.35, 0.2))) * 2.5 - t * 0.9) +
      0.35 * sin(dot(p, normalize(vec3(-0.4, 1.0, 0.3))) * 2.1 + t * 0.75);

    float ripples =
      spreadingRipple(p, vec3(0.7, 0.5, 0.4), t, 0.0) +
      spreadingRipple(p, vec3(-0.6, 0.35, -0.55), t, 0.37);

    float capillary = 0.0;
    float micro = 0.0;

    if (uQuality >= 1.0) {
      ripples += spreadingRipple(p, vec3(0.15, -0.75, 0.45), t, 0.61);
      capillary =
        0.55 * sin(p.x * 14.0 + p.y * 9.0 - t * 2.8) *
          cos(p.z * 11.0 + t * 2.1) +
        0.45 * sin(p.y * 16.0 - p.z * 8.0 + t * 3.2) *
          cos(p.x * 12.0 - t * 1.9);
    }
    if (uQuality >= 2.0) {
      ripples += spreadingRipple(p, vec3(-0.35, -0.2, 0.85), t, 0.83);
      ripples += spreadingRipple(p, vec3(0.55, -0.4, -0.7), t, 0.19);
      micro = fbm(p * 2.1 + vec3(t * 0.25, t * 0.18, -t * 0.16)) * 2.0 - 1.0;
    }

    rippleOut = ripples * 0.55 + capillary * 0.25;
    return bulk * 0.065 + poke * 0.028 + capillary * 0.012 + ripples * 0.02 + micro * 0.014;
  }

  vec3 displacedPoint(vec3 p, float t) {
    float unused;
    return p + normalize(p) * displace(p, t, unused);
  }

  void main() {
    float t = uTime;
    vec3 pos = position;
    float ripple;
    float d = displace(pos, t, ripple);
    vec3 displaced = pos + normalize(pos) * d;

    vec3 n0 = normalize(pos);
    vec3 displacedN = n0;

    // Finite-difference normals only on medium/high — biggest CPU/GPU saver on low.
    if (uQuality >= 1.0) {
      vec3 t1 = normalize(cross(n0, abs(n0.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 t2 = cross(n0, t1);
      float e = 0.015;
      vec3 d1 = displacedPoint(pos + t1 * e, t);
      vec3 d2 = displacedPoint(pos + t2 * e, t);
      displacedN = normalize(cross(d1 - displaced, d2 - displaced));
    }

    vec4 world = modelMatrix * vec4(displaced, 1.0);

    vWorldPos = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * displacedN);
    vViewDir = normalize(cameraPosition - world.xyz);
    vDisplace = d;
    vRipple = ripple;

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vViewDir;
  varying float vDisplace;
  varying float vRipple;

  uniform float uTime;
  uniform float uQuality;
  uniform vec3 uLightDir;
  uniform vec3 uDeep;
  uniform vec3 uOcean;
  uniform vec3 uTurquoise;

  const float IOR = 1.333;

  // Oceanic environment — cooler sky / deep water ground, not pale grey.
  vec3 envColor(vec3 dir) {
    vec3 d = normalize(dir);
    float sky = d.y * 0.5 + 0.5;
    vec3 zenith = mix(uOcean, vec3(0.55, 0.82, 1.0), 0.45);
    vec3 horizon = mix(uTurquoise, uOcean, 0.35);
    vec3 ground = mix(uDeep, vec3(0.02, 0.06, 0.14), 0.4);
    float bands = 0.5 + 0.5 * sin(d.x * 6.0 + d.z * 4.5 + uTime * 0.12);
    vec3 skyCol = mix(horizon, zenith, smoothstep(0.0, 1.0, sky));
    skyCol = mix(skyCol, skyCol * vec3(0.9, 0.97, 1.06), bands * 0.12);
    if (uQuality >= 2.0) {
      float grid = 0.5 + 0.5 * sin(d.x * 16.0) * sin(d.y * 12.0);
      skyCol += uTurquoise * grid * 0.08;
    }
    return mix(ground, skyCol, smoothstep(-0.35, 0.25, d.y));
  }

  vec3 safeRefract(vec3 I, vec3 N, float eta) {
    vec3 r = refract(I, N, eta);
    if (dot(r, r) < 1e-5) {
      return reflect(I, N);
    }
    return r;
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewDir);
    vec3 L = normalize(uLightDir);

    if (dot(N, V) < 0.0) {
      N = -N;
    }

    float crest = clamp(vRipple, -1.0, 1.0);
    vec3 Nshade = normalize(N + vec3(crest * 0.28, crest * 0.2, -crest * 0.12));

    float ndotv = clamp(dot(Nshade, V), 0.0, 1.0);
    float F0 = 0.045;
    float fresnel = F0 + (1.0 - F0) * pow(1.0 - ndotv, 4.5);
    float crestLit = smoothstep(-0.15, 0.55, crest);
    float trough = smoothstep(0.1, -0.45, crest);
    fresnel *= 0.75 + 0.55 * crestLit;

    vec3 I = -V;
    vec3 R = reflect(I, Nshade);
    float eta = 1.0 / IOR;

    vec3 refracted;
    if (uQuality >= 1.0) {
      vec3 refrR = safeRefract(I, Nshade, eta * 0.975);
      vec3 refrG = safeRefract(I, Nshade, eta);
      vec3 refrB = safeRefract(I, Nshade, eta * 1.025);
      refracted = vec3(
        envColor(refrR).r,
        envColor(refrG).g,
        envColor(refrB).b
      );
    } else {
      refracted = envColor(safeRefract(I, Nshade, eta));
    }

    float thickness = mix(0.35, 1.35, ndotv * ndotv);
    thickness *= 1.0 + vDisplace * 1.8;
    thickness *= 1.0 + 0.4 * trough;
    // Oceanic Beer–Lambert: strip red/yellow, keep blue-green.
    vec3 absorption = vec3(0.72, 0.22, 0.06);
    vec3 transmitted = refracted * exp(-absorption * thickness);

    // Volume tint: deep core -> ocean body -> turquoise in shallower / lit crests.
    float depthMix = clamp(thickness * 0.55 + trough * 0.35 - crestLit * 0.25, 0.0, 1.0);
    vec3 waterBody = mix(uTurquoise, uOcean, smoothstep(0.15, 0.55, depthMix));
    waterBody = mix(waterBody, uDeep, smoothstep(0.45, 0.95, depthMix));
    transmitted = mix(transmitted, transmitted * waterBody * 1.35, 0.72);

    vec3 reflected = envColor(R);
    reflected = mix(reflected, mix(uOcean, uTurquoise, 0.35), 0.28);

    vec3 H = normalize(L + V);
    float specTight = pow(clamp(dot(Nshade, H), 0.0, 1.0), 160.0);
    float specBroad = pow(clamp(dot(Nshade, H), 0.0, 1.0), 36.0);

    vec3 col = transmitted * (1.0 - 0.2 * trough);
    col = mix(col, reflected, fresnel * 0.92);
    float sparkle = 0.4 + 0.7 * crestLit;
    col += vec3(0.85, 0.95, 1.0) * specTight * (0.65 + 1.0 * fresnel) * sparkle;
    col += mix(uOcean, uTurquoise, 0.5) * specBroad * (0.12 + 0.14 * crestLit);

    if (uQuality >= 1.0) {
      vec3 L2 = normalize(vec3(-0.55, 0.45, 0.7));
      vec3 H2 = normalize(L2 + V);
      float spec2 = pow(clamp(dot(Nshade, H2), 0.0, 1.0), 120.0);
      col += vec3(0.75, 0.92, 1.0) * spec2 * 0.35 * sparkle;
      float rippleGlint = pow(max(crest, 0.0), 1.15) * (0.4 + 0.7 * fresnel);
      col += uTurquoise * rippleGlint * 0.45;
    } else {
      float rippleGlint = pow(max(crest, 0.0), 1.2) * 0.55;
      col += uTurquoise * rippleGlint * 0.38;
    }

    col += mix(uOcean, uTurquoise, 0.4) * pow(1.0 - ndotv, 3.0) * (0.16 + 0.1 * crestLit);

    float alpha = mix(0.14, 0.6, fresnel);
    alpha += pow(1.0 - ndotv, 2.0) * 0.1;
    alpha += crestLit * 0.06;
    alpha = clamp(alpha, 0.1, 0.74);

    gl_FragColor = vec4(col, alpha);
  }
`;

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

/** Typical laptop CSS viewport — baseline for blob size. */
const LAPTOP_VIEWPORT = { width: 1440, height: 900 };
/** World scale at the laptop baseline. */
const BASE_SCALE = 0.68;

function scaleForScreen(): number {
  const factor = Math.sqrt(
    (window.innerWidth / LAPTOP_VIEWPORT.width) *
      (window.innerHeight / LAPTOP_VIEWPORT.height),
  );
  return BASE_SCALE * THREE.MathUtils.clamp(factor, 0.5, 1.35);
}

/** Slow-frame threshold (~28 fps). Single spikes are ignored; trends matter. */
const SLOW_FRAME_SEC = 1 / 28;
const FPS_WINDOW_FRAMES = 48;
const FPS_BAD_RATIO = 0.42;
/** Ignore the first frames after mount / quality change (shader compile etc.). */
const FPS_WARMUP_FRAMES = 24;
/** After a degrade, wait before sampling again. */
const FPS_COOLDOWN_FRAMES = 60;

type WaterBlobProps = {
  shaderQuality: 0 | 1 | 2;
  detail: 3 | 4 | 5;
  /** When the canvas render loop is live — used to reset FPS warmup after pauses. */
  tracking: boolean;
  onSustainedSlowdown: () => void;
};

/** Registers webglcontextlost with explicit teardown on unmount / remount. */
function WebGlContextGuard({ onContextLost }: { onContextLost: () => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      // Remount with a new context — common after backgrounding on mobile GPUs.
      queueMicrotask(onContextLost);
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
    };
  }, [gl, onContextLost]);

  return null;
}

function WaterBlob({
  shaderQuality,
  detail,
  tracking,
  onSustainedSlowdown,
}: WaterBlobProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const drift = useRef({ yaw: 0, pitch: 0, roll: 0, bob: 0 });
  /** 0→1 enter pop in world space (avoids CSS transform on the Canvas). */
  const enterPop = useRef(0);
  const fps = useRef({
    warmup: FPS_WARMUP_FRAMES,
    cooldown: 0,
    windowCount: 0,
    badCount: 0,
  });
  const onSlowRef = useRef(onSustainedSlowdown);
  const wasTrackingRef = useRef(tracking);

  useEffect(() => {
    onSlowRef.current = onSustainedSlowdown;
  }, [onSustainedSlowdown]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uQuality: { value: 0 },
      uLightDir: { value: new THREE.Vector3(0.45, 0.85, 0.35).normalize() },
      uDeep: { value: new THREE.Vector3(...DEEP_OCEAN_RGB) },
      uOcean: { value: new THREE.Vector3(...OCEAN_RGB) },
      uTurquoise: { value: new THREE.Vector3(...TURQUOISE_RGB) },
    }),
    [],
  );

  useEffect(() => {
    fps.current = {
      warmup: FPS_WARMUP_FRAMES,
      cooldown: 0,
      windowCount: 0,
      badCount: 0,
    };
  }, [shaderQuality, detail]);

  // After frameloop pauses (tab hidden / reduced-motion), the next delta is a
  // huge catch-up spike — reset warmup so it never counts as a "slow" frame.
  useEffect(() => {
    if (tracking && !wasTrackingRef.current) {
      fps.current = {
        warmup: FPS_WARMUP_FRAMES,
        cooldown: 0,
        windowCount: 0,
        badCount: 0,
      };
    }
    wasTrackingRef.current = tracking;
  }, [tracking]);

  useFrame((_, delta) => {
    // Clamp for both animation and FPS sampling — raw delta after a pause is
    // wall-clock catch-up, not GPU cost.
    const dt = Math.min(delta, 0.05);
    const material = materialRef.current;
    const mesh = meshRef.current;
    if (!material || !mesh) {
      return;
    }

    material.uniforms.uTime.value += dt;
    material.uniforms.uQuality.value = shaderQuality;

    const tracker = fps.current;
    if (tracker.warmup > 0) {
      tracker.warmup -= 1;
    } else if (tracker.cooldown > 0) {
      tracker.cooldown -= 1;
    } else {
      tracker.windowCount += 1;
      if (dt > SLOW_FRAME_SEC) {
        tracker.badCount += 1;
      }
      if (tracker.windowCount >= FPS_WINDOW_FRAMES) {
        const ratio = tracker.badCount / tracker.windowCount;
        tracker.windowCount = 0;
        tracker.badCount = 0;
        if (ratio >= FPS_BAD_RATIO) {
          tracker.cooldown = FPS_COOLDOWN_FRAMES;
          onSlowRef.current();
        }
      }
    }

    const s = scaleForScreen();
    // Critically-damped-ish ease toward 1 — soft pop without overshoot chaos.
    enterPop.current += (1 - enterPop.current) * Math.min(1, dt * 3.2);
    const pop = 0.78 + 0.22 * enterPop.current;
    mesh.scale.setScalar(s * pop);

    const d = drift.current;
    d.yaw += dt * 0.18;
    d.pitch += dt * 0.11;
    d.roll += dt * 0.07;
    d.bob += dt * 0.35;

    mesh.rotation.set(
      Math.sin(d.pitch) * 0.35 + Math.sin(d.bob * 0.6) * 0.08,
      d.yaw * 0.4,
      Math.sin(d.roll) * 0.25,
    );
    mesh.position.set(
      Math.sin(d.bob * 0.45) * 0.08 * s,
      (Math.sin(d.bob * 0.7) * 0.1 + Math.cos(d.bob * 0.33) * 0.04) * s,
      0,
    );
  });

  return (
    <mesh
      ref={meshRef}
      scale={BASE_SCALE}
      frustumCulled={false}
      key={`geo-${detail}`}
    >
      <icosahedronGeometry args={[1, detail]} />
      <shaderMaterial
        key={`mat-${shaderQuality}`}
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

type GreetingBlobProps = {
  /** When false, the canvas unmounts and frees the GPU. */
  active: boolean;
};

/** Soft fade-in only — never CSS-scale the Canvas parent (R3F size / compositing drifts). */
const BLOB_ENTER_EASE = [0.22, 1, 0.36, 1] as const;

function GreetingBlobEntrance({
  children,
  tier,
  form,
}: {
  children: ReactNode;
  tier: string;
  form?: string;
}) {
  return (
    <motion.div
      aria-hidden
      data-greeting-blob
      data-blob-tier={tier}
      data-blob-form={form}
      className="absolute inset-0 z-0 -translate-y-12 [&_canvas]:pointer-events-none [&_div]:pointer-events-none"
      style={{ pointerEvents: "none" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.85, ease: BLOB_ENTER_EASE }}
    >
      {children}
    </motion.div>
  );
}

function StaticGreetingBlobFallback() {
  return (
    <div
      aria-hidden
      data-greeting-blob
      data-blob-tier="static"
      className="pointer-events-none absolute inset-0 z-0 -translate-y-12 overflow-hidden"
    >
      {/* Soft irregular glow: layered organic blobs + heavy blur.
          Mobile stays roughly round (min vw/vh); md+ stretches horizontally. */}
      <div className="absolute top-[46%] left-1/2 size-[min(90vw,70vh)] -translate-x-1/2 -translate-y-1/2 md:size-auto md:h-[min(52vh,28rem)] md:w-[min(85vw,52rem)]">
        <div className="absolute inset-0 scale-110 blur-3xl md:blur-[56px]">
          <div
            className="absolute top-[18%] left-[12%] h-[70%] w-[70%] rounded-[42%_58%_48%_52%] opacity-45 md:top-[22%] md:left-[8%] md:h-[65%] md:w-[55%]"
            style={{
              background:
                "radial-gradient(circle at 40% 45%, oklch(0.68 0.16 240 / 0.85), transparent 68%)",
            }}
          />
          <div
            className="absolute top-[8%] right-[6%] h-[62%] w-[58%] rounded-[58%_42%_55%_45%] opacity-40 md:top-[20%] md:right-[10%] md:h-[58%] md:w-[48%]"
            style={{
              background:
                "radial-gradient(circle at 55% 40%, oklch(0.74 0.14 210 / 0.8), transparent 70%)",
            }}
          />
          <div
            className="absolute bottom-[6%] left-[28%] h-[55%] w-[55%] rounded-[48%_52%_40%_60%] opacity-35 md:bottom-[10%] md:left-[30%] md:h-[50%] md:w-[42%]"
            style={{
              background:
                "radial-gradient(circle at 50% 55%, oklch(0.68 0.16 240 / 0.7), oklch(0.74 0.14 210 / 0.35), transparent 72%)",
            }}
          />
          <div
            className="absolute top-[32%] left-[36%] h-[40%] w-[40%] rounded-[50%] opacity-30 md:left-[38%] md:h-[36%] md:w-[28%]"
            style={{
              background:
                "radial-gradient(circle, oklch(0.74 0.14 210 / 0.75), transparent 65%)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function GreetingBlob({ active }: GreetingBlobProps) {
  const reduceMotion = usePrefersReducedMotion();
  const pageVisible = usePageVisible();
  const formFactor = useDeviceProfileStore((s) => s.formFactor);
  const storeTier = useDeviceProfileStore((s) => s.tier);

  /** Runtime override — null means “use store tier”. */
  const [performanceOverride, setPerformanceOverride] =
    useState<PerformanceTier | null>(null);
  /** Bumped on webglcontextlost so Canvas remounts a fresh context. */
  const [glEpoch, setGlEpoch] = useState(0);

  const effectiveTier = performanceOverride ?? storeTier;
  // Mobile always → radial aura. Desktop blob only at tier `high`.
  const useRadialAura =
    formFactor === "mobile" || effectiveTier !== "high";

  // Intentional: tier only steps down within a session (high → medium → low).
  // First step off `high` swaps to the radial aura; further steps stay on it.
  // We do not auto-recover upward — a later spike after thermal recovery would
  // bounce quality; a refresh re-reads the store profile instead.
  const handleSustainedSlowdown = useCallback(() => {
    setPerformanceOverride((prev) =>
      degradePerformanceTier(prev ?? storeTier),
    );
  }, [storeTier]);

  const handleContextLost = useCallback(() => {
    setGlEpoch((n) => n + 1);
  }, []);

  if (!active) {
    return null;
  }

  if (reduceMotion) {
    return <StaticGreetingBlobFallback />;
  }

  if (useRadialAura) {
    return (
      <GreetingBlobEntrance tier="radial" form={formFactor}>
        <GreetingRadialAura active={active} />
      </GreetingBlobEntrance>
    );
  }

  const quality = blobQualityFor();
  const running = active && pageVisible && !reduceMotion;

  return (
    <GreetingBlobEntrance tier={effectiveTier} form={formFactor}>
      <Canvas
        key={`blob-gl-${glEpoch}-${quality.detail}-${quality.antialias}-${quality.dpr.join("x")}`}
        style={{ pointerEvents: "none" }}
        frameloop={running ? "always" : "never"}
        dpr={quality.dpr}
        gl={{
          antialias: quality.antialias,
          alpha: true,
          powerPreference: "low-power",
        }}
        camera={{ position: [0, 0, 4.2], fov: 32, near: 0.1, far: 20 }}
        onCreated={({ gl }) => {
          gl.domElement.style.pointerEvents = "none";
          const root = gl.domElement.parentElement;
          if (root) {
            root.style.pointerEvents = "none";
          }
        }}
      >
        <WebGlContextGuard onContextLost={handleContextLost} />
        <WaterBlob
          detail={quality.detail}
          shaderQuality={quality.shaderQuality}
          tracking={running}
          onSustainedSlowdown={handleSustainedSlowdown}
        />
      </Canvas>
    </GreetingBlobEntrance>
  );
}

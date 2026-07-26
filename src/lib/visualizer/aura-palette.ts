/**
 * Stoic Meridian — shared aura palette for the background shader and
 * streaming token color reveals.
 *
 * vivid indigo → bright cyan → rich amber → luminous violet → periwinkle
 */

type AuraPaletteStop = {
  /** CSS color for DOM animations (matches site theme oklch tokens). */
  css: string;
  /** Linear-ish sRGB 0..1 for the WebGL shader ramp. */
  rgb: readonly [number, number, number];
};

export const AURA_PALETTE: readonly AuraPaletteStop[] = [
  { css: "oklch(0.70 0.16 260)", rgb: [0.42, 0.45, 0.91] },
  { css: "oklch(0.74 0.18 215)", rgb: [0.18, 0.72, 0.91] },
  { css: "oklch(0.80 0.18 72)", rgb: [0.95, 0.75, 0.25] },
  { css: "oklch(0.67 0.17 290)", rgb: [0.66, 0.33, 0.94] },
  { css: "oklch(0.76 0.13 245)", rgb: [0.42, 0.56, 0.94] },
] as const;

/** CSS colors for token reveal (same stops as {@link AURA_PALETTE}). */
export const AURA_PALETTE_CSS = AURA_PALETTE.map((stop) => stop.css);

function vec3Glsl(rgb: readonly [number, number, number]): string {
  return `vec3(${rgb.map((v) => v.toFixed(2)).join(", ")})`;
}

/** GLSL `palette(float t)` body injected into the aura fragment shader. */
export function buildAuraPaletteGlsl(): string {
  const [c0, c1, c2, c3, c4] = AURA_PALETTE.map((stop) => vec3Glsl(stop.rgb));
  return /* glsl */ `
  vec3 palette(float t) {
    t = fract(t);
    vec3 c0 = ${c0};
    vec3 c1 = ${c1};
    vec3 c2 = ${c2};
    vec3 c3 = ${c3};
    vec3 c4 = ${c4};
    vec3 c = mix(c0, c1, smoothstep(0.0, 0.28, t));
    c = mix(c, c2, smoothstep(0.24, 0.5, t));
    c = mix(c, c3, smoothstep(0.5, 0.72, t));
    c = mix(c, c4, smoothstep(0.7, 0.95, t));
    c = mix(c, c0, smoothstep(0.93, 1.0, t));
    return c;
  }`.trim();
}

/** Stable pseudo-random pick from the aura palette for a token key. */
export function pickAuraTokenColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AURA_PALETTE_CSS[hash % AURA_PALETTE_CSS.length];
}

/**
 * One-shot client device profiling: form factor (mobile/desktop) + performance
 * tier (low/medium/high). Pure signals — no UA string sniffing as the sole source.
 *
 * Calibration notes (Safari / phones):
 * - iOS Safari omits `deviceMemory` and Network Information → those stay null (neutral).
 * - Modern phones commonly report `hardwareConcurrency === 6` (incl. recent iPhones);
 *   that is treated as baseline, not a penalty.
 * - Mobile gets a small thermal/compositor penalty, but not enough alone to force `low`.
 */

export type DeviceFormFactor = "mobile" | "desktop";
export type PerformanceTier = "low" | "medium" | "high";

export type DeviceProfileSignals = {
  coarsePointer: boolean;
  noHover: boolean;
  touchPoints: number;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  saveData: boolean;
  effectiveType: string | null;
  reducedMotion: boolean;
  /** UA-CH `mobile` when available; null if unsupported. */
  clientHintMobile: boolean | null;
};

export type DeviceProfile = {
  formFactor: DeviceFormFactor;
  tier: PerformanceTier;
  signals: DeviceProfileSignals;
};

type NavigatorConnection = {
  saveData?: boolean;
  effectiveType?: string;
};

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: NavigatorConnection;
  userAgentData?: { mobile?: boolean };
};

function readSignals(): DeviceProfileSignals {
  const nav = navigator as NavigatorWithHints;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  const touchPoints = nav.maxTouchPoints ?? 0;
  const hardwareConcurrency =
    typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0
      ? nav.hardwareConcurrency
      : null;
  const deviceMemoryGb =
    typeof nav.deviceMemory === "number" && nav.deviceMemory > 0
      ? nav.deviceMemory
      : null;
  const saveData = nav.connection?.saveData === true;
  const effectiveType =
    typeof nav.connection?.effectiveType === "string"
      ? nav.connection.effectiveType
      : null;
  const clientHintMobile =
    typeof nav.userAgentData?.mobile === "boolean"
      ? nav.userAgentData.mobile
      : null;

  return {
    coarsePointer,
    noHover,
    touchPoints,
    hardwareConcurrency,
    deviceMemoryGb,
    saveData,
    effectiveType,
    reducedMotion,
    clientHintMobile,
  };
}

function inferFormFactor(signals: DeviceProfileSignals): DeviceFormFactor {
  if (signals.clientHintMobile === true) {
    return "mobile";
  }
  if (signals.clientHintMobile === false) {
    return "desktop";
  }
  // Touch-primary devices: coarse pointer + no hover (phones/tablets).
  if (signals.coarsePointer && signals.noHover) {
    return "mobile";
  }
  // Multi-touch without hover is a strong mobile/tablet hint.
  if (signals.touchPoints > 1 && signals.noHover) {
    return "mobile";
  }
  return "desktop";
}

function scoreTier(signals: DeviceProfileSignals): number {
  // 0..100 rough capability score; unknown signals stay neutral.
  let score = 58;

  const cores = signals.hardwareConcurrency;
  if (cores != null) {
    // ≤4: genuinely constrained. 5–6: today's phone/laptop baseline (neutral).
    // ≥8: clear headroom. ≥12: desktop-class.
    if (cores <= 4) score -= 22;
    else if (cores >= 8) score += 12;
    if (cores >= 12) score += 8;
  }

  const mem = signals.deviceMemoryGb;
  if (mem != null) {
    if (mem <= 2) score -= 28;
    else if (mem <= 4) score -= 14;
    else if (mem >= 8) score += 10;
    // 5–6 GB: mild/no penalty (common mid Android); leave near neutral.
  }

  if (signals.saveData) score -= 35;
  if (signals.effectiveType === "slow-2g" || signals.effectiveType === "2g") {
    score -= 25;
  } else if (signals.effectiveType === "3g") {
    score -= 12;
  }

  if (signals.reducedMotion) score -= 40;

  return score;
}

function inferTier(
  formFactor: DeviceFormFactor,
  signals: DeviceProfileSignals,
): PerformanceTier {
  if (signals.reducedMotion || signals.saveData) {
    return "low";
  }

  let score = scoreTier(signals);

  // Mild mobile bias (shared GPU / thermal), not a one-way ticket to `low`.
  // Example: iPhone (6 cores, no deviceMemory) → 58 - 6 ≈ 52 → medium.
  if (formFactor === "mobile") {
    score -= 6;
  }

  if (score < 38) return "low";
  if (score < 68) return "medium";
  return "high";
}

/** Synchronous profile snapshot (browser only). */
export function detectDeviceProfile(): DeviceProfile {
  const signals = readSignals();
  const formFactor = inferFormFactor(signals);
  const tier = inferTier(formFactor, signals);
  return { formFactor, tier, signals };
}

export function degradePerformanceTier(
  tier: PerformanceTier,
): PerformanceTier {
  if (tier === "high") return "medium";
  if (tier === "medium") return "low";
  return "low";
}

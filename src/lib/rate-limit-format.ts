type DurationLabels = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

/** Compact relative duration for rate-limit countdown copy. */
export function formatRetryDuration(
  retryAt: string,
  labels: DurationLabels,
  nowMs: number = Date.now(),
): string | null {
  const remainingMs = new Date(retryAt).getTime() - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days} ${labels.days.toLowerCase()}`);
  }
  if (hours > 0) {
    parts.push(`${hours} ${labels.hours.toLowerCase()}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${labels.minutes.toLowerCase()}`);
  }
  if (seconds > 0 && days === 0) {
    parts.push(`${seconds} ${labels.seconds.toLowerCase()}`);
  }
  if (parts.length === 0) {
    parts.push(`${seconds || 1} ${labels.seconds.toLowerCase()}`);
  }

  return parts.slice(0, 2).join(" ");
}

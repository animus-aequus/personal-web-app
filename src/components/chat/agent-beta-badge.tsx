/**
 * Non-interactive watermark shown while the agent is in beta.
 */
export function AgentBetaBadge() {
  return (
    <p
      aria-hidden
      className="pointer-events-none fixed top-4 right-4 z-30 select-none text-sm font-bold tracking-[0.2em] text-foreground/20"
    >
      BETA
    </p>
  );
}

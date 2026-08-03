import type { ReactNode } from "react";

import { SiteShell } from "@/components/layout/site-shell";

const PAGE_BACKGROUND =
  "radial-gradient(ellipse 80% 60% at 50% 40%, oklch(0.18 0.03 260) 0%, oklch(0.13 0.02 260) 70%, oklch(0.08 0.02 260) 100%)";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="relative flex min-h-full flex-1 flex-col bg-background"
      style={{ background: PAGE_BACKGROUND }}
    >
      <div className="relative z-10 flex w-full flex-1 flex-col">
        <SiteShell>{children}</SiteShell>
      </div>
    </main>
  );
}

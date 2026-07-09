import { ChatPanel } from "@/components/chat/chat-panel";
import { TurnstileProvider } from "@/components/turnstile/turnstile-provider";
import { AgentAura } from "@/components/visualizer/agent-aura";

export default function Home() {
  return (
    <main
      className="relative flex min-h-full flex-1 flex-col bg-background"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 40%, oklch(0.18 0.03 260) 0%, oklch(0.13 0.02 260) 70%, oklch(0.08 0.02 260) 100%)",
      }}
    >
      <AgentAura />
      <div className="relative z-10 flex w-full flex-1 flex-col">
        <TurnstileProvider>
          <ChatPanel />
        </TurnstileProvider>
      </div>
    </main>
  );
}

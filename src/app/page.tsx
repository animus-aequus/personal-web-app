import { ChatPanel } from "@/components/chat/chat-panel";

export default function Home() {
  return (
    <main className="flex min-h-full flex-1 flex-col bg-background">
      <ChatPanel />
    </main>
  );
}

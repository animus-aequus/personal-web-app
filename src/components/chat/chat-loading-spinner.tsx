import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type ChatLoadingSpinnerProps = {
  className?: string;
  size?: "sm" | "md";
  label?: string;
};

const sizeClass = {
  sm: "size-4",
  md: "size-6",
} as const;

export function ChatLoadingSpinner({
  className,
  size = "md",
  label = "Loading",
}: ChatLoadingSpinnerProps) {
  return (
    <div
      className={cn("flex items-center justify-center", className)}
      role="status"
      aria-label={label}
    >
      <Loader2
        className={cn(sizeClass[size], "animate-spin text-muted-foreground")}
        aria-hidden
      />
    </div>
  );
}

"use client";

import { Check, X } from "lucide-react";
import { toast } from "sonner";

const DURATION_MS = 5000;

const baseToastClass =
  "cn-toast !bg-popover !text-popover-foreground shadow-md";

export function showBookingOtpSuccessToast(
  message = "Meeting confirmed. Your meeting is on the calendar.",
): void {
  toast.success(message, {
    duration: DURATION_MS,
    icon: <Check className="size-4 text-emerald-500" aria-hidden />,
    classNames: {
      toast: `${baseToastClass} !border-emerald-500/70`,
      title: "!text-popover-foreground",
      icon: "!self-center",
      closeButton: "!bg-popover !border-border !text-muted-foreground",
    },
  });
}

export function showBookingOtpErrorToast(message: string): void {
  toast.error(message, {
    duration: DURATION_MS,
    icon: <X className="size-4 text-destructive" aria-hidden />,
    classNames: {
      toast: `${baseToastClass} !border-destructive/70`,
      title: "!text-popover-foreground",
      icon: "!self-center",
      closeButton: "!bg-popover !border-border !text-muted-foreground",
    },
  });
}

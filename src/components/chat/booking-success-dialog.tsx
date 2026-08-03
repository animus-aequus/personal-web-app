"use client";

import {
  Check,
  CircleHelp,
  Copy,
  Download,
  ExternalLink,
  Video,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { downloadBookingIcs } from "@/lib/chat/booking-ics";
import { cn } from "@/lib/utils";
import {
  useBookingOtpStore,
  type BookingOtpState,
} from "@/lib/stores/booking-otp-store";

function formatSlot(slotStart?: string, durationMinutes?: number): string {
  if (!slotStart) {
    return "";
  }
  const start = new Date(slotStart);
  if (Number.isNaN(start.getTime())) {
    return slotStart;
  }
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(start);
  if (durationMinutes && durationMinutes > 0) {
    return `${dateLabel} · ${durationMinutes} min`;
  }
  return dateLabel;
}

function BookingSuccessDialogInner({ active }: { active: BookingOtpState }) {
  const { t } = useTranslation();
  const dismiss = useBookingOtpStore((s) => s.dismiss);
  const [copied, setCopied] = useState(false);
  const open = active.status === "success";
  const meetUrl = active.meetUrl?.trim() || null;
  const icalUid = active.icalUid?.trim() || null;
  const eventName = active.eventName?.trim() || t("common.meeting");
  const slotLabel = formatSlot(active.slotStart, active.durationMinutes);
  const showInviteDownload =
    Boolean(icalUid) && Boolean(active.slotStart) && Boolean(active.durationMinutes);

  const handleCopyMeet = async () => {
    if (!meetUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(meetUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownloadIcs = () => {
    if (!icalUid || !active.slotStart || !active.durationMinutes) {
      return;
    }
    downloadBookingIcs({
      icalUid,
      eventName,
      slotStartIso: active.slotStart,
      durationMinutes: active.durationMinutes,
      meetUrl,
      htmlLink: active.htmlLink,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          dismiss();
        }
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-emerald-500/15">
            <Check
              className="size-5 text-emerald-600 dark:text-emerald-400"
              aria-hidden
            />
          </div>
          <DialogTitle>{t("booking.successTitle")}</DialogTitle>
          <DialogDescription>
            {t("booking.successDescription", { email: active.emailMasked })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">{eventName}</p>
          {slotLabel ? (
            <p className="text-xs tabular-nums text-muted-foreground">{slotLabel}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {meetUrl ? (
            <div className="flex gap-2">
              <a
                href={meetUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "default" }), "flex-1")}
              >
                <Video className="size-4" aria-hidden />
                {t("booking.joinMeet")}
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </a>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={copied ? t("common.copied") : t("common.copyMeetLink")}
                onClick={() => void handleCopyMeet()}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          ) : null}

          {showInviteDownload ? (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                {t("booking.backupInviteHint")}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 flex-1"
                  onClick={handleDownloadIcs}
                >
                  <Download className="size-4" aria-hidden />
                  {t("booking.downloadInvite")}
                </Button>
                <TooltipProvider delay={200}>
                  <Tooltip>
                    <TooltipTrigger
                      type="button"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "shrink-0 text-muted-foreground",
                      )}
                      aria-label={t("booking.aboutDownload")}
                    >
                      <CircleHelp className="size-4" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[16rem] text-pretty">
                      {t("booking.inviteTooltip")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => dismiss()}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Success modal mounted once in ChatPanel (not inside BookingOtpCard) so text
 * and voice mounts do not create duplicate dialogs.
 */
export function BookingSuccessDialog() {
  const active = useBookingOtpStore((s) => s.active);
  if (!active || active.status !== "success") {
    return null;
  }
  return <BookingSuccessDialogInner active={active} />;
}

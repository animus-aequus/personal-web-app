"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import { MeetingDetailsDialog } from "@/components/chat/meeting-details-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useMeetingsListStore,
  type MeetingsListMeeting,
} from "@/lib/stores/meetings-list-store";

export type MeetingListItem = MeetingsListMeeting;

type MeetingsListCardProps = {
  listId: string;
  meetings: MeetingListItem[];
  sessionId: string;
  className?: string;
};

function formatDateParts(iso: string): { date: string; time: string } {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    return { date: "—", time: "—" };
  }
  const d = new Date(ms);
  const date = d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
}

export function MeetingsListCard({
  listId,
  meetings,
  sessionId,
  className,
}: MeetingsListCardProps) {
  const { t } = useTranslation();
  const activeListId = useMeetingsListStore((s) => s.activeListId);
  const canCancel = activeListId === listId;
  const [detailsMeeting, setDetailsMeeting] = useState<MeetingListItem | null>(
    null,
  );

  return (
    <div
      className={cn(
        "mt-3 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className,
      )}
      role="list"
      aria-label={t("meetings.upcomingAria")}
    >
      {meetings.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          {t("meetings.noUpcoming")}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {meetings.map((meeting) => {
            const { date, time } = formatDateParts(meeting.slotStart);
            const detailsButton = (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setDetailsMeeting(meeting)}
              >
                {t("meetings.details")}
              </Button>
            );

            return (
              <div
                key={meeting.bookingId}
                role="listitem"
                className="px-4 py-4"
              >
                {/* Mobile: two stacked rows — the 4-column grid below doesn't
                    leave enough room for the title on narrow viewports. */}
                <div className="flex flex-col gap-2 md:hidden">
                  <div className="flex items-baseline justify-between gap-2 tabular-nums">
                    <span className="text-sm font-medium text-foreground">
                      {date}
                    </span>
                    <span className="text-xs text-muted-foreground">{time}</span>
                    <span className="text-xs text-muted-foreground">
                      {meeting.durationMinutes} min
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className="min-w-0 flex-1 truncate text-sm text-foreground"
                      title={meeting.eventName}
                    >
                      {meeting.eventName}
                    </p>
                    {detailsButton}
                  </div>
                </div>

                {/* Desktop/tablet: single-row grid, equal column widths. */}
                <div className="hidden md:grid md:grid-cols-[5.5rem_minmax(0,1fr)_4rem_auto] md:items-center md:gap-3">
                  <div className="min-w-0 tabular-nums">
                    <p className="text-sm font-medium leading-tight text-foreground">
                      {date}
                    </p>
                    <p className="text-xs text-muted-foreground">{time}</p>
                  </div>
                  <p
                    className="truncate text-sm text-foreground"
                    title={meeting.eventName}
                  >
                    {meeting.eventName}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {meeting.durationMinutes} min
                  </p>
                  {detailsButton}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <MeetingDetailsDialog
        meeting={detailsMeeting}
        open={detailsMeeting !== null}
        sessionId={sessionId}
        canCancel={canCancel}
        onOpenChange={(next) => {
          if (!next) {
            setDetailsMeeting(null);
          }
        }}
      />
    </div>
  );
}

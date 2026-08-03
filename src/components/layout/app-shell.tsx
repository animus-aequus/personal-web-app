"use client";

import { useEffect, useRef, useState } from "react";
import { Languages, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LogoIconButton } from "@/components/layout/logo-icon-button";
import { changeAppLanguage } from "@/lib/i18n/change-language";
import {
  LOCALE_CODES,
  LOCALE_LABELS,
  normalizeLocale,
  type LocaleCode,
} from "@/lib/i18n/locales";
import { useChatStore } from "@/lib/stores/chat-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

type AppShellProps = {
  children: React.ReactNode;
  sessionId?: string | null;
  onVoiceReconnect?: () => void;
};

const SIDEBAR_TRANSITION_MS = 300;

function useDesktopHeaderTriggerVisible(isMobile: boolean) {
  const { state } = useSidebar();
  const previousStateRef = useRef(state);
  const [showAfterExpand, setShowAfterExpand] = useState(state === "expanded");

  useEffect(() => {
    if (isMobile) {
      return;
    }

    const previousState = previousStateRef.current;
    previousStateRef.current = state;

    if (previousState !== "collapsed" || state !== "expanded") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setShowAfterExpand(false);
    });

    const container = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-container"]',
    );

    if (!container) {
      const timer = window.setTimeout(() => {
        setShowAfterExpand(true);
      }, SIDEBAR_TRANSITION_MS);
      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }

    const handleTransitionEnd = (event: TransitionEvent) => {
      if (event.target === container && event.propertyName === "width") {
        setShowAfterExpand(true);
      }
    };

    container.addEventListener("transitionend", handleTransitionEnd);

    const fallbackTimer = window.setTimeout(() => {
      setShowAfterExpand(true);
    }, SIDEBAR_TRANSITION_MS + 50);

    return () => {
      cancelAnimationFrame(frame);
      container.removeEventListener("transitionend", handleTransitionEnd);
      window.clearTimeout(fallbackTimer);
    };
  }, [isMobile, state]);

  if (isMobile) {
    return true;
  }

  if (state === "collapsed") {
    return false;
  }

  return showAfterExpand;
}

function LanguageSettings({
  sessionId,
  onVoiceReconnect,
}: {
  sessionId?: string | null;
  onVoiceReconnect?: () => void;
}) {
  const { t } = useTranslation();
  const { isMobile, state } = useSidebar();
  const language = useChatStore((store) => normalizeLocale(store.language));
  const isCollapsedDesktop = !isMobile && state === "collapsed";

  const handleChange = (value: string | null) => {
    if (!value) {
      return;
    }
    void changeAppLanguage(value as LocaleCode, {
      sessionId,
      onVoiceReconnect,
    });
  };

  return (
    <Select value={language} onValueChange={handleChange}>
      <SidebarContent className="py-4 group-data-[collapsible=icon]:hidden">
        <div className="flex flex-col gap-2 px-2">
          <Label
            htmlFor="app-language-select"
            className="pl-2 text-sm font-medium text-muted-foreground"
          >
            {t("sidebar.language")}
          </Label>
          <SelectTrigger id="app-language-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
        </div>
      </SidebarContent>

      <SidebarFooter className="hidden border-t border-border p-2 group-data-[collapsible=icon]:block">
        <SidebarMenu>
          <SidebarMenuItem>
            <SelectTrigger
              render={
                <SidebarMenuButton tooltip={t("sidebar.language")} />
              }
              className="size-8 border-0 bg-transparent p-0 shadow-none hover:bg-transparent focus-visible:ring-0 data-[size=default]:h-8 [&>svg:last-child]:hidden"
            >
              <Languages />
            </SelectTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SelectContent
        side={isCollapsedDesktop ? "right" : "bottom"}
        align="center"
        sideOffset={isCollapsedDesktop ? 8 : 4}
      >
        {LOCALE_CODES.map((code) => (
          <SelectItem key={code} value={code} className="py-2">
            {LOCALE_LABELS[code]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SettingsSidebar({
  sessionId,
  onVoiceReconnect,
}: {
  sessionId?: string | null;
  onVoiceReconnect?: () => void;
}) {
  const { t } = useTranslation();
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const showDesktopHeaderTrigger = useDesktopHeaderTriggerVisible(isMobile);

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="relative flex flex-row items-center border-b border-border p-2">
        <LogoIconButton
          appearance="sidebar"
          className="shrink-0"
          label="Kacper Fleming"
          onClick={() => {
            if (!isMobile) {
              toggleSidebar();
            }
          }}
        />
        <div
          className={cn(
            "absolute top-1/2 right-2 flex -translate-y-1/2 shrink-0",
            !isMobile && !showDesktopHeaderTrigger && "hidden",
          )}
        >
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setOpenMobile(false)}
              aria-label={t("sidebar.closeMenu")}
            >
              <X className="size-4" />
            </Button>
          ) : (
            <SidebarTrigger className="size-8" />
          )}
        </div>
      </SidebarHeader>
      <LanguageSettings
        sessionId={sessionId}
        onVoiceReconnect={onVoiceReconnect}
      />
      <SidebarRail />
    </Sidebar>
  );
}

function MobileMenuButton() {
  const { t } = useTranslation();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();

  if (!isMobile || openMobile) {
    return null;
  }

  return (
    <LogoIconButton
      appearance="fab"
      className="fixed left-4 top-4 z-30"
      onClick={() => setOpenMobile(true)}
      label={t("sidebar.openMenu")}
    />
  );
}

export function AppShell({
  children,
  sessionId,
  onVoiceReconnect,
}: AppShellProps) {
  return (
    <SidebarProvider>
      <SettingsSidebar
        sessionId={sessionId}
        onVoiceReconnect={onVoiceReconnect}
      />
      <MobileMenuButton />
      <SidebarInset className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

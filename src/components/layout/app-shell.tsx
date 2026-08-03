"use client";

import { X } from "lucide-react";
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
import { AgentAura } from "@/components/visualizer/agent-aura";
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

function LanguageSelect({
  sessionId,
  onVoiceReconnect,
}: {
  sessionId?: string | null;
  onVoiceReconnect?: () => void;
}) {
  const { t } = useTranslation();
  const language = useChatStore((state) =>
    normalizeLocale(state.language),
  );

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
    <div className="flex flex-col gap-2 px-2">
      <Label htmlFor="app-language-select" className="text-sm font-medium text-muted-foreground pl-2">{t("sidebar.language")}</Label>
      <Select value={language} onValueChange={handleChange}>
        <SelectTrigger id="app-language-select" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LOCALE_CODES.map((code) => (
            <SelectItem key={code} value={code} className="py-2">
              {LOCALE_LABELS[code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
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
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="flex flex-row items-center gap-2 border-b border-border p-2 group-data-[collapsible=icon]:justify-center">
        <LogoIconButton
          appearance="sidebar"
          className="shrink-0 group-data-[collapsible=icon]:mx-auto"
          label="Kacper Fleming"
        />
        <div className="ml-auto flex shrink-0 group-data-[collapsible=icon]:hidden">
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
      <SidebarContent className="py-4 group-data-[collapsible=icon]:hidden">
        <LanguageSelect
          sessionId={sessionId}
          onVoiceReconnect={onVoiceReconnect}
        />
      </SidebarContent>
      <SidebarFooter className="hidden border-t border-border p-2 group-data-[collapsible=icon]:block">
        <SidebarTrigger className="size-8" />
      </SidebarFooter>
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
    <SidebarProvider defaultOpen>
      <SettingsSidebar
        sessionId={sessionId}
        onVoiceReconnect={onVoiceReconnect}
      />
      <MobileMenuButton />
      <SidebarInset className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-transparent">
        <AgentAura />
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

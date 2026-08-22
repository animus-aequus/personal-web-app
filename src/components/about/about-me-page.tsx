"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import { AboutIntro } from "@/components/about/about-intro";
import { ProfileTiltCard } from "@/components/about/profile-tilt-card";
import { GreetingRadialAura } from "@/components/visualizer/greeting-radial-aura";
import { CHAT_PATH } from "@/lib/site-paths";

export function AboutMePageContent() {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <GreetingRadialAura active />
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8 text-foreground drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)] sm:py-14">
        <Link
          href={CHAT_PATH}
          className="mb-8 flex w-fit items-center gap-2 self-center text-sm text-foreground/80 underline-offset-4 transition-colors hover:text-foreground hover:underline lg:self-start"
        >
          <ArrowLeftIcon className="size-4" />
          {t("aboutMe.backToChat")}
        </Link>

        <h1 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-left">
          {t("aboutMe.title")}
        </h1>

        <div className="mt-10 flex flex-col items-center gap-10 lg:mt-12 lg:flex-row lg:items-center lg:gap-14">
          <ProfileTiltCard className="shrink-0" />
          <AboutIntro />
        </div>
      </div>
    </div>
  );
}

"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import { CHAT_PATH } from "@/lib/site-paths";

export function AboutMePageContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8 sm:py-14">
      <Link
        href={CHAT_PATH}
        className="mb-8 w-fit text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline self-center lg:self-start flex items-center gap-2"
      >
        <ArrowLeftIcon className="size-4" />
        {t("aboutMe.backToChat")}
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {t("aboutMe.title")}
      </h1>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        {t("aboutMe.comingSoon")}
      </p>
    </div>
  );
}

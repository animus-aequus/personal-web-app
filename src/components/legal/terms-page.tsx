"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

const SECTION_KEYS = [
  "service",
  "ai",
  "noAdvice",
  "liability",
  "data",
  "changes",
] as const;

export function TermsPageContent() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-8 sm:py-14">
      <Link
        href="/"
        className="mb-8 w-fit text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline self-center lg:self-start flex items-center gap-2"
      >
        <ArrowLeftIcon className="size-4" />
        {t("terms.backToChat")}
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {t("terms.title")}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">{t("terms.updated")}</p>
      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
        {t("terms.intro")}
      </p>

      <div className="mt-10 space-y-8">
        {SECTION_KEYS.map((key) => (
          <section key={key} className="space-y-2">
            <h2 className="text-base font-medium text-foreground">
              {t(`terms.sections.${key}.title`)}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t(`terms.sections.${key}.body`)}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}

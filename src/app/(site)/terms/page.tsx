import type { Metadata } from "next";

import { TermsPageContent } from "@/components/legal/terms-page";

export const metadata: Metadata = {
  title: "Terms of use · Kacper Fleming",
  description:
    "Terms of use for the personal website AI chat assistant — accuracy, advice, and liability.",
};

export default function TermsRoute() {
  return <TermsPageContent />;
}

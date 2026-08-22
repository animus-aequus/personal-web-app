import type { Metadata } from "next";

import { AboutMePageContent } from "@/components/about/about-me-page";

export const metadata: Metadata = {
  title: "About me · Kacper Fleming",
  description: "About Kacper Fleming.",
};

export default function AboutMeRoute() {
  return <AboutMePageContent />;
}

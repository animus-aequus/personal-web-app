import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kacper Fleming's Personal Website",
  description: "Homepage of Kacper Fleming, a software engineer and AI enthusiast.",
  icons: {
    icon: "/logo.svg",
  },
};

// The UI is dark-only. Declaring it in the document head (not just CSS) stops
// mobile browsers — Chrome Android's auto-dark, Samsung Internet's dark mode —
// from re-mapping the palette themselves.
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#04070f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster theme="dark" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}

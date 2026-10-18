import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], display: "swap", weight: ["500", "600", "700", "800"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "iCET - Institute of Computer Engineering Technology",
    template: "%s | iCET",
  },
  description:
    "Enroll in industry-aligned Software Engineering courses in Sri Lanka at iCET. Gain expert guidance, hands-on training, and real-world project experience.",
  applicationName: "iCET",
  referrer: "origin-when-cross-origin",
  formatDetection: { telephone: true, email: true },
};

export const viewport: Viewport = {
  themeColor: "#046bd2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (password managers, translators, dark-mode tools)
    // add attributes to <html>/<body> before React hydrates. This only ignores attribute
    // differences on these two elements; mismatches inside the page are still reported.
    <html lang="en" className={`${inter.variable} ${jakarta.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <TopLoader />
        {children}
      </body>
    </html>
  );
}

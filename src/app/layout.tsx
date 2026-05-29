import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gyomu Navi",
  description: "業務ナビ — 社内のダッシュボード、勤怠、報告、連絡、マスタ、設定",
  applicationName: "Gyomu Navi",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Gyomu Navi",
    description: "社内オペレーション用ナビゲーション",
    type: "website",
  },
  twitter: { card: "summary" },
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "業務ナビ",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

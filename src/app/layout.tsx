import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gyomu Navi",
  description: "業務ナビ — 社内のダッシュボード、勤怠、報告、連絡、マスタ、設定",
  openGraph: {
    title: "Gyomu Navi",
    description: "社内オペレーション用ナビゲーション",
    type: "website",
  },
  twitter: { card: "summary" },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

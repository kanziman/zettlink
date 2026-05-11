// 대시보드 전역 레이아웃을 정의합니다.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "zettlink dashboard",
  description: "Local zettlink review dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";
import type {Metadata} from "next";

export const metadata: Metadata = {
  title: "CVResume | 简历救兵",
  description: "简历救兵 CVResume，基于目标 JD 智能生成更贴近岗位需求的高质量简历",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico"
  }
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

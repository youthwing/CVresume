"use client";

import Link from "next/link";
import {useLocale} from "next-intl";
import {Headset} from "lucide-react";

export function OnlineSupportButton() {
  const locale = useLocale();

  return (
    <Link
      href={`/${locale}/feedbacks`}
      aria-label={locale === "en" ? "Online support" : "在线客服"}
      className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_18px_40px_rgba(37,99,235,0.28)] transition-transform hover:-translate-y-0.5 hover:bg-blue-500"
    >
      <Headset className="h-5 w-5" />
    </Link>
  );
}

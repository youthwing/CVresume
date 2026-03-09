"use client";

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {
  BadgeCheck,
  ChevronDown,
  CircleHelp,
  Coins,
  Gift,
  History,
  LogOut,
  Moon,
  ReceiptText,
  Share2,
  SunMedium,
  Ticket,
  Wand2
} from "lucide-react";
import {useEffect, useMemo, useRef, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {useTheme} from "next-themes";
import {Button} from "@/components/ui/button";
import {useAuth} from "@/components/providers/auth-provider";
import {cn} from "@/lib/utils";

function replaceLocale(pathname: string, locale: string) {
  const segments = pathname.split("/");
  if (segments.length > 1) {
    segments[1] = locale;
  }
  return segments.join("/") || `/${locale}`;
}

export function SiteHeader() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const {theme, setTheme} = useTheme();
  const {user, logout} = useAuth();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const planLabel = user?.role === "ADMIN"
    ? (locale === "en" ? "Admin" : "管理员")
    : user?.proMember
      ? (locale === "en" ? "Pro" : "专业版")
      : (locale === "en" ? "Basic" : "普通用户");
  const menuItems = useMemo(() => ([
    {href: `/${locale}/history`, label: locale === "en" ? "History" : "历史简历", icon: History},
    {href: `/${locale}/my-shares`, label: locale === "en" ? "My Shares" : "我的分享", icon: Share2},
    {href: `/${locale}/redeem`, label: locale === "en" ? "Redeem Credits" : "兑换积分", icon: Gift},
    {href: `/${locale}/packages`, label: locale === "en" ? "Store" : "积分商城", icon: Ticket},
    {href: `/${locale}/orders`, label: locale === "en" ? "My Orders" : "我的订单", icon: ReceiptText},
    {href: `/${locale}/invitations`, label: locale === "en" ? "Invitations" : "我的邀请", icon: BadgeCheck},
    {href: `/${locale}/feedbacks`, label: locale === "en" ? "Submit Issue" : "提交问题", icon: CircleHelp},
    ...(user?.role === "ADMIN" ? [{href: `/${locale}/admin`, label: locale === "en" ? "Admin Console" : "管理后台", icon: BadgeCheck}] : [])
  ]), [locale, user?.role]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href={`/${locale}/marketplace`} className="shrink-0 text-[18px] font-black tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[19px]">
            {t("appName")}
          </Link>
          <Button asChild size="sm" className="h-8 rounded-lg bg-blue-500 px-3 text-white shadow-none hover:bg-blue-600">
            <Link href={`/${locale}/create`}>
              <span className="inline-flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                {t("create")}
              </span>
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                locale === "zh"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              )}
              onClick={() => router.push(replaceLocale(pathname, "zh"))}
            >
              中文
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                locale === "en"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              )}
              onClick={() => router.push(replaceLocale(pathname, "en"))}
            >
              EN
            </button>
          </div>
          <button
            type="button"
            aria-label={t("theme")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-100 dark:text-slate-200 dark:hover:border-slate-800 dark:hover:bg-slate-900"
          >
            {mounted ? (theme === "dark" ? <SunMedium className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <span className="h-4 w-4" />}
          </button>
          <Link href={`/${locale}/pricing`} className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white sm:block">
            {t("pricing")}
          </Link>
          {user ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900/80"
              >
                <span className="max-w-[128px] truncate sm:max-w-[188px]">{user.email}</span>
                <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", menuOpen && "rotate-180")} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[274px] overflow-hidden rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-slate-950">
                  <div className="px-2 pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{user.email}</div>
                      <ChevronDown className="h-4 w-4 text-slate-300" />
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {planLabel}
                    </div>
                  </div>

                  <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />

                  <div className="grid grid-cols-2 gap-2 py-2">
                    <MenuStatRow
                      icon={Coins}
                      label={locale === "en" ? "Credits" : "积分"}
                      value={String(user.credits)}
                    />
                    <MenuStatRow
                      icon={Ticket}
                      label={locale === "en" ? "Plan" : "身份"}
                      value={planLabel}
                    />
                  </div>

                  <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />

                  <div className="space-y-1">
                    {menuItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-900"
                        >
                          <Icon className="h-4 w-4 text-slate-400" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>

                  <div className="my-1 h-px bg-slate-200 dark:bg-slate-800" />

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-900"
                  >
                    <LogOut className="h-4 w-4 text-slate-400" />
                    {t("logout")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button asChild size="sm" className="h-8 rounded-lg bg-blue-500 px-4 text-white hover:bg-blue-600">
              <Link href={`/${locale}/login`}>{t("login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

function MenuStatRow({
  icon: Icon,
  label,
  value
}: {
  icon: React.ComponentType<{className?: string}>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-[18px] font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

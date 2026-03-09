"use client";

import {useEffect} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {useLocale} from "next-intl";
import {oauthApi} from "@/lib/api";
import {useAuth} from "@/components/providers/auth-provider";
import {toast} from "sonner";

export default function OAuthCallbackPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {setAuth} = useAuth();

  useEffect(() => {
    const provider = searchParams.get("provider");
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!provider || !code || !state) {
      toast.error(locale === "en" ? "Missing OAuth parameters" : "OAuth 参数缺失");
      router.push(`/${locale}/login`);
      return;
    }

    oauthApi.callback(provider, code, state, locale)
      .then(({data}) => {
        setAuth(data);
        toast.success(locale === "en" ? "OAuth login complete" : "OAuth 登录成功");
        router.push(`/${locale}/create`);
      })
      .catch(() => {
        toast.error(locale === "en" ? "OAuth login failed" : "OAuth 登录失败");
        router.push(`/${locale}/login`);
      });
  }, [locale, router, searchParams, setAuth]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4">
      <div className="text-center">
        <div className="text-2xl font-semibold text-slate-900 dark:text-white">
          {locale === "en" ? "Completing sign-in..." : "正在完成登录..."}
        </div>
        <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {locale === "en" ? "Please wait a moment." : "请稍候。"}
        </div>
      </div>
    </main>
  );
}

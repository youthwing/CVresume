"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {Trash2} from "lucide-react";
import {useAuth} from "@/components/providers/auth-provider";
import {ResumePreview} from "@/components/sections/resume-preview";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {shareApi} from "@/lib/api";
import {normalizeResume} from "@/lib/resume";
import {toast} from "sonner";
import type {SharedResumeView} from "@/lib/types";

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

export default function MySharesPage() {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading} = useAuth();
  const [items, setItems] = useState<SharedResumeView[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/my-shares`);
      return;
    }

    shareApi.mine()
      .then(({data}) => setItems(data.content))
      .catch(() => toast.error(sectionText(locale, "我的分享加载失败", "Failed to load shared resumes")))
      .finally(() => setLoadingItems(false));
  }, [loading, user, locale, router]);

  async function handleDelete(id: string) {
    await shareApi.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
    toast.success(sectionText(locale, "已删除分享", "Shared resume deleted"));
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{sectionText(locale, "我的分享", "My Shares")}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "管理已经分享到广场的简历案例。", "Manage the resume cases you shared to the marketplace.")}</p>
        </div>
        <Link href={`/${locale}/history`}>
          <Button>{sectionText(locale, "返回历史简历", "Back to history")}</Button>
        </Link>
      </div>

      {loadingItems && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "正在加载...", "Loading...")}</CardContent>
        </Card>
      )}

      {!loadingItems && items.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{sectionText(locale, "还没有分享案例", "No shared resumes yet")}</CardTitle>
            <CardDescription>{sectionText(locale, "先到历史简历里打开一份结果，再点击分享。", "Open a generated result from history and share it from there.")}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="space-y-6">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_240px]">
              <div className="min-w-0">
                <ResumePreview resume={normalizeResume(item.resumePreview)} className="shadow-none" />
              </div>
              <div className="space-y-3">
                <div className="text-xl font-semibold text-slate-900 dark:text-white">{item.companyName}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {sectionText(locale, "匹配度", "Match")} {item.matchScore}% · {sectionText(locale, "浏览", "Views")} {item.viewCount} · {sectionText(locale, "使用", "Uses")} {item.useCount}
                </div>
                <Link href={`/${locale}/shared/${item.id}`}>
                  <Button className="w-full">{sectionText(locale, "打开分享页", "Open shared page")}</Button>
                </Link>
                <Button variant="ghost" className="w-full" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {sectionText(locale, "删除分享", "Delete share")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";
import {Building2, CalendarDays, Eye, MousePointerClick, ShieldCheck} from "lucide-react";
import {shareApi} from "@/lib/api";
import {normalizeResume} from "@/lib/resume";
import {templateOptions} from "@/lib/templates";
import type {SharedResumeView} from "@/lib/types";
import {ResumePreview} from "@/components/sections/resume-preview";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  });
}

function PreviewFrame({item}: {item: SharedResumeView}) {
  const preview = normalizeResume(item.resumePreview);

  return (
    <div className="relative h-full overflow-hidden rounded-[12px] bg-[#f4f5f7]">
      <div className="pointer-events-none absolute left-1/2 top-4 w-[794px] origin-top -translate-x-1/2 scale-[0.29]">
        <ResumePreview resume={preview} />
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const t = useTranslations("marketplace");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<SharedResumeView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    shareApi.list().then(({data}) => {
      setItems(data.content);
    }).finally(() => setLoading(false));
  }, []);

  async function handleApplyTemplate(item: SharedResumeView) {
    await shareApi.recordUse(item.id).catch(() => undefined);
    router.push(`/${locale}/create?template=${item.templateId}&share=${item.id}`);
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-black tracking-[-0.05em] text-slate-950 sm:text-[56px]">{t("title")}</h1>
          <p className="mt-3 text-sm text-slate-500 sm:text-base">{t("subtitle")}</p>
        </div>

        <div className="mt-7 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            <ShieldCheck className="h-4 w-4 text-blue-500" />
            {locale === "en" ? "Sensitive information has been masked" : "该简历已进行隐私脱敏处理"}
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading ? (
            Array.from({length: 3}).map((_, index) => (
              <Card key={index} className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                <div className="aspect-[0.76] animate-pulse bg-slate-100" />
                <div className="border-t border-slate-200 p-4">
                  <div className="h-4 w-32 animate-pulse rounded-full bg-slate-200" />
                </div>
              </Card>
            ))
          ) : (
            items.map((item) => {
              const preview = normalizeResume(item.resumePreview);
              const templateLabel = templateOptions.find((template) => template.id === item.templateId);
              const primaryRole = preview.candidateProfile.targetRole || preview.candidateProfile.title;
              const secondaryRole = preview.candidateProfile.title && preview.candidateProfile.title !== primaryRole
                ? preview.candidateProfile.title
                : (locale === "en" ? templateLabel?.titleEn : templateLabel?.title);

              return (
                <Card key={item.id} className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                  <div className="p-4">
                    <Link href={`/${locale}/shared/${item.id}`} className="block aspect-[0.76]">
                      <PreviewFrame item={item} />
                    </Link>
                  </div>

                  <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
                    <Button asChild variant="outline" className="h-9 flex-1 rounded-lg">
                      <Link href={`/${locale}/shared/${item.id}`}>{locale === "en" ? "Preview" : "预览"}</Link>
                    </Button>
                    <Button className="h-9 flex-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600" onClick={() => void handleApplyTemplate(item)}>
                      {locale === "en" ? "Use template" : "使用模板"}
                    </Button>
                  </div>

                  <div className="space-y-3 border-t border-slate-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-slate-900">
                          <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="truncate text-[18px] font-semibold">{item.companyName}</div>
                        </div>
                      </div>
                      <div className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-600">{item.matchScore}%</div>
                    </div>

                    <div className="space-y-1">
                      {primaryRole && <div className="text-sm font-medium text-slate-900">{primaryRole}</div>}
                      {secondaryRole && <div className="text-sm text-slate-500">{secondaryRole}</div>}
                    </div>

                    <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
                      <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-4 w-4" />
                          {formatDate(item.createdAt, locale)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {item.viewCount}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MousePointerClick className="h-4 w-4" />
                          {item.useCount}
                        </span>
                      </div>
                      <div>{preview.locale === "en" ? "EN" : "中文"}</div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

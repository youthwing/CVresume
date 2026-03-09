"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useParams, useRouter} from "next/navigation";
import {ArrowLeft, Eye, MousePointerClick, ShieldCheck, Sparkles} from "lucide-react";
import {InsightList, KeywordBlock, RadarAnalysis, sectionText} from "@/components/sections/resume-analysis-panels";
import {ResumePreview} from "@/components/sections/resume-preview";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {shareApi} from "@/lib/api";
import {
  buildHrSummary,
  buildImprovementItems,
  buildMatchAxes,
  buildStrengths,
  normalizeResume
} from "@/lib/resume";
import type {SharedResumeView} from "@/lib/types";

export default function SharedResumePage() {
  const params = useParams<{id: string}>();
  const locale = useLocale();
  const router = useRouter();
  const [item, setItem] = useState<SharedResumeView | null>(null);

  useEffect(() => {
    if (!params.id) {
      return;
    }

    shareApi.get(params.id).then(({data}) => setItem(data));
    shareApi.recordView(params.id).catch(() => undefined);
  }, [params.id]);

  async function handleUse() {
    if (!params.id) {
      return;
    }

    await shareApi.recordUse(params.id).catch(() => undefined);
    const activeTemplate = item?.templateId ?? "classic";
    router.push(`/${locale}/create?template=${activeTemplate}&share=${params.id}`);
  }

  if (!item) {
    return <main className="mx-auto max-w-6xl px-4 py-12">{locale === "en" ? "Loading..." : "加载中..."}</main>;
  }

  const preview = normalizeResume(item.resumePreview);
  const matchAxes = buildMatchAxes(preview);
  const strengths = buildStrengths(preview);
  const improvements = buildImprovementItems(preview);
  const hrSummary = buildHrSummary(preview);
  const missingKeywords = preview.jobKeywords.filter((keyword) => !new Set(preview.atsKeywords.map((item) => item.toLowerCase())).has(keyword.toLowerCase()));

  return (
    <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Link href={`/${locale}/marketplace`} className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          {sectionText(locale, "返回广场", "Back to marketplace")}
        </Link>

        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            {item.viewCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MousePointerClick className="h-4 w-4" />
            {item.useCount}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 text-sm text-slate-600">
          <ShieldCheck className="h-4 w-4 text-blue-500" />
          {sectionText(locale, "该简历已进行隐私脱敏处理", "Sensitive information has been masked")}
        </div>
        <Button className="h-11 rounded-2xl px-5" onClick={() => void handleUse()}>
          <Sparkles className="mr-2 h-4 w-4" />
          {sectionText(locale, "选为模板", "Use as template")}
        </Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden border-slate-200 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
          <CardHeader className="border-b border-slate-200 bg-white pb-5">
            <CardTitle className="text-[28px] font-bold tracking-tight text-slate-950">
              {sectionText(locale, "定制简历", "Tailored Resume")}
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-[#f8fafc] p-4 sm:p-6">
            <ResumePreview resume={preview} />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <CardHeader className="border-b border-slate-200 bg-white pb-5">
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{sectionText(locale, "JD 匹配分析", "JD Match Analysis")}</span>
                <span className="text-2xl font-black text-slate-950">{preview.matchScore}/100</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white pt-6">
              <RadarAnalysis axes={matchAxes} locale={locale} />
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <CardHeader className="border-b border-slate-200 bg-white pb-5">
              <CardTitle>{sectionText(locale, "关键词分析", "Keyword Analysis")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 bg-white pt-6">
              <KeywordBlock
                title={sectionText(locale, "命中关键词", "Matched Keywords")}
                items={preview.atsKeywords}
                tone="blue"
                emptyText={sectionText(locale, "暂无命中关键词", "No matched keywords yet")}
              />
              <KeywordBlock
                title={sectionText(locale, "缺失关键词", "Missing Keywords")}
                items={missingKeywords}
                tone="amber"
                emptyText={sectionText(locale, "当前没有明显缺失项", "No obvious gaps right now")}
              />
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,0.06)]">
            <CardHeader className="border-b border-slate-200 bg-white pb-5">
              <CardTitle>{sectionText(locale, "HR视角建议", "HR Perspective")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 bg-white pt-6">
              <p className="text-sm leading-7 text-slate-600">{hrSummary}</p>

              <InsightList
                title={sectionText(locale, "优势", "Strengths")}
                items={strengths}
              />

              <div>
                <div className="mb-3 text-sm font-semibold text-slate-900">
                  {sectionText(locale, "改进建议", "Improvements")}
                </div>
                <ul className="space-y-3">
                  {improvements.map((item, index) => (
                    <li key={`${item.field}-${index}`} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        [{item.field}]
                      </div>
                      <div className="leading-7">{item.text}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

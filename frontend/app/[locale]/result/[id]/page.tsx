"use client";

import Link from "next/link";
import {useEffect, useMemo, useRef, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {ArrowLeft, ChevronDown, Copy, Download, PencilLine, Save, Share2, Sparkles, Wand2} from "lucide-react";
import {InsightList, KeywordBlock, RadarAnalysis, sectionText} from "@/components/sections/resume-analysis-panels";
import {ResumeDiyPanel} from "@/components/sections/resume-diy-panel";
import {ResumeEditor} from "@/components/sections/resume-editor";
import {ResumePreview} from "@/components/sections/resume-preview";
import {useAuth} from "@/components/providers/auth-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {jobApi, projectApi, shareApi} from "@/lib/api";
import {downloadPdfFromElement, downloadWordDocument, slugifyFileName} from "@/lib/export";
import {
  buildHrSummary,
  buildImprovementItems,
  buildMatchAxes,
  buildStrengths,
  normalizeResume,
  resumeToPlainText
} from "@/lib/resume";
import {templateOptions, type TemplateId} from "@/lib/templates";
import {cn} from "@/lib/utils";
import {toast} from "sonner";
import type {JobView, ProjectView, ResumeResult} from "@/lib/types";

export default function ResultPage({
  params
}: {
  params: {locale: string; id: string};
}) {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading} = useAuth();
  const [job, setJob] = useState<JobView | null>(null);
  const [project, setProject] = useState<ProjectView | null>(null);
  const [resume, setResume] = useState<ResumeResult | null>(null);
  const [draft, setDraft] = useState<ResumeResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isDiyOpen, setIsDiyOpen] = useState(false);
  const [activeVersion, setActiveVersion] = useState<"polished" | "original">("polished");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishElapsedSeconds, setPolishElapsedSeconds] = useState(0);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const editingPreviewRef = useRef<HTMLDivElement | null>(null);
  const diyPreviewRef = useRef<HTMLDivElement | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/result/${params.id}`);
      return;
    }

    let cancelled = false;
    let retryTimer: number | null = null;

    const loadResult = async () => {
      try {
        setLoadingPage(true);
        const status = await jobApi.status(params.id);
        if (cancelled) {
          return;
        }
        setJob(status.data);
        const linkedProject = await projectApi.get(status.data.projectId);
        if (cancelled) {
          return;
        }
        setProject(linkedProject.data);

        if (status.data.result) {
          const normalized = normalizeResume(status.data.result);
          setResume(normalized);
          setDraft((current) => current ?? normalized);
          return;
        }

        if (status.data.status !== "SUCCEEDED") {
          retryTimer = window.setTimeout(() => {
            void loadResult();
          }, 1000);
        }
      } catch {
        toast.error(sectionText(locale, "结果页加载失败", "Failed to load result"));
      } finally {
        if (!cancelled) {
          setLoadingPage(false);
        }
      }
    };

    void loadResult();

    return () => {
      cancelled = true;
      if (retryTimer != null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [loading, user, locale, router, params.id]);

  useEffect(() => {
    if (!exportMenuOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!polishing) {
      setPolishElapsedSeconds(0);
      return;
    }

    setPolishElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setPolishElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [polishing]);

  const polishedResume = draft ?? resume;
  const matchAxes = useMemo(() => polishedResume ? buildMatchAxes(polishedResume) : [], [polishedResume]);
  const strengths = useMemo(() => polishedResume ? buildStrengths(polishedResume) : [], [polishedResume]);
  const improvements = useMemo(() => polishedResume ? buildImprovementItems(polishedResume) : [], [polishedResume]);
  const hrSummary = useMemo(() => polishedResume ? buildHrSummary(polishedResume) : "", [polishedResume]);
  const missingKeywords = useMemo(() => {
    if (!polishedResume) {
      return [];
    }
    const matched = new Set(polishedResume.atsKeywords.map((keyword) => keyword.toLowerCase()));
    return polishedResume.jobKeywords.filter((keyword) => !matched.has(keyword.toLowerCase()));
  }, [polishedResume]);

  async function persistResume(nextResume: ResumeResult, closeInlineEditor: boolean, silent = false) {
    if (!job || !resume) {
      return;
    }

    setSaving(true);
    try {
      const {data} = await jobApi.updateResumeContent(
        job.id,
        Math.max(resume.version, nextResume.version),
        nextResume,
        nextResume.candidateProfile
      );
      const normalized = normalizeResume(data);
      setResume(normalized);
      setDraft(normalized);
      if (closeInlineEditor) {
        setIsEditing(false);
      }
      if (!silent) {
        toast.success(sectionText(locale, "简历内容已保存", "Resume updated"));
      }
      return normalized;
    } catch {
      if (!silent) {
        toast.error(sectionText(locale, "保存失败", "Failed to save changes"));
      }
      throw new Error("save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function persistDraft(closeInlineEditor: boolean) {
    if (!draft) {
      return;
    }
    await persistResume(draft, closeInlineEditor);
  }

  async function handleAiPolish(instruction: string) {
    if (!job || !polishedResume) {
      return;
    }

    const currentResume = normalizeResume(draft ?? polishedResume);
    setPolishing(true);
    try {
      const {data} = await jobApi.polishResume(job.id, {
        instruction,
        resumeData: currentResume,
        candidateProfile: currentResume.candidateProfile
      });
      const normalized = normalizeResume(data);
      setDraft(normalized);
      setActiveVersion("polished");

      try {
        const persisted = await persistResume(normalized, false, true);
        if (persisted) {
          setResume(persisted);
          setDraft(persisted);
        }
        toast.success(sectionText(locale, "AI 润色已应用并保存到结果页", "AI rewrite applied and saved"));
      } catch {
        toast.success(sectionText(locale, "AI 已生成新的润色草稿，请手动点保存", "AI rewrite draft is ready. Save it manually."));
      }
    } catch (error) {
      const message = typeof error === "object" && error && "response" in error
        ? (error as {response?: {data?: {message?: string}}}).response?.data?.message
        : undefined;
      toast.error(message || sectionText(locale, "AI 润色失败", "AI rewrite failed"));
    } finally {
      setPolishing(false);
    }
  }

  function handleCancel() {
    setDraft(resume);
    setIsEditing(false);
  }

  async function handleTemplateChange(nextTemplate: TemplateId) {
    if (!job) {
      return;
    }
    try {
      const {data} = await jobApi.updateTemplate(job.id, nextTemplate);
      setJob(data);
      if (data.result) {
        const normalized = normalizeResume(data.result);
        setResume(normalized);
        setDraft(normalized);
      }
    } catch {
      toast.error(sectionText(locale, "模板切换失败", "Failed to switch template"));
    }
  }

  async function handleShare() {
    if (!job) {
      return;
    }
    setSharing(true);
    try {
      const {data} = await shareApi.create(job.id);
      toast.success(sectionText(locale, "已分享至广场", "Shared to marketplace"));
      router.push(`/${locale}/shared/${data.id}`);
    } catch {
      toast.error(sectionText(locale, "分享失败", "Failed to share"));
    } finally {
      setSharing(false);
    }
  }

  async function handleCopy() {
    if (activeVersion === "original" && project) {
      await navigator.clipboard.writeText(project.resumeText);
    } else if (polishedResume) {
      await navigator.clipboard.writeText(resumeToPlainText(polishedResume));
    } else {
      return;
    }
    toast.success(sectionText(locale, "已复制到剪贴板", "Copied to clipboard"));
  }

  function buildExportBaseName() {
    const exportResume = polishedResume ?? resume;
    return `${slugifyFileName(exportResume?.candidateProfile.displayName ?? "resume")}-${slugifyFileName(exportResume?.companyName ?? project?.companyName ?? "resume")}`;
  }

  async function handleExportPdf() {
    const sourceWrapper = isDiyOpen
      ? diyPreviewRef.current
      : isEditing
        ? editingPreviewRef.current
        : previewRef.current;
    const resumeRoot = sourceWrapper?.querySelector<HTMLElement>(".resume-paper") ?? sourceWrapper?.querySelector<HTMLElement>("[data-resume-paper]");
    if (!resumeRoot || !polishedResume) {
      toast.error(sectionText(locale, "导出失败", "Failed to export"));
      return;
    }

    try {
      await downloadPdfFromElement({
        element: resumeRoot,
        filename: `${buildExportBaseName()}.pdf`
      });
      setExportMenuOpen(false);
      toast.success(sectionText(locale, "已导出 PDF 文件", "Exported PDF file"));
    } catch {
      toast.error(sectionText(locale, "PDF 导出失败", "Failed to export PDF"));
    }
  }

  function handleExportWord() {
    if (!polishedResume) {
      toast.error(sectionText(locale, "导出失败", "Failed to export"));
      return;
    }

    try {
      downloadWordDocument({
        title: `${polishedResume.candidateProfile.displayName} - ${polishedResume.companyName}`,
        content: resumeToPlainText(polishedResume),
        filename: `${buildExportBaseName()}.doc`
      });
      setExportMenuOpen(false);
      toast.success(sectionText(locale, "已导出 Word 文件", "Exported Word file"));
    } catch {
      toast.error(sectionText(locale, "Word 导出失败", "Failed to export Word"));
    }
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <main className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6">
        <Link href={`/${locale}/history`} className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          {sectionText(locale, "返回历史简历", "Back to history")}
        </Link>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <Card className="overflow-hidden border-slate-200 shadow-[0_16px_36px_rgba(15,23,42,0.06)] dark:border-slate-800">
              <CardHeader className="border-b border-slate-200/80 bg-white pb-6 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <CardTitle className="text-[28px] font-bold tracking-tight text-slate-950 dark:text-white">
                      {sectionText(locale, "定制简历", "Tailored Resume")}
                    </CardTitle>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {isEditing ? (
                      <>
                        <Button variant="outline" onClick={handleCancel}>
                          {sectionText(locale, "取消", "Cancel")}
                        </Button>
                        <Button onClick={() => void persistDraft(true)} disabled={saving}>
                          <Save className="mr-2 h-4 w-4" />
                          {saving ? sectionText(locale, "保存中...", "Saving...") : sectionText(locale, "保存", "Save")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <ResultToolbarButton icon={PencilLine} label={sectionText(locale, "编辑", "Edit")} onClick={() => setIsEditing(true)} disabled={!resume || activeVersion !== "polished"} />
                        <ResultToolbarButton icon={Wand2} label={sectionText(locale, "DIY", "DIY")} onClick={() => setIsDiyOpen(true)} disabled={!polishedResume} />
                        <ResultToolbarButton icon={Copy} label={sectionText(locale, "复制", "Copy")} onClick={() => void handleCopy()} disabled={!polishedResume && !project} />
                        <ResultToolbarButton icon={Share2} label={sharing ? sectionText(locale, "分享中...", "Sharing...") : sectionText(locale, "分享", "Share")} onClick={() => void handleShare()} disabled={!resume || sharing} />
                        <div className="relative" ref={exportMenuRef}>
                          <Button variant="outline" className="h-12 rounded-2xl" onClick={() => setExportMenuOpen((current) => !current)} disabled={!polishedResume}>
                            <Download className="mr-2 h-4 w-4" />
                            {sectionText(locale, "导出", "Export")}
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                          {exportMenuOpen && (
                            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-[180px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                              <button
                                type="button"
                                onClick={() => void handleExportPdf()}
                                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                              >
                                {sectionText(locale, "导出为 PDF", "Export PDF")}
                              </button>
                              <button
                                type="button"
                                onClick={handleExportWord}
                                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                              >
                                {sectionText(locale, "导出为 Word", "Export Word")}
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <VersionCard
                    active={activeVersion === "original"}
                    title={sectionText(locale, "原始版本", "Original Version")}
                    description={sectionText(locale, "基于原始简历信息如实呈现", "Preserves the imported resume as-is")}
                    onClick={() => setActiveVersion("original")}
                  />
                  <VersionCard
                    active={activeVersion === "polished"}
                    title={sectionText(locale, "润色版本", "Polished Version")}
                    description={sectionText(locale, "润色优化，更符合职位要求", "Rewritten to better match the target role")}
                    onClick={() => setActiveVersion("polished")}
                  />
                </div>

                <div className="mt-5">
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                    {sectionText(locale, "选择简历模板", "Choose Resume Template")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {templateOptions.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => void handleTemplateChange(template.id)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm transition-colors",
                          polishedResume?.templateId === template.id
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white"
                        )}
                      >
                        {locale === "en" ? template.titleEn : template.title}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {resume?.companyName ?? project?.companyName ?? sectionText(locale, "结果页", "Result")}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                {loadingPage && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {sectionText(locale, "正在加载结果...", "Loading result...")}
                  </div>
                )}

                {!loadingPage && job?.status !== "SUCCEEDED" && !resume && (
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                      <span>{sectionText(locale, "当前进度", "Current progress")}</span>
                      <span>{job?.progress ?? 0}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{width: `${job?.progress ?? 0}%`}} />
                    </div>
                  </div>
                )}

                {!loadingPage && activeVersion === "original" && project && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <SourceBlock
                      title={sectionText(locale, "原始简历", "Source Resume")}
                      description={sectionText(locale, "这是生成前导入的原始背景信息。", "This is the imported resume before polishing.")}
                      content={project.resumeText}
                    />
                    <SourceBlock
                      title={sectionText(locale, "目标 JD", "Target JD")}
                      description={sectionText(locale, "系统基于这段职位描述进行定制。", "The tailored result is aligned to this target JD.")}
                      content={project.jdText}
                    />
                  </div>
                )}

                {!loadingPage && activeVersion === "polished" && polishedResume && !isEditing && (
                  <div ref={previewRef}>
                    <ResumePreview resume={polishedResume} />
                  </div>
                )}

                {!loadingPage && activeVersion === "polished" && draft && isEditing && (
                  <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
                    <div className="min-w-0">
                      <ResumeEditor locale={locale} value={draft} onChange={setDraft} />
                    </div>
                    <div className="min-w-0">
                      <div className="sticky top-20">
                        <Card className="overflow-hidden">
                          <CardHeader>
                            <CardTitle>{sectionText(locale, "实时预览", "Live Preview")}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4">
                            <div ref={editingPreviewRef}>
                              <ResumePreview resume={draft} />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="overflow-hidden border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,0.06)] dark:border-slate-800">
              <CardHeader className="border-b border-slate-200/80 bg-white pb-5 dark:border-slate-800 dark:bg-slate-950">
                <CardTitle className="flex items-center justify-between gap-3">
                  <span>{sectionText(locale, "JD 匹配分析", "JD Match Analysis")}</span>
                  <span className="text-2xl font-black text-slate-950 dark:text-white">{polishedResume?.matchScore ?? 0}/100</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="bg-white pt-6 dark:bg-slate-950">
                {matchAxes.length > 0
                  ? <RadarAnalysis axes={matchAxes} locale={locale} />
                  : <div className="text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "生成完成后会展示能力雷达。", "Radar analysis appears after generation.")}</div>}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,0.06)] dark:border-slate-800">
              <CardHeader className="border-b border-slate-200/80 bg-white pb-5 dark:border-slate-800 dark:bg-slate-950">
                <CardTitle>{sectionText(locale, "关键词分析", "Keyword Analysis")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 bg-white pt-6 dark:bg-slate-950">
                <KeywordBlock
                  title={sectionText(locale, "命中关键词", "Matched Keywords")}
                  items={polishedResume?.atsKeywords ?? []}
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

            <Card className="overflow-hidden border-slate-200 shadow-[0_14px_32px_rgba(15,23,42,0.06)] dark:border-slate-800">
              <CardHeader className="border-b border-slate-200/80 bg-white pb-5 dark:border-slate-800 dark:bg-slate-950">
                <CardTitle>{sectionText(locale, "HR视角建议", "HR Perspective")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 bg-white pt-6 dark:bg-slate-950">
                <p className="text-sm leading-7 text-slate-600 dark:text-slate-300">
                  {hrSummary || sectionText(locale, "生成完成后会在这里展示 HR 概览。", "A recruiter summary will appear here after generation.")}
                </p>

                <InsightList
                  title={sectionText(locale, "优势", "Strengths")}
                  items={strengths}
                />

                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                    {sectionText(locale, "改进建议", "Improvements")}
                  </div>
                  <ul className="space-y-3">
                    {improvements.map((item, index) => (
                      <li key={`${item.field}-${index}`} className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          [{item.field}]
                        </div>
                        <div className="leading-7">{item.text}</div>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link href={`/${locale}/create`}>
                  <Button className="w-full">
                    <Sparkles className="mr-2 h-4 w-4" />
                    {sectionText(locale, "生成新的定制简历", "Generate another tailored resume")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {draft && polishedResume && (
        <ResumeDiyPanel
          open={isDiyOpen}
          locale={locale}
          value={draft}
          saving={saving}
          polishing={polishing}
          polishElapsedSeconds={polishElapsedSeconds}
          previewRef={diyPreviewRef}
          templateId={draft.templateId as TemplateId}
          onChange={setDraft}
          onTemplateChange={handleTemplateChange}
          onAiPolish={(instruction) => void handleAiPolish(instruction)}
          onSave={() => void persistDraft(false)}
          onExport={handleExportWord}
          onClose={() => setIsDiyOpen(false)}
        />
      )}
    </>
  );
}

function VersionCard({
  active,
  title,
  description,
  onClick
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-4 text-left transition-colors",
        active
          ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm opacity-80">{description}</div>
    </button>
  );
}

function ResultToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled
}: {
  icon: typeof PencilLine;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="outline" className="h-12 rounded-2xl" onClick={onClick} disabled={disabled}>
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}

function SourceBlock({
  title,
  description,
  content
}: {
  title: string;
  description: string;
  content: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          {content}
        </pre>
      </CardContent>
    </Card>
  );
}

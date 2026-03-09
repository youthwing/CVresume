"use client";

import Link from "next/link";
import {useCallback, useEffect, useMemo, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter, useSearchParams} from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileStack,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  WandSparkles
} from "lucide-react";
import {useAuth} from "@/components/providers/auth-provider";
import {Button} from "@/components/ui/button";
import {templateOptions} from "@/lib/templates";
import {jobApi, projectApi} from "@/lib/api";
import {cn} from "@/lib/utils";
import {toast} from "sonner";
import type {JobView, ProjectView} from "@/lib/types";

interface HistoryItem {
  project: ProjectView;
  job: JobView | null;
}

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

function getStatusText(job: JobView | null, locale: string) {
  if (!job) {
    return sectionText(locale, "未生成", "Not generated");
  }
  if (job.status === "SUCCEEDED") {
    return sectionText(locale, "已完成", "Completed");
  }
  if (job.status === "FAILED") {
    return sectionText(locale, "生成失败", "Failed");
  }
  return sectionText(locale, "生成中", "Running");
}

function getStageText(progress: number, locale: string) {
  if (progress < 34) {
    return sectionText(locale, "正在解析 JD 与原始简历", "Parsing JD and source resume");
  }
  if (progress < 76) {
    return sectionText(locale, "正在重写简历内容与关键词", "Rewriting resume content and keywords");
  }
  return sectionText(locale, "正在生成 HR 分析与最终结果", "Generating HR analysis and final output");
}

function formatDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatTime(value: string, locale: string) {
  return new Date(value).toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getTemplateLabel(templateId: string, locale: string) {
  const matched = templateOptions.find((item) => item.id === templateId);
  if (!matched) {
    return templateId;
  }
  return locale === "en" ? matched.titleEn : matched.title;
}

function summarizeText(value: string, maxLength = 140) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength).trim()}...`;
}

function getProgressValue(job: JobView | null) {
  if (!job) {
    return 0;
  }
  if (job.status === "SUCCEEDED") {
    return 100;
  }
  if (job.status === "FAILED") {
    return Math.max(job.progress, 12);
  }
  return Math.max(job.progress, 8);
}

export default function HistoryPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusJobId = searchParams.get("focus");
  const {user, loading} = useAuth();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async (showLoading = true) => {
    if (!user) {
      return;
    }

    if (showLoading) {
      setLoadingItems(true);
    } else {
      setRefreshing(true);
    }

    try {
      const {data} = await projectApi.list();
      const sortedProjects = [...data].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      const jobs = await Promise.all(
        sortedProjects.map(async (project) => {
          if (!project.latestJobId) {
            return null;
          }
          try {
            const response = await jobApi.status(project.latestJobId);
            return response.data;
          } catch {
            return null;
          }
        })
      );

      setItems(sortedProjects.map((project, index) => ({
        project,
        job: jobs[index]
      })));
    } catch {
      toast.error(sectionText(locale, "历史记录加载失败", "Failed to load resume history"));
    } finally {
      setLoadingItems(false);
      setRefreshing(false);
    }
  }, [locale, user]);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/history`);
      return;
    }

    void loadItems(true);
  }, [loading, user, locale, router, loadItems]);

  const runningItems = useMemo(
    () => items.filter((item) => item.job && item.job.status !== "SUCCEEDED" && item.job.status !== "FAILED"),
    [items]
  );
  const failedItems = useMemo(
    () => items.filter((item) => item.job?.status === "FAILED"),
    [items]
  );
  const completedItems = useMemo(
    () => items.filter((item) => item.job?.status === "SUCCEEDED"),
    [items]
  );
  const averageMatchScore = useMemo(() => {
    if (completedItems.length === 0) {
      return null;
    }
    const total = completedItems.reduce((sum, item) => sum + (item.job?.result?.matchScore ?? 0), 0);
    return Math.round(total / completedItems.length);
  }, [completedItems]);
  const highlightedItem = useMemo(() => {
    if (focusJobId) {
      const focused = items.find((item) => item.job?.id === focusJobId);
      if (focused) {
        return focused;
      }
    }
    return runningItems[0] ?? failedItems[0] ?? completedItems[0] ?? items[0] ?? null;
  }, [completedItems, failedItems, focusJobId, items, runningItems]);

  useEffect(() => {
    if (runningItems.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadItems(false);
    }, 1600);

    return () => {
      window.clearInterval(timer);
    };
  }, [runningItems.length, loadItems]);

  async function handleDelete(projectId: string) {
    await projectApi.delete(projectId);
    setItems((current) => current.filter((item) => item.project.id !== projectId));
    toast.success(sectionText(locale, "项目已删除", "Project deleted"));
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.05em] text-slate-950">{sectionText(locale, "历史简历", "Resume History")}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {sectionText(locale, "把生成中的任务、已完成结果和最近记录放在同一个工作台里管理。", "Manage running jobs, finished resumes, and recent records in one workspace.")}
            </p>
          </div>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => void loadItems(false)} disabled={refreshing}>
            <RefreshCcw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>

        <div className="mb-8 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.9fr))]">
          <HistorySpotlight
            item={highlightedItem}
            locale={locale}
            autoRefreshing={runningItems.length > 0}
          />
          <SummaryStat
            icon={LoaderCircle}
            label={sectionText(locale, "生成中", "Running")}
            value={`${runningItems.length}`}
            detail={runningItems.length > 0
              ? sectionText(locale, "页面会自动刷新任务进度", "Progress refreshes automatically")
              : sectionText(locale, "当前没有运行中的任务", "No running jobs right now")}
            tone="blue"
          />
          <SummaryStat
            icon={CheckCircle2}
            label={sectionText(locale, "已完成", "Completed")}
            value={`${completedItems.length}`}
            detail={completedItems.length > 0
              ? sectionText(locale, "可直接打开结果页继续编辑", "Open any result to keep editing")
              : sectionText(locale, "完成后的简历会显示在这里", "Finished resumes will appear here")}
            tone="emerald"
          />
          <SummaryStat
            icon={Sparkles}
            label={sectionText(locale, "平均匹配度", "Avg. Match")}
            value={averageMatchScore != null ? `${averageMatchScore}%` : "--"}
            detail={averageMatchScore != null
              ? sectionText(locale, "按最近已完成记录计算", "Calculated from finished records")
              : sectionText(locale, "生成完成后展示平均匹配度", "Appears after you finish generating")}
            tone="amber"
          />
        </div>

        {loadingItems && (
          <div className="flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white px-5 py-6 text-sm text-slate-500 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {sectionText(locale, "正在加载你的历史记录...", "Loading your history...")}
          </div>
        )}

        {!loadingItems && items.length === 0 && (
          <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-8 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
            <div className="text-lg font-semibold text-slate-900">{sectionText(locale, "还没有历史简历", "No history yet")}</div>
            <p className="mt-2 max-w-[560px] text-sm leading-6 text-slate-500">
              {sectionText(locale, "先去创建一份定制简历，生成中的任务会自动出现在这里，并实时显示进度。", "Create your first tailored resume. Running jobs will appear here with live progress updates.")}
            </p>
            <Button asChild className="mt-5 h-10 rounded-xl bg-blue-500 px-5 text-white hover:bg-blue-600">
              <Link href={`/${locale}/create`}>
                <WandSparkles className="mr-2 h-4 w-4" />
                {sectionText(locale, "去创建", "Create now")}
              </Link>
            </Button>
          </div>
        )}

        {!loadingItems && items.length > 0 && (
          <div className="space-y-8">
            {runningItems.length > 0 && (
              <HistorySection
                title={sectionText(locale, "正在生成", "Generating")}
                description={sectionText(locale, "运行中的任务会自动刷新进度，点击即可查看详情页。", "Running jobs refresh automatically. Open any card to view the detailed result page.")}
                count={runningItems.length}
              >
                <div className="grid gap-4">
                  {runningItems.map((item) => (
                    <HistoryRecordCard
                      key={item.project.id}
                      item={item}
                      locale={locale}
                      focused={focusJobId != null && focusJobId === item.job?.id}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </HistorySection>
            )}

            {failedItems.length > 0 && (
              <HistorySection
                title={sectionText(locale, "需要处理", "Needs attention")}
                description={sectionText(locale, "失败的任务会保留错误信息，方便你继续查看和重试。", "Failed jobs keep their error state so you can inspect and retry them.")}
                count={failedItems.length}
              >
                <div className="grid gap-4">
                  {failedItems.map((item) => (
                    <HistoryRecordCard
                      key={item.project.id}
                      item={item}
                      locale={locale}
                      focused={focusJobId != null && focusJobId === item.job?.id}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </HistorySection>
            )}

            {completedItems.length > 0 && (
              <HistorySection
                title={sectionText(locale, "最近完成", "Recently completed")}
                description={sectionText(locale, "保留匹配度、关键词和模板信息，方便你快速对比不同版本。", "Match score, keywords, and template info stay visible so you can compare versions quickly.")}
                count={completedItems.length}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  {completedItems.map((item) => (
                    <HistoryRecordCard
                      key={item.project.id}
                      item={item}
                      locale={locale}
                      focused={focusJobId != null && focusJobId === item.job?.id}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </HistorySection>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function HistorySpotlight({
  item,
  locale,
  autoRefreshing
}: {
  item: HistoryItem | null;
  locale: string;
  autoRefreshing: boolean;
}) {
  if (!item) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_55%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          {sectionText(locale, "历史工作台", "History Workspace")}
        </div>
        <div className="mt-4 text-3xl font-black tracking-[-0.04em] text-slate-950">
          {sectionText(locale, "从这里追踪每一次生成", "Track every generation here")}
        </div>
        <p className="mt-3 max-w-[620px] text-sm leading-7 text-slate-500">
          {sectionText(locale, "开始创建后，运行进度、完成结果和最近版本都会按状态自动整理。", "After you start creating, running progress, finished results, and recent versions will all be organized by status.")}
        </p>
      </div>
    );
  }

  const {project, job} = item;
  const progress = getProgressValue(job);
  const isRunning = job && job.status !== "SUCCEEDED" && job.status !== "FAILED";
  const isFailed = job?.status === "FAILED";
  const isCompleted = job?.status === "SUCCEEDED";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_58%),linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
          <Sparkles className="h-3.5 w-3.5" />
          {sectionText(locale, "当前任务", "Current focus")}
        </div>
        {autoRefreshing && (
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            {sectionText(locale, "进度自动刷新中", "Auto-refreshing progress")}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm text-slate-500">{getStatusText(job, locale)}</div>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-slate-950">
            {project.companyName || sectionText(locale, "未命名项目", "Untitled project")}
          </h2>
          <p className="mt-3 max-w-[640px] text-sm leading-7 text-slate-600">
            {isRunning && job
              ? getStageText(job.progress, locale)
              : isFailed
                ? (job?.errorMessage || sectionText(locale, "任务未成功完成，建议打开详情页查看。", "The job did not finish successfully. Open the detail page to inspect it."))
                : sectionText(locale, "结果已生成完成，可以继续查看、导出或编辑。", "The resume is ready. Open it to review, export, or keep editing.")}
          </p>
        </div>

        <div className="rounded-[22px] border border-white/80 bg-white/80 px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
            {isCompleted ? sectionText(locale, "匹配度", "Match score") : sectionText(locale, "当前进度", "Current progress")}
          </div>
          <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
            {isCompleted ? `${job?.result?.matchScore ?? 0}/100` : `${progress}%`}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {sectionText(locale, "更新于", "Updated")} {job ? formatTime(job.updatedAt, locale) : formatTime(project.createdAt, locale)}
          </div>
        </div>
      </div>

      {job && (
        <>
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>{isCompleted ? sectionText(locale, "生成完成", "Completed") : getStageText(job.progress, locale)}</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar value={progress} status={job.status} />
          </div>

          <GenerationSteps progress={progress} locale={locale} status={job.status} />
        </>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <MetaChip icon={CalendarDays} label={formatDate(project.createdAt, locale)} />
        <MetaChip icon={FileStack} label={getTemplateLabel(project.templateId, locale)} />
        <MetaChip icon={Clock3} label={sectionText(locale, `${project.selectedModules.length} 个模块`, `${project.selectedModules.length} modules`)} />
        {project.usedReferenceImage && (
          <MetaChip icon={Sparkles} label={sectionText(locale, "参考图排版", "Reference layout")} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {job?.id && (
          <Button asChild className="h-10 rounded-xl bg-blue-500 px-5 text-white hover:bg-blue-600">
            <Link href={`/${locale}/result/${job.id}`}>
              {isRunning ? sectionText(locale, "查看进度", "Open progress") : sectionText(locale, "查看结果", "Open result")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" className="h-10 rounded-xl px-5">
          <Link href={`/${locale}/create`}>
            <WandSparkles className="mr-2 h-4 w-4" />
            {sectionText(locale, "继续创建", "Create another")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  detail,
  tone
}: {
  icon: typeof LoaderCircle;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "emerald" | "amber";
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600"
  };

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
      <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-2xl", toneClasses[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-4 text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-black tracking-[-0.04em] text-slate-950">{value}</div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function HistorySection({
  title,
  description,
  count,
  children
}: {
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-slate-950">{title}</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{count}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function HistoryRecordCard({
  item,
  locale,
  focused,
  onDelete
}: {
  item: HistoryItem;
  locale: string;
  focused: boolean;
  onDelete: (projectId: string) => Promise<void>;
}) {
  const {project, job} = item;
  const progress = getProgressValue(job);
  const linkHref = job?.id ? `/${locale}/result/${job.id}` : null;
  const isRunning = job && job.status !== "SUCCEEDED" && job.status !== "FAILED";
  const isFailed = job?.status === "FAILED";
  const isCompleted = job?.status === "SUCCEEDED";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[24px] border p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)] transition-colors",
        isRunning && "border-blue-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.72)_0%,#ffffff_100%)]",
        isCompleted && "border-slate-200 bg-white",
        isFailed && "border-rose-200 bg-rose-50/60",
        focused && "ring-2 ring-blue-300 ring-offset-2"
      )}
    >
      <button
        type="button"
        onClick={() => void onDelete(project.id)}
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
        aria-label={locale === "en" ? "Delete project" : "删除项目"}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div className="pr-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="truncate text-xl font-bold tracking-[-0.03em] text-slate-950">
                {project.companyName || sectionText(locale, "未命名项目", "Untitled project")}
              </h3>
              <StatusBadge job={job} locale={locale} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <MetaChip icon={CalendarDays} label={formatDate(project.createdAt, locale)} />
              <MetaChip icon={FileStack} label={getTemplateLabel(project.templateId, locale)} />
              <MetaChip icon={Clock3} label={sectionText(locale, `${project.selectedModules.length} 个模块`, `${project.selectedModules.length} modules`)} />
              {project.usedReferenceImage && (
                <MetaChip icon={Sparkles} label={sectionText(locale, "参考图排版", "Reference layout")} />
              )}
            </div>
          </div>

          <div className="shrink-0 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-right">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {isCompleted ? sectionText(locale, "匹配度", "Match") : sectionText(locale, "更新于", "Updated")}
            </div>
            <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">
              {isCompleted ? `${job?.result?.matchScore ?? 0}%` : formatTime(job?.updatedAt ?? project.createdAt, locale)}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-7 text-slate-600">
          {summarizeText(project.jdText, 170)}
        </p>

        {job && (
          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
              <span>
                {isRunning
                  ? getStageText(job.progress, locale)
                  : isFailed
                    ? sectionText(locale, "任务执行失败", "Job failed")
                    : sectionText(locale, "生成完成", "Completed")}
              </span>
              <span>{progress}%</span>
            </div>
            <ProgressBar value={progress} status={job.status} />
          </div>
        )}

        {isFailed && (
          <div className="mt-4 flex items-start gap-2 rounded-[18px] border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{job?.errorMessage || sectionText(locale, "任务失败，请重新查看详情页。", "The job failed. Open the detail page to inspect it.")}</span>
          </div>
        )}

        {isCompleted && job?.result && (
          <div className="mt-4 flex flex-wrap gap-2">
            {job.result.skills.primary.slice(0, 5).map((skill) => (
              <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {skill}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          {linkHref && (
            <Button asChild className={cn("h-9 rounded-xl px-4 text-white", isCompleted ? "bg-slate-900 hover:bg-slate-800" : "bg-blue-500 hover:bg-blue-600")}>
              <Link href={linkHref}>
                {isRunning
                  ? sectionText(locale, "查看进度", "Open progress")
                  : isFailed
                    ? sectionText(locale, "查看失败详情", "Inspect failure")
                    : sectionText(locale, "查看结果", "Open result")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="h-9 rounded-xl px-4">
            <Link href={`/${locale}/create`}>
              {sectionText(locale, "继续创建", "Create another")}
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({
  job,
  locale
}: {
  job: JobView | null;
  locale: string;
}) {
  const classes = !job
    ? "border-slate-200 bg-slate-100 text-slate-600"
    : job.status === "SUCCEEDED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : job.status === "FAILED"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", classes)}>
      {job?.status !== "SUCCEEDED" && job?.status !== "FAILED" && <LoaderCircle className="h-3 w-3 animate-spin" />}
      {getStatusText(job, locale)}
    </span>
  );
}

function MetaChip({
  icon: Icon,
  label
}: {
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function ProgressBar({
  value,
  status
}: {
  value: number;
  status: string;
}) {
  const tone = status === "SUCCEEDED"
    ? "bg-emerald-500"
    : status === "FAILED"
      ? "bg-rose-500"
      : "bg-blue-500";

  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full transition-all duration-500", tone, status !== "SUCCEEDED" && status !== "FAILED" && "animate-pulse")}
        style={{width: `${Math.min(100, Math.max(4, value))}%`}}
      />
    </div>
  );
}

function GenerationSteps({
  progress,
  locale,
  status
}: {
  progress: number;
  locale: string;
  status: string;
}) {
  const stepIndex = status === "SUCCEEDED"
    ? 2
    : progress < 34
      ? 0
      : progress < 76
        ? 1
        : 2;
  const steps = [
    sectionText(locale, "JD 解析", "JD parse"),
    sectionText(locale, "简历重写", "Rewrite"),
    sectionText(locale, "结果分析", "Analysis")
  ];

  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => {
        const completed = status === "SUCCEEDED" || index < stepIndex;
        const active = status !== "SUCCEEDED" && index === stepIndex;
        return (
          <div
            key={step}
            className={cn(
              "rounded-[18px] border px-4 py-3 text-sm transition-colors",
              completed && "border-emerald-200 bg-emerald-50 text-emerald-700",
              active && "border-blue-200 bg-blue-50 text-blue-700",
              !completed && !active && "border-slate-200 bg-white text-slate-400"
            )}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
              {index + 1}
            </div>
            <div className="mt-1 font-medium">{step}</div>
          </div>
        );
      })}
    </div>
  );
}

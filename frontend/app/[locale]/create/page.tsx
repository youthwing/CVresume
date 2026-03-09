"use client";

import Link from "next/link";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useLocale, useTranslations} from "next-intl";
import {useRouter, useSearchParams} from "next/navigation";
import {
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  History,
  ImagePlus,
  LoaderCircle,
  Sparkles,
  UploadCloud
} from "lucide-react";
import {ReactSortable} from "react-sortablejs";
import {projectApi, shareApi} from "@/lib/api";
import {useAuth} from "@/components/providers/auth-provider";
import {TemplateCarousel} from "@/components/sections/template-carousel";
import {normalizeResume, resumeToPlainText} from "@/lib/resume";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {moduleOptions, templateOptions, type TemplateId} from "@/lib/templates";
import type {ProjectView} from "@/lib/types";
import {toast} from "sonner";

type SortableModule = {id: string; label: string; enabled: boolean};

function createModuleState(selectedModules: readonly string[]) {
  const enabledModules = selectedModules.filter((module) => moduleOptions.includes(module as typeof moduleOptions[number]));
  const orderedModules = [
    ...enabledModules,
    ...moduleOptions.filter((label) => !enabledModules.includes(label))
  ];

  return orderedModules.map((label) => ({
    id: label,
    label,
    enabled: enabledModules.includes(label)
  }));
}

function formatShortDate(value: string, locale: string) {
  return new Date(value).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "numeric",
    day: "numeric"
  });
}

export default function CreatePage() {
  const t = useTranslations("create");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {user, refresh} = useAuth();
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [modules, setModules] = useState<SortableModule[]>(createModuleState(moduleOptions));
  const [image, setImage] = useState<File | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectView[]>([]);
  const [recentProjectsLoading, setRecentProjectsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [appliedTemplateSource, setAppliedTemplateSource] = useState<{id: string; companyName: string; templateId: TemplateId} | null>(null);
  const appliedShareIdRef = useRef<string | null>(null);

  const selectedModules = useMemo(
    () => modules.filter((module) => module.enabled).map((module) => module.label),
    [modules]
  );
  const showRecentProjects = Boolean(user);

  const loadRecentProjects = useCallback(async () => {
    if (!user) {
      setRecentProjects([]);
      return;
    }

    setRecentProjectsLoading(true);
    try {
      const {data} = await projectApi.list();
      setRecentProjects(
        [...data]
          .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
          .slice(0, 3)
      );
    } finally {
      setRecentProjectsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadRecentProjects();
  }, [loadRecentProjects]);

  useEffect(() => {
    const template = searchParams.get("template");
    const matchedTemplate = templateOptions.find((item) => item.id === template);
    if (matchedTemplate) {
      setTemplateId(matchedTemplate.id);
    }

    const shareId = searchParams.get("share");
    if (!shareId || shareId === appliedShareIdRef.current) {
      return;
    }

    appliedShareIdRef.current = shareId;
    shareApi.get(shareId).then(({data}) => {
      const normalized = normalizeResume(data.resumePreview);
      setTemplateId(normalized.templateId as TemplateId);
      setModules(createModuleState(normalized.selectedModules));
      setAppliedTemplateSource({
        id: data.id,
        companyName: data.companyName,
        templateId: normalized.templateId as TemplateId
      });
      setCompanyName((current) => current || data.companyName);
      setResumeText((current) => current || resumeToPlainText(normalized));
      toast.success(locale === "en" ? "Template applied from marketplace" : "已套用案例模板");
    }).catch(() => {
      appliedShareIdRef.current = null;
      toast.error(locale === "en" ? "Failed to apply shared template" : "模板应用失败");
    });
  }, [locale, searchParams]);

  async function ensureAuth() {
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/create`);
      return false;
    }
    return true;
  }

  async function handleGenerate() {
    if (!(await ensureAuth())) {
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        companyName,
        locale,
        jdText,
        resumeText,
        selectedModules,
        templateId
      };

      const activeProjectId = projectId ?? (await projectApi.create(payload)).data.id;
      setProjectId(activeProjectId);
      const {data} = await projectApi.generate(activeProjectId, payload, image);
      await refresh();
      toast.success(locale === "en" ? "Generation started" : "已开始生成");
      router.push(`/${locale}/history?focus=${data.id}`);
    } catch {
      toast.error(locale === "en" ? "Generation failed" : "生成失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRestoreProject(project: ProjectView) {
    const matchedTemplate = templateOptions.find((item) => item.id === project.templateId);
    setProjectId(project.id);
    setResumeText(project.resumeText || "");
    setJdText(project.jdText || "");
    setCompanyName(project.companyName || "");
    setTemplateId(matchedTemplate?.id ?? "classic");
    setModules(createModuleState(project.selectedModules));
    setImage(null);
    setAppliedTemplateSource(null);
    toast.success(locale === "en" ? "Recent record restored" : "已回填最近记录");
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black tracking-[-0.05em] text-slate-950">{t("title")}</h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">{t("subtitle")}</p>
        </div>

        {appliedTemplateSource && (
          <div className="mb-6 rounded-[16px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-700">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">{locale === "en" ? "Shared template applied" : "已应用同款模板"}</div>
                <div className="mt-1 text-slate-500">
                  {locale === "en"
                    ? `Using ${appliedTemplateSource.companyName} as your reference case.`
                    : `已套用来自 ${appliedTemplateSource.companyName} 的案例模板。`}
                </div>
              </div>
              <Link href={`/${locale}/shared/${appliedTemplateSource.id}`}>
                <Button variant="outline" size="sm">{locale === "en" ? "View case" : "查看案例"}</Button>
              </Link>
            </div>
          </div>
        )}

        <div className={`grid gap-6 ${showRecentProjects ? "xl:grid-cols-[220px_minmax(0,1fr)_280px]" : "xl:grid-cols-[minmax(0,1fr)_280px]"}`}>
          {showRecentProjects && (
            <Card className="h-fit overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-4 w-4 text-slate-500" />
                  {locale === "en" ? "Recent Records" : "最近记录"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentProjectsLoading ? (
                  Array.from({length: 3}).map((_, index) => (
                    <div key={index} className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="h-4 w-20 animate-pulse rounded-full bg-slate-200" />
                      <div className="mt-3 h-8 animate-pulse rounded-xl bg-slate-100" />
                    </div>
                  ))
                ) : recentProjects.length > 0 ? (
                  recentProjects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => handleRestoreProject(project)}
                      className="w-full rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3 text-left transition-colors hover:border-slate-300 hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {project.companyName || (locale === "en" ? "Untitled project" : "未命名项目")}
                        </div>
                        <div className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatShortDate(project.createdAt, locale)}
                        </div>
                      </div>
                      <p className="mt-2 max-h-10 overflow-hidden text-xs leading-5 text-slate-500">
                        {project.jdText || project.resumeText}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[14px] border border-dashed border-slate-200 bg-slate-50 px-3 py-5 text-sm text-slate-500">
                    {locale === "en" ? "Recent records appear here after you generate a resume." : "生成过简历后，最近记录会显示在这里。"}
                  </div>
                )}

                <p className="text-xs text-slate-400">
                  {locale === "en" ? "Click to refill the form." : "点击回填到表单"}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="pb-5">
              <CardTitle className="text-[22px] font-bold">{locale === "en" ? "Start generation" : "开始生成"}</CardTitle>
              <CardDescription>
                {locale === "en" ? "Provide your current resume and the target JD. We’ll generate a tailored version." : "填写你的简历内容和目标JD，我们将为你生成定制简历"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">{locale === "en" ? "Your resume / background" : "你的简历 / 个人背景"}</label>
                <Textarea
                  value={resumeText}
                  onChange={(event) => setResumeText(event.target.value)}
                  placeholder={locale === "en" ? "Paste your resume content, including experience, skills, and education..." : "请粘贴你的简历内容，包括工作经历、技能、教育背景等..."}
                  className="min-h-[140px] rounded-[12px] bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{locale === "en" ? "Target JD" : "目标职位描述 (JD)"}</label>
                <Textarea
                  value={jdText}
                  onChange={(event) => setJdText(event.target.value)}
                  placeholder={locale === "en" ? "Paste the target job description here..." : "请粘贴目标职位的JD内容..."}
                  className="min-h-[140px] rounded-[12px] bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{locale === "en" ? "Company (optional)" : "公司名称 (可选)"}</label>
                <Input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder={locale === "en" ? "e.g. ByteDance" : "例如：字节跳动"}
                  className="rounded-[12px] bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">{locale === "en" ? "Reference image (optional, no extra cost)" : "简历格式参考图片（可选，不额外扣积分）"}</div>
                <p className="text-sm text-slate-500">
                  {locale === "en" ? "Upload a resume image and the system will use it as a layout reference." : "上传一张简历图片作为排版参考，系统会自动识别并参考其格式"}
                </p>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <ImagePlus className="h-5 w-5 text-slate-400" />
                  <p className="text-sm text-slate-500">
                    {image ? image.name : locale === "en" ? "Click, drag, or paste an image (Ctrl+V)" : "点击上传、拖拽或粘贴图片 (Ctrl+V)"}
                  </p>
                  <p className="text-xs text-slate-400">JPG, PNG, WebP (max 5MB)</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">{locale === "en" ? "Choose resume template" : "选择简历模板"}</div>
                  <p className="mt-1 text-sm text-slate-500">
                    {locale === "en" ? "Choose your favorite layout. The content stays the same." : "选择你喜欢的简历版式，数据内容完全相同"}
                  </p>
                </div>
                <TemplateCarousel locale={locale} value={templateId} onChange={setTemplateId} />
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">{locale === "en" ? "Select and sort modules" : "选择并排序简历模块"}</div>
                  <p className="mt-1 text-sm text-slate-500">{locale === "en" ? "Drag to reorder" : "拖拽调整顺序"}</p>
                </div>
                <ReactSortable list={modules} setList={setModules} className="space-y-2">
                  {modules.map((module) => (
                    <div key={module.id} className="flex items-center justify-between rounded-[12px] border border-slate-200 bg-white px-3 py-3">
                      <div className="flex items-center gap-3">
                        <button type="button" className="inline-flex h-6 w-6 items-center justify-center text-slate-400" aria-label={locale === "en" ? "Reorder module" : "拖拽排序"}>
                          <ArrowUpDown className="h-4 w-4" />
                        </button>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={module.enabled}
                            onChange={(event) => setModules((current) => current.map((item) => item.id === module.id ? {...item, enabled: event.target.checked} : item))}
                          />
                          <span>{module.label}</span>
                        </label>
                      </div>
                      {module.enabled && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </div>
                  ))}
                </ReactSortable>
              </div>

              {submitting && (
                <div className="rounded-[18px] border border-blue-200 bg-blue-50/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {locale === "en" ? "Creating your generation task" : "正在创建生成任务"}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {locale === "en"
                          ? "We will jump to history and keep the progress updated in real time."
                          : "即将跳转到历史记录页，并实时展示生成进度。"}
                      </p>
                    </div>
                    <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" />
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full w-[72%] animate-pulse rounded-full bg-blue-500" />
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-blue-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    {locale === "en" ? "JD parsing, rewrite, and analysis are being queued." : "JD 解析、简历重写与分析任务正在排队处理中。"}
                  </div>
                </div>
              )}

              <Button className="h-10 w-full rounded-lg bg-blue-500 text-white hover:bg-blue-600" onClick={() => void handleGenerate()} disabled={submitting}>
                <UploadCloud className="mr-2 h-4 w-4" />
                {submitting ? (locale === "en" ? "Creating task..." : "正在创建任务...") : (locale === "en" ? "Generate tailored resume" : "生成定制简历")}
              </Button>
            </CardContent>
          </Card>

          <Card className="h-fit overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">{locale === "en" ? "AI Workflow" : "AI工作流"}</CardTitle>
              <CardDescription>
                {locale === "en" ? "A complete flow from JD analysis to HR review." : "从 JD 解析、简历定制到 HR 视角审核的一体化流程"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <WorkflowStep index="1" title={t("steps1")} desc={locale === "en" ? "Extract required skills, plus factors, and ATS keywords" : "提取必备技能、加分项、ATS关键词"} />
              <WorkflowStep index="2" title={t("steps2")} desc={locale === "en" ? "Rewrite your experience using the JD language system" : "使用JD语言体系重写你的经历"} />
              <WorkflowStep index="3" title={t("steps3")} desc={locale === "en" ? "Get a match score and concrete improvement guidance" : "给出匹配度评分和改进建议"} />
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function WorkflowStep({index, title, desc}: {index: string; title: string; desc: string}) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white px-4 py-5">
      <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-sm font-semibold text-white">
        {index}
      </div>
      <div className="text-base font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-500">{desc}</div>
    </div>
  );
}

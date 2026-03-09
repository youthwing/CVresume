"use client";

import {type RefObject, useEffect, useState} from "react";
import {BriefcaseBusiness, Download, FolderKanban, GraduationCap, Save, Sparkles, UserRound, Wrench, X} from "lucide-react";
import {ResumeEditor} from "@/components/sections/resume-editor";
import {ResumePreview} from "@/components/sections/resume-preview";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {templateOptions, type TemplateId} from "@/lib/templates";
import type {ResumeResult} from "@/lib/types";
import {cn} from "@/lib/utils";

interface ResumeDiyPanelProps {
  open: boolean;
  locale: string;
  value: ResumeResult;
  saving: boolean;
  polishing: boolean;
  polishElapsedSeconds: number;
  previewRef: RefObject<HTMLDivElement>;
  templateId: TemplateId;
  onChange: (value: ResumeResult) => void;
  onTemplateChange: (value: TemplateId) => void;
  onAiPolish: (instruction: string) => void;
  onSave: () => void;
  onExport: () => void;
  onClose: () => void;
}

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

export function ResumeDiyPanel({
  open,
  locale,
  value,
  saving,
  polishing,
  polishElapsedSeconds,
  previewRef,
  templateId,
  onChange,
  onTemplateChange,
  onAiPolish,
  onSave,
  onExport,
  onClose
}: ResumeDiyPanelProps) {
  const [instruction, setInstruction] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const sections = [
    {id: "resume-editor-profile", label: sectionText(locale, "基本信息", "Profile"), icon: UserRound},
    {id: "resume-editor-education", label: sectionText(locale, "教育背景", "Education"), icon: GraduationCap},
    {id: "resume-editor-experience", label: sectionText(locale, "工作经历", "Experience"), icon: BriefcaseBusiness},
    {id: "resume-editor-skills", label: sectionText(locale, "专业技能", "Skills"), icon: Wrench},
    {id: "resume-editor-projects", label: sectionText(locale, "项目经历", "Projects"), icon: FolderKanban},
    {id: "resume-editor-evaluation", label: sectionText(locale, "个人评价", "Evaluation"), icon: Sparkles}
  ];

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  const polishStatusText = polishing
    ? polishElapsedSeconds < 8
      ? sectionText(locale, "正在发送润色请求...", "Sending rewrite request...")
      : polishElapsedSeconds < 20
        ? sectionText(locale, "AI 正在理解 JD 与简历内容...", "AI is understanding the JD and resume...")
        : sectionText(locale, "AI 正在生成新版内容，通常需要 20-40 秒。", "AI is generating the updated draft. This usually takes 20-40 seconds.")
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1560px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_32px_120px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-slate-950">
        <div className="grid min-h-0 w-full xl:grid-cols-[260px_minmax(0,1fr)_520px]">
          <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900 xl:border-b-0 xl:border-r">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                {sectionText(locale, "简历编辑器", "Resume Editor")}
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
                {sectionText(locale, "DIY 编辑", "DIY Editing")}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {sectionText(locale, "按模块快速跳转并修改内容，右侧实时预览当前模板。", "Jump across sections and review the active template preview in real time.")}
              </p>
            </div>

            <div className="mt-6 space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-left text-sm font-medium transition-colors",
                      "bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className="h-4 w-4 text-slate-400" />
                    {section.label}
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-950 dark:text-white">
                  {sectionText(locale, "简历编辑器", "Resume Editor")}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {sectionText(locale, "保存后会同步更新结果页内容。", "Saved changes will sync back to the result page.")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={onExport}>
                  <Download className="mr-2 h-4 w-4" />
                  {sectionText(locale, "导出", "Export")}
                </Button>
                <Button onClick={onSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? sectionText(locale, "保存中...", "Saving...") : sectionText(locale, "保存", "Save")}
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="close-diy-panel">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mb-6 rounded-[28px] border border-blue-100 bg-blue-50/70 p-5 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-950 dark:text-blue-300">
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold text-slate-950 dark:text-white">
                    {sectionText(locale, "AI 润色修改", "AI Rewrite")}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {sectionText(
                      locale,
                      "输入你想让模型如何修改这份简历，例如“更像高级前端候选人”“强化量化结果”“把总结写得更贴 JD”。",
                      "Describe how you want the model to rewrite this resume, such as stronger leadership tone, tighter metrics, or closer JD alignment."
                    )}
                  </p>
                  <Textarea
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder={sectionText(
                      locale,
                      "例如：保留事实不变，把工作经历改得更像高级前端候选人，突出性能优化、工程化和跨团队协作能力。",
                      "Example: keep all facts unchanged, but rewrite the experience to sound more senior and highlight performance, engineering, and cross-team collaboration."
                    )}
                    className="mt-4 min-h-[108px] rounded-2xl border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950"
                  />
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => setInstruction("")} disabled={polishing || !instruction.trim()}>
                      {sectionText(locale, "清空", "Clear")}
                    </Button>
                    <Button onClick={() => onAiPolish(instruction)} disabled={polishing || !instruction.trim()}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {polishing ? sectionText(locale, "润色中...", "Rewriting...") : sectionText(locale, "AI 润色", "AI Rewrite")}
                    </Button>
                  </div>
                  {polishing && (
                    <div className="mt-4 rounded-2xl border border-blue-100 bg-white/90 p-4 dark:border-blue-900/50 dark:bg-slate-950/60">
                      <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>{polishStatusText}</span>
                        <span>{polishElapsedSeconds}s</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/50">
                        <div className="h-full w-full animate-pulse rounded-full bg-blue-500/80" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <ResumeEditor locale={locale} value={value} onChange={onChange} showLayout={false} />
          </div>

          <div className="min-h-0 border-t border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/40 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  {sectionText(locale, "简历预览", "Resume Preview")}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {sectionText(locale, "切换模板后，右侧预览立即刷新。", "Switch templates and the preview updates immediately.")}
                </div>
              </div>
              <select
                value={templateId}
                onChange={(event) => onTemplateChange(event.target.value as TemplateId)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {templateOptions.map((template) => (
                  <option key={template.id} value={template.id}>
                    {locale === "en" ? template.titleEn : template.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 h-[calc(100%-4rem)] overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div ref={previewRef}>
                <ResumePreview resume={value} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

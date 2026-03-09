import {splitMultilineText} from "@/lib/resume";
import {moduleOptions, type ResumeModuleId} from "@/lib/templates";
import type {EducationItem, ResumeExperience, ResumeProject, ResumeResult} from "@/lib/types";
import {cn} from "@/lib/utils";

interface ResumePreviewProps {
  resume: ResumeResult;
  className?: string;
}

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

function orderedModules(resume: ResumeResult): ResumeModuleId[] {
  const modules = resume.selectedModules?.filter((module) => moduleOptions.includes(module as ResumeModuleId)) ?? [];
  return modules.length > 0 ? modules as ResumeModuleId[] : [...moduleOptions];
}

function hasModule(resume: ResumeResult, moduleId: ResumeModuleId) {
  return orderedModules(resume).includes(moduleId);
}

function selectedModules(resume: ResumeResult, modules: ResumeModuleId[]) {
  return modules.filter((moduleId) => hasModule(resume, moduleId));
}

function moduleTitle(locale: string, moduleId: ResumeModuleId) {
  const titles: Record<ResumeModuleId, {zh: string; en: string}> = {
    "教育经历": {zh: "教育背景", en: "Education"},
    "专业技能": {zh: "技能", en: "Skills"},
    "工作经历": {zh: "工作经历", en: "Experience"},
    "项目经历": {zh: "项目经历", en: "Projects"},
    "个人评价": {zh: "个人评价", en: "Evaluation"}
  };

  return locale === "en" ? titles[moduleId].en : titles[moduleId].zh;
}

function resumeTitle(resume: ResumeResult) {
  return resume.candidateProfile.targetRole || resume.candidateProfile.title;
}

function displayName(resume: ResumeResult) {
  return resume.candidateProfile.displayName || sectionText(resume.locale, "候选人A", "Candidate A");
}

function headerFacts(resume: ResumeResult) {
  const profile = resume.candidateProfile;
  return [
    profile.phone,
    profile.email,
    profile.location,
    profile.yearsOfExperience && `${sectionText(resume.locale, "工作年限", "Experience")}: ${profile.yearsOfExperience}`,
    profile.employmentStatus && `${sectionText(resume.locale, "在职状态", "Status")}: ${profile.employmentStatus}`
  ].filter(Boolean) as string[];
}

function summaryLines(value: string) {
  return splitMultilineText(value);
}

function evaluationItems(resume: ResumeResult) {
  return splitMultilineText(resume.personalEvaluation);
}

function SectionBlock({
  title,
  accentClassName = "bg-slate-900",
  className,
  children
}: {
  title: string;
  accentClassName?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("pt-4", className)}>
      <div className="mb-3 flex items-center gap-3">
        <span className={cn("h-[2px] w-8 shrink-0", accentClassName)} />
        <h2 className="shrink-0 text-[13px] font-bold tracking-[0.08em] text-slate-900">{title}</h2>
        <span className="h-px flex-1 bg-slate-300" />
      </div>
      {children}
    </section>
  );
}

function SidebarSection({
  title,
  children,
  accentClassName = "bg-white/70",
  className
}: {
  title: string;
  children: React.ReactNode;
  accentClassName?: string;
  className?: string;
}) {
  return (
    <section className={cn("pt-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className={cn("h-px w-4 shrink-0", accentClassName)} />
        <h2 className="text-[12px] font-semibold tracking-[0.08em] text-inherit">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function MetaLine({
  items,
  centered = false,
  className,
  separatorClassName = "text-slate-300"
}: {
  items: string[];
  centered?: boolean;
  className?: string;
  separatorClassName?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-600", centered && "justify-center", className)}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="inline-flex items-center gap-2 break-words">
          {index > 0 && <span className={separatorClassName}>|</span>}
          <span>{item}</span>
        </span>
      ))}
    </div>
  );
}

function ParagraphGroup({
  lines,
  className
}: {
  lines: string[];
  className?: string;
}) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-1.5 text-[12px] leading-[1.8] text-slate-700", className)}>
      {lines.map((line, index) => (
        <p key={`${line}-${index}`} className="break-words">{line}</p>
      ))}
    </div>
  );
}

function BulletList({
  items,
  bulletClassName = "bg-slate-500",
  className
}: {
  items: string[];
  bulletClassName?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className={cn("space-y-1.5 text-[12px] leading-[1.8] text-slate-700", className)}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2">
          <span className={cn("mt-[8px] h-[2px] w-2 shrink-0", bulletClassName)} />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SkillRows({
  primary,
  secondary,
  locale,
  labelClassName = "text-slate-900",
  valueClassName = "text-slate-700",
  dividerClassName = "border-slate-200"
}: {
  primary: string[];
  secondary: string[];
  locale: string;
  labelClassName?: string;
  valueClassName?: string;
  dividerClassName?: string;
}) {
  const rows = [
    {label: sectionText(locale, "核心技能", "Core"), items: primary},
    {label: sectionText(locale, "其他技能", "Other"), items: secondary}
  ].filter((row) => row.items.length > 0);

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className={cn("border-b pb-2 text-[12px] last:border-b-0 last:pb-0", dividerClassName)}>
          <div className={cn("mb-1 font-semibold", labelClassName)}>{row.label}</div>
          <div className={cn("break-words leading-[1.8]", valueClassName)}>{row.items.join(" / ")}</div>
        </div>
      ))}
    </div>
  );
}

function EducationRows({
  items,
  dividerClassName = "border-slate-200",
  titleClassName = "text-slate-900",
  metaClassName = "text-slate-600",
  periodClassName = "text-slate-500"
}: {
  items: EducationItem[];
  dividerClassName?: string;
  titleClassName?: string;
  metaClassName?: string;
  periodClassName?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.school}-${item.period}-${index}`} className={cn("border-b pb-3 last:border-b-0 last:pb-0", dividerClassName)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={cn("break-words text-[13px] font-semibold", titleClassName)}>{item.school}</div>
              <div className={cn("mt-1 break-words text-[12px]", metaClassName)}>
                {[item.degree, item.major].filter(Boolean).join(" ")}
              </div>
            </div>
            <div className={cn("shrink-0 text-[11px]", periodClassName)}>{item.period}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExperienceRows({
  items,
  bulletClassName = "bg-slate-500",
  dividerClassName = "border-slate-200",
  companyClassName = "text-slate-900",
  titleClassName = "text-slate-600",
  periodClassName = "text-slate-500",
  textClassName = "text-slate-700"
}: {
  items: ResumeExperience[];
  bulletClassName?: string;
  dividerClassName?: string;
  companyClassName?: string;
  titleClassName?: string;
  periodClassName?: string;
  textClassName?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.company}-${item.title}-${index}`} className={cn("border-b pb-4 last:border-b-0 last:pb-0", dividerClassName)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={cn("break-words text-[13px] font-semibold", companyClassName)}>{item.company}</div>
              <div className={cn("mt-1 break-words text-[12px]", titleClassName)}>{item.title}</div>
            </div>
            <div className={cn("shrink-0 text-[11px]", periodClassName)}>{item.period}</div>
          </div>
          <ParagraphGroup lines={summaryLines(item.highlights)} className={cn("mt-2", textClassName)} />
          <BulletList items={item.bullets} bulletClassName={bulletClassName} className={cn("mt-2", textClassName)} />
        </div>
      ))}
    </div>
  );
}

function ProjectRows({
  items,
  bulletClassName = "bg-slate-500",
  dividerClassName = "border-slate-200",
  titleClassName = "text-slate-900",
  metaClassName = "text-slate-600",
  periodClassName = "text-slate-500",
  textClassName = "text-slate-700"
}: {
  items: ResumeProject[];
  bulletClassName?: string;
  dividerClassName?: string;
  titleClassName?: string;
  metaClassName?: string;
  periodClassName?: string;
  textClassName?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={`${item.name}-${item.period}-${index}`} className={cn("border-b pb-4 last:border-b-0 last:pb-0", dividerClassName)}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className={cn("break-words text-[13px] font-semibold", titleClassName)}>{item.name}</div>
              <div className={cn("mt-1 break-words text-[12px]", metaClassName)}>
                {[item.role, item.organization].filter(Boolean).join(" | ")}
              </div>
            </div>
            <div className={cn("shrink-0 text-[11px]", periodClassName)}>{item.period}</div>
          </div>
          <BulletList items={item.bullets} bulletClassName={bulletClassName} className={cn("mt-2", textClassName)} />
        </div>
      ))}
    </div>
  );
}

function ResumeSections({
  resume,
  modules = selectedModules(resume, [...moduleOptions]),
  accentClassName = "bg-slate-900",
  bulletClassName = "bg-slate-500",
  dividerClassName = "border-slate-200"
}: {
  resume: ResumeResult;
  modules?: ResumeModuleId[];
  accentClassName?: string;
  bulletClassName?: string;
  dividerClassName?: string;
}) {
  return (
    <div className="space-y-4">
      <SectionBlock title={sectionText(resume.locale, "简介", "Summary")} accentClassName={accentClassName} className="pt-0">
        <ParagraphGroup lines={summaryLines(resume.summary)} />
      </SectionBlock>

      {modules.includes("教育经历") && (
        <SectionBlock title={moduleTitle(resume.locale, "教育经历")} accentClassName={accentClassName}>
          <EducationRows items={resume.education} dividerClassName={dividerClassName} />
        </SectionBlock>
      )}

      {modules.includes("专业技能") && (
        <SectionBlock title={moduleTitle(resume.locale, "专业技能")} accentClassName={accentClassName}>
          <SkillRows
            primary={resume.skills.primary}
            secondary={resume.skills.secondary}
            locale={resume.locale}
            dividerClassName={dividerClassName}
          />
        </SectionBlock>
      )}

      {modules.includes("工作经历") && (
        <SectionBlock title={moduleTitle(resume.locale, "工作经历")} accentClassName={accentClassName}>
          <ExperienceRows items={resume.experiences} bulletClassName={bulletClassName} dividerClassName={dividerClassName} />
        </SectionBlock>
      )}

      {modules.includes("项目经历") && (
        <SectionBlock title={moduleTitle(resume.locale, "项目经历")} accentClassName={accentClassName}>
          <ProjectRows items={resume.projects} bulletClassName={bulletClassName} dividerClassName={dividerClassName} />
        </SectionBlock>
      )}

      {modules.includes("个人评价") && (
        <SectionBlock title={moduleTitle(resume.locale, "个人评价")} accentClassName={accentClassName}>
          <BulletList items={evaluationItems(resume)} bulletClassName={bulletClassName} />
        </SectionBlock>
      )}
    </div>
  );
}

function ClassicTemplate({resume}: {resume: ResumeResult}) {
  return (
    <div className="space-y-5">
      <header className="border-b-[2px] border-slate-900 pb-5 text-center">
        <h1 className="break-words text-[30px] font-black tracking-[-0.04em] text-slate-900">{displayName(resume)}</h1>
        <div className="mt-1 break-words text-[14px] font-semibold text-slate-700">{resumeTitle(resume)}</div>
        <MetaLine items={headerFacts(resume)} centered className="mt-3" />
      </header>
      <ResumeSections resume={resume} />
    </div>
  );
}

function ModernTemplate({resume}: {resume: ResumeResult}) {
  const sidebarModules = selectedModules(resume, ["教育经历", "专业技能", "个人评价"]);
  const mainModules = selectedModules(resume, ["工作经历", "项目经历"]);

  return (
    <div className="grid gap-0 md:grid-cols-[220px,1fr]">
      <aside className="bg-[#394961] px-5 py-6 text-white">
        <h1 className="break-words text-[28px] font-black tracking-[-0.04em]">{displayName(resume)}</h1>
        <div className="mt-1 break-words text-[13px] font-medium text-white/80">{resumeTitle(resume)}</div>

        <SidebarSection title={sectionText(resume.locale, "联系信息", "Contact")}>
          <div className="space-y-2 text-[12px] leading-[1.8] text-white/80">
            {headerFacts(resume).map((item, index) => (
              <div key={`${item}-${index}`} className="break-words">{item}</div>
            ))}
          </div>
        </SidebarSection>

        {sidebarModules.includes("专业技能") && (
          <SidebarSection title={moduleTitle(resume.locale, "专业技能")} className="border-t border-white/12">
            <SkillRows
              primary={resume.skills.primary}
              secondary={resume.skills.secondary}
              locale={resume.locale}
              labelClassName="text-white"
              valueClassName="text-white/78"
              dividerClassName="border-white/12"
            />
          </SidebarSection>
        )}

        {sidebarModules.includes("教育经历") && (
          <SidebarSection title={moduleTitle(resume.locale, "教育经历")} className="border-t border-white/12">
            <EducationRows
              items={resume.education}
              dividerClassName="border-white/12"
              titleClassName="text-white"
              metaClassName="text-white/78"
              periodClassName="text-white/55"
            />
          </SidebarSection>
        )}

        {sidebarModules.includes("个人评价") && (
          <SidebarSection title={moduleTitle(resume.locale, "个人评价")} className="border-t border-white/12">
            <BulletList items={evaluationItems(resume)} bulletClassName="bg-white/80" className="text-white/78" />
          </SidebarSection>
        )}
      </aside>

      <main className="border-l border-slate-200 pl-6 md:ml-6">
        <ResumeSections
          resume={resume}
          modules={mainModules}
          accentClassName="bg-[#394961]"
          bulletClassName="bg-[#394961]"
        />
      </main>
    </div>
  );
}

function ProfessionalTemplate({resume}: {resume: ResumeResult}) {
  return (
    <div className="space-y-5">
      <header className="border-b-[3px] border-[#25459e] pb-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-3 h-2 w-24 bg-[#25459e]" />
            <h1 className="break-words text-[30px] font-black tracking-[-0.04em] text-slate-900">{displayName(resume)}</h1>
            <div className="mt-1 break-words text-[14px] font-medium text-slate-700">{resumeTitle(resume)}</div>
          </div>
          <div className="shrink-0 text-right text-[11px] leading-6 text-slate-600">
            {headerFacts(resume).map((item, index) => (
              <div key={`${item}-${index}`}>{item}</div>
            ))}
          </div>
        </div>
      </header>
      <ResumeSections
        resume={resume}
        accentClassName="bg-[#25459e]"
        bulletClassName="bg-[#25459e]"
      />
    </div>
  );
}

function GradientTemplate({resume}: {resume: ResumeResult}) {
  return (
    <div className="space-y-5">
      <header className="border-b-[2px] border-[#15b8af] pb-5">
        <div className="mb-4 h-[6px] w-full bg-gradient-to-r from-[#18b7b0] to-[#73e5db]" />
        <h1 className="break-words text-[30px] font-black tracking-[-0.04em] text-slate-900">{displayName(resume)}</h1>
        <div className="mt-1 break-words text-[14px] font-medium text-slate-700">{resumeTitle(resume)}</div>
        <MetaLine items={headerFacts(resume)} className="mt-3" />
      </header>
      <ResumeSections
        resume={resume}
        accentClassName="bg-[#0f766e]"
        bulletClassName="bg-[#0f766e]"
      />
    </div>
  );
}

function CompactTemplate({resume}: {resume: ResumeResult}) {
  const sidebarModules = selectedModules(resume, ["教育经历", "专业技能"]);
  const mainModules = selectedModules(resume, ["工作经历", "项目经历", "个人评价"]);

  return (
    <div className="space-y-5">
      <header className="border-b-[2px] border-[#8a430f] pb-5">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="break-words text-[29px] font-black tracking-[-0.04em] text-slate-900">{displayName(resume)}</h1>
            <div className="mt-1 break-words text-[14px] font-medium text-slate-700">{resumeTitle(resume)}</div>
          </div>
          <div className="shrink-0 text-right text-[11px] leading-6 text-slate-600">
            {headerFacts(resume).map((item, index) => (
              <div key={`${item}-${index}`}>{item}</div>
            ))}
          </div>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[190px,1fr]">
        <aside className="border-r border-slate-200 pr-5">
          {sidebarModules.includes("教育经历") && (
            <SectionBlock title={moduleTitle(resume.locale, "教育经历")} accentClassName="bg-[#8a430f]" className="pt-0">
              <EducationRows items={resume.education} />
            </SectionBlock>
          )}

          {sidebarModules.includes("专业技能") && (
            <SectionBlock title={moduleTitle(resume.locale, "专业技能")} accentClassName="bg-[#8a430f]">
              <SkillRows primary={resume.skills.primary} secondary={resume.skills.secondary} locale={resume.locale} />
            </SectionBlock>
          )}
        </aside>

        <main>
          <ResumeSections
            resume={resume}
            modules={mainModules}
            accentClassName="bg-[#8a430f]"
            bulletClassName="bg-[#8a430f]"
          />
        </main>
      </div>
    </div>
  );
}

function CreativeTemplate({resume}: {resume: ResumeResult}) {
  const sidebarModules = selectedModules(resume, ["专业技能", "教育经历"]);
  const mainModules = selectedModules(resume, ["工作经历", "项目经历", "个人评价"]);

  return (
    <div className="grid gap-6 md:grid-cols-[210px,1fr]">
      <aside className="border-r border-[#c9a5f8] pr-5">
        <div className="mb-5 h-[6px] w-16 bg-gradient-to-r from-[#7b2cf4] to-[#d72b79]" />
        <h1 className="break-words text-[28px] font-black tracking-[-0.04em] text-slate-900">{displayName(resume)}</h1>
        <div className="mt-1 break-words text-[13px] font-medium text-slate-700">{resumeTitle(resume)}</div>
        <MetaLine items={headerFacts(resume)} className="mt-3" separatorClassName="text-[#d7c2f6]" />

        {sidebarModules.includes("专业技能") && (
          <SectionBlock title={moduleTitle(resume.locale, "专业技能")} accentClassName="bg-[#a84af1]">
            <SkillRows primary={resume.skills.primary} secondary={resume.skills.secondary} locale={resume.locale} />
          </SectionBlock>
        )}

        {sidebarModules.includes("教育经历") && (
          <SectionBlock title={moduleTitle(resume.locale, "教育经历")} accentClassName="bg-[#a84af1]">
            <EducationRows items={resume.education} />
          </SectionBlock>
        )}
      </aside>

      <main>
        <ResumeSections
          resume={resume}
          modules={mainModules}
          accentClassName="bg-[#a84af1]"
          bulletClassName="bg-[#a84af1]"
        />
      </main>
    </div>
  );
}

export function ResumePreview({resume, className}: ResumePreviewProps) {
  const templateId = resume.templateId || "classic";
  const template = {
    classic: <ClassicTemplate resume={resume} />,
    modern: <ModernTemplate resume={resume} />,
    professional: <ProfessionalTemplate resume={resume} />,
    gradient: <GradientTemplate resume={resume} />,
    compact: <CompactTemplate resume={resume} />,
    creative: <CreativeTemplate resume={resume} />
  }[templateId] ?? <ClassicTemplate resume={resume} />;

  return (
    <div
      data-resume-paper
      className={cn(
        "resume-paper mx-auto w-full max-w-[794px] min-h-[1123px] overflow-hidden border border-slate-300 bg-white px-8 py-7 shadow-[0_14px_36px_rgba(15,23,42,0.08)]",
        className
      )}
    >
      <div className="mx-auto break-words text-[12px] text-slate-900">
        {template}
      </div>
    </div>
  );
}

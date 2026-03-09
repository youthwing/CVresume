"use client";

import {ArrowDown, ArrowUp, Plus, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {joinMultilineText, splitMultilineText} from "@/lib/resume";
import {moduleLabels, moduleOptions, type ResumeModuleId} from "@/lib/templates";
import type {EducationItem, ResumeExperience, ResumeProject, ResumeResult} from "@/lib/types";

interface ResumeEditorProps {
  locale: string;
  value: ResumeResult;
  onChange: (value: ResumeResult) => void;
  showLayout?: boolean;
}

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

export function ResumeEditor({locale, value, onChange, showLayout = true}: ResumeEditorProps) {
  const evaluationLines = splitMultilineText(value.personalEvaluation);
  const selectedModules = value.selectedModules.length > 0
    ? value.selectedModules.filter((module) => moduleOptions.includes(module as ResumeModuleId))
    : [...moduleOptions];
  const disabledModules = moduleOptions.filter((module) => !selectedModules.includes(module));

  function updateProfile(field: keyof ResumeResult["candidateProfile"], fieldValue: string) {
    onChange({
      ...value,
      candidateProfile: {
        ...value.candidateProfile,
        [field]: fieldValue
      }
    });
  }

  function moveSelectedModule(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedModules.length) {
      return;
    }
    const next = [...selectedModules];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    onChange({
      ...value,
      selectedModules: next
    });
  }

  function toggleModule(moduleId: ResumeModuleId, enabled: boolean) {
    const nextModules = enabled
      ? [...selectedModules, moduleId]
      : selectedModules.filter((module) => module !== moduleId);
    onChange({
      ...value,
      selectedModules: nextModules
    });
  }

  function updateSkills(group: "primary" | "secondary", index: number, fieldValue: string) {
    const nextSkills = [...value.skills[group]];
    nextSkills[index] = fieldValue;
    onChange({
      ...value,
      skills: {
        ...value.skills,
        [group]: nextSkills
      }
    });
  }

  function addSkill(group: "primary" | "secondary") {
    onChange({
      ...value,
      skills: {
        ...value.skills,
        [group]: [...value.skills[group], ""]
      }
    });
  }

  function removeSkill(group: "primary" | "secondary", index: number) {
    onChange({
      ...value,
      skills: {
        ...value.skills,
        [group]: value.skills[group].filter((_, itemIndex) => itemIndex !== index)
      }
    });
  }

  function updateExperience(index: number, patch: Partial<ResumeExperience>) {
    const experiences = [...value.experiences];
    experiences[index] = {
      ...experiences[index],
      ...patch
    };
    onChange({
      ...value,
      experiences
    });
  }

  function updateExperienceBullet(experienceIndex: number, bulletIndex: number, fieldValue: string) {
    const experience = value.experiences[experienceIndex];
    updateExperience(experienceIndex, {
      bullets: experience.bullets.map((bullet, index) => index === bulletIndex ? fieldValue : bullet)
    });
  }

  function addExperience() {
    onChange({
      ...value,
      experiences: [
        ...value.experiences,
        {
          title: "",
          company: "",
          period: "",
          highlights: "",
          bullets: [""]
        }
      ]
    });
  }

  function removeExperience(index: number) {
    onChange({
      ...value,
      experiences: value.experiences.filter((_, itemIndex) => itemIndex !== index)
    });
  }

  function addExperienceBullet(index: number) {
    const experience = value.experiences[index];
    updateExperience(index, {
      bullets: [...experience.bullets, ""]
    });
  }

  function removeExperienceBullet(experienceIndex: number, bulletIndex: number) {
    const experience = value.experiences[experienceIndex];
    updateExperience(experienceIndex, {
      bullets: experience.bullets.filter((_, index) => index !== bulletIndex)
    });
  }

  function updateProject(index: number, patch: Partial<ResumeProject>) {
    const projects = [...value.projects];
    projects[index] = {
      ...projects[index],
      ...patch
    };
    onChange({
      ...value,
      projects
    });
  }

  function updateProjectBullet(projectIndex: number, bulletIndex: number, fieldValue: string) {
    const project = value.projects[projectIndex];
    updateProject(projectIndex, {
      bullets: project.bullets.map((bullet, index) => index === bulletIndex ? fieldValue : bullet)
    });
  }

  function addProject() {
    onChange({
      ...value,
      projects: [
        ...value.projects,
        {
          name: "",
          role: "",
          period: "",
          organization: "",
          bullets: [""]
        }
      ]
    });
  }

  function removeProject(index: number) {
    onChange({
      ...value,
      projects: value.projects.filter((_, itemIndex) => itemIndex !== index)
    });
  }

  function addProjectBullet(index: number) {
    const project = value.projects[index];
    updateProject(index, {
      bullets: [...project.bullets, ""]
    });
  }

  function removeProjectBullet(projectIndex: number, bulletIndex: number) {
    const project = value.projects[projectIndex];
    updateProject(projectIndex, {
      bullets: project.bullets.filter((_, index) => index !== bulletIndex)
    });
  }

  function updateEducation(index: number, patch: Partial<EducationItem>) {
    const education = [...value.education];
    education[index] = {
      ...education[index],
      ...patch
    };
    onChange({
      ...value,
      education
    });
  }

  function addEducation() {
    onChange({
      ...value,
      education: [
        ...value.education,
        {
          school: "",
          degree: "",
          major: "",
          period: ""
        }
      ]
    });
  }

  function removeEducation(index: number) {
    onChange({
      ...value,
      education: value.education.filter((_, itemIndex) => itemIndex !== index)
    });
  }

  function updateEvaluation(index: number, fieldValue: string) {
    const next = [...evaluationLines];
    next[index] = fieldValue;
    onChange({
      ...value,
      personalEvaluation: joinMultilineText(next)
    });
  }

  function addEvaluation() {
    onChange({
      ...value,
      personalEvaluation: joinMultilineText([...evaluationLines, ""])
    });
  }

  function removeEvaluation(index: number) {
    onChange({
      ...value,
      personalEvaluation: joinMultilineText(evaluationLines.filter((_, itemIndex) => itemIndex !== index))
    });
  }

  return (
    <div className="space-y-5">
      <Card id="resume-editor-profile">
        <CardHeader>
          <CardTitle>{sectionText(locale, "个人信息", "Profile")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label={sectionText(locale, "姓名", "Name")}>
            <Input value={value.candidateProfile.displayName} onChange={(event) => updateProfile("displayName", event.target.value)} />
          </Field>
          <Field label={sectionText(locale, "求职头衔", "Title")}>
            <Input value={value.candidateProfile.title} onChange={(event) => updateProfile("title", event.target.value)} />
          </Field>
          <Field label={sectionText(locale, "电话", "Phone")}>
            <Input value={value.candidateProfile.phone} onChange={(event) => updateProfile("phone", event.target.value)} />
          </Field>
          <Field label={sectionText(locale, "邮箱", "Email")}>
            <Input value={value.candidateProfile.email} onChange={(event) => updateProfile("email", event.target.value)} />
          </Field>
          <Field label={sectionText(locale, "所在城市", "Location")}>
            <Input value={value.candidateProfile.location} onChange={(event) => updateProfile("location", event.target.value)} />
          </Field>
          <Field label={sectionText(locale, "工作年限", "Experience")}>
            <Input value={value.candidateProfile.yearsOfExperience} onChange={(event) => updateProfile("yearsOfExperience", event.target.value)} />
          </Field>
          <Field label={sectionText(locale, "求职意向", "Target Role")}>
            <Input value={value.candidateProfile.targetRole} onChange={(event) => updateProfile("targetRole", event.target.value)} />
          </Field>
          <Field label={sectionText(locale, "在职状态", "Employment Status")}>
            <Input value={value.candidateProfile.employmentStatus} onChange={(event) => updateProfile("employmentStatus", event.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{sectionText(locale, "简介", "Summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={value.summary} onChange={(event) => onChange({...value, summary: event.target.value})} className="min-h-[140px]" />
        </CardContent>
      </Card>

      {showLayout && (
        <Card>
          <CardHeader>
            <CardTitle>{sectionText(locale, "模块布局", "Section Layout")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {selectedModules.map((moduleId, index) => (
                <div key={moduleId} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {locale === "en" ? moduleLabels[moduleId as ResumeModuleId].en : moduleLabels[moduleId as ResumeModuleId].zh}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => moveSelectedModule(index, -1)} disabled={index === 0} aria-label="move-up">
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => moveSelectedModule(index, 1)} disabled={index === selectedModules.length - 1} aria-label="move-down">
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleModule(moduleId as ResumeModuleId, false)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      {sectionText(locale, "隐藏", "Hide")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {disabledModules.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-slate-900 dark:text-white">{sectionText(locale, "可添加模块", "Available Sections")}</div>
                <div className="flex flex-wrap gap-2">
                  {disabledModules.map((moduleId) => (
                    <Button key={moduleId} type="button" variant="outline" size="sm" onClick={() => toggleModule(moduleId, true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {locale === "en" ? moduleLabels[moduleId].en : moduleLabels[moduleId].zh}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card id="resume-editor-skills">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{sectionText(locale, "技能", "Skills")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <ListField
            label={sectionText(locale, "核心技能", "Primary Skills")}
            addLabel={sectionText(locale, "添加技能", "Add skill")}
            items={value.skills.primary}
            onAdd={() => addSkill("primary")}
            onRemove={(index) => removeSkill("primary", index)}
            onChange={(index, fieldValue) => updateSkills("primary", index, fieldValue)}
          />
          <ListField
            label={sectionText(locale, "其他技能", "Secondary Skills")}
            addLabel={sectionText(locale, "添加技能", "Add skill")}
            items={value.skills.secondary}
            onAdd={() => addSkill("secondary")}
            onRemove={(index) => removeSkill("secondary", index)}
            onChange={(index, fieldValue) => updateSkills("secondary", index, fieldValue)}
          />
        </CardContent>
      </Card>

      <Card id="resume-editor-experience">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{sectionText(locale, "工作经历", "Experience")}</CardTitle>
          <Button variant="outline" size="sm" onClick={addExperience}>
            <Plus className="mr-2 h-4 w-4" />
            {sectionText(locale, "添加工作经历", "Add experience")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.experiences.map((experience, index) => (
            <EditableBlock
              key={`${experience.company}-${experience.title}-${index}`}
              title={experience.title || sectionText(locale, "未命名经历", "Untitled experience")}
              onRemove={() => removeExperience(index)}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <Field label={sectionText(locale, "职位", "Title")}>
                  <Input value={experience.title} onChange={(event) => updateExperience(index, {title: event.target.value})} />
                </Field>
                <Field label={sectionText(locale, "公司", "Company")}>
                  <Input value={experience.company} onChange={(event) => updateExperience(index, {company: event.target.value})} />
                </Field>
                <Field label={sectionText(locale, "时间", "Period")}>
                  <Input value={experience.period} onChange={(event) => updateExperience(index, {period: event.target.value})} />
                </Field>
              </div>
              <Field label={sectionText(locale, "经历概述", "Highlights")}>
                <Textarea value={experience.highlights} onChange={(event) => updateExperience(index, {highlights: event.target.value})} className="min-h-[100px]" />
              </Field>
              <ListField
                label={sectionText(locale, "项目要点", "Bullets")}
                addLabel={sectionText(locale, "添加要点", "Add bullet")}
                items={experience.bullets}
                onAdd={() => addExperienceBullet(index)}
                onRemove={(bulletIndex) => removeExperienceBullet(index, bulletIndex)}
                onChange={(bulletIndex, fieldValue) => updateExperienceBullet(index, bulletIndex, fieldValue)}
              />
            </EditableBlock>
          ))}
        </CardContent>
      </Card>

      <Card id="resume-editor-projects">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{sectionText(locale, "项目经历", "Projects")}</CardTitle>
          <Button variant="outline" size="sm" onClick={addProject}>
            <Plus className="mr-2 h-4 w-4" />
            {sectionText(locale, "添加项目经历", "Add project")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.projects.map((project, index) => (
            <EditableBlock
              key={`${project.name}-${project.organization}-${index}`}
              title={project.name || sectionText(locale, "未命名项目", "Untitled project")}
              onRemove={() => removeProject(index)}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={sectionText(locale, "项目名称", "Project Name")}>
                  <Input value={project.name} onChange={(event) => updateProject(index, {name: event.target.value})} />
                </Field>
                <Field label={sectionText(locale, "担任角色", "Role")}>
                  <Input value={project.role} onChange={(event) => updateProject(index, {role: event.target.value})} />
                </Field>
                <Field label={sectionText(locale, "所属组织", "Organization")}>
                  <Input value={project.organization} onChange={(event) => updateProject(index, {organization: event.target.value})} />
                </Field>
                <Field label={sectionText(locale, "时间", "Period")}>
                  <Input value={project.period} onChange={(event) => updateProject(index, {period: event.target.value})} />
                </Field>
              </div>
              <ListField
                label={sectionText(locale, "项目要点", "Bullets")}
                addLabel={sectionText(locale, "添加要点", "Add bullet")}
                items={project.bullets}
                onAdd={() => addProjectBullet(index)}
                onRemove={(bulletIndex) => removeProjectBullet(index, bulletIndex)}
                onChange={(bulletIndex, fieldValue) => updateProjectBullet(index, bulletIndex, fieldValue)}
              />
            </EditableBlock>
          ))}
        </CardContent>
      </Card>

      <Card id="resume-editor-education">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{sectionText(locale, "教育背景", "Education")}</CardTitle>
          <Button variant="outline" size="sm" onClick={addEducation}>
            <Plus className="mr-2 h-4 w-4" />
            {sectionText(locale, "添加教育经历", "Add education")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.education.map((item, index) => (
            <EditableBlock
              key={`${item.school}-${item.period}-${index}`}
              title={item.school || sectionText(locale, "未命名教育经历", "Untitled education")}
              onRemove={() => removeEducation(index)}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={sectionText(locale, "学校", "School")}>
                  <Input value={item.school} onChange={(event) => updateEducation(index, {school: event.target.value})} />
                </Field>
                <Field label={sectionText(locale, "学历", "Degree")}>
                  <Input value={item.degree} onChange={(event) => updateEducation(index, {degree: event.target.value})} />
                </Field>
                <Field label={sectionText(locale, "专业", "Major")}>
                  <Input value={item.major} onChange={(event) => updateEducation(index, {major: event.target.value})} />
                </Field>
                <Field label={sectionText(locale, "时间", "Period")}>
                  <Input value={item.period} onChange={(event) => updateEducation(index, {period: event.target.value})} />
                </Field>
              </div>
            </EditableBlock>
          ))}
        </CardContent>
      </Card>

      <Card id="resume-editor-evaluation">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{sectionText(locale, "个人评价", "Personal Evaluation")}</CardTitle>
          <Button variant="outline" size="sm" onClick={addEvaluation}>
            <Plus className="mr-2 h-4 w-4" />
            {sectionText(locale, "添加评价", "Add note")}
          </Button>
        </CardHeader>
        <CardContent>
          <ListField
            label={sectionText(locale, "评价条目", "Evaluation Lines")}
            addLabel={sectionText(locale, "添加评价", "Add note")}
            items={evaluationLines.length > 0 ? evaluationLines : [""]}
            onAdd={addEvaluation}
            onRemove={removeEvaluation}
            onChange={updateEvaluation}
            multiline
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <label className="space-y-2">
      <div className="text-sm font-medium text-slate-900 dark:text-white">{label}</div>
      {children}
    </label>
  );
}

function EditableBlock({
  title,
  onRemove,
  children
}: {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">{title}</div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </Button>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ListField({
  label,
  addLabel,
  items,
  onAdd,
  onRemove,
  onChange,
  multiline = false
}: {
  label: string;
  addLabel: string;
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-slate-900 dark:text-white">{label}</div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {addLabel}
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={`${label}-${index}`} className="flex items-start gap-2">
            {multiline ? (
              <Textarea value={item} onChange={(event) => onChange(index, event.target.value)} className="min-h-[90px]" />
            ) : (
              <Input value={item} onChange={(event) => onChange(index, event.target.value)} />
            )}
            <Button variant="ghost" size="icon" onClick={() => onRemove(index)} aria-label="remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

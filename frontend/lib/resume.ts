import {moduleOptions} from "@/lib/templates";
import type {CandidateProfile, ResumeResult} from "@/lib/types";

const defaultCandidateProfile: CandidateProfile = {
  displayName: "",
  title: "",
  location: "",
  email: "",
  phone: "",
  yearsOfExperience: "",
  targetRole: "",
  employmentStatus: ""
};

export function normalizeResume(resume: ResumeResult): ResumeResult {
  return {
    ...resume,
    skills: {
      primary: resume.skills?.primary ?? [],
      secondary: resume.skills?.secondary ?? []
    },
    experiences: resume.experiences ?? [],
    projects: resume.projects ?? [],
    education: resume.education ?? [],
    selectedModules: resume.selectedModules?.filter((module) => moduleOptions.includes(module as typeof moduleOptions[number])) ?? [...moduleOptions],
    atsKeywords: resume.atsKeywords ?? [],
    jobKeywords: resume.jobKeywords ?? [],
    suggestions: resume.suggestions ?? [],
    candidateProfile: {
      ...defaultCandidateProfile,
      ...resume.candidateProfile
    },
    personalEvaluation: resume.personalEvaluation ?? ""
  };
}

export interface MatchAxisScore {
  label: string;
  jd: number;
  candidate: number;
}

export interface ImprovementItem {
  field: string;
  text: string;
}

function clampScore(value: number) {
  return Math.max(45, Math.min(98, Math.round(value)));
}

function includesAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(pattern));
}

function detectImprovementField(locale: string, suggestion: string) {
  const directMatch = suggestion.match(/^\[([^\]]+)]\s*(.*)$/);
  if (directMatch) {
    const rawField = directMatch[1].trim();
    const text = directMatch[2].trim();
    return {
      field: rawField,
      text: text || suggestion
    };
  }

  const lowered = suggestion.toLowerCase();
  const field = (() => {
    if (includesAny(lowered, ["summary", "总结", "简介"])) {
      return "summary";
    }
    if (includesAny(lowered, ["experience", "经历", "timeline", "时间线"])) {
      return "experience";
    }
    if (includesAny(lowered, ["skills", "技能", "keyword", "关键词"])) {
      return "skills.primary";
    }
    if (includesAny(lowered, ["education", "学校", "学历"])) {
      return "education";
    }
    if (includesAny(lowered, ["project", "项目"])) {
      return "projects";
    }
    return locale === "en" ? "content" : "内容";
  })();

  return {
    field,
    text: suggestion
  };
}

export function buildMatchAxes(resume: ResumeResult): MatchAxisScore[] {
  const locale = resume.locale === "en" ? "en" : "zh";
  const matchedKeywords = new Set(resume.atsKeywords.map((item) => item.toLowerCase()));
  const totalKeywordCount = Math.max(resume.jobKeywords.length, resume.atsKeywords.length, 1);
  const keywordCoverage = matchedKeywords.size / totalKeywordCount;
  const projectSignal = Math.min(resume.projects.length, 3) * 6;
  const experienceSignal = Math.min(resume.experiences.length, 3) * 5;
  const educationSignal = resume.education.length > 0 ? 18 : 6;
  const collaborationSignal = includesAny(
    `${resume.summary} ${resume.personalEvaluation}`.toLowerCase(),
    ["协作", "团队", "沟通", "collaboration", "stakeholder", "team"]
  ) ? 10 : 0;
  const domainSignal = includesAny(
    [...resume.jobKeywords, ...resume.atsKeywords].join(" ").toLowerCase(),
    ["低代码", "ai", "ats", "editor", "schema", "platform"]
  ) ? 10 : 4;

  const candidateScores = [
    clampScore(66 + keywordCoverage * 28 + Math.min(resume.skills.primary.length, 5) * 2),
    clampScore(62 + collaborationSignal + Math.min(resume.suggestions.length, 5) * 2),
    clampScore(64 + projectSignal + Math.min(resume.matchScore / 12, 8)),
    clampScore(60 + experienceSignal + domainSignal),
    clampScore(54 + educationSignal + Math.min(resume.matchScore / 18, 6))
  ];

  const jdScores = [
    clampScore(candidateScores[0] + 5),
    clampScore(candidateScores[1] + 5),
    clampScore(candidateScores[2] + 4),
    clampScore(candidateScores[3] + 3),
    clampScore(candidateScores[4] - 2)
  ];

  const labels = locale === "en"
    ? ["Skill Fit", "Collaboration", "Business Context", "Domain Fit", "Education"]
    : ["技能能力", "协作能力", "业务能力", "行业经验", "学历背景"];

  return labels.map((label, index) => ({
    label,
    jd: jdScores[index],
    candidate: candidateScores[index]
  }));
}

export function buildStrengths(resume: ResumeResult) {
  const locale = resume.locale === "en" ? "en" : "zh";
  const primaryKeywordLine = resume.atsKeywords.slice(0, 5).join(locale === "en" ? ", " : "、");
  const strengths = [
    locale === "en"
      ? `Matched keywords cover the role core: ${primaryKeywordLine || resume.skills.primary.slice(0, 4).join(", ")}.`
      : `命中关键词覆盖了岗位核心诉求：${primaryKeywordLine || resume.skills.primary.slice(0, 4).join("、")}。`,
    locale === "en"
      ? `Project and experience sections already align to ${resume.companyName} style hiring expectations.`
      : `项目经历和工作经历已经能对齐 ${resume.companyName} 这类岗位的筛选口径。`,
    locale === "en"
      ? `The resume keeps a clear structure across ${resume.selectedModules.length} modules and remains easy to scan.`
      : `简历在 ${resume.selectedModules.length} 个模块内保持了清晰层次，便于 HR 快速扫描。`,
    locale === "en"
      ? `The current summary and skills stack provide enough signal for both ATS filtering and recruiter review.`
      : `当前总结和技能栈已经同时兼顾了 ATS 过滤与人工阅读的信息密度。`
  ];

  if (resume.projects.length > 1) {
    strengths.splice(2, 0, locale === "en"
      ? "Multiple project cases make the narrative more convincing than a single hero project."
      : "多个项目案例形成了互相印证，比单一明星项目更有说服力。");
  }

  return strengths.slice(0, 5);
}

export function buildHrSummary(resume: ResumeResult) {
  const locale = resume.locale === "en" ? "en" : "zh";
  const missingCount = Math.max(resume.jobKeywords.length - resume.atsKeywords.length, 0);

  if (locale === "en") {
    if (resume.matchScore >= 88) {
      return `This resume is already a strong match for the target role. Keyword coverage is broad, the project narrative is relevant, and only ${missingCount} higher-bar signals still need to be made more explicit.`;
    }
    if (resume.matchScore >= 78) {
      return `This resume is competitive, but it still needs sharper positioning in summary, keywords, and timeline details to remove recruiter doubt on the first screen.`;
    }
    return "The resume has a workable base, but it still needs stronger evidence, tighter wording, and clearer alignment to the role priorities.";
  }

  if (resume.matchScore >= 88) {
    return `这份简历已经具备较强竞争力，关键词覆盖广、项目叙事贴岗，只剩 ${missingCount} 个左右的高门槛信号需要再明确表达。`;
  }
  if (resume.matchScore >= 78) {
    return "这份简历已经具备投递基础，但还需要在总结定位、关键词前置和时间线细节上进一步收紧，减少 HR 的第一眼疑虑。";
  }
  return "这份简历已经有可用底稿，但还需要用更强证据、更多量化结果和更明确的贴岗表达来提升通过率。";
}

export function buildImprovementItems(resume: ResumeResult): ImprovementItem[] {
  const locale = resume.locale === "en" ? "en" : "zh";
  const suggestions = resume.suggestions.length > 0
    ? resume.suggestions
    : (locale === "en"
      ? [
          "Move the most important keywords into the top summary.",
          "Add metrics to experience bullets to show business impact.",
          "Make education and timeline fields easier for ATS parsing."
        ]
      : [
          "把最关键的岗位关键词前置到个人总结中。",
          "为工作经历补充量化结果，增强业务影响力表达。",
          "把教育信息和时间线写得更利于 ATS 解析。"
        ]);

  return suggestions.map((suggestion) => detectImprovementField(locale, suggestion));
}

export function splitMultilineText(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinMultilineText(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function resumeToPlainText(resume: ResumeResult) {
  const profile = resume.candidateProfile;
  const sections = [
    `${profile.displayName} | ${profile.targetRole || profile.title}`,
    [profile.phone, profile.email, profile.location, profile.yearsOfExperience, profile.employmentStatus].filter(Boolean).join(" | "),
    "",
    "Summary",
    resume.summary,
    "",
    "Skills",
    `Primary: ${resume.skills.primary.join(", ")}`,
    `Secondary: ${resume.skills.secondary.join(", ")}`,
    "",
    "Experience",
    ...resume.experiences.flatMap((experience) => [
      `${experience.title} | ${experience.company} | ${experience.period}`,
      experience.highlights,
      ...experience.bullets.map((bullet) => `- ${bullet}`),
      ""
    ]),
    "Projects",
    ...resume.projects.flatMap((project) => [
      `${project.name} | ${project.role} | ${project.organization} | ${project.period}`,
      ...project.bullets.map((bullet) => `- ${bullet}`),
      ""
    ]),
    "Education",
    ...resume.education.map((item) => `${item.school} | ${item.degree} | ${item.major} | ${item.period}`),
    "",
    "Personal Evaluation",
    resume.personalEvaluation
  ];

  return sections.filter((item, index, list) => item !== "" || list[index - 1] !== "").join("\n").trim();
}

export function resumeToMarkdown(resume: ResumeResult) {
  const profile = resume.candidateProfile;
  const visibleModules = resume.selectedModules?.filter((module) => moduleOptions.includes(module as typeof moduleOptions[number])) ?? [...moduleOptions];
  const heading = (zh: string, en: string) => resume.locale === "en" ? en : zh;
  const lines = [
    `# ${profile.displayName || "Resume"}`,
    "",
    `> ${profile.targetRole || profile.title || heading("候选人", "Candidate")}`,
    "",
    `- ${heading("公司", "Company")}: ${resume.companyName}`,
    `- ${heading("匹配度", "Match Score")}: ${resume.matchScore}%`,
    `- ${heading("电话", "Phone")}: ${profile.phone || "-"}`,
    `- ${heading("邮箱", "Email")}: ${profile.email || "-"}`,
    `- ${heading("地点", "Location")}: ${profile.location || "-"}`,
    `- ${heading("工作年限", "Experience")}: ${profile.yearsOfExperience || "-"}`,
    `- ${heading("在职状态", "Employment Status")}: ${profile.employmentStatus || "-"}`,
    "",
    `## ${heading("简介", "Summary")}`,
    "",
    resume.summary || "-"
  ];

  if (visibleModules.includes("专业技能")) {
    lines.push(
      "",
      `## ${heading("专业技能", "Skills")}`,
      "",
      `### ${heading("核心技能", "Primary Skills")}`,
      ...resume.skills.primary.map((item) => `- ${item}`),
      "",
      `### ${heading("其他技能", "Secondary Skills")}`,
      ...resume.skills.secondary.map((item) => `- ${item}`)
    );
  }

  if (visibleModules.includes("教育经历")) {
    lines.push("", `## ${heading("教育经历", "Education")}`);
    resume.education.forEach((item) => {
      lines.push(
        "",
        `### ${item.school}`,
        `- ${heading("学历", "Degree")}: ${item.degree}`,
        `- ${heading("专业", "Major")}: ${item.major}`,
        `- ${heading("时间", "Period")}: ${item.period}`
      );
    });
  }

  if (visibleModules.includes("工作经历")) {
    lines.push("", `## ${heading("工作经历", "Experience")}`);
    resume.experiences.forEach((experience) => {
      lines.push(
        "",
        `### ${experience.title} · ${experience.company}`,
        `- ${heading("时间", "Period")}: ${experience.period}`,
        "",
        experience.highlights,
        ...experience.bullets.map((item) => `- ${item}`)
      );
    });
  }

  if (visibleModules.includes("项目经历")) {
    lines.push("", `## ${heading("项目经历", "Projects")}`);
    resume.projects.forEach((project) => {
      lines.push(
        "",
        `### ${project.name}`,
        `- ${heading("角色", "Role")}: ${project.role}`,
        `- ${heading("组织", "Organization")}: ${project.organization}`,
        `- ${heading("时间", "Period")}: ${project.period}`,
        ...project.bullets.map((item) => `- ${item}`)
      );
    });
  }

  if (visibleModules.includes("个人评价")) {
    lines.push("", `## ${heading("个人评价", "Evaluation")}`, "");
    splitMultilineText(resume.personalEvaluation).forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  if (resume.atsKeywords.length > 0) {
    lines.push("", `## ${heading("ATS关键词", "ATS Keywords")}`, "", ...resume.atsKeywords.map((item) => `- ${item}`));
  }

  if (resume.suggestions.length > 0) {
    lines.push("", `## ${heading("优化建议", "Suggestions")}`, "", ...resume.suggestions.map((item) => `- ${item}`));
  }

  return lines.filter((line, index, list) => line !== "" || list[index - 1] !== "").join("\n").trim();
}

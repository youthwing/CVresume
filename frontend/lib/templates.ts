export type TemplateId = "classic" | "modern" | "professional" | "gradient" | "compact" | "creative";
export const moduleOptions = ["教育经历", "专业技能", "工作经历", "项目经历", "个人评价"] as const;
export type ResumeModuleId = (typeof moduleOptions)[number];

export const moduleLabels: Record<ResumeModuleId, {zh: string; en: string}> = {
  "教育经历": {zh: "教育经历", en: "Education"},
  "专业技能": {zh: "专业技能", en: "Skills"},
  "工作经历": {zh: "工作经历", en: "Experience"},
  "项目经历": {zh: "项目经历", en: "Projects"},
  "个人评价": {zh: "个人评价", en: "Evaluation"}
};

export const templateOptions: Array<{
  id: TemplateId;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
}> = [
  {id: "classic", title: "经典简约", titleEn: "Classic", description: "单栏布局，黑白配色，传统简洁", descriptionEn: "Single-column, traditional and clean"},
  {id: "modern", title: "现代双栏", titleEn: "Modern Split", description: "左右分栏，侧边导航，视觉丰富", descriptionEn: "Two-column with richer visual hierarchy"},
  {id: "professional", title: "专业正式", titleEn: "Professional", description: "深蓝头部，时间轴设计，信息密集", descriptionEn: "Deep-blue header with timeline cues"},
  {id: "gradient", title: "优雅渐变", titleEn: "Gradient", description: "渐变色条，清新柔和，精致排版", descriptionEn: "Soft gradient accents and refined spacing"},
  {id: "compact", title: "紧凑高效", titleEn: "Compact", description: "双栏布局，信息密集，适合资深", descriptionEn: "Dense two-column layout for senior profiles"},
  {id: "creative", title: "创意设计", titleEn: "Creative", description: "卡片模块，独特配色，适合创意岗", descriptionEn: "Card-driven layout for creative roles"}
];

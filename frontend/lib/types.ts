export interface SortView {
  empty: boolean;
  sorted: boolean;
  unsorted: boolean;
}

export interface PageableView {
  pageNumber: number;
  pageSize: number;
  sort: SortView;
  offset: number;
  paged: boolean;
  unpaged: boolean;
}

export interface PageResponse<T> {
  content: T[];
  pageable: PageableView;
  totalElements: number;
  totalPages: number;
  last: boolean;
  size: number;
  number: number;
  sort: SortView;
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  headline: string;
  locale: string;
  role: string;
  proMember: boolean;
  credits: number;
  inviteCode: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface AuthPayload {
  token: string;
  user: UserProfile;
}

export interface OAuthProvider {
  providerType: string;
  displayName: string;
  iconUrl: string;
}

export interface OAuthAuthorizeResponse {
  authUrl: string;
  state: string;
}

export interface CreditPackageItem {
  id: string;
  productType: string;
  name: string;
  description: string;
  credits: number;
  priceCent: number;
  badge: string;
  recommended: boolean;
  grantsPro: boolean;
}

export interface CreditLedgerEntry {
  id: string;
  type: string;
  delta: number;
  title: string;
  description: string;
  createdAt: string;
}

export interface CreditSummary {
  balance: number;
  totalConsumed: number;
  history: CreditLedgerEntry[];
}

export interface InvitationUserView {
  id: string;
  displayName: string;
  email: string;
  createdAt: string;
}

export interface InvitationSummaryView {
  inviteCode: string;
  invitedUsers: number;
  totalEarnedCredits: number;
  rewardPerInvite: number;
  rewardForInvitee: number;
  invitees: InvitationUserView[];
}

export interface OrderView {
  id: string;
  productId: string;
  productType: string;
  title: string;
  amountCent: number;
  credits: number;
  grantsPro: boolean;
  status: string;
  paymentMethod: string | null;
  payerName: string | null;
  payerAccount: string | null;
  paymentReference: string | null;
  paymentNote: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  fulfilledAt: string | null;
  redemptionCodeId: string | null;
  createdAt: string;
}

export interface RedemptionProductView {
  id: string;
  productType: string;
  name: string;
  description: string;
  credits: number;
  priceCent: number;
  grantsPro: boolean;
  recommended: boolean;
  active: boolean;
}

export interface RedemptionCodeView {
  id: string;
  code: string;
  productId: string;
  productType: string;
  productName: string;
  credits: number;
  grantsPro: boolean;
  status: string;
  createdAt: string;
  redeemedAt: string | null;
  orderId: string | null;
}

export interface PurchaseResponse {
  order: OrderView | null;
  balance: number;
  code: RedemptionCodeView | null;
  message: string;
}

export interface CandidateProfile {
  displayName: string;
  title: string;
  location: string;
  email: string;
  phone: string;
  yearsOfExperience: string;
  targetRole: string;
  employmentStatus: string;
}

export interface ResumeSkills {
  primary: string[];
  secondary: string[];
}

export interface ResumeExperience {
  title: string;
  company: string;
  period: string;
  highlights: string;
  bullets: string[];
}

export interface ResumeProject {
  name: string;
  role: string;
  period: string;
  organization: string;
  bullets: string[];
}

export interface EducationItem {
  school: string;
  major: string;
  period: string;
  degree: string;
}

export interface ResumeResult {
  jobId: string;
  companyName: string;
  matchScore: number;
  locale: string;
  templateId: string;
  selectedModules: string[];
  skills: ResumeSkills;
  summary: string;
  atsKeywords: string[];
  jobKeywords: string[];
  suggestions: string[];
  experiences: ResumeExperience[];
  projects: ResumeProject[];
  education: EducationItem[];
  personalEvaluation: string;
  candidateProfile: CandidateProfile;
  version: number;
  usedReferenceImage: boolean;
}

export interface ProjectView {
  id: string;
  companyName: string;
  locale: string;
  jdText: string;
  resumeText: string;
  selectedModules: string[];
  templateId: string;
  usedReferenceImage: boolean;
  createdAt: string;
  latestJobId: string | null;
}

export interface JobView {
  id: string;
  projectId: string;
  status: string;
  progress: number;
  result: ResumeResult | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharedResumeView {
  id: string;
  companyName: string;
  matchScore: number;
  templateId: string;
  locale: string;
  resumePreview: ResumeResult;
  viewCount: number;
  useCount: number;
  createdAt: string;
  mine: boolean;
}

export interface CountResponse {
  viewCount: number;
  useCount: number;
}

export interface FeedbackView {
  id: string;
  category: string;
  content: string;
  createdAt: string;
}

export interface ChatSessionView {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageView {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ChatHistoryView {
  content: ChatSessionView[];
  nextCursor: string | null;
}

export interface AdminDashboardView {
  totalUsers: number;
  proUsers: number;
  adminUsers: number;
  totalOrders: number;
  totalCodes: number;
  redeemedCodes: number;
  totalJobs: number;
  totalCreditsIssued: number;
  totalCreditsConsumed: number;
}

export interface AdminUserView {
  id: string;
  email: string;
  displayName: string;
  role: string;
  proMember: boolean;
  credits: number;
  inviteCode: string;
  referredByInviteCode: string | null;
  createdAt: string;
  lastLoginAt: string;
}

export interface AdminOrderView {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  productId: string;
  productType: string;
  title: string;
  amountCent: number;
  credits: number;
  grantsPro: boolean;
  status: string;
  paymentMethod: string | null;
  payerName: string | null;
  payerAccount: string | null;
  paymentReference: string | null;
  paymentNote: string | null;
  reviewNote: string | null;
  reviewedByUserId: string | null;
  reviewedByEmail: string;
  reviewedAt: string | null;
  fulfilledAt: string | null;
  redemptionCodeId: string | null;
  createdAt: string;
}

export interface AdminRedemptionCodeView {
  id: string;
  code: string;
  productId: string;
  productType: string;
  productName: string;
  credits: number;
  grantsPro: boolean;
  status: string;
  purchasedByUserId: string | null;
  purchasedByEmail: string;
  redeemedByUserId: string | null;
  redeemedByEmail: string;
  createdAt: string;
  redeemedAt: string | null;
  orderId: string | null;
}

export interface AdminGenerateCodesResponse {
  productId: string;
  productName: string;
  count: number;
  generationCount: number;
  creditsPerCode: number;
  codes: AdminRedemptionCodeView[];
}

"use client";

import axios, {type AxiosRequestConfig} from "axios";
import type {
  AdminDashboardView,
  AdminGenerateCodesResponse,
  AdminOrderView,
  AdminRedemptionCodeView,
  AdminUserView,
  AuthPayload,
  ChatHistoryView,
  ChatMessageView,
  ChatSessionView,
  CountResponse,
  CreditPackageItem,
  CreditSummary,
  FeedbackView,
  InvitationSummaryView,
  JobView,
  OAuthAuthorizeResponse,
  OAuthProvider,
  OrderView,
  PageResponse,
  ProjectView,
  PurchaseResponse,
  RedemptionCodeView,
  RedemptionProductView,
  ResumeResult,
  SharedResumeView,
  UserProfile
} from "@/lib/types";

const LOCAL_API_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_API_BASE_URL = "http://localhost:8080/api";

function resolveApiBaseUrl() {
  const envApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (typeof window === "undefined") {
    return envApiBaseUrl || LOCAL_API_BASE_URL;
  }

  if (!envApiBaseUrl) {
    return "/api";
  }

  try {
    const apiUrl = new URL(envApiBaseUrl, window.location.origin);
    const isLoopbackBackend =
      LOCAL_API_HOSTS.has(apiUrl.hostname) &&
      (apiUrl.port === "" || apiUrl.port === "8080") &&
      apiUrl.pathname.startsWith("/api");
    const isRemoteSite = !LOCAL_API_HOSTS.has(window.location.hostname);

    if (isLoopbackBackend && isRemoteSite) {
      return "/api";
    }
  } catch {
    return envApiBaseUrl;
  }

  return envApiBaseUrl;
}

const apiBaseUrl = resolveApiBaseUrl();

const instance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json"
  }
});

const pendingGetRequests = new Map<string, Promise<unknown>>();
const rawGet = instance.get.bind(instance);
type DedupeConfig = AxiosRequestConfig & {disableRequestDedupe?: boolean};

instance.get = ((url, config) => {
  const nextConfig = config as DedupeConfig | undefined;
  if (nextConfig?.disableRequestDedupe) {
    return rawGet(url, config);
  }
  const key = `GET::${localStorage.getItem("token") ?? ""}::${instance.getUri({...config, url, method: "get"})}`;
  const pending = pendingGetRequests.get(key);
  if (pending) {
    return pending as ReturnType<typeof rawGet>;
  }
  const request = rawGet(url, config).finally(() => {
    pendingGetRequests.delete(key);
  });
  pendingGetRequests.set(key, request);
  return request;
}) as typeof instance.get;

instance.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("auth_user");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  sendCode: (payload: {email: string; type: "LOGIN" | "REGISTER" | "AUTH"; locale: string}) =>
    instance.post<{message: string; success: boolean; demoCode: string | null; expiresAt: string | null; isRegistered: boolean | null}>("/auth/send-code", payload),
  register: (payload: {email: string; password: string; displayName: string; code: string; inviteCode?: string; locale: string}) =>
    instance.post<AuthPayload>("/auth/register", payload),
  login: (payload: {email: string; password: string; code: string; locale: string}) =>
    instance.post<AuthPayload>("/auth/login", payload),
  invitations: () => instance.get<InvitationSummaryView>("/auth/invitations"),
  updateProfile: (payload: {displayName?: string; headline?: string; locale?: string}) =>
    instance.put<UserProfile>("/auth/profile", payload),
  me: () => instance.get<UserProfile>("/auth/me")
};

export const oauthApi = {
  listProviders: () => instance.get<OAuthProvider[]>("/auth/oauth/providers"),
  getAuthUrl: (provider: string, locale: string) =>
    instance.get<OAuthAuthorizeResponse>(`/auth/oauth/${provider}/authorize`, {params: {locale}}),
  callback: (provider: string, code: string, state: string, locale: string) =>
    instance.post<AuthPayload>(`/auth/oauth/${provider}/callback`, {code, state, locale})
};

export const creditApi = {
  get: () => instance.get<CreditSummary>("/credits"),
  getPackages: () => instance.get<CreditPackageItem[]>("/credits/packages"),
  purchasePackage: (packageId: string) => instance.post<PurchaseResponse>(`/credits/packages/${packageId}/purchase`)
};

export const orderApi = {
  create: (productType: string) => instance.post<OrderView>("/orders", {productType}),
  list: (page = 0, size = 10) => instance.get<PageResponse<OrderView>>(`/orders?page=${page}&size=${size}`),
  get: (orderId: string) => instance.get<OrderView>(`/orders/${orderId}`),
  cancel: (orderId: string) => instance.post<OrderView>(`/orders/${orderId}/cancel`)
};

export const redemptionApi = {
  redeem: (code: string) => instance.post<PurchaseResponse>("/redemption/redeem", {code}),
  history: () => instance.get<RedemptionCodeView[]>("/redemption/history"),
  products: () => instance.get<RedemptionProductView[]>("/redemption/products"),
  codes: (size = 50) => instance.get<RedemptionCodeView[]>(`/redemption/codes?size=${size}`),
  purchasedCodes: () => instance.get<RedemptionCodeView[]>("/redemption/purchased"),
  purchaseProduct: (productId: string) => instance.post<PurchaseResponse>(`/redemption/products/${productId}/purchase`),
  purchaseCode: (codeId: string) => instance.post<PurchaseResponse>(`/redemption/codes/${codeId}/purchase`)
};

export const projectApi = {
  create: (payload: {
    companyName: string;
    locale: string;
    jdText: string;
    resumeText: string;
    selectedModules: string[];
    templateId: string;
  }) => instance.post<ProjectView>("/projects", payload),
  list: () => instance.get<ProjectView[]>("/projects"),
  get: (projectId: string) => instance.get<ProjectView>(`/projects/${projectId}`),
  delete: (projectId: string) => instance.delete<{message: string}>(`/projects/${projectId}`),
  generate: (projectId: string, payload: {
    companyName: string;
    resumeText: string;
    jdText: string;
    locale: string;
    selectedModules: string[];
    templateId: string;
  }, image?: File | null) => {
    const formData = new FormData();
    formData.append("data", new Blob([JSON.stringify(payload)], {type: "application/json"}));
    if (image) {
      formData.append("image", image);
    }
    return instance.post<JobView>(`/projects/${projectId}/generate`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
  }
};

export const jobApi = {
  status: (jobId: string) => instance.get<JobView>(`/jobs/${jobId}`),
  result: (jobId: string) => instance.get<ResumeResult>(`/jobs/${jobId}/result`),
  retry: (jobId: string) => instance.post<JobView>(`/jobs/${jobId}/retry`),
  updateTemplate: (jobId: string, templateId: string) => instance.patch<JobView>(`/jobs/${jobId}/template`, {templateId}),
  polishResume: (jobId: string, payload: {
    instruction: string;
    resumeData: ResumeResult;
    candidateProfile: ResumeResult["candidateProfile"];
  }) => instance.post<ResumeResult>(`/jobs/${jobId}/polish`, payload),
  updateResumeContent: (jobId: string, version: number, resumeData: ResumeResult, candidateProfile: ResumeResult["candidateProfile"]) =>
    instance.put<ResumeResult>(`/jobs/${jobId}/resume-content`, {version, resumeData, candidateProfile})
};

export const shareApi = {
  create: (jobId: string) => instance.post<SharedResumeView>("/shared-resumes", {jobId}),
  list: (page = 0, size = 12) => instance.get<PageResponse<SharedResumeView>>(`/shared-resumes?page=${page}&size=${size}`),
  mine: (page = 0, size = 12) => instance.get<PageResponse<SharedResumeView>>(`/shared-resumes/mine?page=${page}&size=${size}`),
  get: (shareId: string) => instance.get<SharedResumeView>(`/shared-resumes/${shareId}`),
  recordView: (shareId: string) => instance.post<CountResponse>(`/shared-resumes/${shareId}/view`),
  recordUse: (shareId: string) => instance.post<CountResponse>(`/shared-resumes/${shareId}/use`),
  delete: (shareId: string) => instance.delete<{message: string}>(`/shared-resumes/${shareId}`)
};

export const feedbackApi = {
  submit: (payload: {category: string; content: string}) => instance.post<FeedbackView>("/feedback", payload),
  myList: (page = 0, size = 10) => instance.get<PageResponse<FeedbackView>>(`/feedback?page=${page}&size=${size}`)
};

export const chatApi = {
  getCurrentSession: () => instance.get<ChatSessionView>("/chat/current"),
  getMessages: (sessionId: string) => instance.get<ChatMessageView[]>(`/chat/sessions/${sessionId}/messages`),
  closeSession: (sessionId: string) => instance.post<ChatSessionView>(`/chat/sessions/${sessionId}/close`),
  getHistorySessions: (cursor?: string, size = 10) => {
    const params = new URLSearchParams({size: String(size)});
    if (cursor) {
      params.append("cursor", cursor);
    }
    return instance.get<ChatHistoryView>(`/chat/history?${params.toString()}`);
  }
};

export const adminApi = {
  dashboard: () => instance.get<AdminDashboardView>("/admin/dashboard"),
  users: (page = 0, size = 20, q?: string) => {
    const params = new URLSearchParams({page: String(page), size: String(size)});
    if (q) {
      params.append("q", q);
    }
    return instance.get<PageResponse<AdminUserView>>(`/admin/users?${params.toString()}`);
  },
  adjustCredits: (userId: string, delta: number, reason: string) =>
    instance.post<UserProfile>(`/admin/users/${userId}/credits`, {delta, reason}),
  products: () => instance.get<RedemptionProductView[]>("/admin/products"),
  createProduct: (payload: {
    productType: string;
    name: string;
    description: string;
    credits: number;
    priceCent: number;
    grantsPro: boolean;
    recommended: boolean;
    active: boolean;
  }) => instance.post<RedemptionProductView>("/admin/products", payload),
  updateProduct: (productId: string, payload: {
    productType: string;
    name: string;
    description: string;
    credits: number;
    priceCent: number;
    grantsPro: boolean;
    recommended: boolean;
    active: boolean;
  }) => instance.put<RedemptionProductView>(`/admin/products/${productId}`, payload),
  generateCodes: (productId: string, count: number) =>
    instance.post<AdminGenerateCodesResponse>(`/admin/products/${productId}/codes`, {count}),
  generateCustomCodes: (generationCount: number, count: number) =>
    instance.post<AdminGenerateCodesResponse>("/admin/redemption-codes/custom", {generationCount, count}),
  orders: (page = 0, size = 20) => instance.get<PageResponse<AdminOrderView>>(`/admin/orders?page=${page}&size=${size}`),
  codes: (page = 0, size = 20) => instance.get<PageResponse<AdminRedemptionCodeView>>(`/admin/redemption-codes?page=${page}&size=${size}`)
};

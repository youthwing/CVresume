"use client";

import {useEffect, useState} from "react";
import Link from "next/link";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {Bot, Coins, FolderKanban, History, MessageSquareText, ReceiptText, Ticket} from "lucide-react";
import {
  chatApi,
  creditApi,
  feedbackApi,
  orderApi,
  projectApi,
  redemptionApi
} from "@/lib/api";
import {useAuth} from "@/components/providers/auth-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {formatPrice} from "@/lib/utils";
import type {
  ChatMessageView,
  ChatSessionView,
  CreditSummary,
  FeedbackView,
  OrderView,
  ProjectView,
  RedemptionCodeView
} from "@/lib/types";
import {toast} from "sonner";

export default function WorkspacePage() {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading, refresh} = useAuth();
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [projects, setProjects] = useState<ProjectView[]>([]);
  const [purchasedCodes, setPurchasedCodes] = useState<RedemptionCodeView[]>([]);
  const [redeemedCodes, setRedeemedCodes] = useState<RedemptionCodeView[]>([]);
  const [currentChat, setCurrentChat] = useState<ChatSessionView | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageView[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackView[]>([]);
  const [feedbackCategory, setFeedbackCategory] = useState("general");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [redeemCode, setRedeemCode] = useState("");

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/workspace`);
      return;
    }

    Promise.all([
      creditApi.get(),
      orderApi.list(),
      projectApi.list(),
      redemptionApi.purchasedCodes(),
      redemptionApi.history(),
      chatApi.getCurrentSession(),
      feedbackApi.myList()
    ]).then(async ([creditRes, orderRes, projectRes, purchasedRes, historyRes, chatRes, feedbackRes]) => {
      setCreditSummary(creditRes.data);
      setOrders(orderRes.data.content);
      setProjects(projectRes.data);
      setPurchasedCodes(purchasedRes.data);
      setRedeemedCodes(historyRes.data);
      setCurrentChat(chatRes.data);
      setFeedbackList(feedbackRes.data.content);
      const messages = await chatApi.getMessages(chatRes.data.id);
      setChatMessages(messages.data);
    }).catch(() => {
      toast.error(locale === "en" ? "Failed to load workspace data" : "工作台数据加载失败");
    });
  }, [loading, user, locale, router]);

  async function handleRedeem() {
    if (!redeemCode.trim()) {
      return;
    }
    const {data} = await redemptionApi.redeem(redeemCode.trim());
    setRedeemCode("");
    await refresh();
    const [creditRes, historyRes] = await Promise.all([creditApi.get(), redemptionApi.history()]);
    setCreditSummary(creditRes.data);
    setRedeemedCodes(historyRes.data);
    toast.success(data.message);
  }

  async function handleFeedbackSubmit() {
    if (!feedbackContent.trim()) {
      return;
    }
    const {data} = await feedbackApi.submit({category: feedbackCategory, content: feedbackContent.trim()});
    setFeedbackContent("");
    setFeedbackList((current) => [data, ...current]);
    toast.success(locale === "en" ? "Feedback submitted" : "反馈已提交");
  }

  async function handleDeleteProject(projectId: string) {
    await projectApi.delete(projectId);
    setProjects((current) => current.filter((project) => project.id !== projectId));
    toast.success(locale === "en" ? "Project deleted" : "项目已删除");
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {locale === "en" ? "Workspace" : "个人工作台"}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {user.displayName} · {user.email}
          </p>
        </div>
        <Link href={`/${locale}/create`}>
          <Button>{locale === "en" ? "Create new resume" : "继续创建简历"}</Button>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-blue-600" />
                {locale === "en" ? "Credits" : "积分中心"}
              </CardTitle>
              <CardDescription>
                {locale === "en" ? "Balance, consumption, and redemption" : "查看余额、消耗记录和兑换码"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard label={locale === "en" ? "Balance" : "当前余额"} value={String(user.credits)} />
                <MetricCard label={locale === "en" ? "Consumed" : "累计消耗"} value={String(creditSummary?.totalConsumed ?? 0)} />
                <MetricCard label={locale === "en" ? "Invite code" : "邀请码"} value={user.inviteCode} />
              </div>
              <div className="flex gap-2">
                <Input placeholder={locale === "en" ? "Enter redemption code" : "输入兑换码"} value={redeemCode} onChange={(event) => setRedeemCode(event.target.value)} />
                <Button onClick={handleRedeem}>{locale === "en" ? "Redeem" : "兑换"}</Button>
              </div>
              <div className="space-y-3">
                {(creditSummary?.history ?? []).slice(0, 6).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{entry.title}</div>
                      <div className="text-slate-500 dark:text-slate-400">{entry.description}</div>
                    </div>
                    <div className={entry.delta >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                      {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-blue-600" />
                {locale === "en" ? "Projects" : "项目记录"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">{locale === "en" ? "No projects yet." : "暂时没有项目记录。"}</div>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{project.companyName}</div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {project.selectedModules.join(" · ")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {project.latestJobId && (
                          <Link href={`/${locale}/result/${project.latestJobId}`}>
                            <Button variant="outline" size="sm">{locale === "en" ? "Open" : "打开"}</Button>
                          </Link>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteProject(project.id)}>
                          {locale === "en" ? "Delete" : "删除"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-blue-600" />
                {locale === "en" ? "Orders and redemption" : "订单与兑换码"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{locale === "en" ? "Recent orders" : "最近订单"}</div>
                {orders.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">{locale === "en" ? "No orders yet." : "暂无订单。"}</div>
                ) : (
                  orders.slice(0, 5).map((order) => (
                    <div key={order.id} className="rounded-xl border border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900 dark:text-white">{order.title}</span>
                        <span>{formatPrice(order.amountCent, locale)}</span>
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">{order.status}</div>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{locale === "en" ? "Purchased / redeemed codes" : "已购 / 已兑兑换码"}</div>
                {[...purchasedCodes.slice(0, 3), ...redeemedCodes.slice(0, 3)].slice(0, 6).map((code) => (
                  <div key={code.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">{code.code}</div>
                        <div className="text-slate-500 dark:text-slate-400">{code.productName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-slate-900 dark:text-white">{code.credits}</div>
                      <div className="text-slate-500 dark:text-slate-400">{code.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-600" />
                {locale === "en" ? "AI chat history" : "AI 对话记录"}
              </CardTitle>
              <CardDescription>
                {currentChat ? `${currentChat.title} · ${currentChat.status}` : locale === "en" ? "No active session" : "暂无活跃会话"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">{locale === "en" ? "No messages yet." : "暂无消息记录。"}</div>
              ) : (
                chatMessages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                    <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">{message.role}</div>
                    <div className="text-slate-700 dark:text-slate-300">{message.content}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-blue-600" />
                {locale === "en" ? "Feedback" : "反馈中心"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={feedbackCategory} onChange={(event) => setFeedbackCategory(event.target.value)} placeholder={locale === "en" ? "Category" : "反馈分类"} />
              <Textarea value={feedbackContent} onChange={(event) => setFeedbackContent(event.target.value)} placeholder={locale === "en" ? "Tell us what should improve..." : "告诉我们哪里需要改进..."} className="min-h-[140px]" />
              <Button onClick={handleFeedbackSubmit}>{locale === "en" ? "Submit feedback" : "提交反馈"}</Button>
              <div className="space-y-3 pt-2">
                {feedbackList.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 px-3 py-3 text-sm dark:border-slate-800">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-medium text-slate-900 dark:text-white">{item.category}</span>
                      <History className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">{item.content}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function MetricCard({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

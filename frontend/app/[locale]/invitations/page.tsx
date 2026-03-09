"use client";

import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {Copy, Gift} from "lucide-react";
import {useAuth} from "@/components/providers/auth-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {authApi} from "@/lib/api";
import {toast} from "sonner";
import type {InvitationSummaryView} from "@/lib/types";

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

export default function InvitationsPage() {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading} = useAuth();
  const [summary, setSummary] = useState<InvitationSummaryView | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/invitations`);
      return;
    }

    authApi.invitations()
      .then(({data}) => setSummary(data))
      .catch(() => toast.error(sectionText(locale, "邀请信息加载失败", "Failed to load invitations")))
      .finally(() => setLoadingPage(false));
  }, [loading, user, locale, router]);

  async function handleCopyInviteCode() {
    const code = summary?.inviteCode ?? user?.inviteCode;
    if (!code) {
      return;
    }
    await navigator.clipboard.writeText(code);
    toast.success(sectionText(locale, "邀请码已复制", "Invite code copied"));
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{sectionText(locale, "我的邀请", "My Invitations")}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "分享邀请码，好友注册后你得积分，对方也会获得新手奖励。", "Share your invite code. When a friend signs up, both of you receive credits.")}</p>
      </div>

      {loadingPage && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "正在加载邀请信息...", "Loading invitation data...")}</CardContent>
        </Card>
      )}

      {!loadingPage && summary && (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <MetricCard label={sectionText(locale, "邀请码", "Invite Code")} value={summary.inviteCode} />
            <MetricCard label={sectionText(locale, "已邀请人数", "Invited Users")} value={String(summary.invitedUsers)} />
            <MetricCard label={sectionText(locale, "累计奖励积分", "Total Earned")} value={String(summary.totalEarnedCredits)} />
            <MetricCard label={sectionText(locale, "邀请人奖励", "Inviter Reward")} value={String(summary.rewardPerInvite)} />
          </div>

          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {sectionText(locale, "每成功邀请 1 位用户注册，你获得 ", "For each successful signup, you receive ")}
            <span className="font-semibold text-slate-900 dark:text-white">{summary.rewardPerInvite}</span>
            {sectionText(locale, " 积分；新用户获得 ", " credits, and the new user receives ")}
            <span className="font-semibold text-slate-900 dark:text-white">{summary.rewardForInvitee}</span>
            {sectionText(locale, " 积分。", " credits.")}
          </div>

          <div className="mb-6">
            <Button onClick={handleCopyInviteCode}>
              <Copy className="mr-2 h-4 w-4" />
              {sectionText(locale, "复制邀请码", "Copy Invite Code")}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{sectionText(locale, "邀请记录", "Invitees")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.invitees.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "还没有好友通过你的邀请码注册。", "No one has signed up with your invite code yet.")}</div>
              )}
              {summary.invitees.map((invitee) => (
                <div key={invitee.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/40">
                      <Gift className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{invitee.displayName}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">{invitee.email}</div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {new Date(invitee.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN")}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function MetricCard({label, value}: {label: string; value: string}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

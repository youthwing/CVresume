"use client";

import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {CheckCircle2, Ticket} from "lucide-react";
import {useAuth} from "@/components/providers/auth-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {creditApi, redemptionApi} from "@/lib/api";
import {toast} from "sonner";
import type {CreditSummary, RedemptionCodeView} from "@/lib/types";

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

export default function RedeemPage() {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading, refresh} = useAuth();
  const [code, setCode] = useState("");
  const [history, setHistory] = useState<RedemptionCodeView[]>([]);
  const [purchasedCodes, setPurchasedCodes] = useState<RedemptionCodeView[]>([]);
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/redeem`);
      return;
    }

    Promise.all([redemptionApi.purchasedCodes(), redemptionApi.history(), creditApi.get()])
      .then(([codesRes, historyRes, summaryRes]) => {
        setPurchasedCodes(codesRes.data);
        setHistory(historyRes.data);
        setSummary(summaryRes.data);
      })
      .catch(() => toast.error(sectionText(locale, "兑换页加载失败", "Failed to load redeem center")))
      .finally(() => setLoadingPage(false));
  }, [loading, user, locale, router]);

  async function reloadData() {
    const [codesRes, historyRes, summaryRes] = await Promise.all([
      redemptionApi.purchasedCodes(),
      redemptionApi.history(),
      creditApi.get()
    ]);
    setPurchasedCodes(codesRes.data);
    setHistory(historyRes.data);
    setSummary(summaryRes.data);
  }

  async function handleRedeem(value?: string) {
    const redeemCode = (value ?? code).trim();
    if (!redeemCode) {
      return;
    }
    setRedeeming(true);
    try {
      const {data} = await redemptionApi.redeem(redeemCode);
      setCode("");
      await reloadData();
      await refresh();
      toast.success(data.message);
    } catch (error) {
      toast.error(getErrorMessage(error, sectionText(locale, "兑换失败", "Failed to redeem code")));
    } finally {
      setRedeeming(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{sectionText(locale, "兑换中心", "Redeem Center")}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {sectionText(locale, "在这里兑换购买到的积分码，兑换成功后积分实时到账。", "Redeem purchased codes here and credits will be added immediately.")}
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard label={sectionText(locale, "当前积分", "Current credits")} value={String(summary?.balance ?? user.credits)} />
        <SummaryCard label={sectionText(locale, "待兑换兑换码", "Codes to redeem")} value={String(purchasedCodes.length)} />
        <SummaryCard label={sectionText(locale, "已兑换次数", "Redeemed codes")} value={String(history.length)} />
      </div>

      {loadingPage && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "正在加载兑换数据...", "Loading redemption data...")}</CardContent>
        </Card>
      )}

      {!loadingPage && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(340px,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{sectionText(locale, "输入兑换码", "Redeem a code")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder={sectionText(locale, "请输入兑换码，如 CRS-XXXXXX", "Enter code, for example CRS-XXXXXX")} />
                <Button onClick={() => handleRedeem()} disabled={redeeming}>
                  {redeeming ? sectionText(locale, "兑换中...", "Redeeming...") : sectionText(locale, "立即兑换", "Redeem now")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{sectionText(locale, "我购买的兑换码", "Purchased codes")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {purchasedCodes.length === 0 && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "还没有待兑换的兑换码。", "No purchased codes waiting to be redeemed.")}</div>
                )}
                {purchasedCodes.map((item) => (
                  <div key={item.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/40">
                        <Ticket className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-semibold tracking-[0.08em] text-slate-900 dark:text-white">{item.code}</div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.productName}</div>
                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {item.credits} {sectionText(locale, "积分", "credits")}
                          {item.grantsPro ? ` · ${sectionText(locale, "含专业版身份", "includes Pro")}` : ""}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => handleRedeem(item.code)} disabled={redeeming}>
                      {sectionText(locale, "立即兑换", "Redeem")}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{sectionText(locale, "兑换记录", "Redemption history")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "暂无兑换记录。", "No redemption history yet.")}</div>
              )}
              {history.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{item.code}</div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {sectionText(locale, "已到账", "Redeemed")}
                    </div>
                  </div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">{item.productName}</div>
                  <div className="mt-2 text-slate-500 dark:text-slate-400">
                    {item.credits} {sectionText(locale, "积分", "credits")} · {item.redeemedAt ? new Date(item.redeemedAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : ""}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

function SummaryCard({label, value}: {label: string; value: string}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as {response?: {data?: {message?: string}}}).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }
  return fallback;
}

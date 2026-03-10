"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {Coins, Crown, Ticket} from "lucide-react";
import {useAuth} from "@/components/providers/auth-provider";
import {ManualPaymentDialog} from "@/components/sections/manual-payment-dialog";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {creditApi, orderApi, redemptionApi} from "@/lib/api";
import {formatPrice} from "@/lib/utils";
import {toast} from "sonner";
import type {CreditSummary, OrderView, RedemptionProductView} from "@/lib/types";

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

function formatPaymentMethod(locale: string, method: string | null) {
  if (method === "ALIPAY") {
    return sectionText(locale, "支付宝", "Alipay");
  }
  if (method === "WECHAT") {
    return sectionText(locale, "微信支付", "WeChat Pay");
  }
  return "-";
}

function formatOrderStatus(locale: string, status: string) {
  switch (status) {
    case "PENDING_REVIEW":
      return sectionText(locale, "待人工审核", "Pending review");
    case "APPROVED":
      return sectionText(locale, "已通过", "Approved");
    case "REJECTED":
      return sectionText(locale, "已拒绝", "Rejected");
    case "CANCELLED":
      return sectionText(locale, "已取消", "Cancelled");
    case "PAID":
      return sectionText(locale, "已支付", "Paid");
    default:
      return status;
  }
}

export default function PackagesPage() {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading} = useAuth();
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [products, setProducts] = useState<RedemptionProductView[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderView[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<RedemptionProductView | null>(null);
  const [customCredits, setCustomCredits] = useState("200");

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/packages`);
      return;
    }

    Promise.all([creditApi.get(), redemptionApi.products(), orderApi.list(0, 5)])
      .then(([summaryRes, productsRes, ordersRes]) => {
        setSummary(summaryRes.data);
        setProducts(productsRes.data);
        setRecentOrders(ordersRes.data.content);
      })
      .catch(() => toast.error(sectionText(locale, "积分商城加载失败", "Failed to load store")))
      .finally(() => setLoadingPage(false));
  }, [loading, user, locale, router]);

  function handlePurchase(product: RedemptionProductView) {
    setSelectedProduct(product);
  }

  function handleCustomPurchase() {
    const credits = Number(customCredits);
    if (!Number.isInteger(credits) || credits < 10 || credits % 10 !== 0) {
      toast.error(sectionText(locale, "请输入 10 的倍数积分数量，最低 10 积分。", "Enter a credit amount in multiples of 10, with a minimum of 10 credits."));
      return;
    }

    setSelectedProduct(buildCustomProduct(credits, locale));
  }

  function handleOrderSubmitted(order: OrderView) {
    setSelectedProduct(null);
    setRecentOrders((current) => [order, ...current.filter((item) => item.id !== order.id)].slice(0, 5));
  }

  const customCreditsValue = Number(customCredits);
  const customCreditsValid = Number.isInteger(customCreditsValue) && customCreditsValue >= 10 && customCreditsValue % 10 === 0;
  const customProduct = buildCustomProduct(customCreditsValid ? customCreditsValue : 0, locale);

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{sectionText(locale, "积分商城", "Credit Store")}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {sectionText(
            locale,
            "当前支持支付宝和微信人工收款。点击后可切换支付方式、查看对应收款码，并在支付完成后确认实际付款方式。",
            "Manual payments now support both Alipay and WeChat Pay. Open the dialog to switch methods, scan the matching QR code, and confirm which one you used after paying."
          )}
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard icon={<Coins className="h-5 w-5 text-blue-600" />} label={sectionText(locale, "当前积分", "Current Credits")} value={String(summary?.balance ?? user.credits)} />
        <MetricCard icon={<Ticket className="h-5 w-5 text-blue-600" />} label={sectionText(locale, "累计消耗", "Consumed")} value={String(summary?.totalConsumed ?? 0)} />
        <MetricCard icon={<Crown className="h-5 w-5 text-blue-600" />} label={sectionText(locale, "会员身份", "Plan")} value={user.proMember ? sectionText(locale, "专业版", "Pro") : sectionText(locale, "普通用户", "Basic")} />
      </div>

      {loadingPage && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "正在加载商品...", "Loading products...")}</CardContent>
        </Card>
      )}

      <div className="mb-5">
        <Card className="border-slate-300 bg-[linear-gradient(135deg,rgba(241,245,249,0.95)_0%,rgba(219,234,254,0.95)_100%)]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3">
              <span>{sectionText(locale, "自定义积分充值", "Custom credit top-up")}</span>
              <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs text-slate-600">
                {sectionText(locale, "灵活充值", "Flexible")}
              </span>
            </CardTitle>
            <CardDescription>
              {sectionText(
                locale,
                "输入你要充值的积分数量，系统会按 1 RMB = 10 积分自动计算付款金额。",
                "Enter the exact credit amount you want. The payment amount is calculated automatically at 1 RMB = 10 credits."
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm font-medium text-slate-700">{sectionText(locale, "积分数量", "Credit amount")}</div>
                <Input
                  inputMode="numeric"
                  min={10}
                  onChange={(event) => setCustomCredits(event.target.value.replace(/\D/g, ""))}
                  placeholder={sectionText(locale, "请输入 10 的倍数", "Enter a multiple of 10")}
                  step={10}
                  type="text"
                  value={customCredits}
                />
                <div className="mt-2 text-xs text-slate-500">
                  {sectionText(locale, "最低 10 积分，建议按 10 的倍数输入。", "Minimum 10 credits. Use multiples of 10 for payment.")}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[100, 300, 500, 1000].map((value) => (
                  <button
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
                    key={value}
                    onClick={() => setCustomCredits(String(value))}
                    type="button"
                  >
                    {value} {sectionText(locale, "积分", "credits")}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
              <div className="grid gap-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>{sectionText(locale, "充值积分", "Credits")}</span>
                  <span className="font-semibold text-slate-900">{customCreditsValid ? customProduct.credits : "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{sectionText(locale, "付款金额", "Amount")}</span>
                  <span className="font-semibold text-slate-900">{customCreditsValid ? formatPrice(customProduct.priceCent, locale) : "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{sectionText(locale, "预计可生成次数", "Estimated generations")}</span>
                  <span className="font-semibold text-slate-900">{customCreditsValid ? Math.floor(customProduct.credits / 10) : "-"}</span>
                </div>
              </div>

              <Button className="mt-4 w-full" disabled={!customCreditsValid} onClick={handleCustomPurchase}>
                {sectionText(locale, "自定义充值并支付", "Pay custom amount")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {products.map((item) => (
          <Card key={item.id} className={item.recommended ? "border-blue-500 shadow-blue-100 dark:shadow-none" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span>{item.name}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {item.grantsPro ? sectionText(locale, "专业版", "Pro") : sectionText(locale, "积分码", "Credits")}
                </span>
              </CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <div className="flex items-center justify-between">
                  <span>{sectionText(locale, "兑换积分", "Credits after redeem")}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{item.credits}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{sectionText(locale, "购买价格", "Price")}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{formatPrice(item.priceCent, locale)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{sectionText(locale, "预计可生成次数", "Estimated generations")}</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{Math.floor(item.credits / 10)}</span>
                </div>
              </div>

              <Button className="w-full" onClick={() => handlePurchase(item)}>
                {sectionText(locale, "选择支付方式", "Choose payment method")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{sectionText(locale, "最近订单", "Recent orders")}</CardTitle>
              <CardDescription>
                {sectionText(locale, "你刚提交的人工支付订单会直接显示在这里，方便查看审核进度。", "Your latest manual-payment orders appear here so you can track review progress immediately.")}
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href={`/${locale}/orders`}>{sectionText(locale, "查看全部订单", "View all orders")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOrders.length > 0 ? recentOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900 dark:text-white">{order.title}</div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {formatOrderStatus(locale, order.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">
                      {formatPaymentMethod(locale, order.paymentMethod)} · {order.credits} {sectionText(locale, "积分", "credits")}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{order.id}</div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <div>{sectionText(locale, "付款人", "Payer")}: {order.payerName ?? "-"}</div>
                      <div>{sectionText(locale, "交易单号/备注", "Transaction reference")}: {order.paymentReference ?? "-"}</div>
                      <div>{sectionText(locale, "审核备注", "Review note")}: {order.reviewNote ?? "-"}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 dark:text-white">{formatPrice(order.amountCent, locale)}</div>
                    <div className="mt-1 text-xs text-slate-400">{new Date(order.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                {sectionText(locale, "还没有订单记录。支付并提交审核后，这里会立即显示。", "You do not have any orders yet. Once you submit a payment for review, it will appear here immediately.")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedProduct && (
        <ManualPaymentDialog
          locale={locale}
          onClose={() => setSelectedProduct(null)}
          onSubmitted={handleOrderSubmitted}
          product={selectedProduct}
        />
      )}
    </main>
  );
}

function buildCustomProduct(credits: number, locale: string): RedemptionProductView {
  return {
    id: `custom-points-${credits}`,
    productType: "POINTS",
    name: locale === "en" ? `Custom ${credits} credit top-up` : `${credits} 积分自定义充值`,
    description: locale === "en"
      ? "Calculated at 1 RMB = 10 credits with manual QR-code payment."
      : "按 1 RMB = 10 积分计算，支持人工扫码支付。",
    credits,
    priceCent: credits * 10,
    grantsPro: false,
    recommended: false,
    active: true
  };
}

function MetricCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/40">{icon}</div>
        <div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

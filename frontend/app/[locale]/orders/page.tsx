"use client";

import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {useAuth} from "@/components/providers/auth-provider";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {orderApi} from "@/lib/api";
import {formatPrice} from "@/lib/utils";
import {toast} from "sonner";
import type {OrderView} from "@/lib/types";

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

export default function OrdersPage() {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading} = useAuth();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/orders`);
      return;
    }

    orderApi.list()
      .then(({data}) => setOrders(data.content))
      .catch(() => toast.error(sectionText(locale, "订单加载失败", "Failed to load orders")))
      .finally(() => setLoadingPage(false));
  }, [loading, user, locale, router]);

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{sectionText(locale, "我的订单", "My Orders")}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "查看积分码、专业版礼包等购买记录。", "Review your credit-code and Pro bundle purchase history.")}</p>
      </div>

      {loadingPage && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "正在加载订单...", "Loading orders...")}</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardHeader>
              <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{order.title}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{formatOrderStatus(locale, order.status)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              <div>{sectionText(locale, "订单号", "Order ID")}: {order.id}</div>
              <div>{sectionText(locale, "金额", "Amount")}: {formatPrice(order.amountCent, locale)}</div>
              <div>{sectionText(locale, "商品类型", "Product Type")}: {order.productType}</div>
              <div>{sectionText(locale, "可兑积分", "Credits")}: {order.credits}</div>
              <div>{sectionText(locale, "专业版", "Pro")}: {order.grantsPro ? sectionText(locale, "是", "Yes") : sectionText(locale, "否", "No")}</div>
              <div>{sectionText(locale, "支付方式", "Payment method")}: {formatPaymentMethod(locale, order.paymentMethod)}</div>
              <div>{sectionText(locale, "付款人", "Payer")}: {order.payerName ?? "-"}</div>
              <div>{sectionText(locale, "支付账号/尾号", "Account hint")}: {order.payerAccount ?? "-"}</div>
              <div>{sectionText(locale, "交易单号/备注", "Transaction reference")}: {order.paymentReference ?? "-"}</div>
              <div>{sectionText(locale, "兑换码关联", "Redemption code")}: {order.redemptionCodeId ?? "-"}</div>
              <div>{sectionText(locale, "创建时间", "Created At")}: {new Date(order.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</div>
              <div>{sectionText(locale, "审核时间", "Reviewed At")}: {order.reviewedAt ? new Date(order.reviewedAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : "-"}</div>
              <div>{sectionText(locale, "到账时间", "Fulfilled At")}: {order.fulfilledAt ? new Date(order.fulfilledAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN") : "-"}</div>
              <div className="sm:col-span-2">{sectionText(locale, "补充说明", "Payment note")}: {order.paymentNote ?? "-"}</div>
              <div className="sm:col-span-2">{sectionText(locale, "审核备注", "Review note")}: {order.reviewNote ?? "-"}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loadingPage && orders.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "暂无订单记录。", "No orders yet.")}</CardContent>
        </Card>
      )}
    </main>
  );
}

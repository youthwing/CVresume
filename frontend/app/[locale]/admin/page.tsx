"use client";

import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {Shield, Ticket, Users} from "lucide-react";
import {useAuth} from "@/components/providers/auth-provider";
import {adminApi} from "@/lib/api";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {formatPrice} from "@/lib/utils";
import type {
  AdminDashboardView,
  AdminGenerateCodesResponse,
  AdminOrderView,
  AdminRedemptionCodeView,
  AdminUserView,
  RedemptionProductView
} from "@/lib/types";
import {toast} from "sonner";

type ProductDraft = {
  productType: string;
  name: string;
  description: string;
  credits: string;
  priceCent: string;
  grantsPro: boolean;
  recommended: boolean;
  active: boolean;
};

const defaultDraft: ProductDraft = {
  productType: "POINTS",
  name: "",
  description: "",
  credits: "100",
  priceCent: "1000",
  grantsPro: false,
  recommended: false,
  active: true
};

export default function AdminPage() {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading, refresh} = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardView | null>(null);
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [products, setProducts] = useState<RedemptionProductView[]>([]);
  const [orders, setOrders] = useState<AdminOrderView[]>([]);
  const [codes, setCodes] = useState<AdminRedemptionCodeView[]>([]);
  const [keyword, setKeyword] = useState("");
  const [creditDelta, setCreditDelta] = useState<Record<string, string>>({});
  const [creditReason, setCreditReason] = useState<Record<string, string>>({});
  const [orderReviewNote, setOrderReviewNote] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<ProductDraft>(defaultDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codeProductId, setCodeProductId] = useState("");
  const [codeBatchCount, setCodeBatchCount] = useState("10");
  const [customGenerationCount, setCustomGenerationCount] = useState("1");
  const [customBatchCount, setCustomBatchCount] = useState("10");
  const [generatedBatch, setGeneratedBatch] = useState<AdminGenerateCodesResponse | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/admin`);
      return;
    }
    if (user.role !== "ADMIN") {
      setLoadingPage(false);
      return;
    }
    void reloadData();
  }, [loading, user, locale, router]);

  async function reloadData(nextKeyword = keyword) {
    setLoadingPage(true);
    try {
      const [dashboardRes, usersRes, productsRes, ordersRes, codesRes] = await Promise.all([
        adminApi.dashboard(),
        adminApi.users(0, 20, nextKeyword || undefined),
        adminApi.products(),
        adminApi.orders(0, 20),
        adminApi.codes(0, 10)
      ]);
      setDashboard(dashboardRes.data);
      setUsers(usersRes.data.content);
      setProducts(productsRes.data);
      setOrders(ordersRes.data.content);
      setCodes(codesRes.data.content);
      if (!codeProductId && productsRes.data.length > 0) {
        setCodeProductId(productsRes.data[0].id);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, locale === "en" ? "Failed to load admin console" : "管理后台加载失败"));
    } finally {
      setLoadingPage(false);
    }
  }

  async function handleAdjustCredits(targetUser: AdminUserView) {
    const delta = Number(creditDelta[targetUser.id] ?? "0");
    if (!delta) {
      toast.error(locale === "en" ? "Enter a non-zero delta" : "请输入非 0 的积分调整值");
      return;
    }
    try {
      const reason = creditReason[targetUser.id] ?? "";
      await adminApi.adjustCredits(targetUser.id, delta, reason);
      toast.success(locale === "en" ? "Credits updated" : "积分已调整");
      setCreditDelta((current) => ({...current, [targetUser.id]: ""}));
      await reloadData();
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, locale === "en" ? "Failed to update credits" : "积分调整失败"));
    }
  }

  async function handleSaveProduct() {
    const payload = {
      productType: draft.productType,
      name: draft.name,
      description: draft.description,
      credits: Number(draft.credits),
      priceCent: Number(draft.priceCent),
      grantsPro: draft.grantsPro,
      recommended: draft.recommended,
      active: draft.active
    };
    try {
      if (editingId) {
        await adminApi.updateProduct(editingId, payload);
        toast.success(locale === "en" ? "Product updated" : "商品已更新");
      } else {
        await adminApi.createProduct(payload);
        toast.success(locale === "en" ? "Product created" : "商品已创建");
      }
      setDraft(defaultDraft);
      setEditingId(null);
      await reloadData();
    } catch (error) {
      toast.error(getErrorMessage(error, locale === "en" ? "Failed to save product" : "商品保存失败"));
    }
  }

  function startEditProduct(product: RedemptionProductView) {
    setEditingId(product.id);
    setDraft({
      productType: product.productType,
      name: product.name,
      description: product.description,
      credits: String(product.credits),
      priceCent: String(product.priceCent),
      grantsPro: product.grantsPro,
      recommended: product.recommended,
      active: product.active
    });
  }

  async function handleGenerateCodes() {
    if (!codeProductId) {
      toast.error(locale === "en" ? "Select a product first" : "请先选择商品");
      return;
    }

    const count = Number(codeBatchCount);
    if (!Number.isInteger(count) || count <= 0) {
      toast.error(locale === "en" ? "Enter a valid count" : "请输入有效的生成数量");
      return;
    }

    try {
      const {data} = await adminApi.generateCodes(codeProductId, count);
      setGeneratedBatch(data);
      toast.success(locale === "en" ? `Generated ${data.count} codes` : `已生成 ${data.count} 个兑换码`);
      await reloadData();
    } catch (error) {
      toast.error(getErrorMessage(error, locale === "en" ? "Failed to generate codes" : "兑换码生成失败"));
    }
  }

  async function handleGenerateCustomCodes() {
    const generationCount = Number(customGenerationCount);
    const count = Number(customBatchCount);
    if (!Number.isInteger(generationCount) || generationCount <= 0) {
      toast.error(locale === "en" ? "Enter a valid generation count" : "请输入有效的兑换次数");
      return;
    }
    if (!Number.isInteger(count) || count <= 0) {
      toast.error(locale === "en" ? "Enter a valid count" : "请输入有效的生成数量");
      return;
    }

    try {
      const {data} = await adminApi.generateCustomCodes(generationCount, count);
      setGeneratedBatch(data);
      toast.success(locale === "en" ? `Generated ${data.count} custom codes` : `已生成 ${data.count} 个自定义兑换码`);
      await reloadData();
    } catch (error) {
      toast.error(getErrorMessage(error, locale === "en" ? "Failed to generate custom codes" : "自定义兑换码生成失败"));
    }
  }

  async function handleCopyGeneratedCodes() {
    if (!generatedBatch || generatedBatch.codes.length === 0) {
      return;
    }
    await navigator.clipboard.writeText(generatedBatch.codes.map((item) => item.code).join("\n"));
    toast.success(locale === "en" ? "Codes copied" : "兑换码已复制");
  }

  async function handleApproveOrder(order: AdminOrderView) {
    try {
      await adminApi.approveOrder(order.id, orderReviewNote[order.id] ?? "");
      toast.success(locale === "en" ? "Order approved and credits granted" : "订单已通过，积分已发放");
      setOrderReviewNote((current) => ({...current, [order.id]: ""}));
      await reloadData();
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error, locale === "en" ? "Failed to approve order" : "订单审核通过失败"));
    }
  }

  async function handleRejectOrder(order: AdminOrderView) {
    try {
      await adminApi.rejectOrder(order.id, orderReviewNote[order.id] ?? "");
      toast.success(locale === "en" ? "Order rejected" : "订单已拒绝");
      setOrderReviewNote((current) => ({...current, [order.id]: ""}));
      await reloadData();
    } catch (error) {
      toast.error(getErrorMessage(error, locale === "en" ? "Failed to reject order" : "订单拒绝失败"));
    }
  }

  if (!user) {
    return null;
  }

  if (!loadingPage && user.role !== "ADMIN") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-xl font-semibold text-slate-900 dark:text-white">{locale === "en" ? "Admin access required" : "需要管理员权限"}</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{locale === "en" ? "Your current account is not allowed to open this console." : "当前账号无权访问管理后台。"}</div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{locale === "en" ? "Admin Console" : "管理后台"}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {locale === "en" ? "Operate users, products, codes, and the credit system from one place." : "统一管理用户、商品、兑换码和积分系统。"}
          </p>
        </div>
        <Button variant="outline" onClick={() => reloadData()}>{locale === "en" ? "Refresh" : "刷新数据"}</Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <AdminMetric icon={<Users className="h-5 w-5 text-blue-600" />} label={locale === "en" ? "Users" : "用户数"} value={String(dashboard?.totalUsers ?? 0)} />
        <AdminMetric icon={<Shield className="h-5 w-5 text-blue-600" />} label={locale === "en" ? "Pro Users" : "专业版用户"} value={String(dashboard?.proUsers ?? 0)} />
        <AdminMetric icon={<Ticket className="h-5 w-5 text-blue-600" />} label={locale === "en" ? "Orders" : "订单数"} value={String(dashboard?.totalOrders ?? 0)} />
        <AdminMetric icon={<Ticket className="h-5 w-5 text-blue-600" />} label={locale === "en" ? "Codes" : "兑换码"} value={String(dashboard?.totalCodes ?? 0)} />
        <AdminMetric icon={<Users className="h-5 w-5 text-blue-600" />} label={locale === "en" ? "Consumed Credits" : "已消耗积分"} value={String(dashboard?.totalCreditsConsumed ?? 0)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{locale === "en" ? "Users and credit adjustments" : "用户与积分调整"}</CardTitle>
              <CardDescription>{locale === "en" ? "Search users and adjust balances directly." : "搜索用户并直接调整积分余额。"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder={locale === "en" ? "Search by email, name, or ID" : "按邮箱、名称或 ID 搜索"} />
                <Button variant="outline" onClick={() => reloadData(keyword)}>{locale === "en" ? "Search" : "搜索"}</Button>
              </div>
              <div className="space-y-3">
                {users.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{item.displayName} · {item.email}</div>
                        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {item.role} · {item.proMember ? (locale === "en" ? "Pro" : "专业版") : (locale === "en" ? "Basic" : "普通用户")} · {sectionText(locale, "积分", "Credits")}: {item.credits}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{item.id}</div>
                      </div>
                      <div className="grid gap-2 sm:w-[320px]">
                        <Input
                          value={creditDelta[item.id] ?? ""}
                          onChange={(event) => setCreditDelta((current) => ({...current, [item.id]: event.target.value}))}
                          placeholder={locale === "en" ? "Delta, e.g. 100 or -50" : "调整值，如 100 或 -50"}
                        />
                        <Input
                          value={creditReason[item.id] ?? ""}
                          onChange={(event) => setCreditReason((current) => ({...current, [item.id]: event.target.value}))}
                          placeholder={locale === "en" ? "Reason" : "调整原因"}
                        />
                        <Button onClick={() => handleAdjustCredits(item)}>{locale === "en" ? "Apply credit change" : "提交积分调整"}</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{locale === "en" ? "Products" : "商品管理"}</CardTitle>
              <CardDescription>{locale === "en" ? "All prices should follow 1 RMB = 10 credits." : "所有商品价格都应遵循 1 RMB = 10 积分。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {products.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.productType} · {item.credits} {sectionText(locale, "积分", "credits")} · {formatPrice(item.priceCent, locale)}</div>
                    </div>
                    <Button variant="outline" onClick={() => startEditProduct(item)}>{locale === "en" ? "Edit" : "编辑"}</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? (locale === "en" ? "Edit product" : "编辑商品") : (locale === "en" ? "Create product" : "创建商品")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={draft.productType} onChange={(event) => setDraft((current) => ({...current, productType: event.target.value.toUpperCase()}))} placeholder="POINTS / PRO_PLAN" />
              <Input value={draft.name} onChange={(event) => setDraft((current) => ({...current, name: event.target.value}))} placeholder={locale === "en" ? "Product name" : "商品名称"} />
              <Input value={draft.description} onChange={(event) => setDraft((current) => ({...current, description: event.target.value}))} placeholder={locale === "en" ? "Description" : "商品描述"} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input value={draft.credits} onChange={(event) => setDraft((current) => ({...current, credits: event.target.value}))} placeholder={locale === "en" ? "Credits" : "积分"} />
                <Input value={draft.priceCent} onChange={(event) => setDraft((current) => ({...current, priceCent: event.target.value}))} placeholder={locale === "en" ? "Price (cent)" : "价格（分）"} />
              </div>
              <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={draft.grantsPro} onChange={(event) => setDraft((current) => ({...current, grantsPro: event.target.checked}))} />
                  {locale === "en" ? "Grant Pro membership" : "兑换后开通专业版"}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={draft.recommended} onChange={(event) => setDraft((current) => ({...current, recommended: event.target.checked}))} />
                  {locale === "en" ? "Recommended product" : "推荐商品"}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({...current, active: event.target.checked}))} />
                  {locale === "en" ? "Active" : "上架中"}
                </label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProduct}>{editingId ? (locale === "en" ? "Save product" : "保存商品") : (locale === "en" ? "Create product" : "创建商品")}</Button>
                {editingId && (
                  <Button variant="outline" onClick={() => {
                    setEditingId(null);
                    setDraft(defaultDraft);
                  }}>
                    {locale === "en" ? "Cancel edit" : "取消编辑"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{locale === "en" ? "Batch generate redemption codes" : "批量生成兑换码"}</CardTitle>
              <CardDescription>
                {locale === "en" ? "Choose a product and generate any number of available codes directly from admin." : "选择商品后可直接批量生成指定数量的可用兑换码。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                <select
                  value={codeProductId}
                  onChange={(event) => setCodeProductId(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="">{locale === "en" ? "Select a product" : "选择商品"}</option>
                  {products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.credits} {sectionText(locale, "积分", "credits")}
                    </option>
                  ))}
                </select>
                <Input
                  value={codeBatchCount}
                  onChange={(event) => setCodeBatchCount(event.target.value)}
                  placeholder={locale === "en" ? "Count" : "数量"}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleGenerateCodes}>{locale === "en" ? "Generate codes" : "生成兑换码"}</Button>
                <Button variant="outline" onClick={() => setGeneratedBatch(null)} disabled={!generatedBatch}>
                  {locale === "en" ? "Clear result" : "清空结果"}
                </Button>
                <Button variant="outline" onClick={() => void handleCopyGeneratedCodes()} disabled={!generatedBatch || generatedBatch.codes.length === 0}>
                  {locale === "en" ? "Copy all codes" : "复制全部兑换码"}
                </Button>
              </div>

              {generatedBatch && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{generatedBatch.productName}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {locale === "en"
                          ? `Generated ${generatedBatch.count} available codes · ${generatedBatch.generationCount} generations / ${generatedBatch.creditsPerCode} credits each`
                          : `已生成 ${generatedBatch.count} 个可用兑换码 · 每张 ${generatedBatch.generationCount} 次生成 / ${generatedBatch.creditsPerCode} 积分`}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">{generatedBatch.productId}</div>
                  </div>
                  <textarea
                    readOnly
                    value={generatedBatch.codes.map((item) => item.code).join("\n")}
                    className="mt-4 min-h-[220px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm tracking-[0.08em] text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{locale === "en" ? "Generate custom usage codes" : "生成自定义次数兑换码"}</CardTitle>
              <CardDescription>
                {locale === "en" ? "Set how many resume generations each code contains. The system converts it by 10 credits per generation." : "直接设置每张兑换码包含几次简历生成，系统会按 10 积分/次自动换算。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={customGenerationCount}
                  onChange={(event) => setCustomGenerationCount(event.target.value)}
                  placeholder={locale === "en" ? "Generations per code" : "每张码可生成次数"}
                />
                <Input
                  value={customBatchCount}
                  onChange={(event) => setCustomBatchCount(event.target.value)}
                  placeholder={locale === "en" ? "Number of codes" : "生成张数"}
                />
              </div>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-300">
                {locale === "en"
                  ? `Per-code credits: ${Math.max(Number(customGenerationCount) || 0, 0) * 10}`
                  : `每张兑换码将发放 ${Math.max(Number(customGenerationCount) || 0, 0) * 10} 积分，等于 ${Math.max(Number(customGenerationCount) || 0, 0)} 次简历生成`}
              </div>
              <Button onClick={handleGenerateCustomCodes}>{locale === "en" ? "Generate custom codes" : "生成自定义兑换码"}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{locale === "en" ? "Manual payment review" : "人工支付审核"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {orders.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.title}</div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {formatOrderStatus(locale, item.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-500 dark:text-slate-400">
                        {item.userDisplayName || item.userEmail} · {item.userEmail}
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <div>{sectionText(locale, "支付方式", "Payment method")}: {formatPaymentMethod(locale, item.paymentMethod)}</div>
                        <div>{sectionText(locale, "付款人", "Payer")}: {item.payerName || "-"}</div>
                        <div>{sectionText(locale, "支付账号/尾号", "Account hint")}: {item.payerAccount || "-"}</div>
                        <div>{sectionText(locale, "交易单号/备注", "Transaction reference")}: {item.paymentReference || "-"}</div>
                        <div>{sectionText(locale, "用户补充说明", "Customer note")}: {item.paymentNote || "-"}</div>
                        <div>{sectionText(locale, "审核备注", "Review note")}: {item.reviewNote || "-"}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-semibold text-slate-900 dark:text-white">{formatPrice(item.amountCent, locale)}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.credits} {sectionText(locale, "积分", "credits")}</div>
                      <div className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</div>
                      {item.fulfilledAt && (
                        <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                          {sectionText(locale, "到账时间", "Fulfilled")}: {new Date(item.fulfilledAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}
                        </div>
                      )}
                    </div>
                  </div>
                  {item.status === "PENDING_REVIEW" && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <Input
                        value={orderReviewNote[item.id] ?? ""}
                        onChange={(event) => setOrderReviewNote((current) => ({...current, [item.id]: event.target.value}))}
                        placeholder={locale === "en" ? "Review note (optional)" : "审核备注（可选）"}
                      />
                      <Button onClick={() => handleApproveOrder(item)}>
                        {locale === "en" ? "Approve" : "通过并发放"}
                      </Button>
                      <Button onClick={() => handleRejectOrder(item)} variant="outline">
                        {locale === "en" ? "Reject" : "拒绝"}
                      </Button>
                    </div>
                  )}
                  {item.status !== "PENDING_REVIEW" && item.reviewedAt && (
                    <div className="mt-3 text-xs text-slate-400">
                      {sectionText(locale, "审核时间", "Reviewed At")}: {new Date(item.reviewedAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}
                      {item.reviewedByEmail ? ` · ${item.reviewedByEmail}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{locale === "en" ? "Recent redemption codes" : "最近兑换码"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {codes.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold tracking-[0.08em] text-slate-900 dark:text-white">{item.code}</div>
                    <div>{item.status}</div>
                  </div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">{item.productName} · {item.credits} {sectionText(locale, "积分", "credits")}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.purchasedByEmail || "-"} → {item.redeemedByEmail || "-"}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function AdminMetric({
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

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as {response?: {data?: {message?: string}}}).response;
    if (response?.data?.message) {
      return response.data.message;
    }
  }
  return fallback;
}

"use client";

import {useEffect, useState} from "react";
import Image from "next/image";
import {LoaderCircle, X} from "lucide-react";
import {toast} from "sonner";
import {orderApi} from "@/lib/api";
import type {OrderView, RedemptionProductView} from "@/lib/types";
import {formatCnyPrice} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import alipayQrCode from "@/static/img/alipay.jpg";
import wechatQrCode from "@/static/img/wxpay.jpg";

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

interface ManualPaymentDialogProps {
  locale: string;
  product: RedemptionProductView;
  onClose: () => void;
  onSubmitted: (order: OrderView) => void;
}

type PaymentMethod = "alipay" | "wechat";

export function ManualPaymentDialog({locale, product, onClose, onSubmitted}: ManualPaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("alipay");
  const [confirmedMethod, setConfirmedMethod] = useState<PaymentMethod>("alipay");
  const [payerName, setPayerName] = useState("");
  const [payerAccount, setPayerAccount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const paymentMethods: Record<PaymentMethod, {
    label: string;
    caption: string;
    badge: string;
    image: typeof alipayQrCode;
  }> = {
    alipay: {
      label: sectionText(locale, "支付宝", "Alipay"),
      caption: sectionText(locale, "支付宝收款码", "Alipay QR code"),
      badge: sectionText(locale, "推荐支付宝", "Alipay"),
      image: alipayQrCode
    },
    wechat: {
      label: sectionText(locale, "微信支付", "WeChat Pay"),
      caption: sectionText(locale, "微信收款码", "WeChat Pay QR code"),
      badge: sectionText(locale, "推荐微信", "WeChat"),
      image: wechatQrCode
    }
  };

  const activeMethod = paymentMethods[selectedMethod];
  const actualMethod = paymentMethods[confirmedMethod];
  const paymentAmount = formatCnyPrice(product.priceCent);
  const isCustomProduct = product.id.startsWith("custom-points-");
  const selectedMethodTone = selectedMethod === "alipay"
    ? "border-sky-200 bg-sky-50 text-sky-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  const canSubmit = payerName.trim().length > 0 && (payerAccount.trim().length > 0 || paymentReference.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || submitting) {
      toast.error(sectionText(locale, "请填写付款人，并补充支付账号或交易单号。", "Enter the payer name and either an account hint or transaction reference."));
      return;
    }

    setSubmitting(true);
    try {
      const {data} = await orderApi.create({
        productId: isCustomProduct ? undefined : product.id,
        customCredits: isCustomProduct ? product.credits : undefined,
        paymentMethod: confirmedMethod === "alipay" ? "ALIPAY" : "WECHAT",
        payerName: payerName.trim(),
        payerAccount: payerAccount.trim() || undefined,
        paymentReference: paymentReference.trim() || undefined,
        note: paymentNote.trim() || undefined
      });
      toast.success(sectionText(locale, "订单已提交，等待管理员审核到账。", "Order submitted. It is now waiting for manual review."));
      onSubmitted(data);
    } catch (error) {
      toast.error(getErrorMessage(error, sectionText(locale, "提交订单失败", "Failed to submit order")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 p-4 sm:p-6" onClick={onClose}>
      <Card
        aria-labelledby="manual-payment-title"
        aria-modal="true"
        className="mx-auto my-4 w-full max-w-4xl overflow-hidden rounded-[28px] border-none bg-white shadow-[0_28px_80px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#0f172a_35%,#1d4ed8_100%)] px-6 py-5 text-white sm:px-7">
          <div className="absolute inset-y-0 right-[-80px] w-[220px] rounded-full bg-white/10 blur-3xl" />
          <button
            aria-label={sectionText(locale, "关闭支付弹窗", "Close payment dialog")}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-white transition hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100/80">
                {sectionText(locale, "人工支付", "Manual payment")}
              </div>
              <h2 id="manual-payment-title" className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
                {product.name}
              </h2>
              <p className="mt-2 text-sm leading-6 text-blue-50/90">
                {sectionText(
                  locale,
                  "扫码付款后提交付款人和交易信息，系统会生成待审核订单，管理员确认后再发放积分或开通权益。",
                  "After paying by QR code, submit the payer and transaction details. The system will create a pending order for admin review."
                )}
              </p>
            </div>

            <div className="rounded-[22px] border border-white/15 bg-white/10 px-5 py-4 backdrop-blur sm:min-w-[220px]">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/70">
                {sectionText(locale, "应付金额", "Amount due")}
              </div>
              <div className="mt-2 text-4xl font-black tracking-[-0.05em]">{paymentAmount}</div>
              <div className="mt-1 text-sm text-blue-50/80">{activeMethod.label}</div>
            </div>
          </div>
        </div>

        <div className="max-h-[calc(92vh-160px)] overflow-y-auto">
          <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="border-b border-slate-200 bg-slate-50 p-5 sm:p-6 lg:border-b-0 lg:border-r">
              <div className="grid grid-cols-2 gap-3">
                {(["alipay", "wechat"] as PaymentMethod[]).map((method) => {
                  const item = paymentMethods[method];
                  const active = selectedMethod === method;

                  return (
                    <button
                      className={active
                        ? "rounded-[20px] border border-slate-900 bg-slate-900 px-4 py-4 text-left text-white shadow-[0_16px_32px_rgba(15,23,42,0.16)]"
                        : "rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-left text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"}
                      key={method}
                      onClick={() => setSelectedMethod(method)}
                      type="button"
                    >
                      <div className={active ? "text-xs font-semibold uppercase tracking-[0.24em] text-slate-300" : "text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"}>
                        {item.badge}
                      </div>
                      <div className="mt-2 text-base font-bold">{item.label}</div>
                      <div className={active ? "mt-1 text-xs text-slate-300/90" : "mt-1 text-xs text-slate-500"}>
                        {item.caption}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <Image
                  alt={activeMethod.caption}
                  className="mx-auto h-auto w-full max-w-[240px] rounded-[22px] border border-slate-200 bg-white"
                  priority
                  src={activeMethod.image}
                />
                <div className="mt-4 text-center">
                  <div className="text-sm font-semibold text-slate-900">{activeMethod.label}</div>
                  <div className="mt-1 text-sm text-slate-500">
                    {sectionText(locale, "请使用当前方式扫码付款", "Scan with the currently selected method")}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5 sm:p-6">
              <div className={`rounded-[20px] border px-4 py-3 text-sm font-medium ${selectedMethodTone}`}>
                {sectionText(
                  locale,
                  `当前展示的是${activeMethod.label}收款码，请准确支付 ${paymentAmount}。`,
                  `You are viewing the ${activeMethod.label} QR code. Please pay exactly ${paymentAmount}.`
                )}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {sectionText(locale, "填写人工审核信息", "Fill in review details")}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-500">
                      {sectionText(
                        locale,
                        "管理员会根据这里的信息核对收款记录。至少填写付款人，并补充支付账号或交易单号中的一项。",
                        "Admins will use this information to match the payment record. Provide the payer name plus either an account hint or a transaction reference."
                      )}
                    </div>
                  </div>

                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600">
                    {sectionText(locale, "实际付款方式", "Actual method")}: {actualMethod.label}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {(["alipay", "wechat"] as PaymentMethod[]).map((method) => {
                    const item = paymentMethods[method];
                    const active = confirmedMethod === method;

                    return (
                      <button
                        className={active
                          ? "rounded-[20px] border border-emerald-400 bg-white px-4 py-4 text-left shadow-[0_12px_28px_rgba(16,185,129,0.12)]"
                          : "rounded-[20px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:border-slate-300"}
                        key={method}
                        onClick={() => setConfirmedMethod(method)}
                        type="button"
                      >
                        <div className={active ? "text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600" : "text-xs font-semibold uppercase tracking-[0.24em] text-slate-400"}>
                          {sectionText(locale, "最终实际付款方式", "Final payment method")}
                        </div>
                        <div className="mt-2 text-base font-bold text-slate-900">{item.label}</div>
                        <div className="mt-1 text-sm text-slate-500">{item.caption}</div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Input
                    value={payerName}
                    onChange={(event) => setPayerName(event.target.value)}
                    placeholder={sectionText(locale, "付款人姓名/昵称", "Payer name or nickname")}
                  />
                  <Input
                    value={payerAccount}
                    onChange={(event) => setPayerAccount(event.target.value)}
                    placeholder={sectionText(locale, "支付账号/尾号（选填）", "Payment account hint / last digits")}
                  />
                  <Input
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    className="sm:col-span-2"
                    placeholder={sectionText(locale, "交易单号、付款备注或付款时间（选填但建议填写）", "Transaction reference, remark, or payment time")}
                  />
                  <Textarea
                    value={paymentNote}
                    onChange={(event) => setPaymentNote(event.target.value)}
                    className="sm:col-span-2"
                    placeholder={sectionText(locale, "补充说明，例如付款截图关键字、订单备注等（选填）", "Extra notes such as screenshot hints or extra context")}
                  />
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button className="flex-1" disabled={submitting} onClick={() => void handleSubmit()}>
                    {submitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    {sectionText(locale, `提交${actualMethod.label}付款审核`, `Submit ${actualMethod.label} payment for review`)}
                  </Button>
                  <Button className="flex-1" onClick={onClose} variant="outline">
                    {sectionText(locale, "稍后再付", "Pay later")}
                  </Button>
                </div>
              </div>

              <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                {sectionText(
                  locale,
                  "订单提交后可在“我的订单”查看审核状态。管理员通过后会直接给当前账号发放积分或开通权益。",
                  "After submission, check the review result in My Orders. Once approved, credits or plan benefits are granted directly to your account."
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button className="sm:min-w-[140px]" onClick={onClose} variant="outline">
                  {sectionText(locale, "关闭窗口", "Close")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
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

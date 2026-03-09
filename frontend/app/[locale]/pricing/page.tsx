"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useAuth} from "@/components/providers/auth-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {redemptionApi} from "@/lib/api";
import {formatPrice} from "@/lib/utils";
import type {RedemptionProductView} from "@/lib/types";
import {toast} from "sonner";

export default function PricingPage() {
  const locale = useLocale();
  const {user} = useAuth();
  const [products, setProducts] = useState<RedemptionProductView[]>([]);

  useEffect(() => {
    redemptionApi.products()
      .then(({data}) => setProducts(data))
      .catch(() => toast.error(locale === "en" ? "Failed to load pricing" : "定价信息加载失败"));
  }, [locale]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[1120px] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex rounded-full bg-slate-900 px-4 py-1 text-sm font-medium text-white">
            {locale === "en" ? "Real billing" : "真实计费体系"}
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-slate-950">
            {locale === "en" ? "CVResume pricing" : "CVResume 定价"}
          </h1>
          <p className="mt-3 text-sm text-slate-500 sm:text-base">
            {locale === "en"
              ? "Payments currently use a manual QR-code flow with both Alipay and WeChat Pay. The store page lets users switch methods, view the exact payment amount, and confirm what they used after paying. The exchange rate remains fixed at 1 RMB = 10 credits."
              : "当前支付采用人工扫码流程，支持支付宝和微信。进入商城后可切换支付方式、查看准确付款金额，并在支付后确认所用方式。积分比例仍固定为 1 RMB = 10 积分。"}
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            title={locale === "en" ? "Generation cost" : "生成消耗"}
            value={locale === "en" ? "10 credits / resume" : "10 积分 / 次"}
            description={locale === "en" ? "Each resume generation consumes a fixed 10 credits." : "每次生成简历固定扣减 10 积分。"}
          />
          <InfoCard
            title={locale === "en" ? "Credit ratio" : "积分比例"}
            value={locale === "en" ? "1 RMB = 10 credits" : "1 RMB = 10 积分"}
            description={locale === "en" ? "Price and credit amount stay in sync across all products." : "所有商品都遵循统一价格和积分兑换比例。"}
          />
          <InfoCard
            title={locale === "en" ? "Payment method" : "支付方式"}
            value={locale === "en" ? "Alipay / WeChat" : "支付宝 / 微信"}
            description={locale === "en" ? "The store page lets users switch between two QR codes and confirm the actual payment method after paying." : "在商城页点击支付后，可在支付宝和微信收款码之间切换，并在支付完成后确认实际付款方式。"}
          />
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden rounded-[22px] border border-slate-200 bg-white">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  {product.recommended && (
                    <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                      {locale === "en" ? "Recommended" : "推荐"}
                    </span>
                  )}
                  {product.grantsPro && (
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                      {locale === "en" ? "Pro bundle" : "专业版礼包"}
                    </span>
                  )}
                </div>
                <CardTitle className="mt-3 text-[30px] font-black tracking-[-0.04em] text-slate-950">{product.name}</CardTitle>
                <CardDescription>{product.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 rounded-[18px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
                  <div className="flex items-center justify-between">
                    <span>{locale === "en" ? "Credits" : "积分"}</span>
                    <span className="font-semibold text-slate-950">{product.credits}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{locale === "en" ? "Price" : "售价"}</span>
                    <span className="font-semibold text-slate-950">{formatPrice(product.priceCent, locale)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>{locale === "en" ? "Estimated generation count" : "预计可生成次数"}</span>
                    <span className="font-semibold text-slate-950">{Math.floor(product.credits / 10)}</span>
                  </div>
                </div>

                <Button asChild className="h-10 w-full rounded-lg bg-blue-500 text-white hover:bg-blue-600">
                  <Link href={user ? `/${locale}/packages` : `/${locale}/register`}>
                    {user
                      ? (locale === "en" ? "Go to store" : "去积分商城")
                      : (locale === "en" ? "Register to purchase" : "注册后购买")}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

function InfoCard({
  title,
  value,
  description
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="rounded-[20px] border border-slate-200 bg-white">
      <CardContent className="pt-6">
        <div className="text-sm text-slate-500">{title}</div>
        <div className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950">{value}</div>
        <div className="mt-2 text-sm text-slate-500">{description}</div>
      </CardContent>
    </Card>
  );
}

import {clsx, type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(priceCent: number, locale: string) {
  const currency = locale === "en" ? "USD" : "CNY";
  const value = locale === "en" ? priceCent / 100 / 7.2 : priceCent / 100;
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function formatCnyPrice(priceCent: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(priceCent / 100) ? 0 : 2
  }).format(priceCent / 100);
}

export function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

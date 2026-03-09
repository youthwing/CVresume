import {AppProviders} from "@/components/providers/app-providers";
import {OnlineSupportButton} from "@/components/sections/online-support-button";
import {SiteHeader} from "@/components/sections/site-header";
import {isLocale} from "@/lib/i18n";
import {NextIntlClientProvider} from "next-intl";
import {notFound} from "next/navigation";

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const {locale} = params;
  if (!isLocale(locale)) {
    notFound();
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppProviders>
        <div className="min-h-screen">
          <SiteHeader />
          {children}
          <OnlineSupportButton />
        </div>
      </AppProviders>
    </NextIntlClientProvider>
  );
}

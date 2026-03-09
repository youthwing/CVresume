import {redirect} from "next/navigation";

export default async function RegisterPage({
  params
}: {
  params: {locale: string};
}) {
  const {locale} = params;
  redirect(`/${locale}/login?mode=register`);
}

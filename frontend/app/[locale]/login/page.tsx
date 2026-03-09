"use client";

import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import {useLocale, useTranslations} from "next-intl";
import {Github, Mail} from "lucide-react";
import {authApi, oauthApi} from "@/lib/api";
import {useAuth} from "@/components/providers/auth-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {toast} from "sonner";
import type {OAuthProvider} from "@/lib/types";

export default function LoginPage() {
  const t = useTranslations("login");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {setAuth} = useAuth();
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [code, setCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const mode = searchParams.get("mode") === "register" ? "register" : "login";
  const redirect = searchParams.get("redirect") ?? `/${locale}/create`;
  const isLoginMode = mode === "login";

  useEffect(() => {
    oauthApi.listProviders().then(({data}) => setProviders(data));
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const title = useMemo(
    () => mode === "login" ? (locale === "en" ? "Login" : "登录") : (locale === "en" ? "Register" : "注册"),
    [locale, mode]
  );

  const subtitle = mode === "login"
    ? t("subtitle")
    : (locale === "en" ? "Create an account, bind an invite code if needed, and start using CVResume." : "创建账号后即可使用简历救兵，邀请码可在注册时绑定。");

  async function handleSendCode() {
    if (!email.includes("@")) {
      toast.error(locale === "en" ? "Enter a valid email first" : "请先输入正确的邮箱");
      return;
    }
    setSendingCode(true);
    try {
      const {data} = await authApi.sendCode({
        email,
        type: mode === "login" ? "LOGIN" : "REGISTER",
        locale
      });
      setCountdown(60);
      toast.success(data.message);
    } catch (error) {
      toast.error(getErrorMessage(error, locale === "en" ? "Failed to send verification code" : "验证码发送失败"));
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit() {
    if (!email.includes("@")) {
      toast.error(locale === "en" ? "Enter a valid email" : "请输入正确的邮箱");
      return;
    }
    if (!password.trim()) {
      toast.error(locale === "en" ? "Enter your password" : "请输入密码");
      return;
    }
    if (mode === "register" && password.trim().length < 8) {
      toast.error(locale === "en" ? "Password must be at least 8 characters" : "密码至少需要 8 位");
      return;
    }
    if (mode === "register" && !code.trim()) {
      toast.error(locale === "en" ? "Enter the verification code" : "请输入邮箱验证码");
      return;
    }
    if (mode === "register" && !displayName.trim()) {
      toast.error(locale === "en" ? "Enter your display name" : "请输入显示名称");
      return;
    }
    try {
      const {data} = mode === "login"
        ? await authApi.login({email, password, code, locale})
        : await authApi.register({email, password, displayName, code, inviteCode, locale});
      setAuth(data);
      toast.success(mode === "login" ? (locale === "en" ? "Logged in" : "登录成功") : (locale === "en" ? "Registered" : "注册成功"));
      router.push(redirect);
    } catch (error) {
      toast.error(getErrorMessage(error, mode === "login" ? (locale === "en" ? "Login failed" : "登录失败") : (locale === "en" ? "Register failed" : "注册失败")));
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    const {data} = await oauthApi.getAuthUrl(provider.providerType, locale);
    window.location.href = data.authUrl;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-[520px] px-4 py-16">
        <Card className="rounded-[22px] border border-slate-200 bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-[24px] font-bold text-slate-950">{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{locale === "en" ? "Email" : "邮箱"}</label>
              <Input placeholder="your@email.com" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-[12px] bg-slate-50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{locale === "en" ? "Password" : "密码"}</label>
              <Input type="password" placeholder="******" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="rounded-[12px] bg-slate-50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {isLoginMode
                  ? (locale === "en" ? "Verification code (optional for admin)" : "邮箱验证码（管理员可选）")
                  : (locale === "en" ? "Verification code" : "邮箱验证码")}
              </label>
              <div className="flex gap-2">
                <Input placeholder={locale === "en" ? "Enter the 6-digit code" : "请输入 6 位邮箱验证码"} value={code} onChange={(event) => setCode(event.target.value)} className="rounded-[12px] bg-slate-50" />
                <Button
                  variant="outline"
                  disabled={!email.includes("@") || sendingCode || countdown > 0}
                  onClick={() => void handleSendCode()}
                  className="h-10 shrink-0 rounded-[12px]"
                >
                  {sendingCode
                    ? (locale === "en" ? "Sending..." : "发送中...")
                    : countdown > 0
                      ? (locale === "en" ? `${countdown}s` : `${countdown}秒`)
                      : (locale === "en" ? "Send code" : "发送验证码")}
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {isLoginMode
                  ? (locale === "en" ? "Regular users still need an email code. Admin accounts can log in with email and password only." : "普通用户登录仍需邮箱验证码，管理员账号可直接用邮箱和密码登录。")
                  : (locale === "en" ? "A verification code will be sent via QQ Mail SMTP." : "验证码会通过 QQ 邮箱 SMTP 发送到你的邮箱。")}
              </p>
            </div>

            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{locale === "en" ? "Display name" : "显示名称"}</label>
                  <Input placeholder={locale === "en" ? "Your name" : "请输入你的姓名或昵称"} value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-[12px] bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{locale === "en" ? "Invite code (optional)" : "邀请码（可选）"}</label>
                  <Input placeholder={locale === "en" ? "INV-XXXXXXXX" : "请输入邀请码，如 INV-XXXXXXXX"} value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="rounded-[12px] bg-slate-50" />
                  <p className="text-xs text-slate-500">{locale === "en" ? "Inviter gets 50 credits and you get 30 credits after successful registration." : "注册时填写邀请码，邀请人可得 50 积分，你可得 30 积分。"}</p>
                </div>
              </>
            )}

            <Button className="h-10 w-full rounded-lg bg-blue-500 text-white hover:bg-blue-600" onClick={() => void handleSubmit()}>
              <Mail className="mr-2 h-4 w-4" />
              {title}
            </Button>

            {mode === "login" && providers.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-center text-sm text-slate-500">{locale === "en" ? "Or continue with" : "或使用以下方式登录"}</div>
                {providers.map((provider) => (
                  <Button key={provider.providerType} variant="outline" className="h-10 w-full rounded-lg" onClick={() => void handleOAuth(provider)}>
                    <Github className="mr-2 h-4 w-4" />
                    {provider.displayName}
                  </Button>
                ))}
              </div>
            )}

            <div className="pt-1 text-center text-sm text-slate-500">
              {mode === "login" ? (
                <Link href={`/${locale}/register`} className="text-blue-600 hover:text-blue-700">
                  {locale === "en" ? "Need an account? Register" : "没有账号？去注册"}
                </Link>
              ) : (
                <Link href={`/${locale}/login`} className="text-blue-600 hover:text-blue-700">
                  {locale === "en" ? "Already have an account? Login" : "已有账号？去登录"}
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
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

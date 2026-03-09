"use client";

import {useEffect, useState} from "react";
import {useLocale} from "next-intl";
import {useRouter} from "next/navigation";
import {MessageSquareText, Send} from "lucide-react";
import {useAuth} from "@/components/providers/auth-provider";
import {Button} from "@/components/ui/button";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {feedbackApi} from "@/lib/api";
import {toast} from "sonner";
import type {FeedbackView} from "@/lib/types";

function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

export default function FeedbacksPage() {
  const locale = useLocale();
  const router = useRouter();
  const {user, loading} = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [items, setItems] = useState<FeedbackView[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.push(`/${locale}/login?redirect=/${locale}/feedbacks`);
      return;
    }

    feedbackApi.myList()
      .then(({data}) => setItems(data.content))
      .catch(() => toast.error(sectionText(locale, "问题列表加载失败", "Failed to load feedback list")))
      .finally(() => setLoadingPage(false));
  }, [loading, user, locale, router]);

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      return;
    }
    try {
      const {data} = await feedbackApi.submit({
        category: title.trim(),
        content: content.trim()
      });
      setItems((current) => [data, ...current]);
      setTitle("");
      setContent("");
      setShowForm(false);
      toast.success(sectionText(locale, "问题已提交", "Feedback submitted"));
    } catch {
      toast.error(sectionText(locale, "提交失败", "Failed to submit feedback"));
    }
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{sectionText(locale, "我的问题", "My Feedback")}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "提交产品问题、体验建议或模板需求。", "Submit product issues, UX suggestions, or template requests.")}</p>
        </div>
        <Button onClick={() => setShowForm((current) => !current)}>
          <MessageSquareText className="mr-2 h-4 w-4" />
          {showForm ? sectionText(locale, "收起表单", "Hide form") : sectionText(locale, "提交问题", "Submit feedback")}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{sectionText(locale, "提交问题", "Submit Feedback")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={sectionText(locale, "问题标题", "Feedback title")} />
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder={sectionText(locale, "详细描述", "Describe the issue in detail")} className="min-h-[160px]" />
            <Button onClick={handleSubmit}>
              <Send className="mr-2 h-4 w-4" />
              {sectionText(locale, "提交", "Submit")}
            </Button>
          </CardContent>
        </Card>
      )}

      {loadingPage && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "正在加载问题列表...", "Loading feedback list...")}</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="pt-6">
              <div className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">{item.category}</div>
              <div className="text-sm leading-7 text-slate-600 dark:text-slate-300">{item.content}</div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">{new Date(item.createdAt).toLocaleString(locale === "en" ? "en-US" : "zh-CN")}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!loadingPage && items.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500 dark:text-slate-400">{sectionText(locale, "暂时还没有提交过问题。", "No feedback submitted yet.")}</CardContent>
        </Card>
      )}
    </main>
  );
}

"use client";

import {Check, ChevronLeft, ChevronRight} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {templateOptions, type TemplateId} from "@/lib/templates";
import {cn} from "@/lib/utils";

interface TemplateCarouselProps {
  locale: string;
  value: TemplateId;
  onChange: (value: TemplateId) => void;
}

function TemplateArt({id}: {id: TemplateId}) {
  const commonCard = "rounded-[10px] border border-slate-200 bg-white p-3";

  if (id === "classic") {
    return (
      <div className={cn(commonCard, "space-y-3 bg-slate-50")}>
        <div className="mx-auto h-2 w-16 rounded-full bg-slate-400" />
        <div className="mx-auto h-1.5 w-20 rounded-full bg-slate-300" />
        <div className="space-y-2 pt-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-slate-300" />
              <div className="h-1.5 w-4/5 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === "modern") {
    return (
      <div className={cn(commonCard, "grid grid-cols-[46px,1fr] gap-3")}>
        <div className="rounded-[8px] bg-[#394961] px-2 py-3">
          <div className="mb-2 h-1.5 w-8 rounded-full bg-slate-100" />
          <div className="mb-3 h-1 w-6 rounded-full bg-slate-300/70" />
          <div className="space-y-1.5">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-1.5 rounded-full bg-slate-300/30" />
            ))}
          </div>
        </div>
        <div className="space-y-2 pt-1">
          <div className="h-1.5 w-16 rounded-full bg-slate-500" />
          <div className="h-1.5 w-12 rounded-full bg-slate-300" />
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-slate-300" />
                <div className="h-1.5 w-4/5 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (id === "professional") {
    return (
      <div className={cn(commonCard, "space-y-3")}>
        <div className="rounded-[8px] bg-[#25459e] px-3 py-3">
          <div className="mb-2 h-1.5 w-10 rounded-full bg-white" />
          <div className="flex justify-between gap-2">
            <div className="h-1 w-8 rounded-full bg-white/70" />
            <div className="h-1 w-6 rounded-full bg-white/60" />
          </div>
        </div>
        <div className="space-y-2 pt-1">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex gap-2">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-400" />
              <div className="flex-1 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-slate-300" />
                <div className="h-1.5 w-4/5 rounded-full bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-2 rounded-full bg-blue-100" />
          ))}
        </div>
      </div>
    );
  }

  if (id === "gradient") {
    return (
      <div className={cn(commonCard, "space-y-3")}>
        <div className="rounded-[8px] bg-[#1ab7b0] px-3 py-3">
          <div className="mb-2 h-1.5 w-10 rounded-full bg-white" />
          <div className="h-1 w-14 rounded-full bg-white/70" />
        </div>
        <div className="h-3 rounded-full bg-[#e7fbf9]" />
        <div className="space-y-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-[#bfece7]" />
              <div className="h-1.5 w-4/5 rounded-full bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === "compact") {
    return (
      <div className={cn(commonCard, "space-y-3")}>
        <div className="rounded-[8px] bg-[#8a430f] px-3 py-3">
          <div className="mb-2 h-1.5 w-10 rounded-full bg-white" />
          <div className="flex justify-between gap-2">
            <div className="h-1 w-8 rounded-full bg-white/70" />
            <div className="h-1 w-6 rounded-full bg-white/60" />
          </div>
        </div>
        <div className="grid grid-cols-[42px,1fr] gap-3">
          <div className="rounded-[8px] bg-[#fbf5e7] px-2 py-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="mb-2 h-1.5 rounded-full bg-[#d97706]/60 last:mb-0" />
            ))}
          </div>
          <div className="space-y-2 pt-1">
            {[0, 1, 2].map((item) => (
              <div key={item} className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-slate-300" />
                <div className="h-1.5 w-4/5 rounded-full bg-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(commonCard, "space-y-3 bg-[#fcf8ff]")}>
      <div className="rounded-[12px] bg-gradient-to-r from-[#7b2cf4] via-[#a642e4] to-[#d72b79] px-3 py-3">
        <div className="mb-2 h-5 w-5 rounded-full bg-white/30" />
        <div className="h-1.5 w-10 rounded-full bg-white" />
        <div className="mt-1 h-1 w-14 rounded-full bg-white/70" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-[10px] border border-[#eadbff] bg-white px-3 py-3">
            <div className="mb-2 h-1.5 w-8 rounded-full bg-[#a84af1]" />
            <div className="h-1.5 w-full rounded-full bg-slate-200" />
            <div className="mt-1 h-1.5 w-4/5 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TemplateCarousel({locale, value, onChange}: TemplateCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function syncScrollState() {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    setCanScrollLeft(node.scrollLeft > 8);
    setCanScrollRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 8);
  }

  useEffect(() => {
    const selectedCard = containerRef.current?.querySelector<HTMLElement>(`[data-template-id="${value}"]`);
    selectedCard?.scrollIntoView({behavior: "smooth", block: "nearest", inline: "center"});
    window.setTimeout(syncScrollState, 120);
  }, [value]);

  useEffect(() => {
    syncScrollState();
    const node = containerRef.current;
    if (!node) {
      return;
    }

    node.addEventListener("scroll", syncScrollState, {passive: true});
    window.addEventListener("resize", syncScrollState);
    return () => {
      node.removeEventListener("scroll", syncScrollState);
      window.removeEventListener("resize", syncScrollState);
    };
  }, []);

  function scrollByCard(direction: "left" | "right") {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    node.scrollBy({
      left: direction === "left" ? -220 : 220,
      behavior: "smooth"
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollByCard("left")}
          disabled={!canScrollLeft}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollByCard("right")}
          disabled={!canScrollRight}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {templateOptions.map((template) => {
          const selected = template.id === value;

          return (
            <button
              key={template.id}
              data-template-id={template.id}
              type="button"
              onClick={() => onChange(template.id)}
              className={cn(
                "relative w-[154px] shrink-0 rounded-[12px] border bg-white p-2.5 text-left transition-all",
                selected
                  ? "border-blue-400 shadow-[0_0_0_1px_rgba(96,165,250,0.55)]"
                  : "border-slate-200 hover:border-slate-300"
              )}
            >
              <div className="relative h-[114px] overflow-hidden rounded-[10px] border border-slate-200 bg-slate-100 p-2">
                <TemplateArt id={template.id} />
                {selected && (
                  <span className="absolute right-1.5 top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
              <div className="mt-2 text-[13px] font-semibold text-slate-900">
                {locale === "en" ? template.titleEn : template.title}
              </div>
              <div className="mt-1 min-h-8 text-[11px] leading-4 text-slate-500">
                {locale === "en" ? template.descriptionEn : template.description}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center gap-1.5">
        {templateOptions.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onChange(template.id)}
            aria-label={`${locale === "en" ? "Go to template" : "切换到模板"} ${template.id}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              value === template.id ? "w-5 bg-blue-600" : "w-1.5 bg-slate-300"
            )}
          />
        ))}
      </div>
    </div>
  );
}

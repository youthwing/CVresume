"use client";

import {cn} from "@/lib/utils";

export function sectionText(locale: string, zh: string, en: string) {
  return locale === "en" ? en : zh;
}

export function KeywordBlock({
  title,
  items,
  tone,
  emptyText
}: {
  title: string;
  items: string[];
  tone: "blue" | "amber";
  emptyText: string;
}) {
  const styles = tone === "blue"
    ? "border-blue-100 bg-blue-50 text-blue-700"
    : "border-amber-100 bg-amber-50 text-amber-700";

  return (
    <div>
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium", styles)}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500">{emptyText}</div>
      )}
    </div>
  );
}

export function InsightList({
  title,
  items
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <div className="mb-3 text-sm font-semibold text-slate-900">{title}</div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-slate-600">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-900" />
            <span className="leading-7">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RadarAnalysis({
  axes,
  locale
}: {
  axes: Array<{label: string; jd: number; candidate: number}>;
  locale: string;
}) {
  const size = 224;
  const center = size / 2;
  const radius = 72;
  const levels = [0.25, 0.5, 0.75, 1];

  const toPoint = (index: number, value: number) => {
    const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / axes.length;
    const scaledRadius = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return {
      x: center + Math.cos(angle) * scaledRadius,
      y: center + Math.sin(angle) * scaledRadius
    };
  };

  const polygonPoints = (field: "jd" | "candidate") => axes
    .map((axis, index) => {
      const point = toPoint(index, axis[field]);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">
          {sectionText(locale, "能力雷达", "Radar Overview")}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            {sectionText(locale, "JD 需求", "JD")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            {sectionText(locale, "候选人", "Candidate")}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-[224px] w-[224px]">
        {levels.map((level) => {
          const points = axes.map((_, index) => {
            const angle = (-Math.PI / 2) + (Math.PI * 2 * index) / axes.length;
            return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
          }).join(" ");
          return (
            <polygon
              key={level}
              points={points}
              fill="none"
              stroke="rgba(148,163,184,0.24)"
              strokeWidth="1"
            />
          );
        })}
        {axes.map((axis, index) => {
          const edge = toPoint(index, 100);
          return (
            <line
              key={axis.label}
              x1={center}
              y1={center}
              x2={edge.x}
              y2={edge.y}
              stroke="rgba(148,163,184,0.22)"
              strokeWidth="1"
            />
          );
        })}
        <polygon points={polygonPoints("jd")} fill="rgba(203,213,225,0.24)" stroke="rgba(148,163,184,0.92)" strokeWidth="2.5" />
        <polygon points={polygonPoints("candidate")} fill="rgba(59,130,246,0.16)" stroke="rgba(59,130,246,0.95)" strokeWidth="2.5" />
        {axes.map((axis, index) => {
          const point = toPoint(index, axis.candidate);
          const labelPoint = toPoint(index, 118);
          return (
            <g key={`${axis.label}-point`}>
              <circle cx={point.x} cy={point.y} r="3.5" fill="#3b82f6" />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                fontSize="11"
                fill="#64748b"
                textAnchor={labelPoint.x >= center + 4 ? "start" : labelPoint.x <= center - 4 ? "end" : "middle"}
              >
                {axis.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-5 space-y-4">
        {axes.map((axis) => (
          <div key={axis.label}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-900">{axis.label}</span>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="text-slate-500">JD {axis.jd}</span>
                <span className="text-blue-600">{axis.candidate}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-300" style={{width: `${axis.jd}%`}} />
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-500" style={{width: `${axis.candidate}%`}} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 리뷰 보드의 단일 카드 칩을 렌더링합니다.
import Link from "next/link";
import React from "react";

import type { DashboardCardRow } from "../lib/scan";

type ArtifactKey = keyof DashboardCardRow["artifacts"];

const artifactLabels: Record<ArtifactKey, string> = {
  deep: "Deep",
  til: "TIL",
  guide: "Guide",
};

export function CardChip({ row }: { row: DashboardCardRow }) {
  const { frontmatter } = row;
  const insight = extractStrongestInsight(row.body) ?? frontmatter.summary_one_line;
  const artifacts = Object.entries(row.artifacts).filter(([, artifact]) => artifact.exists);

  return (
    <Link
      aria-label={`${frontmatter.title} card`}
      className="block rounded-md border border-line-solid bg-background-elevated p-12 shadow-elevated transition hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      href={`/cards/${encodeURIComponent(frontmatter.slug)}`}
    >
      <div className="flex min-w-0 items-center justify-between gap-8 text-label-sm text-label-alternative">
        <span className="shrink-0 rounded-sm border border-line-normal bg-background-alternative px-6 py-2 text-label-sm font-medium uppercase text-label-neutral">
          {frontmatter.platform}
        </span>
        <time className="shrink-0" dateTime={frontmatter.captured_at}>
          {formatDate(frontmatter.captured_at)}
        </time>
      </div>

      <h3 className="mt-10 overflow-hidden text-ellipsis text-body-sm font-semibold leading-20 text-label-strong [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
        {frontmatter.title}
      </h3>
      <p className="mt-4 overflow-hidden text-ellipsis text-label-sm leading-16 text-label-neutral [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
        {insight}
      </p>
      {insight !== frontmatter.summary_one_line ? (
        <p className="mt-4 overflow-hidden text-ellipsis text-label-sm leading-16 text-label-alternative [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]">
          {frontmatter.summary_one_line}
        </p>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-4">
        {frontmatter.tags.slice(0, 3).map((tag) => (
          <span
            className="max-w-full truncate rounded-sm bg-background-alternative px-6 py-2 text-label-sm text-label-alternative"
            key={tag}
          >
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-label-sm">
        <StatusBadge tone={frontmatter.status === "failed" ? "negative" : "neutral"}>
          {frontmatter.status}
        </StatusBadge>
        <StatusBadge tone={row.snapshot.reviewed ? "positive" : "cautionary"}>
          {row.snapshot.reviewed ? "Reviewed" : "Review"}
        </StatusBadge>
        <StatusBadge tone={row.snapshot.index_published ? "positive" : "neutral"}>
          {row.snapshot.index_published ? "Index pub" : "Index draft"}
        </StatusBadge>
        {artifacts.map(([kind, artifact]) => (
          <StatusBadge key={kind} tone={artifact.published ? "positive" : "neutral"}>
            {artifactLabels[kind as ArtifactKey]}
            {artifact.published ? " pub" : ""}
          </StatusBadge>
        ))}
      </div>
    </Link>
  );
}

function StatusBadge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "positive" | "cautionary" | "negative" | "neutral";
}) {
  const toneClass = {
    positive: "border-status-positive/40 text-status-positive",
    cautionary: "border-status-cautionary/40 text-status-cautionary",
    negative: "border-status-negative/40 text-status-negative",
    neutral: "border-line-normal text-label-alternative",
  }[tone];

  return (
    <span className={`rounded-sm border px-6 py-2 leading-16 ${toneClass}`}>
      {children}
    </span>
  );
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function extractStrongestInsight(body: string): string | null {
  const lines = body.split(/\r?\n/);
  const insightHeadingIndex = lines.findIndex((line) =>
    /^#{1,3}\s*(인사이트|insights?|key insights?)\s*$/i.test(line.trim()),
  );

  if (insightHeadingIndex === -1) {
    return null;
  }

  for (const line of lines.slice(insightHeadingIndex + 1)) {
    const trimmed = line.trim();
    if (/^#{1,3}\s+/.test(trimmed)) {
      return null;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet?.[1]) {
      return bullet[1].trim();
    }
  }

  return null;
}

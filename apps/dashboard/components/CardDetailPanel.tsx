// 카드 상세 화면의 reviewed 와 요약본 publish 토글을 비낙관적으로 처리합니다.
"use client";

import React from "react";
import { useState } from "react";

type CardDetailPanelProps = {
  dir: string;
  initialReviewed: boolean;
  initialPublished: boolean;
};

type PendingAction = "reviewed" | "publish" | null;

export function CardDetailPanel({
  dir,
  initialReviewed,
  initialPublished,
}: CardDetailPanelProps) {
  const [reviewed, setReviewed] = useState(initialReviewed);
  const [published, setPublished] = useState(initialPublished);
  const [pending, setPending] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleReviewed() {
    const nextValue = !reviewed;
    setPending("reviewed");
    setError(null);

    try {
      const result = await postJson<{ reviewed: boolean }>("/api/reviewed", {
        dir,
        value: nextValue,
      });
      setReviewed(result.reviewed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update reviewed state.");
    } finally {
      setPending(null);
    }
  }

  async function togglePublished() {
    const nextValue = !published;
    setPending("publish");
    setError(null);

    try {
      const result = await postJson<{ published: boolean }>("/api/publish", {
        dir,
        target: "index",
        value: nextValue,
      });
      setPublished(result.published);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update publish state.");
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <section className="rounded-md border border-line-solid bg-background-elevated p-12 shadow-elevated">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
        <button
          aria-pressed={reviewed}
          className={buttonClass(reviewed ? "positive" : "neutral")}
          disabled={busy}
          onClick={toggleReviewed}
          type="button"
        >
          {pending === "reviewed" ? "Saving..." : reviewed ? "Reviewed" : "Mark reviewed"}
        </button>
        <button
          aria-pressed={published}
          className={buttonClass(published ? "primary" : "neutral")}
          disabled={busy}
          onClick={togglePublished}
          type="button"
        >
          {pending === "publish" ? "Saving..." : published ? "Summary published" : "Publish summary"}
        </button>
      </div>
      {error ? (
        <p className="mt-8 text-label-sm text-status-negative" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload;
}

function buttonClass(tone: "positive" | "primary" | "neutral"): string {
  const toneClass = {
    positive: "border-status-positive bg-status-positive text-white",
    primary: "border-primary bg-primary text-white",
    neutral: "border-line-solid bg-background text-label-strong hover:border-primary",
  }[tone];

  return `min-h-40 rounded-md border px-12 py-8 text-label-md transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`;
}

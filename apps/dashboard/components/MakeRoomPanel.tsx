// Make Room 의 Deep / TIL / Guide 박스. 각 박스마다 생성 또는 발행 토글을 비낙관적으로 처리한다.
"use client";

import React, { useState } from "react";

type Kind = "deep" | "til" | "guide";

type ArtifactState = {
  exists: boolean;
  published: boolean;
  body: string | null;
};

type MakeRoomPanelProps = {
  dir: string;
  initial: Record<Kind, ArtifactState>;
};

type PendingMap = Partial<Record<Kind, "generate" | "publish">>;

const KINDS: Kind[] = ["deep", "til", "guide"];
const LABELS: Record<Kind, string> = {
  deep: "Deep",
  til: "TIL",
  guide: "Guide",
};
const DESCRIPTIONS: Record<Kind, string> = {
  deep: "원문을 한 단계 더 분해한 비판적 분석본.",
  til: "1인칭 학습자 시점의 짧은 TIL 노트.",
  guide: "원문을 적용하려는 사람을 위한 실용 가이드.",
};

export function MakeRoomPanel({ dir, initial }: MakeRoomPanelProps) {
  const [state, setState] = useState<Record<Kind, ArtifactState>>(initial);
  const [pending, setPending] = useState<PendingMap>({});
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleGenerate(kind: Kind) {
    setPending((p) => ({ ...p, [kind]: "generate" }));
    setError(null);
    setWarning(null);
    try {
      const result = await postJson<{
        kind: Kind;
        created: boolean;
        warning?: string;
      }>("/api/generate", { dir, kind });
      setWarning(result.warning ?? null);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${LABELS[kind]} 생성에 실패했다.`);
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[kind];
        return next;
      });
    }
  }

  async function handlePublishToggle(kind: Kind) {
    const current = state[kind];
    const nextValue = !current.published;
    setPending((p) => ({ ...p, [kind]: "publish" }));
    setError(null);
    setWarning(null);
    try {
      const result = await postJson<{ published: boolean; warning?: string }>("/api/publish", {
        dir,
        target: kind,
        value: nextValue,
      });
      setState((s) => ({ ...s, [kind]: { ...s[kind], published: result.published } }));
      setWarning(result.warning ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${LABELS[kind]} 발행 토글에 실패했다.`);
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[kind];
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col gap-12">
      {KINDS.map((kind) => {
        const s = state[kind];
        const pendingKind = pending[kind];
        return (
          <section
            className="rounded-md border border-line-solid bg-background-elevated p-16 shadow-elevated"
            data-kind={kind}
            data-exists={s.exists ? "true" : "false"}
            data-published={s.published ? "true" : "false"}
            key={kind}
          >
            <header className="flex flex-wrap items-center justify-between gap-8">
              <div className="min-w-0">
                <h2 className="text-label-md text-label-strong">{LABELS[kind]}</h2>
                <p className="mt-2 text-label-sm text-label-alternative">
                  {DESCRIPTIONS[kind]}
                </p>
              </div>
              {s.exists ? (
                <button
                  aria-pressed={s.published}
                  className={buttonClass(s.published ? "primary" : "neutral")}
                  disabled={pendingKind !== undefined}
                  onClick={() => handlePublishToggle(kind)}
                  type="button"
                >
                  {pendingKind === "publish"
                    ? "Saving..."
                    : s.published
                      ? `${LABELS[kind]} published`
                      : `Publish ${LABELS[kind]}`}
                </button>
              ) : (
                <button
                  className={buttonClass("primary")}
                  disabled={pendingKind !== undefined}
                  onClick={() => handleGenerate(kind)}
                  type="button"
                >
                  {pendingKind === "generate" ? "Generating..." : `Generate ${LABELS[kind]}`}
                </button>
              )}
            </header>
            {s.exists && s.body !== null ? (
              <pre className="mt-12 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md bg-background p-12 text-body-sm text-label-neutral">
                {s.body}
              </pre>
            ) : null}
            {!s.exists ? (
              <p className="mt-8 text-label-sm text-label-alternative">
                아직 생성되지 않았다.
              </p>
            ) : null}
          </section>
        );
      })}
      {error ? (
        <p className="text-label-sm text-status-negative" role="alert">
          {error}
        </p>
      ) : null}
      {warning ? (
        <p className="text-label-sm text-status-cautionary" role="status">
          {warning}
        </p>
      ) : null}
    </div>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

function buttonClass(tone: "primary" | "neutral"): string {
  const toneClass = {
    primary: "border-primary bg-primary text-white",
    neutral: "border-line-solid bg-background text-label-strong hover:border-primary",
  }[tone];
  return `min-h-40 rounded-md border px-12 py-8 text-label-md transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`;
}

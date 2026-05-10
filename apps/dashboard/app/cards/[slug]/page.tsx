// 카드 상세 화면에서 요약본과 검토/발행 상태를 보여줍니다.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import Link from "next/link";
import React from "react";

import { CardDetailPanel } from "../../../components/CardDetailPanel";
import { scanDashboardCards, type DashboardCardRow } from "../../../lib/scan";

type CardDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CardDetailPage({ params }: CardDetailPageProps) {
  const { slug } = await params;
  const root = process.env.REPO_LOCAL_PATH;

  if (!root) {
    return (
      <DetailShell>
        <StatePanel title="Dashboard not configured">
          REPO_LOCAL_PATH is not configured.
        </StatePanel>
      </DetailShell>
    );
  }

  let rows: DashboardCardRow[];
  try {
    rows = await scanDashboardCards(root);
  } catch (error) {
    return (
      <DetailShell>
        <StatePanel title="Vault scan failed">
          {error instanceof Error ? error.message : "Unable to scan dashboard cards."}
        </StatePanel>
      </DetailShell>
    );
  }

  const row = rows.find((candidate) => candidate.frontmatter.slug === slug);
  if (!row) {
    return (
      <DetailShell>
        <StatePanel title="Card not found">
          No card with slug "{slug}" was found in the configured vault.
        </StatePanel>
      </DetailShell>
    );
  }

  const sourceText = await readSourceText(row);
  const insights = extractInsights(row.body);
  const fm = row.frontmatter;

  return (
    <DetailShell>
      <article className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Link className="text-label-md text-primary hover:text-primary-strong" href="/">
            Back to Review Board
          </Link>

          <header className="mt-12 rounded-md border border-line-solid bg-background-elevated p-16 shadow-elevated">
            <div className="flex flex-wrap items-center gap-6 text-label-sm text-label-alternative">
              <StatusBadge>{fm.platform}</StatusBadge>
              <time dateTime={fm.captured_at}>{fm.captured_at.slice(0, 10)}</time>
              <span>{fm.status}</span>
            </div>
            <h1 className="mt-10 text-headline-lg text-label-strong">{fm.title}</h1>
            <p className="mt-8 text-body-lg text-label-neutral">{fm.summary_one_line}</p>
            <div className="mt-12 flex flex-wrap gap-6">
              {fm.tags.map((tag) => (
                <span
                  className="rounded-sm bg-background-alternative px-8 py-4 text-label-sm text-label-alternative"
                  key={tag}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </header>

          <section className="mt-16 rounded-md border border-line-solid bg-background-elevated p-16 shadow-elevated">
            <h2 className="text-label-md text-label-strong">Summary</h2>
            <div className="mt-8 whitespace-pre-wrap text-body-md text-label-neutral">{row.body}</div>
          </section>

          {insights.length > 0 ? (
            <section className="mt-16 rounded-md border border-line-solid bg-background-elevated p-16 shadow-elevated">
              <h2 className="text-label-md text-label-strong">Insights</h2>
              <ul className="mt-8 grid gap-6 text-body-sm text-label-neutral">
                {insights.map((insight) => (
                  <li key={insight}>{insight}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <SourceSection row={row} sourceText={sourceText} />
        </div>

        <aside className="flex flex-col gap-12">
          <CardDetailPanel
            dir={row.dir}
            initialPublished={fm.published}
            initialReviewed={fm.reviewed ?? false}
          />
          <Link
            className="rounded-md border border-primary bg-primary px-12 py-10 text-center text-label-md text-white transition hover:bg-primary-strong"
            href={`/cards/${encodeURIComponent(fm.slug)}/make`}
          >
            Open Make Room
          </Link>
          <MetadataPanel row={row} />
        </aside>
      </article>
    </DetailShell>
  );
}

function DetailShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background-alternative px-16 py-16 text-label-normal md:px-24">
      <section className="mx-auto max-w-[1200px]">{children}</section>
    </main>
  );
}

function StatePanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-md border border-line-solid bg-background-elevated p-16 text-body-sm text-label-neutral shadow-elevated">
      <Link className="text-label-md text-primary hover:text-primary-strong" href="/">
        Back to Review Board
      </Link>
      <h1 className="mt-12 text-headline-md text-label-strong">{title}</h1>
      <p className="mt-6">{children}</p>
    </section>
  );
}

function SourceSection({
  row,
  sourceText,
}: {
  row: DashboardCardRow;
  sourceText: { label: string; body: string } | null;
}) {
  const fm = row.frontmatter;

  return (
    <section className="mt-16 rounded-md border border-line-solid bg-background-elevated p-16 shadow-elevated">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-label-md text-label-strong">Source</h2>
          <p className="mt-4 text-body-sm text-label-neutral">{fm.url}</p>
        </div>
        <a
          className="rounded-md border border-line-solid px-10 py-8 text-center text-label-md text-label-strong hover:border-primary"
          href={fm.url}
          rel="noreferrer"
          target="_blank"
        >
          Open source
        </a>
      </div>

      {fm.platform === "youtube" && fm.youtube?.video_id ? (
        <iframe
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="mt-12 aspect-video w-full rounded-md border border-line-solid"
          src={`https://www.youtube.com/embed/${encodeURIComponent(fm.youtube.video_id)}`}
          title={fm.title}
        />
      ) : null}

      {sourceText ? (
        <details className="mt-12 rounded-md border border-line-solid bg-background p-12">
          <summary className="cursor-pointer text-label-md text-label-strong">
            {sourceText.label}
          </summary>
          <pre className="mt-8 max-h-[480px] overflow-auto whitespace-pre-wrap text-body-sm text-label-neutral">
            {sourceText.body}
          </pre>
        </details>
      ) : null}
    </section>
  );
}

function MetadataPanel({ row }: { row: DashboardCardRow }) {
  const fm = row.frontmatter;

  return (
    <section className="rounded-md border border-line-solid bg-background-elevated p-12 text-body-sm text-label-neutral shadow-elevated">
      <h2 className="text-label-md text-label-strong">Metadata</h2>
      <dl className="mt-10 grid gap-8">
        <MetaItem label="Captured" value={fm.captured_at} />
        <MetaItem label="LLM" value={fm.llm.model} />
        <MetaItem label="Truncated" value={fm.llm.truncated ? "Yes" : "No"} />
        {fm.platform === "youtube" && fm.youtube ? (
          <>
            <MetaItem label="Channel" value={fm.youtube.channel} />
            <MetaItem label="Upload date" value={fm.youtube.upload_date} />
            <MetaItem label="Duration" value={`${fm.youtube.duration_sec}s`} />
            <MetaItem label="Subtitles" value={fm.youtube.subtitle_source} />
          </>
        ) : null}
        {fm.platform === "github" && fm.github ? (
          <>
            <MetaItem label="Repository" value={`${fm.github.owner}/${fm.github.repo}`} />
            <MetaItem label="Stars" value={String(fm.github.stars)} />
            <MetaItem label="Language" value={fm.github.primary_language} />
            <MetaItem label="Topics" value={fm.github.topics.join(", ") || "None"} />
          </>
        ) : null}
      </dl>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-label-sm text-label-alternative">{label}</dt>
      <dd className="mt-2 break-words text-label-neutral">{value}</dd>
    </div>
  );
}

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm border border-line-normal bg-background-alternative px-6 py-2 text-label-sm font-medium uppercase text-label-neutral">
      {children}
    </span>
  );
}

async function readSourceText(
  row: DashboardCardRow,
): Promise<{ label: string; body: string } | null> {
  const file =
    row.frontmatter.platform === "youtube"
      ? { label: "transcript.md", name: "transcript.md" }
      : { label: "extract.md", name: "extract.md" };

  try {
    const body = await readFile(join(row.dir, file.name), "utf8");
    return { label: file.label, body };
  } catch {
    return null;
  }
}

function extractInsights(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) =>
    /^#{1,3}\s*(인사이트|insights?|key insights?)\s*$/i.test(line.trim()),
  );
  if (headingIndex === -1) {
    return [];
  }

  const insights: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    const trimmed = line.trim();
    if (/^#{1,3}\s+/.test(trimmed)) {
      break;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet?.[1]) {
      insights.push(bullet[1].trim());
    }
  }
  return insights;
}

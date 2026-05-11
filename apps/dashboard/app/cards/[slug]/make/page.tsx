// Focused Make Room. 카드 슬러그로 카드를 찾아 Deep / TIL / Guide 박스 3 개를 렌더한다.
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { parseArtifact } from "@zettlink/core";
import Link from "next/link";
import React from "react";

import { MakeRoomPanel } from "../../../../components/MakeRoomPanel";
import { scanDashboardCards, type DashboardCardRow } from "../../../../lib/scan";

type MakeRoomPageProps = {
  params: Promise<{ slug: string }>;
};

type Kind = "deep" | "til" | "guide";

export default async function MakeRoomPage({ params }: MakeRoomPageProps) {
  const { slug } = await params;
  const root = process.env.REPO_LOCAL_PATH;

  if (!root) {
    return (
      <Shell>
        <StatePanel title="Make Room not configured">
          REPO_LOCAL_PATH is not configured.
        </StatePanel>
      </Shell>
    );
  }

  let rows: DashboardCardRow[];
  try {
    rows = await scanDashboardCards(root);
  } catch (error) {
    return (
      <Shell>
        <StatePanel title="Vault scan failed">
          {error instanceof Error ? error.message : "Unable to scan dashboard cards."}
        </StatePanel>
      </Shell>
    );
  }

  const row = rows.find((candidate) => candidate.frontmatter.slug === slug);
  if (!row) {
    return (
      <Shell>
        <StatePanel title="Card not found">
          No card with slug "{slug}" was found in the configured vault.
        </StatePanel>
      </Shell>
    );
  }

  const fm = row.frontmatter;
  const initial = await readArtifacts(row.dir);

  return (
    <Shell>
      <article className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Link
            className="text-label-md text-primary hover:text-primary-strong"
            href={`/cards/${encodeURIComponent(fm.slug)}`}
          >
            ← Card detail
          </Link>

          <header className="mt-12 rounded-md border border-line-solid bg-background-elevated p-16 shadow-elevated">
            <p className="text-label-sm text-label-alternative">Make Room</p>
            <h1 className="mt-4 text-headline-md text-label-strong">{fm.title}</h1>
            <p className="mt-8 text-body-md text-label-neutral">{fm.summary_one_line}</p>
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

          <section className="mt-16">
            <MakeRoomPanel dir={row.dir} initial={initial} />
          </section>
        </div>

        <aside className="flex flex-col gap-12">
          <section className="rounded-md border border-line-solid bg-background-elevated p-12 text-body-sm text-label-neutral shadow-elevated">
            <h2 className="text-label-md text-label-strong">Source</h2>
            <p className="mt-6 break-words">{fm.url}</p>
            <a
              className="mt-10 inline-block rounded-md border border-line-solid px-10 py-6 text-label-md text-label-strong hover:border-primary"
              href={fm.url}
              rel="noreferrer"
              target="_blank"
            >
              Open source
            </a>
          </section>
        </aside>
      </article>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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

async function readArtifacts(
  dir: string,
): Promise<Record<Kind, { exists: boolean; published: boolean; body: string | null }>> {
  const entries = await Promise.all(
    (["deep", "til", "guide"] as Kind[]).map(async (kind) => {
      const path = join(dir, `${kind}.md`);
      if (!existsSync(path)) {
        return [kind, { exists: false, published: false, body: null }] as const;
      }
      try {
        const md = await readFile(path, "utf8");
        const { frontmatter, body } = parseArtifact(md);
        return [kind, { exists: true, published: frontmatter.published, body }] as const;
      } catch {
        return [kind, { exists: true, published: false, body: null }] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<
    Kind,
    { exists: boolean; published: boolean; body: string | null }
  >;
}

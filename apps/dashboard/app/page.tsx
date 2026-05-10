// 로컬 vault 를 스캔해 리뷰 보드 페이지를 렌더링합니다.
import React from "react";

import { BoardColumn } from "../components/BoardColumn.js";
import { FilterBar } from "../components/FilterBar.js";
import { ScopeToggle } from "../components/ScopeToggle.js";
import { type BoardColumn as BoardColumnName, computeColumn } from "../lib/board.js";
import { EMPTY_FILTER, filterRows, type FilterState } from "../lib/filter.js";
import { scanDashboardCards, type DashboardCardRow } from "../lib/scan.js";

const BOARD_COLUMNS: BoardColumnName[] = [
  "Published",
  "Needs review",
  "TIL ready",
  "Deep done",
];

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ReviewBoardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const filter = buildFilterState(resolvedSearchParams);
  const root = process.env.REPO_LOCAL_PATH;

  if (!root) {
    return (
      <DashboardShell
        count={0}
        filter={filter}
        subtitle="REPO_LOCAL_PATH is not configured."
      >
        <ConfigState />
      </DashboardShell>
    );
  }

  try {
    const rows = await scanDashboardCards(root);
    const filteredRows = filterRows(rows, filter);
    const groupedRows = groupRows(filteredRows);
    const activeCount = BOARD_COLUMNS.reduce(
      (count, column) => count + groupedRows[column].length,
      0,
    );

    return (
      <DashboardShell count={activeCount} filter={filter} subtitle={`${rows.length} total cards`}>
        <div className="grid gap-10 overflow-x-auto pb-4 md:grid-cols-4">
          {BOARD_COLUMNS.map((column) => (
            <BoardColumn column={column} key={column} rows={groupedRows[column]} />
          ))}
        </div>
      </DashboardShell>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to scan dashboard cards.";

    return (
      <DashboardShell count={0} filter={filter} subtitle="Vault scan failed.">
        <section className="rounded-md border border-line-solid bg-background-elevated p-16 text-body-sm text-label-neutral shadow-elevated">
          <h2 className="text-label-md text-label-strong">Dashboard unavailable</h2>
          <p className="mt-6">{message}</p>
        </section>
      </DashboardShell>
    );
  }
}

function DashboardShell({
  children,
  count,
  filter,
  subtitle,
}: {
  children: React.ReactNode;
  count: number;
  filter: FilterState;
  subtitle: string;
}) {
  return (
    <main className="min-h-screen bg-background-alternative px-16 py-16 text-label-normal md:px-24">
      <section className="mx-auto flex max-w-[1600px] flex-col gap-16">
        <header className="rounded-md border border-line-solid bg-background-elevated p-16 shadow-elevated">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-label-sm text-label-alternative">zettlink dashboard</p>
              <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
                <h1 className="text-headline-md text-label-strong">Review Board</h1>
                <span className="pb-2 text-label-md text-label-alternative">{count} cards</span>
              </div>
              <p className="mt-4 text-body-sm text-label-neutral">{subtitle}</p>
            </div>
            <ScopeToggle filter={filter} />
          </div>

          <div className="mt-14">
            <FilterBar filter={filter} />
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}

function ConfigState() {
  return (
    <section className="rounded-md border border-line-solid bg-background-elevated p-16 text-body-sm text-label-neutral shadow-elevated">
      <h2 className="text-label-md text-label-strong">Dashboard not configured</h2>
      <p className="mt-6">Set REPO_LOCAL_PATH to the local vault root.</p>
    </section>
  );
}

function buildFilterState(searchParams: SearchParams): FilterState {
  return {
    scope: parseEnum(first(searchParams.scope), ["active", "all"], EMPTY_FILTER.scope),
    q: first(searchParams.q) ?? EMPTY_FILTER.q,
    platform: parseEnum(
      first(searchParams.platform),
      ["all", "youtube", "github"],
      EMPTY_FILTER.platform,
    ),
    tags: parseTags(first(searchParams.tags)),
    publish: parseEnum(
      first(searchParams.publish),
      ["all", "published", "not_published"],
      EMPTY_FILTER.publish,
    ),
    artifact: parseEnum(
      first(searchParams.artifact),
      ["all", "deep", "til", "guide", "none"],
      EMPTY_FILTER.artifact,
    ),
  };
}

function groupRows(rows: DashboardCardRow[]): Record<BoardColumnName, DashboardCardRow[]> {
  const groupedRows: Record<BoardColumnName, DashboardCardRow[]> = {
    Published: [],
    "Needs review": [],
    "TIL ready": [],
    "Deep done": [],
  };

  for (const row of rows) {
    const column = computeColumn(row.snapshot);
    if (column) {
      groupedRows[column].push(row);
    }
  }

  return groupedRows;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseTags(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseEnum<const T extends string>(
  value: string | undefined,
  values: readonly T[],
  fallback: T,
): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

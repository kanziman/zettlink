// 대시보드 카드 검색과 필터 조건을 적용합니다.
import { computeColumn } from "./board.js";
import type { DashboardCardRow } from "./scan.js";

export type FilterState = {
  scope: "active" | "all";
  q: string;
  platform: "all" | "youtube" | "github";
  tags: string[];
  publish: "all" | "published" | "not_published";
  artifact: "all" | "deep" | "til" | "guide" | "none";
};

export const EMPTY_FILTER: FilterState = {
  scope: "active",
  q: "",
  platform: "all",
  tags: [],
  publish: "all",
  artifact: "all",
};

type SearchableDashboardCardRow = DashboardCardRow & {
  body?: string;
  index_body?: string;
  indexBody?: string;
};

export function filterRows(
  rows: DashboardCardRow[],
  filter: FilterState,
): DashboardCardRow[] {
  const query = filter.q.trim().toLocaleLowerCase();

  return rows.filter((row) => {
    const column = computeColumn(row.snapshot);

    if (filter.scope === "active" && column === null) {
      return false;
    }

    if (query.length > 0 && !matchesText(row, query)) {
      return false;
    }

    if (
      filter.platform !== "all" &&
      row.frontmatter.platform !== filter.platform
    ) {
      return false;
    }

    if (!filter.tags.every((tag) => row.frontmatter.tags.includes(tag))) {
      return false;
    }

    if (filter.publish === "published" && column !== "Published") {
      return false;
    }
    if (filter.publish === "not_published" && column === "Published") {
      return false;
    }

    if (!matchesArtifact(row, filter.artifact)) {
      return false;
    }

    return true;
  });
}

function matchesText(row: DashboardCardRow, query: string): boolean {
  const searchable = row as SearchableDashboardCardRow;
  const fields = [
    row.frontmatter.title,
    row.frontmatter.summary_one_line,
    ...row.frontmatter.tags,
    searchable.body,
    searchable.index_body,
    searchable.indexBody,
  ];

  return fields.some((field) =>
    (field ?? "").toLocaleLowerCase().includes(query),
  );
}

function matchesArtifact(
  row: DashboardCardRow,
  artifact: FilterState["artifact"],
): boolean {
  if (artifact === "all") {
    return true;
  }

  const artifacts = row.artifacts;

  if (artifact === "none") {
    return (
      !artifacts.deep.exists &&
      !artifacts.til.exists &&
      !artifacts.guide.exists
    );
  }

  return artifacts[artifact].exists;
}

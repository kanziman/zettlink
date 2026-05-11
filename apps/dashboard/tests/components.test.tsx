// 대시보드 Review Board 컴포넌트 렌더링을 검증합니다.
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { BoardColumn } from "../components/BoardColumn";
import { CardChip } from "../components/CardChip";
import { FilterBar } from "../components/FilterBar";
import { ScopeToggle } from "../components/ScopeToggle";
import type { CardSnapshot } from "../lib/board";
import { EMPTY_FILTER, type FilterState } from "../lib/filter";
import type { DashboardCardRow } from "../lib/scan";

type RowOverrides = {
  slug: string;
  title?: string;
  summary?: string;
  body?: string;
  platform?: "youtube" | "github";
  tags?: string[];
  reviewed?: boolean;
  published?: boolean;
  artifacts?: Partial<CardSnapshot["artifacts"]>;
};

function row(overrides: RowOverrides): DashboardCardRow {
  const artifacts = {
    deep: { exists: false, published: false },
    til: { exists: false, published: false },
    guide: { exists: false, published: false },
    ...overrides.artifacts,
  };
  const snapshot: CardSnapshot = {
    reviewed: overrides.reviewed ?? true,
    index_published: overrides.published ?? false,
    artifacts,
  };
  const platform = overrides.platform ?? "youtube";

  return {
    frontmatter: {
      url:
        platform === "youtube"
          ? "https://www.youtube.com/watch?v=abc123"
          : "https://github.com/example/repo",
      platform,
      slug: overrides.slug,
      captured_at: "2026-05-09T10:00:00.000Z",
      title: overrides.title ?? overrides.slug,
      summary_one_line: overrides.summary ?? "Summary fallback.",
      tags: overrides.tags ?? [],
      status: "summarized",
      reviewed: snapshot.reviewed,
      published: snapshot.index_published,
      note: "",
      generated: { deep: false, til: false, guide: false },
      llm: { model: "test-model", truncated: false },
    },
    dir: `/vault/${overrides.slug}`,
    snapshot,
    artifacts,
    body: overrides.body ?? "",
  };
}

function filter(overrides: Partial<FilterState> = {}): FilterState {
  return { ...EMPTY_FILTER, ...overrides };
}

test("CardChip links to the card detail page and shows compact metadata", () => {
  const html = renderToStaticMarkup(
    <CardChip
      row={row({
        slug: "vector-notes",
        title: "Vector Notes",
        platform: "github",
        tags: ["ai", "systems", "notes", "extra"],
        artifacts: { deep: { exists: true, published: false } },
      })}
    />,
  );

  expect(html).toContain('href="/cards/vector-notes"');
  expect(html).toContain("github");
  expect(html).toContain("2026-05-09");
  expect(html).toContain("Vector Notes");
  expect(html).toContain("#ai");
  expect(html).toContain("#systems");
  expect(html).toContain("#notes");
  expect(html).not.toContain("#extra");
  expect(html).toContain("Deep");
});

test("CardChip extracts the first body insight when present", () => {
  const html = renderToStaticMarkup(
    <CardChip
      row={row({
        slug: "insight-card",
        summary: "Summary fallback.",
        body: "Intro\n\n## 인사이트\n- Strongest body insight.\n- Second insight.\n",
      })}
    />,
  );

  expect(html).toContain("Strongest body insight.");
});

test("BoardColumn renders count, chips, and an empty state", () => {
  const withCards = renderToStaticMarkup(
    <BoardColumn column="Needs review" rows={[row({ slug: "one" }), row({ slug: "two" })]} />,
  );
  const empty = renderToStaticMarkup(<BoardColumn column="Deep done" rows={[]} />);

  expect(withCards).toContain("Needs review");
  expect(withCards).toContain("2");
  expect(withCards).toContain("one");
  expect(withCards).toContain("two");
  expect(empty).toContain("No cards");
});

test("ScopeToggle preserves filters while switching scope", () => {
  const html = renderToStaticMarkup(
    <ScopeToggle filter={filter({ scope: "active", q: "vector", tags: ["ai"] })} />,
  );

  expect(html).toContain("scope=active");
  expect(html).toContain("scope=all");
  expect(html).toContain("q=vector");
  expect(html).toContain("tags=ai");
  expect(html).toContain('aria-current="page"');
});

test("FilterBar binds filter values into a GET form", () => {
  const html = renderToStaticMarkup(
    <FilterBar
      filter={filter({
        scope: "all",
        q: "retrieval",
        platform: "github",
        tags: ["ai", "systems"],
        publish: "not_published",
        artifact: "deep",
      })}
    />,
  );

  expect(html).toContain('method="get"');
  expect(html).toContain('name="scope"');
  expect(html).toContain('value="all"');
  expect(html).toContain('name="q"');
  expect(html).toContain('value="retrieval"');
  expect(html).toContain('value="github" selected=""');
  expect(html).toContain('value="not_published" selected=""');
  expect(html).toContain('value="deep" selected=""');
  expect(html).toContain('value="ai, systems"');
});

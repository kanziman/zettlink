// 대시보드 카드 필터 조건을 검증합니다.
import { expect, test } from "vitest";

import type { CardSnapshot } from "../lib/board.js";
import { EMPTY_FILTER, filterRows, type FilterState } from "../lib/filter.js";
import type { DashboardCardRow } from "../lib/scan.js";

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

type SearchableRow = DashboardCardRow & { body?: string };

function snapshot(overrides: RowOverrides): CardSnapshot {
  const artifacts = {
    deep: { exists: false, published: false },
    til: { exists: false, published: false },
    guide: { exists: false, published: false },
    ...overrides.artifacts,
  };

  return {
    reviewed: overrides.reviewed ?? true,
    index_published: overrides.published ?? false,
    artifacts,
  };
}

function row(overrides: RowOverrides): SearchableRow {
  const rowSnapshot = snapshot(overrides);
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
      summary_one_line: overrides.summary ?? "",
      tags: overrides.tags ?? [],
      status: "summarized",
      reviewed: rowSnapshot.reviewed,
      published: rowSnapshot.index_published,
      note: "",
      generated: { deep: false, til: false, guide: false },
      llm: { model: "test-model", truncated: false },
    },
    dir: `/vault/${overrides.slug}`,
    snapshot: rowSnapshot,
    artifacts: rowSnapshot.artifacts,
    body: overrides.body,
  };
}

function slugs(rows: DashboardCardRow[]): string[] {
  return rows.map((item) => item.frontmatter.slug);
}

function filter(overrides: Partial<FilterState>): FilterState {
  return { ...EMPTY_FILTER, ...overrides };
}

test("exports the empty active filter state", () => {
  expect(EMPTY_FILTER).toEqual({
    scope: "active",
    q: "",
    platform: "all",
    tags: [],
    publish: "all",
    artifact: "all",
  });
});

test("active scope hides reviewed unpublished cards with no active column", () => {
  const rows = [
    row({ slug: "published", published: true }),
    row({ slug: "needs-review", reviewed: false }),
    row({ slug: "til-ready", artifacts: { til: { exists: true, published: false } } }),
    row({ slug: "deep-done", artifacts: { deep: { exists: true, published: false } } }),
    row({ slug: "reviewed-empty" }),
  ];

  expect(slugs(filterRows(rows, filter({ scope: "active" })))).toEqual([
    "published",
    "needs-review",
    "til-ready",
    "deep-done",
  ]);
});

test("all scope includes rows outside active columns", () => {
  const rows = [row({ slug: "active", reviewed: false }), row({ slug: "reviewed-empty" })];

  expect(slugs(filterRows(rows, filter({ scope: "all" })))).toEqual([
    "active",
    "reviewed-empty",
  ]);
});

test("search matches title, summary, tags, and body case-insensitively", () => {
  const rows = [
    row({ slug: "title", title: "Vector Stores" }),
    row({ slug: "summary", summary: "A note about retrieval pipelines" }),
    row({ slug: "tag", tags: ["Knowledge-Graph"] }),
    row({ slug: "body", body: "Embeddings live in the parsed index body." }),
    row({ slug: "miss", title: "Unrelated" }),
  ];

  expect(slugs(filterRows(rows, filter({ q: "vector", scope: "all" })))).toEqual([
    "title",
  ]);
  expect(slugs(filterRows(rows, filter({ q: "RETRIEVAL", scope: "all" })))).toEqual([
    "summary",
  ]);
  expect(
    slugs(filterRows(rows, filter({ q: "knowledge-graph", scope: "all" }))),
  ).toEqual(["tag"]);
  expect(
    slugs(filterRows(rows, filter({ q: "parsed index", scope: "all" }))),
  ).toEqual(["body"]);
  expect(slugs(filterRows(rows, filter({ q: "   ", scope: "all" })))).toEqual([
    "title",
    "summary",
    "tag",
    "body",
    "miss",
  ]);
});

test("filters by platform", () => {
  const rows = [
    row({ slug: "video", platform: "youtube" }),
    row({ slug: "repo", platform: "github" }),
  ];

  expect(slugs(filterRows(rows, filter({ platform: "github", scope: "all" })))).toEqual([
    "repo",
  ]);
});

test("requires every selected tag to exist on the card", () => {
  const rows = [
    row({ slug: "both", tags: ["ai", "systems"] }),
    row({ slug: "one", tags: ["ai"] }),
    row({ slug: "other", tags: ["systems", "notes"] }),
  ];

  expect(
    slugs(filterRows(rows, filter({ tags: ["ai", "systems"], scope: "all" }))),
  ).toEqual(["both"]);
});

test("filters by published and not-published board state", () => {
  const rows = [
    row({ slug: "index-published", published: true }),
    row({
      slug: "artifact-published",
      artifacts: { guide: { exists: true, published: true } },
    }),
    row({ slug: "draft", reviewed: false }),
  ];

  expect(slugs(filterRows(rows, filter({ publish: "published" })))).toEqual([
    "index-published",
    "artifact-published",
  ]);
  expect(slugs(filterRows(rows, filter({ publish: "not_published" })))).toEqual([
    "draft",
  ]);
});

test("filters by artifact existence", () => {
  const rows = [
    row({ slug: "deep", artifacts: { deep: { exists: true, published: false } } }),
    row({ slug: "til", artifacts: { til: { exists: true, published: false } } }),
    row({ slug: "guide", artifacts: { guide: { exists: true, published: false } } }),
    row({ slug: "none" }),
  ];

  expect(slugs(filterRows(rows, filter({ artifact: "deep" })))).toEqual(["deep"]);
  expect(slugs(filterRows(rows, filter({ artifact: "til" })))).toEqual(["til"]);
  expect(slugs(filterRows(rows, filter({ artifact: "guide", scope: "all" })))).toEqual([
    "guide",
  ]);
  expect(slugs(filterRows(rows, filter({ artifact: "none", scope: "all" })))).toEqual([
    "none",
  ]);
});

test("preserves input order among included rows", () => {
  const rows = [
    row({ slug: "first", tags: ["keep"] }),
    row({ slug: "second", tags: ["skip"] }),
    row({ slug: "third", tags: ["keep"] }),
  ];

  expect(slugs(filterRows(rows, filter({ tags: ["keep"], scope: "all" })))).toEqual([
    "first",
    "third",
  ]);
});

// 대시보드 페이지의 서버 렌더링 흐름을 검증합니다.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { serializeIndex, type IndexFrontmatter } from "@zettlink/core";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test } from "vitest";

import ReviewBoardPage from "../app/page";

const previousRepoLocalPath = process.env.REPO_LOCAL_PATH;

afterEach(() => {
  process.env.REPO_LOCAL_PATH = previousRepoLocalPath;
});

async function tempVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "zettlink-dashboard-page-"));
}

function indexFrontmatter(
  overrides: Partial<IndexFrontmatter> = {},
): IndexFrontmatter {
  return {
    url: "https://www.youtube.com/watch?v=abc123",
    platform: "youtube",
    slug: "example-card",
    captured_at: "2026-05-09T10:00:00.000Z",
    title: "Example card",
    summary_one_line: "A short summary.",
    tags: ["demo"],
    status: "summarized",
    reviewed: true,
    published: false,
    note: "",
    generated: { deep: false, til: false, guide: false },
    llm: { model: "test-model", truncated: false },
    youtube: {
      video_id: "abc123",
      channel: "Example",
      upload_date: "2026-05-01",
      duration_sec: 120,
      thumbnail: "https://example.com/thumb.jpg",
      subtitle_source: "manual",
    },
    ...overrides,
  };
}

async function writeCard(root: string, fm: IndexFrontmatter): Promise<void> {
  const dir = join(root, "sources", fm.platform, `${fm.captured_at.slice(0, 10)}-${fm.slug}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.md"), serializeIndex(fm, "Body"), "utf8");
}

test("scope=all renders filtered cards that have no active board column", async () => {
  const root = await tempVault();
  await writeCard(
    root,
    indexFrontmatter({
      slug: "needs-review",
      title: "Needs Review",
      reviewed: false,
    }),
  );
  await writeCard(
    root,
    indexFrontmatter({
      slug: "reviewed-without-artifacts",
      title: "Reviewed Without Artifacts",
      reviewed: true,
    }),
  );
  process.env.REPO_LOCAL_PATH = root;

  const page = await ReviewBoardPage({
    searchParams: Promise.resolve({ scope: "all" }),
  });
  const html = renderToStaticMarkup(page);

  expect(html).toContain("Needs review");
  expect(html).toContain("Reviewed Without Artifacts");
  expect(html).toContain("No active column");
  expect(html).toContain('href="/cards/reviewed-without-artifacts"');
});

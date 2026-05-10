// 카드 상세 페이지가 vault 카드 내용을 서버 렌더링하는지 검증합니다.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { serializeIndex, type IndexFrontmatter } from "@zettlink/core";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test } from "vitest";

import CardDetailPage from "../app/cards/[slug]/page";

const previousRepoLocalPath = process.env.REPO_LOCAL_PATH;

afterEach(() => {
  process.env.REPO_LOCAL_PATH = previousRepoLocalPath;
});

async function tempVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "zettlink-dashboard-detail-"));
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
    tags: ["demo", "ai"],
    status: "summarized",
    reviewed: false,
    published: false,
    note: "",
    generated: { deep: false, til: false, guide: false },
    llm: { model: "test-model", truncated: false },
    youtube: {
      video_id: "abc123",
      channel: "Example Channel",
      upload_date: "2026-05-01",
      duration_sec: 120,
      thumbnail: "https://example.com/thumb.jpg",
      subtitle_source: "manual",
    },
    ...overrides,
  };
}

async function writeCard(root: string, fm: IndexFrontmatter, body: string): Promise<string> {
  const dir = join(root, "sources", fm.platform, `${fm.captured_at.slice(0, 10)}-${fm.slug}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.md"), serializeIndex(fm, body), "utf8");
  return dir;
}

test("renders card summary, metadata, transcript, and Make Room link by slug", async () => {
  const root = await tempVault();
  const dir = await writeCard(
    root,
    indexFrontmatter(),
    "Summary body paragraph.\n\n## 인사이트\n- Strong insight from the body.\n",
  );
  await writeFile(join(dir, "transcript.md"), "Transcript body text.", "utf8");
  process.env.REPO_LOCAL_PATH = root;

  const page = await CardDetailPage({ params: Promise.resolve({ slug: "example-card" }) });
  const html = renderToStaticMarkup(page);

  expect(html).toContain('href="/"');
  expect(html).toContain("Example card");
  expect(html).toContain("A short summary.");
  expect(html).toContain("Summary body paragraph.");
  expect(html).toContain("Strong insight from the body.");
  expect(html).toContain("#demo");
  expect(html).toContain("Example Channel");
  expect(html).toContain('href="https://www.youtube.com/watch?v=abc123"');
  expect(html).toContain("Transcript body text.");
  expect(html).toContain('href="/cards/example-card/make"');
});

test("renders a clear configuration state when REPO_LOCAL_PATH is missing", async () => {
  delete process.env.REPO_LOCAL_PATH;

  const page = await CardDetailPage({ params: Promise.resolve({ slug: "example-card" }) });
  const html = renderToStaticMarkup(page);

  expect(html).toContain("REPO_LOCAL_PATH is not configured.");
});

test("renders a clear not-found state with a Review Board link when slug is missing", async () => {
  const root = await tempVault();
  await writeCard(root, indexFrontmatter({ slug: "existing-card" }), "Body");
  process.env.REPO_LOCAL_PATH = root;

  const page = await CardDetailPage({ params: Promise.resolve({ slug: "missing-card" }) });
  const html = renderToStaticMarkup(page);

  expect(html).toContain("Card not found");
  expect(html).toContain("missing-card");
  expect(html).toContain('href="/"');
  expect(html).toContain("Back to Review Board");
});

test("renders a clear scan error state with a Review Board link", async () => {
  const root = await tempVault();
  await mkdir(join(root, "sources"), { recursive: true });
  await writeFile(join(root, "sources", "youtube"), "not a directory", "utf8");
  process.env.REPO_LOCAL_PATH = root;

  const page = await CardDetailPage({ params: Promise.resolve({ slug: "example-card" }) });
  const html = renderToStaticMarkup(page);

  expect(html).toContain("Vault scan failed");
  expect(html).toContain("Back to Review Board");
  expect(html).toContain('href="/"');
});

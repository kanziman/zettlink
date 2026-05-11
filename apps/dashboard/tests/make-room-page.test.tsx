// Make Room 페이지가 산출물 상태별로 적절히 렌더링되는지 검증한다.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  serializeArtifact,
  serializeIndex,
  type ArtifactFrontmatter,
  type IndexFrontmatter,
} from "@zettlink/core";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, test } from "vitest";

import MakeRoomPage from "../app/cards/[slug]/make/page";

const previousRepoLocalPath = process.env.REPO_LOCAL_PATH;
afterEach(() => {
  process.env.REPO_LOCAL_PATH = previousRepoLocalPath;
});

async function tempVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "zettlink-make-room-"));
}

function indexFrontmatter(overrides: Partial<IndexFrontmatter> = {}): IndexFrontmatter {
  return {
    url: "https://www.youtube.com/watch?v=abc123",
    platform: "youtube",
    slug: "example-card",
    captured_at: "2026-05-09T10:00:00.000Z",
    title: "Example card",
    summary_one_line: "한 줄 요약.",
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

function artifactFrontmatter(overrides: Partial<ArtifactFrontmatter> = {}): ArtifactFrontmatter {
  return {
    generated_at: "2026-05-09T11:00:00.000Z",
    published: false,
    llm: { model: "test-model" },
    ...overrides,
  };
}

async function writeCard(root: string, fm: IndexFrontmatter, body = "Body") {
  const dir = join(root, "sources", fm.platform, `${fm.captured_at.slice(0, 10)}-${fm.slug}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.md"), serializeIndex(fm, body), "utf8");
  return dir;
}

test("renders generate slots for missing artifacts and a back link", async () => {
  const root = await tempVault();
  await writeCard(root, indexFrontmatter());
  process.env.REPO_LOCAL_PATH = root;

  const page = await MakeRoomPage({ params: Promise.resolve({ slug: "example-card" }) });
  const html = renderToStaticMarkup(page);

  expect(html).toContain("Make Room");
  expect(html).toContain("Example card");
  expect(html).toContain("한 줄 요약.");
  expect(html).toContain('href="/cards/example-card"');
  for (const kind of ["deep", "til", "guide"]) {
    expect(html).toContain(`data-kind="${kind}"`);
  }
});

test("renders existing artifact bodies and publish state", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  await writeFile(
    join(dir, "deep.md"),
    serializeArtifact(artifactFrontmatter({ published: true }), "심화 본문 텍스트.\n"),
    "utf8",
  );
  await writeFile(
    join(dir, "til.md"),
    serializeArtifact(artifactFrontmatter({ published: false }), "TIL 본문 텍스트.\n"),
    "utf8",
  );
  process.env.REPO_LOCAL_PATH = root;

  const page = await MakeRoomPage({ params: Promise.resolve({ slug: "example-card" }) });
  const html = renderToStaticMarkup(page);

  expect(html).toContain("심화 본문 텍스트.");
  expect(html).toContain("TIL 본문 텍스트.");
  expect(html).toMatch(/data-kind="deep"[\s\S]*?data-published="true"/);
  expect(html).toMatch(/data-kind="til"[\s\S]*?data-published="false"/);
});

test("returns a not-found state when slug does not match", async () => {
  const root = await tempVault();
  await writeCard(root, indexFrontmatter({ slug: "other" }));
  process.env.REPO_LOCAL_PATH = root;

  const page = await MakeRoomPage({ params: Promise.resolve({ slug: "missing" }) });
  const html = renderToStaticMarkup(page);

  expect(html).toContain("not found");
  expect(html).toContain('href="/"');
});

test("returns a configuration state when REPO_LOCAL_PATH is missing", async () => {
  delete process.env.REPO_LOCAL_PATH;

  const page = await MakeRoomPage({ params: Promise.resolve({ slug: "anything" }) });
  const html = renderToStaticMarkup(page);

  expect(html).toMatch(/REPO_LOCAL_PATH/);
});

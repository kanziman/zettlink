// 대시보드 쓰기 API 라우트의 vault 변경과 경로 검증을 테스트합니다.
import { mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseIndex, serializeIndex, type IndexFrontmatter } from "@zettlink/core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  commitAndPushWithRetry: vi.fn(async () => undefined),
  openRepo: vi.fn((path: string) => ({ path })),
}));

vi.mock("@zettlink/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@zettlink/core")>();
  return {
    ...actual,
    commitAndPushWithRetry: coreMocks.commitAndPushWithRetry,
    openRepo: coreMocks.openRepo,
  };
});

const previousRepoLocalPath = process.env.REPO_LOCAL_PATH;

beforeEach(() => {
  vi.resetModules();
  coreMocks.commitAndPushWithRetry.mockClear();
  coreMocks.openRepo.mockClear();
});

afterEach(() => {
  process.env.REPO_LOCAL_PATH = previousRepoLocalPath;
});

async function tempVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "zettlink-dashboard-api-"));
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
    reviewed: false,
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

async function writeCard(root: string, fm: IndexFrontmatter, body = "Summary body\n") {
  const dir = join(root, "sources", fm.platform, `${fm.captured_at.slice(0, 10)}-${fm.slug}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.md"), serializeIndex(fm, body), "utf8");
  return dir;
}

function postRequest(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("reviewed route rejects card directories outside REPO_LOCAL_PATH", async () => {
  const root = await tempVault();
  const outside = await tempVault();
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/reviewed/route");

  const response = await POST(postRequest("/api/reviewed", { dir: outside, value: true }));
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error).toMatch(/inside REPO_LOCAL_PATH/i);
  expect(coreMocks.commitAndPushWithRetry).not.toHaveBeenCalled();
});

test("reviewed route rejects symlinked card directories that escape REPO_LOCAL_PATH", async () => {
  const root = await tempVault();
  const outside = await tempVault();
  const outsideDir = await writeCard(outside, indexFrontmatter({ slug: "outside-card" }));
  const linkDir = join(root, "sources", "youtube", "linked-card");
  await mkdir(join(root, "sources", "youtube"), { recursive: true });
  await symlink(outsideDir, linkDir);
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/reviewed/route");

  const response = await POST(postRequest("/api/reviewed", { dir: linkDir, value: true }));
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error).toMatch(/inside REPO_LOCAL_PATH/i);
  expect(coreMocks.commitAndPushWithRetry).not.toHaveBeenCalled();
});

test("reviewed route toggles index frontmatter and preserves body", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ reviewed: false }), "Body text\n");
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/reviewed/route");

  const response = await POST(postRequest("/api/reviewed", { dir, value: true }));
  const payload = await response.json();
  const updated = parseIndex(await readFile(join(dir, "index.md"), "utf8"));
  const expectedRoot = await realpath(root);
  const expectedIndex = await realpath(join(dir, "index.md"));

  expect(response.status).toBe(200);
  expect(payload).toEqual({ ok: true, reviewed: true });
  expect(updated.frontmatter.reviewed).toBe(true);
  expect(updated.body).toBe("Body text\n");
  expect(coreMocks.openRepo).toHaveBeenCalledWith(expectedRoot);
  expect(coreMocks.commitAndPushWithRetry).toHaveBeenCalledWith(
    { path: expectedRoot },
    [expectedIndex],
    expect.stringContaining("reviewed=true"),
    expect.objectContaining({ delayMs: 0 }),
  );
});

test("publish route toggles summary published frontmatter and preserves body", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ published: false }), "Summary\n\nDetails\n");
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/publish/route");

  const response = await POST(postRequest("/api/publish", { dir, target: "index", value: true }));
  const payload = await response.json();
  const updated = parseIndex(await readFile(join(dir, "index.md"), "utf8"));
  const expectedRoot = await realpath(root);
  const expectedIndex = await realpath(join(dir, "index.md"));

  expect(response.status).toBe(200);
  expect(payload).toEqual({ ok: true, target: "index", published: true });
  expect(updated.frontmatter.published).toBe(true);
  expect(updated.body).toBe("Summary\n\nDetails\n");
  expect(coreMocks.commitAndPushWithRetry).toHaveBeenCalledWith(
    { path: expectedRoot },
    [expectedIndex],
    expect.stringContaining("publish index=true"),
    expect.objectContaining({ delayMs: 0 }),
  );
});

test("publish route rejects unsupported targets with a clear error", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/publish/route");

  const response = await POST(postRequest("/api/publish", { dir, target: "deep", value: true }));
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error).toMatch(/target/i);
  expect(coreMocks.commitAndPushWithRetry).not.toHaveBeenCalled();
});

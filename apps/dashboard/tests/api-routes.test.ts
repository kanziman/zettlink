// 대시보드 쓰기 API 라우트의 vault 변경과 경로 검증을 테스트합니다.
import { mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parseIndex, serializeIndex, type IndexFrontmatter } from "@zettlink/core";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const coreMocks = vi.hoisted(() => ({
  git: {
    add: vi.fn(async () => undefined),
    commit: vi.fn(async () => undefined),
    push: vi.fn(async () => undefined),
  },
  openRepo: vi.fn((_path: string) => ({
    add: coreMocks.git.add,
    commit: coreMocks.git.commit,
    push: coreMocks.git.push,
  })),
}));

vi.mock("@zettlink/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@zettlink/core")>();
  return {
    ...actual,
    openRepo: coreMocks.openRepo,
  };
});

const previousRepoLocalPath = process.env.REPO_LOCAL_PATH;

beforeEach(() => {
  vi.resetModules();
  coreMocks.openRepo.mockClear();
  coreMocks.git.add.mockClear();
  coreMocks.git.add.mockResolvedValue(undefined);
  coreMocks.git.commit.mockClear();
  coreMocks.git.commit.mockResolvedValue(undefined);
  coreMocks.git.push.mockClear();
  coreMocks.git.push.mockResolvedValue(undefined);
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
  expect(payload.error).not.toContain(outside);
  expect(coreMocks.git.add).not.toHaveBeenCalled();
});

test("reviewed route rejects raw path traversal with a client-safe error", async () => {
  const root = await tempVault();
  const outside = await tempVault();
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/reviewed/route");

  const response = await POST(
    postRequest("/api/reviewed", { dir: join(root, "..", outside.split("/").pop()!), value: true }),
  );
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error).toBe("dir must be inside REPO_LOCAL_PATH.");
  expect(JSON.stringify(payload)).not.toContain(outside);
  expect(coreMocks.git.add).not.toHaveBeenCalled();
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
  expect(coreMocks.git.add).not.toHaveBeenCalled();
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
  expect(payload).toEqual({ ok: true, reviewed: true, pushed: true });
  expect(updated.frontmatter.reviewed).toBe(true);
  expect(updated.body).toBe("Body text\n");
  expect(coreMocks.openRepo).toHaveBeenCalledWith(expectedRoot);
  expect(coreMocks.git.add).toHaveBeenCalledWith([expectedIndex]);
  expect(coreMocks.git.commit).toHaveBeenCalledWith(expect.stringContaining("reviewed=true"));
  expect(coreMocks.git.push).toHaveBeenCalledTimes(1);
});

test("reviewed route keeps committed file state when push fails after commit", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ reviewed: false }), "Body text\n");
  const indexPath = join(dir, "index.md");
  coreMocks.git.push.mockRejectedValue(new Error(`fatal: cannot push ${indexPath}`));
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/reviewed/route");

  const response = await POST(postRequest("/api/reviewed", { dir, value: true }));
  const payload = await response.json();
  const after = await readFile(indexPath, "utf8");

  expect(response.status).toBe(200);
  expect(payload).toEqual({
    ok: true,
    reviewed: true,
    pushed: false,
    warning: "Saved locally, but push failed.",
  });
  expect(coreMocks.git.commit).toHaveBeenCalledTimes(1);
  expect(coreMocks.git.push).toHaveBeenCalledTimes(3);
  expect(parseIndex(after).frontmatter.reviewed).toBe(true);
});

test("reviewed route rolls back index.md when git commit fails before a commit is created", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ reviewed: false }), "Body text\n");
  const indexPath = join(dir, "index.md");
  const original = await readFile(indexPath, "utf8");
  coreMocks.git.commit.mockRejectedValueOnce(new Error(`fatal: cannot commit ${indexPath}`));
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/reviewed/route");

  const response = await POST(postRequest("/api/reviewed", { dir, value: true }));
  const payload = await response.json();
  const after = await readFile(indexPath, "utf8");

  expect(response.status).toBe(500);
  expect(payload.error).toBe("Unable to update reviewed state.");
  expect(JSON.stringify(payload)).not.toContain(indexPath);
  expect(after).toBe(original);
  expect(parseIndex(after).frontmatter.reviewed).toBe(false);
  expect(coreMocks.git.push).not.toHaveBeenCalled();
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
  expect(payload).toEqual({ ok: true, target: "index", published: true, pushed: true });
  expect(updated.frontmatter.published).toBe(true);
  expect(updated.body).toBe("Summary\n\nDetails\n");
  expect(coreMocks.openRepo).toHaveBeenCalledWith(expectedRoot);
  expect(coreMocks.git.add).toHaveBeenCalledWith([expectedIndex]);
  expect(coreMocks.git.commit).toHaveBeenCalledWith(expect.stringContaining("publish index=true"));
  expect(coreMocks.git.push).toHaveBeenCalledTimes(1);
});

test("publish route keeps committed file state when push fails after commit", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ published: false }), "Summary\n\nDetails\n");
  const indexPath = join(dir, "index.md");
  coreMocks.git.push.mockRejectedValue(new Error(`fatal: cannot push ${indexPath}`));
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/publish/route");

  const response = await POST(postRequest("/api/publish", { dir, target: "index", value: true }));
  const payload = await response.json();
  const after = await readFile(indexPath, "utf8");

  expect(response.status).toBe(200);
  expect(payload).toEqual({
    ok: true,
    target: "index",
    published: true,
    pushed: false,
    warning: "Saved locally, but push failed.",
  });
  expect(coreMocks.git.commit).toHaveBeenCalledTimes(1);
  expect(coreMocks.git.push).toHaveBeenCalledTimes(3);
  expect(parseIndex(after).frontmatter.published).toBe(true);
});

test("publish route rolls back index.md when git commit fails before a commit is created", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ published: false }), "Summary\n\nDetails\n");
  const indexPath = join(dir, "index.md");
  const original = await readFile(indexPath, "utf8");
  coreMocks.git.commit.mockRejectedValueOnce(new Error(`fatal: cannot commit ${indexPath}`));
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/publish/route");

  const response = await POST(postRequest("/api/publish", { dir, target: "index", value: true }));
  const payload = await response.json();
  const after = await readFile(indexPath, "utf8");

  expect(response.status).toBe(500);
  expect(payload.error).toBe("Unable to update publish state.");
  expect(JSON.stringify(payload)).not.toContain(indexPath);
  expect(after).toBe(original);
  expect(parseIndex(after).frontmatter.published).toBe(false);
  expect(coreMocks.git.push).not.toHaveBeenCalled();
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
  expect(coreMocks.git.add).not.toHaveBeenCalled();
});

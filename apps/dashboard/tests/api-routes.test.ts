// 대시보드 쓰기 API 라우트의 vault 변경과 경로 검증을 테스트합니다.
import { mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseArtifact,
  parseIndex,
  serializeArtifact,
  serializeIndex,
  type ArtifactFrontmatter,
  type IndexFrontmatter,
} from "@zettlink/core";
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
  runArtifact: vi.fn(
    async (_client: unknown, _input: { kind: string; transcript: string; modelId: string }) =>
      "## 생성된 본문\n내용",
  ),
}));

vi.mock("@zettlink/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@zettlink/core")>();
  return {
    ...actual,
    openRepo: coreMocks.openRepo,
    runArtifact: coreMocks.runArtifact,
  };
});

const previousRepoLocalPath = process.env.REPO_LOCAL_PATH;

const previousLlmKey = process.env.OPENROUTER_API_KEY;
const previousLlmModel = process.env.OPENROUTER_MODEL;

beforeEach(() => {
  vi.resetModules();
  coreMocks.openRepo.mockClear();
  coreMocks.git.add.mockClear();
  coreMocks.git.add.mockResolvedValue(undefined);
  coreMocks.git.commit.mockClear();
  coreMocks.git.commit.mockResolvedValue(undefined);
  coreMocks.git.push.mockClear();
  coreMocks.git.push.mockResolvedValue(undefined);
  coreMocks.runArtifact.mockClear();
  coreMocks.runArtifact.mockResolvedValue("## 생성된 본문\n내용");
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "anthropic/claude-sonnet-4.6";
});

afterEach(() => {
  process.env.REPO_LOCAL_PATH = previousRepoLocalPath;
  process.env.OPENROUTER_API_KEY = previousLlmKey;
  process.env.OPENROUTER_MODEL = previousLlmModel;
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

  const response = await POST(postRequest("/api/publish", { dir, target: "summary", value: true }));
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error).toMatch(/target/i);
  expect(coreMocks.git.add).not.toHaveBeenCalled();
});

function artifactFrontmatter(
  overrides: Partial<ArtifactFrontmatter> = {},
): ArtifactFrontmatter {
  return {
    generated_at: "2026-05-09T11:00:00.000Z",
    published: false,
    llm: { model: "test-model" },
    ...overrides,
  };
}

async function writeArtifact(
  dir: string,
  kind: "deep" | "til" | "guide",
  fm: ArtifactFrontmatter,
  body = "Artifact body\n",
): Promise<string> {
  const path = join(dir, `${kind}.md`);
  await writeFile(path, serializeArtifact(fm, body), "utf8");
  return path;
}

test.each(["deep", "til", "guide"] as const)(
  "publish route toggles %s artifact published frontmatter and preserves body",
  async (kind) => {
    const root = await tempVault();
    const dir = await writeCard(root, indexFrontmatter());
    await writeArtifact(dir, kind, artifactFrontmatter({ published: false }), "Body\n");
    process.env.REPO_LOCAL_PATH = root;
    const { POST } = await import("../app/api/publish/route");

    const response = await POST(postRequest("/api/publish", { dir, target: kind, value: true }));
    const payload = await response.json();
    const updated = parseArtifact(await readFile(join(dir, `${kind}.md`), "utf8"));
    const expectedArtifact = await realpath(join(dir, `${kind}.md`));

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, target: kind, published: true, pushed: true });
    expect(updated.frontmatter.published).toBe(true);
    expect(updated.body).toBe("Body\n");
    expect(coreMocks.git.add).toHaveBeenCalledWith([expectedArtifact]);
    expect(coreMocks.git.commit).toHaveBeenCalledWith(
      expect.stringContaining(`publish ${kind}=true`),
    );
    expect(coreMocks.git.push).toHaveBeenCalledTimes(1);
  },
);

test("publish route returns 404 when the artifact file does not exist", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/publish/route");

  const response = await POST(postRequest("/api/publish", { dir, target: "deep", value: true }));
  const payload = await response.json();

  expect(response.status).toBe(404);
  expect(payload.error).toMatch(/deep/i);
  expect(coreMocks.git.add).not.toHaveBeenCalled();
});

test("publish route rolls back artifact file when commit fails", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  await writeArtifact(dir, "deep", artifactFrontmatter({ published: false }), "Body\n");
  const artifactPath = join(dir, "deep.md");
  const original = await readFile(artifactPath, "utf8");
  coreMocks.git.commit.mockRejectedValueOnce(new Error("fatal: commit failed"));
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/publish/route");

  const response = await POST(postRequest("/api/publish", { dir, target: "deep", value: true }));
  const after = await readFile(artifactPath, "utf8");

  expect(response.status).toBe(500);
  expect(after).toBe(original);
  expect(parseArtifact(after).frontmatter.published).toBe(false);
  expect(coreMocks.git.push).not.toHaveBeenCalled();
});

test("generate route creates a new artifact and commits it", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  await writeFile(join(dir, "transcript.md"), "Transcript body.", "utf8");
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/generate/route");

  const response = await POST(postRequest("/api/generate", { dir, kind: "deep" }));
  const payload = await response.json();
  const written = await readFile(join(dir, "deep.md"), "utf8");
  const parsed = parseArtifact(written);

  expect(response.status).toBe(200);
  expect(payload).toEqual({ ok: true, kind: "deep", created: true, pushed: true });
  expect(parsed.frontmatter.published).toBe(false);
  expect(parsed.frontmatter.llm.model).toBe("anthropic/claude-sonnet-4.6");
  expect(parsed.body).toBe("## 생성된 본문\n내용\n");
  expect(coreMocks.runArtifact).toHaveBeenCalledOnce();
  const [, callArgs] = coreMocks.runArtifact.mock.calls[0]!;
  expect(callArgs).toMatchObject({ kind: "deep", transcript: "Transcript body." });
  expect(coreMocks.git.commit).toHaveBeenCalledWith(expect.stringContaining("add deep"));
  expect(coreMocks.git.push).toHaveBeenCalledTimes(1);
});

test("generate route reuses extract.md when transcript.md is missing", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ platform: "github" }));
  await writeFile(join(dir, "extract.md"), "GitHub extract body.", "utf8");
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/generate/route");

  const response = await POST(postRequest("/api/generate", { dir, kind: "til" }));
  expect(response.status).toBe(200);
  const [, callArgs] = coreMocks.runArtifact.mock.calls[0]!;
  expect(callArgs).toMatchObject({ kind: "til", transcript: "GitHub extract body." });
});

test("generate route returns 409 when the artifact already exists", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  await writeFile(join(dir, "transcript.md"), "Transcript body.", "utf8");
  await writeArtifact(dir, "guide", artifactFrontmatter(), "Existing body\n");
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/generate/route");

  const response = await POST(postRequest("/api/generate", { dir, kind: "guide" }));
  const payload = await response.json();

  expect(response.status).toBe(409);
  expect(payload.error).toMatch(/exists/i);
  expect(coreMocks.runArtifact).not.toHaveBeenCalled();
});

test("generate route does not create a partial file when LLM fails", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  await writeFile(join(dir, "transcript.md"), "Transcript body.", "utf8");
  coreMocks.runArtifact.mockRejectedValueOnce(new Error("LLM down"));
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/generate/route");

  const response = await POST(postRequest("/api/generate", { dir, kind: "deep" }));
  const payload = await response.json();

  expect(response.status).toBe(502);
  expect(payload.error).toMatch(/deep/i);
  await expect(readFile(join(dir, "deep.md"), "utf8")).rejects.toThrow();
  expect(coreMocks.git.add).not.toHaveBeenCalled();
});

test("generate route rejects directories outside REPO_LOCAL_PATH", async () => {
  const root = await tempVault();
  const outside = await tempVault();
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/generate/route");

  const response = await POST(postRequest("/api/generate", { dir: outside, kind: "deep" }));
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error).toMatch(/inside REPO_LOCAL_PATH/i);
  expect(coreMocks.runArtifact).not.toHaveBeenCalled();
});

test("generate route rejects unsupported kinds", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  await writeFile(join(dir, "transcript.md"), "Body", "utf8");
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/generate/route");

  const response = await POST(postRequest("/api/generate", { dir, kind: "summary" }));
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error).toMatch(/kind/i);
  expect(coreMocks.runArtifact).not.toHaveBeenCalled();
});

test("generate route returns 422 when neither transcript.md nor extract.md exists", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/generate/route");

  const response = await POST(postRequest("/api/generate", { dir, kind: "deep" }));
  const payload = await response.json();

  expect(response.status).toBe(422);
  expect(payload.error).toMatch(/source/i);
  expect(coreMocks.runArtifact).not.toHaveBeenCalled();
});

test("generate route warns on push failure but keeps the file", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  await writeFile(join(dir, "transcript.md"), "Transcript body.", "utf8");
  coreMocks.git.push.mockRejectedValue(new Error("push down"));
  process.env.REPO_LOCAL_PATH = root;
  const { POST } = await import("../app/api/generate/route");

  const response = await POST(postRequest("/api/generate", { dir, kind: "deep" }));
  const payload = await response.json();
  const written = await readFile(join(dir, "deep.md"), "utf8");

  expect(response.status).toBe(200);
  expect(payload).toEqual({
    ok: true,
    kind: "deep",
    created: true,
    pushed: false,
    warning: "Saved locally, but push failed.",
  });
  expect(parseArtifact(written).frontmatter.published).toBe(false);
  expect(coreMocks.git.push).toHaveBeenCalledTimes(3);
});

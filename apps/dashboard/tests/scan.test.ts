// 대시보드 파일 스캔 동작을 임시 vault 로 검증합니다.
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { tmpdir } from "node:os";

import {
  serializeArtifact,
  serializeIndex,
  type ArtifactFrontmatter,
  type IndexFrontmatter,
} from "@zettlink/core";
import { expect, test } from "vitest";

import { computeColumn } from "../lib/board.js";
import { readArtifactStatus, scanDashboardCards } from "../lib/scan.js";

async function tempVault(): Promise<string> {
  return mkdtemp(join(tmpdir(), "zettlink-dashboard-scan-"));
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

async function writeCard(
  root: string,
  fm: IndexFrontmatter,
): Promise<string> {
  const dir = join(root, "sources", fm.platform, `${fm.captured_at.slice(0, 10)}-${fm.slug}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.md"), serializeIndex(fm, "Body"), "utf8");
  return dir;
}

async function writeArtifact(
  dir: string,
  kind: "deep" | "til" | "guide",
  fm: ArtifactFrontmatter,
): Promise<void> {
  await writeFile(join(dir, `${kind}.md`), serializeArtifact(fm, "Artifact body"), "utf8");
}

test("returns an empty list when there are no sources", async () => {
  await expect(scanDashboardCards(await tempVault())).resolves.toEqual([]);
});

test("scans index card body and artifact published flags", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ slug: "with-artifacts" }));
  await writeArtifact(dir, "deep", artifactFrontmatter({ published: true }));
  await writeArtifact(dir, "til", artifactFrontmatter({ published: false }));

  const rows = await scanDashboardCards(root);

  expect(rows).toHaveLength(1);
  expect(rows[0]?.frontmatter.slug).toBe("with-artifacts");
  expect(rows[0]?.body).toBe("Body\n");
  expect(rows[0]?.dir).toBe(dir);
  expect(rows[0]?.artifacts).toEqual({
    deep: { exists: true, published: true },
    til: { exists: true, published: false },
    guide: { exists: false, published: false },
  });
  expect(rows[0]?.snapshot.artifacts).toEqual(rows[0]?.artifacts);
});

test("treats malformed artifact files as existing but unpublished", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter());
  await writeFile(join(dir, "guide.md"), "---\npublished: yes\n---\nBad", "utf8");

  await expect(readArtifactStatus(dir, "guide")).resolves.toEqual({
    exists: true,
    published: false,
  });
  await expect(scanDashboardCards(root)).resolves.toMatchObject([
    {
      artifacts: {
        guide: { exists: true, published: false },
      },
    },
  ]);
});

test("maps snapshot fields for board column computation", async () => {
  const root = await tempVault();
  const dir = await writeCard(
    root,
    indexFrontmatter({ reviewed: false, published: false }),
  );
  await writeArtifact(dir, "til", artifactFrontmatter({ published: false }));

  const [row] = await scanDashboardCards(root);

  expect(row?.snapshot).toEqual({
    reviewed: false,
    index_published: false,
    artifacts: {
      deep: { exists: false, published: false },
      til: { exists: true, published: false },
      guide: { exists: false, published: false },
    },
  });
  expect(computeColumn(row!.snapshot)).toBe("Needs review");
});

test("scans index cards missing reviewed as unreviewed", async () => {
  const root = await tempVault();
  const dir = await writeCard(root, indexFrontmatter({ reviewed: false }));
  const indexPath = join(dir, "index.md");
  const markdown = serializeIndex(indexFrontmatter({ reviewed: false }), "Body").replace(
    /^reviewed: false\n/m,
    "",
  );
  await writeFile(indexPath, markdown, "utf8");

  const rows = await scanDashboardCards(root);

  expect(rows).toHaveLength(1);
  expect(rows[0]?.snapshot.reviewed).toBe(false);
  expect(computeColumn(rows[0]!.snapshot)).toBe("Needs review");
});

test("returns absolute dirs when scanning from a relative root", async () => {
  const root = await tempVault();
  const expectedDir = await writeCard(root, indexFrontmatter({ slug: "relative-root" }));
  const relativeRoot = relative(dirname(root), root);

  const previousCwd = process.cwd();
  process.chdir(dirname(root));
  try {
    const rows = await scanDashboardCards(relativeRoot || basename(root));

    expect(rows[0]?.dir).toBeDefined();
    expect(isAbsolute(rows[0]!.dir)).toBe(true);
    expect(rows[0]!.dir.endsWith(relative(dirname(root), expectedDir))).toBe(true);
  } finally {
    process.chdir(previousCwd);
  }
});

test("sorts rows newest first by captured_at", async () => {
  const root = await tempVault();
  await writeCard(
    root,
    indexFrontmatter({
      slug: "old",
      captured_at: "2026-05-08T10:00:00.000Z",
    }),
  );
  await writeCard(
    root,
    indexFrontmatter({
      slug: "new",
      captured_at: "2026-05-10T10:00:00.000Z",
    }),
  );
  await writeCard(
    root,
    indexFrontmatter({
      slug: "middle",
      captured_at: "2026-05-09T10:00:00.000Z",
    }),
  );

  const rows = await scanDashboardCards(root);

  expect(rows.map((row) => row.frontmatter.slug)).toEqual(["new", "middle", "old"]);
});

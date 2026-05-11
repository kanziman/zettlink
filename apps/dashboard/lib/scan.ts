// vault 파일을 읽어 대시보드 카드 행과 malformed 에러 목록으로 변환합니다.
import { existsSync } from "node:fs";
import { access, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  parseArtifact,
  parseIndex,
  type IndexFrontmatter,
} from "@zettlink/core";

import type { ArtifactSnapshot, CardSnapshot } from "./board";

export type ArtifactKind = "deep" | "til" | "guide";

export type DashboardCardRow = {
  frontmatter: IndexFrontmatter;
  body: string;
  dir: string;
  snapshot: CardSnapshot;
  artifacts: CardSnapshot["artifacts"];
};

export type DashboardCardError = {
  dir: string;
  platform: string;
  folder: string;
  message: string;
};

export async function readArtifactStatus(
  dir: string,
  kind: ArtifactKind,
): Promise<ArtifactSnapshot> {
  const path = join(dir, `${kind}.md`);

  try {
    await access(path);
  } catch {
    return { exists: false, published: false };
  }

  try {
    const markdown = await readFile(path, "utf8");
    const { frontmatter } = parseArtifact(markdown);
    return { exists: true, published: frontmatter.published };
  } catch {
    return { exists: true, published: false };
  }
}

export async function scanDashboardCards(root: string): Promise<DashboardCardRow[]> {
  const { rows } = await scanDashboardWithErrors(root);
  return rows;
}

export async function scanDashboardWithErrors(
  root: string,
): Promise<{ rows: DashboardCardRow[]; errors: DashboardCardError[] }> {
  const absoluteRoot = resolve(root);
  const sourcesDir = join(absoluteRoot, "sources");
  if (!existsSync(sourcesDir)) {
    return { rows: [], errors: [] };
  }

  const rows: DashboardCardRow[] = [];
  const errors: DashboardCardError[] = [];

  const platforms = await readdir(sourcesDir);
  for (const platform of platforms) {
    const platformDir = join(sourcesDir, platform);
    const folders = await readdir(platformDir);
    for (const folder of folders) {
      const dir = join(platformDir, folder);
      const indexPath = join(dir, "index.md");
      if (!existsSync(indexPath)) continue;

      let markdown: string;
      try {
        markdown = await readFile(indexPath, "utf8");
      } catch (error) {
        errors.push({
          dir,
          platform,
          folder,
          message: error instanceof Error ? error.message : "Unable to read index.md.",
        });
        continue;
      }

      let parsed: { frontmatter: IndexFrontmatter; body: string };
      try {
        parsed = parseIndex(markdown);
      } catch (error) {
        errors.push({
          dir,
          platform,
          folder,
          message: error instanceof Error ? error.message : "Malformed frontmatter.",
        });
        continue;
      }

      const [deep, til, guide] = await Promise.all([
        readArtifactStatus(dir, "deep"),
        readArtifactStatus(dir, "til"),
        readArtifactStatus(dir, "guide"),
      ]);
      const artifacts = { deep, til, guide };
      const snapshot: CardSnapshot = {
        reviewed: parsed.frontmatter.reviewed ?? false,
        index_published: parsed.frontmatter.published,
        artifacts,
      };

      rows.push({ frontmatter: parsed.frontmatter, body: parsed.body, dir, snapshot, artifacts });
    }
  }

  rows.sort((a, b) => {
    const capturedOrder =
      Date.parse(b.frontmatter.captured_at) - Date.parse(a.frontmatter.captured_at);
    if (capturedOrder !== 0) return capturedOrder;
    return a.dir.localeCompare(b.dir);
  });
  errors.sort((a, b) => a.dir.localeCompare(b.dir));

  return { rows, errors };
}

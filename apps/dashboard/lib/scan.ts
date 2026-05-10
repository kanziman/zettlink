// vault 파일을 읽어 대시보드 카드 행으로 변환합니다.
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  listCards,
  parseArtifact,
  type IndexFrontmatter,
} from "@zettlink/core";

import type { ArtifactSnapshot, CardSnapshot } from "./board.js";

export type ArtifactKind = "deep" | "til" | "guide";

export type DashboardCardRow = {
  frontmatter: IndexFrontmatter;
  dir: string;
  snapshot: CardSnapshot;
  artifacts: CardSnapshot["artifacts"];
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
  const cards = await listCards(root);
  const rows = await Promise.all(
    cards.map(async ({ frontmatter, dir }) => {
      const [deep, til, guide] = await Promise.all([
        readArtifactStatus(dir, "deep"),
        readArtifactStatus(dir, "til"),
        readArtifactStatus(dir, "guide"),
      ]);
      const artifacts = { deep, til, guide };
      const snapshot: CardSnapshot = {
        reviewed: frontmatter.reviewed ?? false,
        index_published: frontmatter.published,
        artifacts,
      };

      return { frontmatter, dir, snapshot, artifacts };
    }),
  );

  return rows.sort((a, b) => {
    const capturedOrder =
      Date.parse(b.frontmatter.captured_at) - Date.parse(a.frontmatter.captured_at);
    if (capturedOrder !== 0) return capturedOrder;
    return a.dir.localeCompare(b.dir);
  });
}

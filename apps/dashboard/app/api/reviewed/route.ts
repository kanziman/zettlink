// 카드 요약본의 reviewed frontmatter 를 갱신하고 vault 저장소에 반영합니다.
import { readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  commitAndPushWithRetry,
  openRepo,
  parseIndex,
  serializeIndex,
} from "@zettlink/core";
import { NextResponse } from "next/server";

type ReviewedRequest = {
  dir?: unknown;
  value?: unknown;
};

export async function POST(request: Request) {
  try {
    const root = process.env.REPO_LOCAL_PATH;
    if (!root) {
      return jsonError("REPO_LOCAL_PATH is not configured.", 500);
    }

    const payload = (await request.json()) as ReviewedRequest;
    if (typeof payload.dir !== "string" || typeof payload.value !== "boolean") {
      return jsonError("Expected JSON body { dir: string, value: boolean }.", 400);
    }

    const rootDir = await realpath(resolve(root));
    const dir = await realpath(resolve(payload.dir));
    if (!isInside(rootDir, dir)) {
      return jsonError("dir must be inside REPO_LOCAL_PATH.", 400);
    }

    const indexPath = join(dir, "index.md");
    const realIndexPath = await realpath(indexPath);
    if (!isInside(rootDir, realIndexPath)) {
      return jsonError("dir must be inside REPO_LOCAL_PATH.", 400);
    }

    const markdown = await readFile(realIndexPath, "utf8");
    const { frontmatter, body } = parseIndex(markdown);
    const nextFrontmatter = { ...frontmatter, reviewed: payload.value };

    await writeFile(realIndexPath, serializeIndex(nextFrontmatter, body), "utf8");
    await commitAndPushWithRetry(
      openRepo(rootDir),
      [realIndexPath],
      `set reviewed=${payload.value} ${frontmatter.slug}`,
      { delayMs: process.env.NODE_ENV === "test" ? 0 : undefined },
    );

    return NextResponse.json({ ok: true, reviewed: payload.value });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to update reviewed state.", 500);
  }
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

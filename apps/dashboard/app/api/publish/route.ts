// 카드 요약본의 published frontmatter 를 갱신하고 vault 저장소에 반영합니다.
import { readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  openRepo,
  parseIndex,
  serializeIndex,
} from "@zettlink/core";
import { NextResponse } from "next/server";

type PublishRequest = {
  dir?: unknown;
  target?: unknown;
  value?: unknown;
};

class ClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  try {
    const root = process.env.REPO_LOCAL_PATH;
    if (!root) {
      return jsonError("Unable to update publish state.", 500);
    }

    const payload = (await request.json()) as PublishRequest;
    if (
      typeof payload.dir !== "string" ||
      typeof payload.target !== "string" ||
      typeof payload.value !== "boolean"
    ) {
      throw new ClientError("Expected JSON body { dir: string, target: string, value: boolean }.", 400);
    }
    if (payload.target !== "index") {
      throw new ClientError("Unsupported publish target. Supported target: index.", 400);
    }

    const rootDir = await realpath(resolve(root));
    const dir = await safeRealpath(payload.dir, "dir must be inside REPO_LOCAL_PATH.");
    if (!isInside(rootDir, dir)) {
      throw new ClientError("dir must be inside REPO_LOCAL_PATH.", 400);
    }

    const indexPath = join(dir, "index.md");
    const realIndexPath = await safeRealpath(indexPath, "dir must be inside REPO_LOCAL_PATH.");
    if (!isInside(rootDir, realIndexPath)) {
      throw new ClientError("dir must be inside REPO_LOCAL_PATH.", 400);
    }

    const originalMarkdown = await readFile(realIndexPath, "utf8");
    const { frontmatter, body } = parseIndex(originalMarkdown);
    const nextFrontmatter = { ...frontmatter, published: payload.value };

    await writeFile(realIndexPath, serializeIndex(nextFrontmatter, body), "utf8");
    const git = openRepo(rootDir);
    try {
      await git.add([realIndexPath]);
      await git.commit(`publish index=${payload.value} ${frontmatter.slug}`);
    } catch {
      await rollbackFile(realIndexPath, originalMarkdown);
      return jsonError("Unable to update publish state.", 500);
    }

    const pushed = await pushWithRetry(git);
    if (!pushed) {
      return NextResponse.json({
        ok: true,
        target: "index",
        published: payload.value,
        pushed: false,
        warning: "Saved locally, but push failed.",
      });
    }

    return NextResponse.json({ ok: true, target: "index", published: payload.value, pushed: true });
  } catch (error) {
    if (error instanceof ClientError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Unable to update publish state.", 500);
  }
}

async function safeRealpath(path: string, message: string): Promise<string> {
  try {
    return await realpath(resolve(path));
  } catch {
    throw new ClientError(message, 400);
  }
}

async function rollbackFile(path: string, original: string): Promise<void> {
  try {
    await writeFile(path, original, "utf8");
  } catch {
    // The response remains generic so rollback paths/errors are not exposed.
  }
}

async function pushWithRetry(git: { push: () => Promise<unknown> }): Promise<boolean> {
  const delayMs = process.env.NODE_ENV === "test" ? 0 : 5000;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await git.push();
      return true;
    } catch {
      if (attempt < 2 && delayMs > 0) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
      }
    }
  }

  return false;
}

function isInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

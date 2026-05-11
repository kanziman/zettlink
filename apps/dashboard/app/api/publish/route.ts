// 카드 요약본(index.md) 또는 산출물(deep/til/guide.md) 의 published frontmatter 를 갱신한다.
import { readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  openRepo,
  parseArtifact,
  parseIndex,
  serializeArtifact,
  serializeIndex,
} from "@zettlink/core";
import { NextResponse } from "next/server";

type PublishTarget = "index" | "deep" | "til" | "guide";
const ARTIFACT_TARGETS: ReadonlyArray<Exclude<PublishTarget, "index">> = ["deep", "til", "guide"];
const ALL_TARGETS: ReadonlyArray<PublishTarget> = ["index", ...ARTIFACT_TARGETS];

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
      throw new ClientError(
        "Expected JSON body { dir: string, target: string, value: boolean }.",
        400,
      );
    }
    if (!ALL_TARGETS.includes(payload.target as PublishTarget)) {
      throw new ClientError(
        `Unsupported publish target. Supported targets: ${ALL_TARGETS.join(", ")}.`,
        400,
      );
    }
    const target = payload.target as PublishTarget;

    const rootDir = await realpath(resolve(root));
    const dir = await safeRealpath(payload.dir, "dir must be inside REPO_LOCAL_PATH.");
    if (!isInside(rootDir, dir)) {
      throw new ClientError("dir must be inside REPO_LOCAL_PATH.", 400);
    }

    const filename = target === "index" ? "index.md" : `${target}.md`;
    const filePath = join(dir, filename);
    const realFilePath = await safeRealpath(
      filePath,
      target === "index"
        ? "dir must be inside REPO_LOCAL_PATH."
        : `${target} artifact does not exist.`,
      target === "index" ? 400 : 404,
    );
    if (!isInside(rootDir, realFilePath)) {
      throw new ClientError("dir must be inside REPO_LOCAL_PATH.", 400);
    }

    const originalMarkdown = await readFile(realFilePath, "utf8");
    const slug = readSlug(dir);

    let nextMarkdown: string;
    if (target === "index") {
      const { frontmatter, body } = parseIndex(originalMarkdown);
      nextMarkdown = serializeIndex({ ...frontmatter, published: payload.value }, body);
    } else {
      const { frontmatter, body } = parseArtifact(originalMarkdown);
      nextMarkdown = serializeArtifact({ ...frontmatter, published: payload.value }, body);
    }

    await writeFile(realFilePath, nextMarkdown, "utf8");
    const git = openRepo(rootDir);
    try {
      await git.add([realFilePath]);
      await git.commit(`publish ${target}=${payload.value} ${slug}`);
    } catch {
      await rollbackFile(realFilePath, originalMarkdown);
      return jsonError("Unable to update publish state.", 500);
    }

    const pushed = await pushWithRetry(git);
    if (!pushed) {
      return NextResponse.json({
        ok: true,
        target,
        published: payload.value,
        pushed: false,
        warning: "Saved locally, but push failed.",
      });
    }

    return NextResponse.json({ ok: true, target, published: payload.value, pushed: true });
  } catch (error) {
    if (error instanceof ClientError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Unable to update publish state.", 500);
  }
}

async function safeRealpath(
  path: string,
  message: string,
  status: number = 400,
): Promise<string> {
  try {
    return await realpath(resolve(path));
  } catch {
    throw new ClientError(message, status);
  }
}

function readSlug(dir: string): string {
  const folder = dir.split("/").pop() ?? "";
  const m = folder.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  return m?.[1] ?? folder;
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

// 카드 산출물(deep / til / guide.md) 을 LLM 으로 생성하고 vault 에 커밋한다. 실패 시 부분 파일을 남기지 않는다.
import { mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  createOpenRouterClient,
  openRepo,
  runArtifact,
  serializeArtifact,
  type ArtifactKind,
} from "@zettlink/core";
import { NextResponse } from "next/server";

const KINDS: ReadonlyArray<ArtifactKind> = ["deep", "til", "guide"];

type GenerateRequest = {
  dir?: unknown;
  kind?: unknown;
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
    const apiKey = process.env.OPENROUTER_API_KEY;
    const modelId = process.env.OPENROUTER_MODEL;
    if (!root || !apiKey || !modelId) {
      return jsonError("Unable to generate artifact.", 500);
    }

    const payload = (await request.json()) as GenerateRequest;
    if (typeof payload.dir !== "string" || typeof payload.kind !== "string") {
      throw new ClientError("Expected JSON body { dir: string, kind: string }.", 400);
    }
    if (!KINDS.includes(payload.kind as ArtifactKind)) {
      throw new ClientError(`Unsupported kind. Supported kinds: ${KINDS.join(", ")}.`, 400);
    }
    const kind = payload.kind as ArtifactKind;

    const rootDir = await realpath(resolve(root));
    const dir = await safeRealpath(payload.dir, "dir must be inside REPO_LOCAL_PATH.", 400);
    if (!isInside(rootDir, dir)) {
      throw new ClientError("dir must be inside REPO_LOCAL_PATH.", 400);
    }

    const targetPath = join(dir, `${kind}.md`);
    if (existsSync(targetPath)) {
      throw new ClientError(`${kind}.md already exists.`, 409);
    }

    const transcript = await readSourceText(dir);
    if (transcript === null) {
      throw new ClientError("No source file (transcript.md or extract.md) found.", 422);
    }

    const slug = readSlug(dir);
    const client = createOpenRouterClient(apiKey);

    let body: string;
    try {
      body = await runArtifact(client, { kind, transcript, modelId });
    } catch {
      return jsonError(`Unable to generate ${kind} artifact.`, 502);
    }

    const markdown = serializeArtifact(
      {
        generated_at: new Date().toISOString(),
        published: false,
        llm: { model: modelId },
      },
      body.endsWith("\n") ? body : `${body}\n`,
    );

    await mkdir(dir, { recursive: true });
    await writeFile(targetPath, markdown, "utf8");
    const realTargetPath = await realpath(targetPath);
    if (!isInside(rootDir, realTargetPath)) {
      await rm(targetPath, { force: true });
      throw new ClientError("Artifact path escapes REPO_LOCAL_PATH.", 400);
    }

    const git = openRepo(rootDir);
    try {
      await git.add([realTargetPath]);
      await git.commit(`add ${kind} ${slug}`);
    } catch {
      await rm(targetPath, { force: true });
      return jsonError(`Unable to generate ${kind} artifact.`, 500);
    }

    const pushed = await pushWithRetry(git);
    if (!pushed) {
      return NextResponse.json({
        ok: true,
        kind,
        created: true,
        pushed: false,
        warning: "Saved locally, but push failed.",
      });
    }
    return NextResponse.json({ ok: true, kind, created: true, pushed: true });
  } catch (error) {
    if (error instanceof ClientError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Unable to generate artifact.", 500);
  }
}

async function readSourceText(dir: string): Promise<string | null> {
  for (const name of ["transcript.md", "extract.md"]) {
    const path = join(dir, name);
    if (!existsSync(path)) continue;
    try {
      return await readFile(path, "utf8");
    } catch {
      return null;
    }
  }
  return null;
}

async function safeRealpath(
  path: string,
  message: string,
  status: number,
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

async function pushWithRetry(git: { push: () => Promise<unknown> }): Promise<boolean> {
  const delayMs = process.env.NODE_ENV === "test" ? 0 : 5000;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await git.push();
      return true;
    } catch {
      if (attempt < 2 && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
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

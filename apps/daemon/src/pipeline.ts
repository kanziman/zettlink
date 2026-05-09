// URL 한 건의 캡처 → 추출 → LLM → 파일 생성 → git push 까지를 직렬로 실행한다.
import {
  normalizeUrl, type IndexFrontmatter,
  cardFolderExists, writeCard, listCards, commitAndPushWithRetry,
  computeTagFrequency, formatTagHints, headTailTruncate,
  githubSlug, datedFolder,
} from '@zettlink/core';
import type { SimpleGit } from 'simple-git';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ParsedMessage } from './flags.js';

interface Deps {
  repoLocalPath: string;
  extractYoutube: (url: string, workDir: string) => Promise<{ meta: any; transcript: string }>;
  extractGithub?: (owner: string, repo: string) => Promise<{ meta: any; extract: string }>;
  whisperTranscribe?: (url: string, workDir: string) => Promise<string>;
  runAutoSummary: (input: { transcript: string; tagHints: string; truncated: boolean; modelId: string }) => Promise<{
    title: string; slug: string; summary_one_line: string; summary_body: string; insights: string[]; tags: string[];
  }>;
  git: SimpleGit;
  now: () => Date;
  modelId: string;
}

export type PipelineResult =
  | { kind: 'ok'; cardDir: string; cardSlug: string }
  | { kind: 'duplicate'; existingSlug: string }
  | { kind: 'unsupported' }
  | { kind: 'failed'; reason: string; cardDir?: string };

export async function processUrl(msg: ParsedMessage, deps: Deps): Promise<PipelineResult> {
  if (!msg.url) return { kind: 'unsupported' };
  const norm = normalizeUrl(msg.url);
  if (!norm) return { kind: 'unsupported' };

  const date = deps.now().toISOString().slice(0, 10);
  const provisionalSlug = norm.platform === 'youtube'
    ? `youtube-${norm.videoId}`
    : githubSlug(norm.owner, norm.repo);

  // 중복 체크. youtube 는 LLM 결과 슬러그가 다를 수 있어 video_id 기반 보조 인덱스도 검사.
  if (!msg.flags.force) {
    if (await cardFolderExists(deps.repoLocalPath, norm.platform, provisionalSlug)) {
      return { kind: 'duplicate', existingSlug: provisionalSlug };
    }
    if (norm.platform === 'youtube') {
      const cards = await listCards(deps.repoLocalPath);
      const dup = cards.find((c) => c.frontmatter.youtube?.video_id === norm.videoId);
      if (dup) return { kind: 'duplicate', existingSlug: dup.frontmatter.slug };
    }
  }

  // 1) 추출.
  let transcript = '';
  let platformMeta: any;
  if (norm.platform === 'youtube') {
    const yt = await deps.extractYoutube(msg.url, deps.repoLocalPath + '/.tmp');
    platformMeta = yt.meta;
    transcript = yt.transcript;
    if (!transcript && msg.flags.whisper && deps.whisperTranscribe) {
      transcript = await deps.whisperTranscribe(msg.url, deps.repoLocalPath + '/.tmp');
      platformMeta.subtitle_source = 'whisper';
    }
  } else {
    if (!deps.extractGithub) return { kind: 'unsupported' };
    const gh = await deps.extractGithub(norm.owner, norm.repo);
    platformMeta = gh.meta;
    transcript = gh.extract;
  }

  // 2) LLM 자동 요약.
  const cards = await listCards(deps.repoLocalPath);
  const tagHints = formatTagHints(computeTagFrequency(cards.map((c) => c.frontmatter)));
  const { text: trimmed, truncated } = headTailTruncate(transcript, 6000);

  let llmResult: Awaited<ReturnType<Deps['runAutoSummary']>> | null = null;
  let llmError: Error | null = null;
  try {
    llmResult = await deps.runAutoSummary({ transcript: trimmed, tagHints, truncated, modelId: deps.modelId });
  } catch (e) { llmError = e as Error; }

  // 3) 파일 작성.
  const slug = llmResult?.slug ?? provisionalSlug;
  const fm: IndexFrontmatter = {
    url: norm.canonical,
    platform: norm.platform,
    slug,
    captured_at: deps.now().toISOString(),
    title: llmResult?.title ?? (platformMeta.title ?? slug),
    summary_one_line: llmResult?.summary_one_line ?? '(요약 실패)',
    tags: llmResult?.tags ?? [],
    status: llmResult ? 'summarized' : 'failed',
    reviewed: false,
    published: false,
    note: msg.note,
    generated: { deep: false, til: false, guide: false },
    llm: { model: deps.modelId, truncated },
    youtube: norm.platform === 'youtube' ? platformMeta : undefined,
    github: norm.platform === 'github' ? platformMeta : undefined,
  };
  const body = llmResult
    ? `${fm.summary_one_line}\n\n${llmResult.summary_body}\n\n## 인사이트\n${llmResult.insights.map((i) => `- ${i}`).join('\n')}\n`
    : '## 요약 실패\n자동 요약을 생성하지 못했다. transcript.md / extract.md 는 이미 저장되어 있다.\n';

  const cardDir = await writeCard(deps.repoLocalPath, fm, body);
  const sourceFile = norm.platform === 'youtube' ? 'transcript.md' : 'extract.md';
  await writeFile(join(cardDir, sourceFile), transcript, 'utf8');

  // 4) git push.
  await commitAndPushWithRetry(deps.git, [`sources/${norm.platform}/${datedFolder(date, slug)}/`], `add ${slug}`);

  return llmResult
    ? { kind: 'ok', cardDir, cardSlug: slug }
    : { kind: 'failed', reason: llmError?.message ?? 'unknown', cardDir };
}

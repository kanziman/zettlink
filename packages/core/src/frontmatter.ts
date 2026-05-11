// 카드(`index.md`) 의 frontmatter 타입과 parse/serialize 헬퍼. Zod 로 스키마를 강제한다.
import matter from 'gray-matter';
import { z } from 'zod';

const YoutubeMeta = z.object({
  video_id: z.string(),
  channel: z.string(),
  upload_date: z.string(),     // YYYY-MM-DD (yt-dlp 의 YYYYMMDD 를 변환). 정보 없으면 ''.
  duration_sec: z.number().int(),
  thumbnail: z.string().url(),
  subtitle_source: z.enum(['auto', 'manual', 'whisper', 'description', 'none']),
});
const GithubMeta = z.object({
  owner: z.string(),
  repo: z.string(),
  stars: z.number().int(),
  primary_language: z.string(),
  topics: z.array(z.string()),
});

const IndexSchema = z.object({
  url: z.string().url(),
  platform: z.enum(['youtube', 'github']),
  slug: z.string().min(1),
  captured_at: z.string().datetime(),
  title: z.string(),
  summary_one_line: z.string(),
  tags: z.array(z.string()),
  status: z.enum(['extracted', 'summarized', 'failed']),
  reviewed: z.boolean().default(false),
  published: z.boolean(),
  note: z.string().default(''),
  generated: z.object({ deep: z.boolean(), til: z.boolean(), guide: z.boolean() }),
  llm: z.object({ model: z.string(), truncated: z.boolean() }),
  youtube: YoutubeMeta.optional(),
  github: GithubMeta.optional(),
});

export type IndexFrontmatter = z.infer<typeof IndexSchema>;

export function parseIndex(markdown: string): { frontmatter: IndexFrontmatter; body: string } {
  const { data, content } = matter(markdown);
  const parsed = IndexSchema.parse(data);
  return { frontmatter: parsed, body: content };
}

export function serializeIndex(fm: IndexFrontmatter, body: string): string {
  IndexSchema.parse(fm);
  const cleaned: Record<string, unknown> = { ...fm };
  if (fm.platform === 'youtube') delete cleaned.github;
  if (fm.platform === 'github') delete cleaned.youtube;
  return matter.stringify(body, cleaned);
}

// 산출물(`deep.md` / `til.md` / `guide.md`) 의 frontmatter — ADR 0001 의 2-레벨 발행 플래그.
export const ArtifactSchema = z.object({
  generated_at: z.string().datetime(),
  published: z.boolean(),
  llm: z.object({ model: z.string() }),
});
export type ArtifactFrontmatter = z.infer<typeof ArtifactSchema>;

export function parseArtifact(markdown: string): { frontmatter: ArtifactFrontmatter; body: string } {
  const { data, content } = matter(markdown);
  return { frontmatter: ArtifactSchema.parse(data), body: content };
}
export function serializeArtifact(fm: ArtifactFrontmatter, body: string): string {
  ArtifactSchema.parse(fm);
  return matter.stringify(body, fm);
}

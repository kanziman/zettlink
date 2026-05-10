// vault 카드 폴더에서 공개 가능한 index.md 를 수집한다.
import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCollection, z } from 'astro:content';
import type { Loader } from 'astro/loaders';
import matter from 'gray-matter';
import sanitizeHtml from 'sanitize-html';

const fallbackVaultRoot = fileURLToPath(new URL('../fixtures/empty-vault', import.meta.url));

function allowFallbackVault() {
  return process.env.ZETTLINK_BLOG_ALLOW_EMPTY_VAULT === '1' || process.env.NODE_ENV !== 'production';
}

function vaultRoot() {
  if (process.env.REPO_LOCAL_PATH) {
    return process.env.REPO_LOCAL_PATH;
  }
  if (allowFallbackVault()) {
    return fallbackVaultRoot;
  }
  throw new Error('REPO_LOCAL_PATH is required for production blog builds.');
}

function sourcesDir() {
  return join(vaultRoot(), 'sources');
}

function isPrivatePath(path: string) {
  return path.split(sep).includes('private');
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findIndexMarkdownFiles(root: string, current = root): Promise<string[]> {
  if (!(await pathExists(current)) || isPrivatePath(relative(root, current))) {
    return [];
  }

  const entries = await readdir(current, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        return findIndexMarkdownFiles(root, path);
      }
      return entry.isFile() && entry.name === 'index.md' ? [path] : [];
    }),
  );
  return files.flat();
}

function hasBooleanPublished(data: Record<string, unknown>) {
  return typeof data.published === 'boolean';
}

function entryId(file: string, root: string, data: Record<string, unknown>) {
  if (typeof data.slug === 'string') {
    return data.slug;
  }
  return relative(root, file).replace(/(^|[/\\])index\.md$/, '').replace(/[/\\]+$/, '');
}

function redactLocalPaths(text: string) {
  const redacted = '[redacted-local-path]';
  const localPathStart = String.raw`(?:file:\/\/|\/(?:Users|home|tmp|var|opt)(?:\/|$))`;
  return text
    .replace(new RegExp(String.raw`\]\(\s*${localPathStart}[^)\n]*\)`, 'gi'), `](${redacted})`)
    .replace(new RegExp(String.raw`${localPathStart}[^\n<>"')\]]*`, 'gi'), redacted);
}

function publicString(value: unknown) {
  return typeof value === 'string' ? redactLocalPaths(value) : value;
}

function publicStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(publicString).filter((item): item is string => typeof item === 'string') : value;
}

function publicYoutubeData(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const source = data as Record<string, unknown>;
  return {
    video_id: publicString(source.video_id),
    channel: publicString(source.channel),
    upload_date: publicString(source.upload_date),
    duration_sec: source.duration_sec,
    thumbnail: publicString(source.thumbnail),
    subtitle_source: publicString(source.subtitle_source),
  };
}

function publicGithubData(data: unknown) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return undefined;
  }
  const source = data as Record<string, unknown>;
  return {
    owner: publicString(source.owner),
    repo: publicString(source.repo),
    stars: source.stars,
    primary_language: publicString(source.primary_language),
    topics: publicStringArray(source.topics),
  };
}

function publicCardData(data: Record<string, unknown>) {
  return {
    url: publicString(data.url),
    platform: data.platform,
    slug: publicString(data.slug),
    title: publicString(data.title),
    summary_one_line: publicString(data.summary_one_line),
    tags: publicStringArray(data.tags),
    published: data.published,
    youtube: publicYoutubeData(data.youtube),
    github: publicGithubData(data.github),
  };
}

function sanitizeCachedMarkdown(markdown: string) {
  const markdownWithoutUnsafeLinks = redactLocalPaths(markdown).replace(/\]\(\s*javascript:[^)]+\)/gi, '](#)');
  return sanitizeHtml(markdownWithoutUnsafeLinks, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

function publicCardLoader(): Loader {
  return {
    name: 'zettlink-public-card-loader',
    async load({ store, parseData, generateDigest, logger }) {
      const root = sourcesDir();
      store.clear();

      if (!(await pathExists(root))) {
        logger.warn(`The base directory "${root}" does not exist.`);
        return;
      }

      const files = await findIndexMarkdownFiles(root);
      for (const file of files) {
        const markdown = await readFile(file, 'utf8');
        const { content, data } = matter(markdown);

        if (!hasBooleanPublished(data)) {
          logger.warn(`Card is missing boolean published: ${relative(root, file)}`);
        }
        if (data.published !== true) {
          continue;
        }

        const publicData = publicCardData(data);
        const id = entryId(file, root, publicData);
        const parsedData = await parseData({ id, data: publicData });
        const sanitizedBody = sanitizeCachedMarkdown(content);

        store.set({
          id,
          data: parsedData,
          body: sanitizedBody,
          digest: generateDigest({ data: parsedData, body: sanitizedBody }),
        });
      }
    },
  };
}

const cards = defineCollection({
  loader: publicCardLoader(),
  schema: z
    .object({
      url: z.string(),
      platform: z.enum(['youtube', 'github']),
      slug: z.string(),
      title: z.string(),
      summary_one_line: z.string(),
      tags: z.array(z.string()),
      published: z.boolean().optional().default(false),
      youtube: z
        .object({
          video_id: z.string(),
          channel: z.string(),
          upload_date: z.string(),
          duration_sec: z.number().int(),
          thumbnail: z.string(),
          subtitle_source: z.enum(['auto', 'manual', 'whisper', 'description', 'none']),
        })
        .optional(),
      github: z
        .object({
          owner: z.string(),
          repo: z.string(),
          stars: z.number().int(),
          primary_language: z.string(),
          topics: z.array(z.string()),
        })
        .optional(),
    }),
});

export const collections = { cards };

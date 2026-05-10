// vault 카드 폴더에서 공개 가능한 index.md 를 수집한다.
import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineCollection, z } from 'astro:content';
import type { Loader } from 'astro/loaders';
import matter from 'gray-matter';

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

function publicCardLoader(): Loader {
  return {
    name: 'zettlink-public-card-loader',
    async load({ config, store, parseData, generateDigest, logger }) {
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

        const { note: _note, ...publicData } = data;
        const id = entryId(file, root, publicData);
        const parsedData = await parseData({ id, data: publicData, filePath: file });

        store.set({
          id,
          data: parsedData,
          body: content,
          filePath: relative(fileURLToPath(config.root), file),
          digest: generateDigest({ data: parsedData, body: content }),
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
      youtube: z.any().optional(),
      github: z.any().optional(),
    })
    .passthrough(),
});

export const collections = { cards };

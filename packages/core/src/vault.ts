// 카드 폴더(`vault/sources/{platform}/{date}-{slug}/`) 스캔·읽기·쓰기.
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { type IndexFrontmatter, parseIndex, serializeIndex } from './frontmatter.js';

const SOURCES = 'sources';

function ymd(iso: string): string { return iso.slice(0, 10); }
function folderName(fm: IndexFrontmatter): string { return `${ymd(fm.captured_at)}-${fm.slug}`; }
function cardDir(root: string, platform: string, folder: string): string {
  return join(root, SOURCES, platform, folder);
}

export async function cardFolderExists(root: string, platform: string, slug: string, date?: string): Promise<boolean> {
  // 빠른 경로. date 가 있으면 정확 경로, 없으면 platform 디렉토리에서 -{slug} suffix 탐색.
  if (date) return existsSync(cardDir(root, platform, `${date}-${slug}`));
  const dir = join(root, SOURCES, platform);
  if (!existsSync(dir)) return false;
  const entries = await readdir(dir);
  return entries.some((e) => e.endsWith(`-${slug}`));
}

export async function writeCard(root: string, fm: IndexFrontmatter, body: string): Promise<string> {
  const folder = folderName(fm);
  const dir = cardDir(root, fm.platform, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.md'), serializeIndex(fm, body), 'utf8');
  return dir;
}

export async function readCard(
  root: string,
  platform: string,
  folder: string,
): Promise<{ frontmatter: IndexFrontmatter; body: string; dir: string }> {
  const dir = cardDir(root, platform, folder);
  const md = await readFile(join(dir, 'index.md'), 'utf8');
  const { frontmatter, body } = parseIndex(md);
  return { frontmatter, body, dir };
}

export async function listCards(root: string): Promise<Array<{ frontmatter: IndexFrontmatter; dir: string }>> {
  const out: Array<{ frontmatter: IndexFrontmatter; dir: string }> = [];
  const sourcesDir = join(root, SOURCES);
  if (!existsSync(sourcesDir)) return out;
  for (const platform of await readdir(sourcesDir)) {
    const platformDir = join(sourcesDir, platform);
    for (const folder of await readdir(platformDir)) {
      const indexPath = join(platformDir, folder, 'index.md');
      if (!existsSync(indexPath)) continue;
      const md = await readFile(indexPath, 'utf8');
      try {
        const { frontmatter } = parseIndex(md);
        out.push({ frontmatter, dir: join(platformDir, folder) });
      } catch {
        // malformed card 는 스킵 — 대시보드에서 별도 표시.
      }
    }
  }
  return out;
}

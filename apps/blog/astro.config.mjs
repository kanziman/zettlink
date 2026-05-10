// 공개 블로그 정적 빌드와 vault 안전 검사를 설정한다.
import { access, readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

const fallbackVaultRoot = fileURLToPath(new URL('./fixtures/empty-vault', import.meta.url));

function allowFallbackVault() {
  return process.env.ZETTLINK_BLOG_ALLOW_EMPTY_VAULT === '1' || process.env.NODE_ENV !== 'production';
}

function repoLocalPath() {
  if (process.env.REPO_LOCAL_PATH) {
    return process.env.REPO_LOCAL_PATH;
  }
  if (allowFallbackVault()) {
    return fallbackVaultRoot;
  }
  throw new Error('REPO_LOCAL_PATH is required for production blog builds.');
}

function sourcesDir() {
  return join(repoLocalPath(), 'sources');
}

function isPrivatePath(path) {
  return path.split(sep).includes('private');
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findIndexMarkdownFiles(root, current = root) {
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

function hasBooleanPublished(frontmatter) {
  return /^published:\s*(true|false)\s*$/m.test(frontmatter);
}

function publishedWarningPlugin() {
  return {
    name: 'zettlink-published-warning',
    async buildStart() {
      const root = sourcesDir();
      if (!(await pathExists(root))) {
        return;
      }

      const files = await findIndexMarkdownFiles(root);
      for (const file of files) {
        const markdown = await readFile(file, 'utf8');
        const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/);
        if (!frontmatter || !hasBooleanPublished(frontmatter[1])) {
          this.warn(`Card is missing boolean published: ${relative(root, file)}`);
        }
      }
    },
  };
}

export default defineConfig({
  site: 'https://zettlink.local',
  output: 'static',
  vite: {
    server: {
      fs: {
        deny: ['**/private/**'],
      },
    },
    plugins: [publishedWarningPlugin()],
    optimizeDeps: {
      exclude: ['private'],
    },
  },
});

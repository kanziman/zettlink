// 공개되지 않은 카드가 정적 빌드 결과에 포함되지 않는지 검증한다.
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);
const blogRoot = resolve(import.meta.dirname, '..');
const tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test('published=false 카드의 제목과 본문을 빌드 결과에서 제외한다.', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zettlink-blog-'));
  tmpRoots.push(root);

  const sources = join(root, 'sources');
  await mkdir(join(sources, 'published-card'), { recursive: true });
  await mkdir(join(sources, 'hidden-card'), { recursive: true });
  await mkdir(join(sources, 'missing-published-card'), { recursive: true });
  await mkdir(join(sources, 'private', 'private-card'), { recursive: true });

  await writeFile(
    join(sources, 'published-card', 'index.md'),
    [
      '---',
      'url: https://github.com/example/published',
      'platform: github',
      'slug: published-card',
      'title: 공개 카드',
      'summary_one_line: 공개 요약.',
      'tags: [public]',
      'published: true',
      'note: 공개되면 안 되는 개인 메모 SECRET_PRIVATE_NOTE.',
      '---',
      '공개 본문입니다.',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(sources, 'hidden-card', 'index.md'),
    [
      '---',
      'url: https://github.com/example/hidden',
      'platform: github',
      'slug: hidden-card',
      'title: 비공개 카드 제목',
      'summary_one_line: 비공개 요약.',
      'tags: [private]',
      'published: false',
      '---',
      '비공개 카드 본문 SECRET_UNPUBLISHED_BODY.',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(sources, 'missing-published-card', 'index.md'),
    [
      '---',
      'url: https://github.com/example/missing',
      'platform: github',
      'slug: missing-published-card',
      'title: published 누락 카드 제목',
      'summary_one_line: published 누락 요약.',
      'tags: [draft]',
      '---',
      'MISSING_PUBLISHED_BODY_SHOULD_NOT_LOAD.',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(sources, 'private', 'private-card', 'index.md'),
    [
      '---',
      'url: https://github.com/example/private',
      'platform: github',
      'slug: private-card',
      'title: 비공개 경로 카드 제목',
      'summary_one_line: 비공개 경로 요약.',
      'tags: [private]',
      'published: true',
      '---',
      'PRIVATE_PATH_BODY_SHOULD_NOT_LOAD.',
      '',
    ].join('\n'),
  );

  const result = await execFileAsync('pnpm', ['exec', 'astro', 'build'], {
    cwd: blogRoot,
    env: { ...process.env, REPO_LOCAL_PATH: root, ZETTLINK_BLOG_ALLOW_EMPTY_VAULT: '1' },
  });

  const html = await readFile(join(blogRoot, 'dist', 'index.html'), 'utf8');
  const store = await readFile(join(blogRoot, 'node_modules', '.astro', 'data-store.json'), 'utf8');
  const generated = [
    html,
    store,
    ...(await Promise.all(
      (await readdir(join(blogRoot, '.astro', 'collections'))).map((file) =>
        readFile(join(blogRoot, '.astro', 'collections', file), 'utf8'),
      ),
    )),
  ].join('\n');

  expect(html).toContain('공개 카드');
  expect(store).toContain('공개 카드');
  expect(generated).not.toContain('SECRET_PRIVATE_NOTE');
  expect(generated).not.toContain('비공개 카드 제목');
  expect(generated).not.toContain('SECRET_UNPUBLISHED_BODY');
  expect(generated).not.toContain('published 누락 카드 제목');
  expect(generated).not.toContain('MISSING_PUBLISHED_BODY_SHOULD_NOT_LOAD');
  expect(generated).not.toContain('비공개 경로 카드 제목');
  expect(generated).not.toContain('PRIVATE_PATH_BODY_SHOULD_NOT_LOAD');
  expect(`${result.stdout}\n${result.stderr}`).toContain(
    'Card is missing boolean published: missing-published-card/index.md',
  );
});

test('production 빌드는 vault 경로 또는 명시적 fallback 없이는 실패한다.', async () => {
  const { REPO_LOCAL_PATH, ZETTLINK_BLOG_ALLOW_EMPTY_VAULT, ...env } = process.env;

  await expect(
    execFileAsync('pnpm', ['exec', 'astro', 'build'], {
      cwd: blogRoot,
      env: { ...env, NODE_ENV: 'production' },
    }),
  ).rejects.toMatchObject({
    stderr: expect.stringContaining('REPO_LOCAL_PATH is required for production blog builds.'),
  });

  void REPO_LOCAL_PATH;
  void ZETTLINK_BLOG_ALLOW_EMPTY_VAULT;
});

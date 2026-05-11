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

async function readGeneratedText(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        return readGeneratedText(path);
      }
      return entry.isFile() ? [await readFile(path, 'utf8')] : [];
    }),
  );
  return files.flat();
}

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test('published=false 카드의 제목과 본문을 빌드 결과에서 제외한다.', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zettlink-blog-'));
  tmpRoots.push(root);

  const sources = join(root, 'sources');
  await mkdir(join(sources, 'SECRET_SOURCE_FOLDER'), { recursive: true });
  await mkdir(join(sources, 'hidden-card'), { recursive: true });
  await mkdir(join(sources, 'missing-published-card'), { recursive: true });
  await mkdir(join(sources, 'private', 'private-card'), { recursive: true });

  await writeFile(
    join(sources, 'SECRET_SOURCE_FOLDER', 'index.md'),
    [
      '---',
      'url: file:///Users/zorba/private/SECRET_URL_FIELD',
      'platform: github',
      'slug: published-card',
      'title: 공개 카드 /Users/zorba/private/SECRET_TITLE_PATH /Users/zorba/My Documents/SECRET_SPACE_TITLE',
      'summary_one_line: 공개 요약 file:///Users/zorba/private/SECRET_SUMMARY_FILE_URL /tmp/SECRET_SUMMARY_TMP_PATH.',
      'tags: [public, "/home/zorba/private/SECRET_TAG_PATH", "/var/folders/SECRET_TAG_VAR_PATH", "/var/folders/My Cache/SECRET_SPACE_TAG"]',
      'published: true',
      'github:',
      '  owner: example',
      '  repo: published',
      '  stars: 1',
      '  primary_language: TypeScript',
      '  topics: [public, "/Users/zorba/private/SECRET_GITHUB_TOPIC_PATH", "/opt/SECRET_GITHUB_TOPIC_OPT_PATH", "/Users/zorba/My Documents/SECRET_SPACE_GITHUB_TOPIC"]',
      '  note: SECRET_GITHUB_NOTE',
      '  local_path: /Users/zorba/private/SECRET_GITHUB_LOCAL_PATH',
      '  file_url: file:///Users/zorba/private/SECRET_GITHUB_FILE_URL',
      'note: 공개되면 안 되는 개인 메모 SECRET_PRIVATE_NOTE.',
      'internal_path: /Users/zorba/private/SECRET_FRONTMATTER_PATH',
      'debug_dump: file:///Users/zorba/private/SECRET_FRONTMATTER_FILE_URL',
      '---',
      '공개 본문입니다.',
      '<script>SECRET_CARD_SCRIPT()</script>',
      '<img src="x" onerror="SECRET_CARD_ONERROR()">',
      '<a href="javascript:SECRET_CARD_LINK()">위험 카드 링크</a>',
      '/Users/zorba/private/SECRET_CARD_BODY_PATH',
      '[로컬 경로 링크](/home/zorba/private/SECRET_CARD_BODY_LINK)',
      'file:///Users/zorba/private/SECRET_CARD_FILE_URL',
      '/tmp/SECRET_CARD_TMP_PATH',
      '[tmp 링크](/tmp/SECRET_CARD_TMP_LINK)',
      '/var/folders/SECRET_CARD_VAR_PATH',
      '[opt 링크](/opt/SECRET_CARD_OPT_LINK)',
      '/Users/zorba/My Documents/SECRET_SPACE_CARD_BODY',
      '[space 링크](/var/folders/My Cache/SECRET_SPACE_CARD_LINK)',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(sources, 'SECRET_SOURCE_FOLDER', 'deep.md'),
    [
      '---',
      'title: 공개 심화',
      'generated_at: "2026-05-11T00:00:00.000Z"',
      'published: true',
      'llm: { model: test-model }',
      'note: 산출물 개인 메모 SECRET_ARTIFACT_NOTE.',
      '---',
      '공개 심화 본문입니다.',
      '<script>SECRET_ARTIFACT_SCRIPT()</script>',
      '<a href="javascript:SECRET_ARTIFACT_LINK()">위험 링크</a>',
      '/Users/zorba/private/SECRET_ARTIFACT_BODY_PATH',
      '[산출물 로컬 링크](/home/zorba/private/SECRET_ARTIFACT_BODY_LINK)',
      'file:///Users/zorba/private/SECRET_ARTIFACT_FILE_URL',
      '/tmp/SECRET_ARTIFACT_TMP_PATH',
      '[산출물 tmp 링크](/tmp/SECRET_ARTIFACT_TMP_LINK)',
      '/var/folders/SECRET_ARTIFACT_VAR_PATH',
      '[산출물 opt 링크](/opt/SECRET_ARTIFACT_OPT_LINK)',
      '/Users/zorba/My Documents/SECRET_SPACE_ARTIFACT_BODY',
      '[산출물 space 링크](/var/folders/My Cache/SECRET_SPACE_ARTIFACT_LINK)',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(sources, 'SECRET_SOURCE_FOLDER', 'til.md'),
    [
      '---',
      'title: 비공개 TIL',
      'generated_at: "2026-05-11T00:00:00.000Z"',
      'published: false',
      'llm: { model: test-model }',
      '---',
      '비공개 TIL 본문 SECRET_UNPUBLISHED_ARTIFACT.',
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

  const result = await execFileAsync('pnpm', ['run', 'build:empty'], {
    cwd: blogRoot,
    env: { ...process.env, REPO_LOCAL_PATH: root, ZETTLINK_BLOG_ALLOW_EMPTY_VAULT: '1' },
  });

  const html = await readFile(join(blogRoot, 'dist', 'index.html'), 'utf8');
  const detailHtml = await readFile(join(blogRoot, 'dist', 'cards', 'published-card', 'index.html'), 'utf8');
  const store = await readFile(join(blogRoot, 'node_modules', '.astro', 'data-store.json'), 'utf8');
  const generated = [
    html,
    detailHtml,
    store,
    ...(await Promise.all(
      (await readdir(join(blogRoot, '.astro', 'collections'))).map((file) =>
        readFile(join(blogRoot, '.astro', 'collections', file), 'utf8'),
      ),
    )),
    ...(await readGeneratedText(join(blogRoot, 'dist', 'pagefind'))),
  ].join('\n');

  expect(html).toContain('공개 카드');
  expect(detailHtml).toContain('공개 카드');
  expect(detailHtml).toContain('공개 요약');
  expect(detailHtml).toContain('공개 본문입니다.');
  expect(detailHtml).toContain('심화');
  expect(detailHtml).toContain('공개 심화 본문입니다.');
  expect(detailHtml).not.toContain('<script>');
  expect(detailHtml).not.toContain('SECRET_CARD_SCRIPT()');
  expect(detailHtml).not.toContain('onerror=');
  expect(detailHtml).not.toContain('SECRET_CARD_ONERROR()');
  expect(detailHtml).not.toContain('javascript:SECRET_CARD_LINK()');
  expect(detailHtml).toContain('위험 카드 링크');
  expect(detailHtml).not.toContain('SECRET_ARTIFACT_SCRIPT()');
  expect(detailHtml).not.toContain('javascript:SECRET_ARTIFACT_LINK()');
  expect(detailHtml).toContain('위험 링크');
  expect(store).toContain('공개 카드');
  expect(generated).not.toContain(root);
  expect(generated).not.toContain('SECRET_CARD_SCRIPT()');
  expect(generated).not.toContain('SECRET_CARD_ONERROR()');
  expect(generated).not.toContain('SECRET_CARD_LINK()');
  expect(generated).not.toContain('SECRET_FRONTMATTER_PATH');
  expect(generated).not.toContain('SECRET_FRONTMATTER_FILE_URL');
  expect(generated).not.toContain('SECRET_URL_FIELD');
  expect(generated).not.toContain('SECRET_TITLE_PATH');
  expect(generated).not.toContain('SECRET_SPACE_TITLE');
  expect(generated).not.toContain('Documents/SECRET_SPACE_TITLE');
  expect(generated).not.toContain('SECRET_SUMMARY_FILE_URL');
  expect(generated).not.toContain('SECRET_SUMMARY_TMP_PATH');
  expect(generated).not.toContain('SECRET_TAG_PATH');
  expect(generated).not.toContain('SECRET_TAG_VAR_PATH');
  expect(generated).not.toContain('SECRET_SPACE_TAG');
  expect(generated).not.toContain('Cache/SECRET_SPACE_TAG');
  expect(generated).not.toContain('SECRET_GITHUB_TOPIC_PATH');
  expect(generated).not.toContain('SECRET_GITHUB_TOPIC_OPT_PATH');
  expect(generated).not.toContain('SECRET_SPACE_GITHUB_TOPIC');
  expect(generated).not.toContain('Documents/SECRET_SPACE_GITHUB_TOPIC');
  expect(generated).not.toContain('SECRET_GITHUB_NOTE');
  expect(generated).not.toContain('SECRET_GITHUB_LOCAL_PATH');
  expect(generated).not.toContain('SECRET_GITHUB_FILE_URL');
  expect(generated).not.toContain('SECRET_CARD_BODY_PATH');
  expect(generated).not.toContain('SECRET_CARD_BODY_LINK');
  expect(generated).not.toContain('SECRET_CARD_FILE_URL');
  expect(generated).not.toContain('SECRET_CARD_TMP_PATH');
  expect(generated).not.toContain('SECRET_CARD_TMP_LINK');
  expect(generated).not.toContain('SECRET_CARD_VAR_PATH');
  expect(generated).not.toContain('SECRET_CARD_OPT_LINK');
  expect(generated).not.toContain('SECRET_SPACE_CARD_BODY');
  expect(generated).not.toContain('SECRET_SPACE_CARD_LINK');
  expect(generated).not.toContain('Documents/SECRET_SPACE_CARD_BODY');
  expect(generated).not.toContain('Cache/SECRET_SPACE_CARD_LINK');
  expect(generated).not.toContain('SECRET_ARTIFACT_BODY_PATH');
  expect(generated).not.toContain('SECRET_ARTIFACT_BODY_LINK');
  expect(generated).not.toContain('SECRET_ARTIFACT_FILE_URL');
  expect(generated).not.toContain('SECRET_ARTIFACT_TMP_PATH');
  expect(generated).not.toContain('SECRET_ARTIFACT_TMP_LINK');
  expect(generated).not.toContain('SECRET_ARTIFACT_VAR_PATH');
  expect(generated).not.toContain('SECRET_ARTIFACT_OPT_LINK');
  expect(generated).not.toContain('SECRET_SPACE_ARTIFACT_BODY');
  expect(generated).not.toContain('SECRET_SPACE_ARTIFACT_LINK');
  expect(generated).not.toContain('Documents/SECRET_SPACE_ARTIFACT_BODY');
  expect(generated).not.toContain('Cache/SECRET_SPACE_ARTIFACT_LINK');
  expect(generated).not.toContain('SECRET_SOURCE_FOLDER');
  expect(generated).not.toContain('/Users/zorba/private');
  expect(generated).not.toContain('/home/zorba/private');
  expect(generated).not.toContain('/tmp/SECRET');
  expect(generated).not.toContain('/var/folders/SECRET');
  expect(generated).not.toContain('/opt/SECRET');
  expect(generated).not.toContain('file:///Users/zorba/private');
  expect(generated).not.toContain('SECRET_PRIVATE_NOTE');
  expect(generated).not.toContain('SECRET_ARTIFACT_NOTE');
  expect(generated).not.toContain('비공개 TIL');
  expect(generated).not.toContain('SECRET_UNPUBLISHED_ARTIFACT');
  expect(generated).not.toContain('비공개 카드 제목');
  expect(generated).not.toContain('SECRET_UNPUBLISHED_BODY');
  expect(generated).not.toContain('published 누락 카드 제목');
  expect(generated).not.toContain('MISSING_PUBLISHED_BODY_SHOULD_NOT_LOAD');
  expect(generated).not.toContain('비공개 경로 카드 제목');
  expect(generated).not.toContain('PRIVATE_PATH_BODY_SHOULD_NOT_LOAD');
  expect(`${result.stdout}\n${result.stderr}`).toContain(
    'Card is missing boolean published: missing-published-card/index.md',
  );
  expect(`${result.stdout}\n${result.stderr}`).toContain('Running Pagefind');
});

test('published artifact frontmatter가 잘못되면 빌드를 실패시킨다.', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zettlink-blog-'));
  tmpRoots.push(root);

  const sources = join(root, 'sources');
  await mkdir(join(sources, 'published-card'), { recursive: true });

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
      '---',
      '공개 본문입니다.',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(sources, 'published-card', 'deep.md'),
    [
      '---',
      'published: true',
      'broken: [',
      '---',
      '잘못된 산출물입니다.',
      '',
    ].join('\n'),
  );

  await expect(
    execFileAsync('pnpm', ['exec', 'astro', 'build'], {
      cwd: blogRoot,
      env: { ...process.env, REPO_LOCAL_PATH: root, ZETTLINK_BLOG_ALLOW_EMPTY_VAULT: '1' },
    }),
  ).rejects.toMatchObject({
    stderr: expect.stringContaining('Failed to load artifact deep.md for card published-card.'),
  });
});

test('published artifact frontmatter shape이 잘못되면 빌드를 실패시킨다.', async () => {
  const root = await mkdtemp(join(tmpdir(), 'zettlink-blog-'));
  tmpRoots.push(root);

  const sources = join(root, 'sources');
  await mkdir(join(sources, 'published-card'), { recursive: true });

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
      '---',
      '공개 본문입니다.',
      '',
    ].join('\n'),
  );

  await writeFile(
    join(sources, 'published-card', 'deep.md'),
    [
      '---',
      'generated_at: "2026-05-11T00:00:00.000Z"',
      'published: "true"',
      'llm: { model: test-model }',
      '---',
      '문법은 맞지만 shape이 잘못된 산출물입니다.',
      '',
    ].join('\n'),
  );

  await expect(
    execFileAsync('pnpm', ['exec', 'astro', 'build'], {
      cwd: blogRoot,
      env: { ...process.env, REPO_LOCAL_PATH: root, ZETTLINK_BLOG_ALLOW_EMPTY_VAULT: '1' },
    }),
  ).rejects.toMatchObject({
    stderr: expect.stringContaining(
      'Invalid artifact frontmatter in deep.md for card published-card',
    ),
  });
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

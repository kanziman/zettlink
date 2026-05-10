// pipeline.ts 의 processUrl 통합 흐름을 mock 으로 검증하는 테스트.
// 시나리오. youtube URL 처리 → vault 카드 생성 → git push.
import { describe, it, expect, vi } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { processUrl } from '../src/pipeline.js';

describe('processUrl', () => {
  it('YouTube 카드 생성 + git push 성공 시 status=summarized 로 끝난다', async () => {
    const repoLocalPath = await mkdtemp(join(tmpdir(), 'vault-'));
    const deps = {
      extractYoutube: vi.fn().mockResolvedValue({
        meta: { video_id: 'abc', channel: 'C', title: 'How Claude Uses Tools', upload_date: '2026-05-08', duration_sec: 60, thumbnail: 'https://x/y.jpg', subtitle_source: 'auto' },
        transcript: 'hello world',
      }),
      runAutoSummary: vi.fn().mockResolvedValue({
        title: 'How Claude Uses Tools', slug: 'how-claude-uses-tools',
        summary_one_line: '한 줄.', summary_body: '본문.',
        insights: ['i1'], tags: ['claude'],
      }),
      git: { add: vi.fn().mockResolvedValue({}), commit: vi.fn().mockResolvedValue({}), push: vi.fn().mockResolvedValue({}) },
      now: () => new Date('2026-05-09T12:00:00Z'),
      modelId: 'claude-sonnet-4-6',
    };
    const r = await processUrl(
      { url: 'https://youtu.be/abc', flags: { force: false, whisper: false }, note: '' },
      { ...deps, repoLocalPath } as any,
    );
    expect(r.kind).toBe('ok');
    const indexMd = await readFile(join(repoLocalPath, 'sources', 'youtube', '2026-05-09-how-claude-uses-tools', 'index.md'), 'utf8');
    expect(indexMd).toContain('status: summarized');
    expect(deps.git.push).toHaveBeenCalledOnce();
  });

  it('LLM 실패 시 transcript 만 commit 하고 status=failed 로 둔다', async () => {
    const repoLocalPath = await mkdtemp(join(tmpdir(), 'vault-'));
    const deps = {
      extractYoutube: vi.fn().mockResolvedValue({
        meta: { video_id: 'abc', channel: 'C', title: 'T', upload_date: '2026-05-08', duration_sec: 60, thumbnail: 'https://x/y.jpg', subtitle_source: 'auto' },
        transcript: 'hello world',
      }),
      runAutoSummary: vi.fn().mockRejectedValue(new Error('LLM 실패')),
      git: { add: vi.fn().mockResolvedValue({}), commit: vi.fn().mockResolvedValue({}), push: vi.fn().mockResolvedValue({}) },
      now: () => new Date('2026-05-09T12:00:00Z'),
      modelId: 'claude-sonnet-4-6',
    };
    const r = await processUrl(
      { url: 'https://youtu.be/abc', flags: { force: false, whisper: false }, note: '' },
      { ...deps, repoLocalPath } as any,
    );
    expect(r.kind).toBe('failed');
    // 카드 폴더는 만들되 status=failed.
    expect(deps.git.push).toHaveBeenCalledOnce();
  });

  it('중복 URL + force=false 면 duplicate 결과 + git push 호출 없음', async () => {
    const repoLocalPath = await mkdtemp(join(tmpdir(), 'vault-'));
    // 1차 호출로 카드 만들어둔다.
    const seedDeps = {
      extractYoutube: vi.fn().mockResolvedValue({
        meta: { video_id: 'abc', channel: 'C', title: 'T', upload_date: '2026-05-08', duration_sec: 60, thumbnail: 'https://x/y.jpg', subtitle_source: 'auto' },
        transcript: 'hello',
      }),
      runAutoSummary: vi.fn().mockResolvedValue({
        title: 'T', slug: 'how-claude-uses-tools', summary_one_line: 'one', summary_body: 'body',
        insights: ['i'], tags: ['claude'],
      }),
      git: { add: vi.fn().mockResolvedValue({}), commit: vi.fn().mockResolvedValue({}), push: vi.fn().mockResolvedValue({}) },
      now: () => new Date('2026-05-09T12:00:00Z'),
      modelId: 'claude-sonnet-4-6',
    };
    await processUrl(
      { url: 'https://youtu.be/abc', flags: { force: false, whisper: false }, note: '' },
      { ...seedDeps, repoLocalPath } as any,
    );

    // 2차 호출. 같은 video_id 에 force=false 면 duplicate.
    const dupDeps = {
      extractYoutube: vi.fn(),
      runAutoSummary: vi.fn(),
      git: { add: vi.fn(), commit: vi.fn(), push: vi.fn() },
      now: () => new Date('2026-05-09T13:00:00Z'),
      modelId: 'claude-sonnet-4-6',
    };
    const r = await processUrl(
      { url: 'https://youtu.be/abc', flags: { force: false, whisper: false }, note: '' },
      { ...dupDeps, repoLocalPath } as any,
    );
    expect(r.kind).toBe('duplicate');
    expect(dupDeps.git.push).not.toHaveBeenCalled();
    expect(dupDeps.extractYoutube).not.toHaveBeenCalled();
  });
});

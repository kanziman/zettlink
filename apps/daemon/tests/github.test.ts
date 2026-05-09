// octokit 으로 README + depth-2 디렉토리 트리 + 메타데이터를 받아 extract.md 본문을 만든다.
import { describe, it, expect, vi } from 'vitest';
import { extractGithub } from '../src/extractors/github.js';

describe('extractGithub', () => {
  it('README + 디렉토리 트리(depth 2) + 메타데이터를 수집한다', async () => {
    const fakeOctokit = {
      repos: {
        get: vi.fn().mockResolvedValue({ data: { stargazers_count: 100, language: 'TypeScript', topics: ['agents'] } }),
        getReadme: vi.fn().mockResolvedValue({ data: { content: Buffer.from('# Hello').toString('base64') } }),
        getContent: vi.fn()
          .mockResolvedValueOnce({ data: [{ type: 'dir', path: 'src' }, { type: 'file', path: 'README.md' }] })
          .mockResolvedValueOnce({ data: [{ type: 'file', path: 'src/index.ts' }] }),
      },
    };
    const r = await extractGithub(fakeOctokit as any, 'a', 'b');
    expect(r.meta).toEqual({ owner: 'a', repo: 'b', stars: 100, primary_language: 'TypeScript', topics: ['agents'] });
    expect(r.extract).toContain('# Hello');
    expect(r.extract).toContain('src/');
    expect(r.extract).toContain('src/index.ts');
  });
});

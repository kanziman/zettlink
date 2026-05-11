// vault 카드 폴더 스캔·읽기·쓰기 기능 테스트.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCards, cardFolderExists, writeCard, readCard } from '../src/vault.js';

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'zettlink-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const baseFm = {
  url: 'https://www.youtube.com/watch?v=abc',
  platform: 'youtube' as const,
  slug: 'sample',
  captured_at: '2026-05-09T12:00:00Z',
  title: 't',
  summary_one_line: 's',
  tags: ['ai'],
  status: 'summarized' as const,
  reviewed: false,
  published: false,
  note: '',
  generated: { deep: false, til: false, guide: false },
  llm: { model: 'claude-sonnet-4-6', truncated: false },
  youtube: {
    video_id: 'abc',
    channel: 'C',
    upload_date: '2026-05-08',
    duration_sec: 60,
    thumbnail: 'https://i.ytimg.com/vi/abc/m.jpg',
    subtitle_source: 'auto' as const,
  },
};

describe('vault', () => {
  it('writeCard 후 cardFolderExists 가 true 이고 readCard 가 같은 frontmatter 를 돌려준다', async () => {
    await writeCard(root, baseFm, '본문');
    expect(await cardFolderExists(root, 'youtube', 'sample', '2026-05-09')).toBe(true);
    const got = await readCard(root, 'youtube', '2026-05-09-sample');
    expect(got.frontmatter.slug).toBe('sample');
  });

  it('listCards 는 모든 플랫폼 폴더의 index.md 를 본문과 함께 카드로 반환한다', async () => {
    await writeCard(root, baseFm, 'first body');
    await writeCard(root, { ...baseFm, slug: 'second' }, 'second body');
    const cards = await listCards(root);
    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.body).sort()).toEqual(['first body\n', 'second body\n']);
  });
});
